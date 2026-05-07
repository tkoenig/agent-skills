/**
 * Current PR Extension
 *
 * Local, non-blocking replacement for npm:pi-pr-status.
 *
 * Key differences from the original:
 * - no execSync; all git/gh calls go through async pi.exec()
 * - no shell interpolation; all arguments are passed as argv arrays
 * - input handlers never await network calls
 * - refreshes are skipped while pi is busy, then resumed when idle
 * - custom footer keeps the default pi footer shape and places PR status top-right
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExecResult, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

interface CheckStatus {
  total: number;
  pass: number;
  fail: number;
  pending: number;
}

interface PrInfo {
  number: number;
  title: string;
  url: string;
  state: string;
  checks: CheckStatus;
  unresolvedThreads: number;
}

interface RepoInfo {
  owner: string;
  name: string;
}

const STATUS_KEY = "current-pr";
const POLL_WITH_PR_MS = 30_000;
const POLL_WITHOUT_PR_MS = 5 * 60_000;
const MAX_STATUS_WIDTH = 92;

const PR_URL_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/;
const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes { isResolved }
      }
    }
  }
}`;

function parsePrUrl(text: string): { repo: string; owner: string; name: string; number: number } | null {
  const raw = text.match(/https:\/\/github\.com\/\S+\/\S+\/pull\/\d+(?:[/?#]\S*)?/u)?.[0];
  if (!raw) return null;

  const parsed = raw.match(PR_URL_RE);
  if (!parsed) return null;

  const [, owner, name, number] = parsed;
  if (!owner || !name || !number) return null;

  return {
    repo: `${owner}/${name}`,
    owner,
    name,
    number: Number.parseInt(number, 10),
  };
}

function parseChecks(statusCheckRollup: unknown[]): CheckStatus {
  const checks: CheckStatus = { total: 0, pass: 0, fail: 0, pending: 0 };

  for (const check of statusCheckRollup) {
    const c = check as Record<string, string | undefined>;
    const conclusion = (c.conclusion || "").toUpperCase();
    const status = (c.status || "").toUpperCase();
    const name = c.name || "";

    // Skip ghost checks with no meaningful data (for example deployment placeholders).
    if (!name && !conclusion && !status) continue;

    checks.total += 1;

    if (["SUCCESS", "NEUTRAL", "SKIPPED"].includes(conclusion)) {
      checks.pass += 1;
    } else if (["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(conclusion)) {
      checks.fail += 1;
    } else if (["IN_PROGRESS", "QUEUED", "PENDING", "WAITING"].includes(status)) {
      checks.pending += 1;
    } else if (status === "COMPLETED") {
      checks.pass += 1;
    } else {
      checks.pending += 1;
    }
  }

  return checks;
}

function prFromJson(pr: Record<string, unknown>, unresolvedThreads: number): PrInfo | undefined {
  if (typeof pr.number !== "number" || typeof pr.url !== "string") return undefined;

  return {
    number: pr.number,
    title: typeof pr.title === "string" ? pr.title : "",
    url: pr.url,
    state: typeof pr.state === "string" ? pr.state : "UNKNOWN",
    checks: Array.isArray(pr.statusCheckRollup)
      ? parseChecks(pr.statusCheckRollup)
      : { total: 0, pass: 0, fail: 0, pending: 0 },
    unresolvedThreads,
  };
}

function checkSummary(pr: PrInfo): { icon: string; text: string } | undefined {
  if (pr.checks.total === 0) return undefined;

  if (pr.checks.fail > 0) return { icon: "❌", text: `${pr.checks.fail}/${pr.checks.total} failed` };
  if (pr.checks.pending > 0) return { icon: "⏳", text: `${pr.checks.pending}/${pr.checks.total} pending` };
  return { icon: "✅", text: `${pr.checks.total} checks` };
}

function plainStatus(pr: PrInfo): string {
  const parts: string[] = [];
  const checks = checkSummary(pr);
  const prLabel = `PR #${pr.number}`;

  if (pr.state === "CLOSED") {
    parts.push(`🚫 ${prLabel}`);
    if (checks) parts.push(checks.text);
  } else {
    parts.push(checks ? `${checks.icon} ${prLabel}` : prLabel);
    if (pr.state === "MERGED") parts.push("merged");
    if (checks) parts.push(checks.text);
  }

  if (pr.unresolvedThreads > 0) {
    parts.push(`💬 ${pr.unresolvedThreads}`);
  }

  return parts.join(" · ");
}

function terminalLink(text: string, url: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

function linkedStatus(pr: PrInfo): string {
  return plainStatus(pr).replace(`PR #${pr.number}`, terminalLink(`PR #${pr.number}`, pr.url));
}

function sanitizeStatusText(text: string): string {
  return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

export default function (pi: ExtensionAPI) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentAbort: AbortController | undefined;
  let latestCtx: ExtensionContext | undefined;
  let currentPr: PrInfo | undefined;
  let pinnedPr: { repo: string; owner: string; name: string; number: number } | undefined;
  let refreshInFlight = false;
  let refreshPending = false;
  let customFooterEnabled = true;

  async function exec(command: string, args: string[], options: { cwd?: string; timeout: number }): Promise<ExecResult> {
    currentAbort = new AbortController();
    try {
      return await pi.exec(command, args, {
        cwd: options.cwd,
        timeout: options.timeout,
        signal: currentAbort.signal,
      });
    } finally {
      currentAbort = undefined;
    }
  }

  async function execJson<T>(command: string, args: string[], options: { cwd?: string; timeout: number }): Promise<T | undefined> {
    const result = await exec(command, args, options);
    if (result.code !== 0 || !result.stdout.trim()) return undefined;

    try {
      return JSON.parse(result.stdout) as T;
    } catch {
      return undefined;
    }
  }

  async function getUnresolvedThreads(cwd: string | undefined, repo: RepoInfo, prNumber: number): Promise<number> {
    const data = await execJson<{
      data?: { repository?: { pullRequest?: { reviewThreads?: { nodes?: Array<{ isResolved?: boolean }> } } } };
    }>(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=${REVIEW_THREADS_QUERY}`,
        "-F",
        `owner=${repo.owner}`,
        "-F",
        `name=${repo.name}`,
        "-F",
        `number=${prNumber}`,
      ],
      { cwd, timeout: 10_000 },
    );

    const threads = data?.data?.repository?.pullRequest?.reviewThreads?.nodes;
    return Array.isArray(threads) ? threads.filter((thread) => !thread.isResolved).length : 0;
  }

  async function getPrByNumber(cwd: string, pinned: NonNullable<typeof pinnedPr>): Promise<PrInfo | undefined> {
    const pr = await execJson<Record<string, unknown>>(
      "gh",
      [
        "pr",
        "view",
        String(pinned.number),
        "--repo",
        pinned.repo,
        "--json",
        "number,title,url,state,statusCheckRollup",
      ],
      { cwd, timeout: 10_000 },
    );
    if (!pr) return undefined;

    const unresolvedThreads = await getUnresolvedThreads(undefined, { owner: pinned.owner, name: pinned.name }, pinned.number);
    return prFromJson(pr, unresolvedThreads);
  }

  async function getPrForBranch(cwd: string): Promise<PrInfo | undefined> {
    const pr = await execJson<Record<string, unknown>>(
      "gh",
      ["pr", "view", "--json", "number,title,url,state,statusCheckRollup"],
      { cwd, timeout: 10_000 },
    );
    if (!pr) return undefined;

    const number = typeof pr.number === "number" ? pr.number : undefined;
    const repoFromUrl = typeof pr.url === "string" ? parsePrUrl(pr.url) : null;
    const repo = repoFromUrl ? { owner: repoFromUrl.owner, name: repoFromUrl.name } : undefined;
    const unresolvedThreads = repo && number ? await getUnresolvedThreads(cwd, repo, number) : 0;
    return prFromJson(pr, unresolvedThreads);
  }

  function setCurrentPr(pr: PrInfo | undefined, ctx: ExtensionContext): void {
    currentPr = pr;

    if (customFooterEnabled) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    } else {
      ctx.ui.setStatus(STATUS_KEY, pr ? `${plainStatus(pr)} · ${pr.url}` : undefined);
    }
  }

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function scheduleRefresh(delayMs = 0): void {
    clearTimer();
    timer = setTimeout(() => {
      void refresh();
    }, delayMs);
  }

  function scheduleNextPoll(): void {
    scheduleRefresh(currentPr || pinnedPr ? POLL_WITH_PR_MS : POLL_WITHOUT_PR_MS);
  }

  async function refresh(force = false): Promise<void> {
    const ctx = latestCtx;
    if (!ctx) return;

    if (!force && !ctx.isIdle()) {
      refreshPending = true;
      return;
    }

    if (refreshInFlight) {
      refreshPending = true;
      return;
    }

    refreshInFlight = true;
    refreshPending = false;

    try {
      let pr: PrInfo | undefined;

      if (pinnedPr) {
        pr = await getPrByNumber(ctx.cwd, pinnedPr);

        // Prefer the current branch once it has an open PR of its own.
        const branchPr = await getPrForBranch(ctx.cwd);
        if (branchPr?.state === "OPEN") {
          pinnedPr = undefined;
          pr = branchPr;
        }
      } else {
        pr = await getPrForBranch(ctx.cwd);
      }

      setCurrentPr(pr, ctx);
    } catch {
      // Keep the previous status on transient gh/network failures.
    } finally {
      refreshInFlight = false;

      if (refreshPending) {
        scheduleRefresh(1000);
      } else {
        scheduleNextPoll();
      }
    }
  }

  function tryPinFromUrl(text: string, ctx: ExtensionContext): void {
    const parsed = parsePrUrl(text);
    if (!parsed) return;

    if (currentPr?.state === "OPEN") return;
    if (pinnedPr?.repo === parsed.repo && pinnedPr.number === parsed.number) return;

    pinnedPr = parsed;
    latestCtx = ctx;
    scheduleRefresh(0);
  }

  function installFooter(ctx: ExtensionContext): void {
    if (!ctx.hasUI || !customFooterEnabled) return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsubscribeBranch = footerData.onBranchChange(() => {
        refreshPending = true;
        scheduleRefresh(0);
        tui.requestRender();
      });

      return {
        dispose: unsubscribeBranch,
        invalidate() {},
        render(width: number): string[] {
          let totalInput = 0;
          let totalOutput = 0;
          let totalCacheRead = 0;
          let totalCacheWrite = 0;
          let totalCost = 0;

          for (const entry of ctx.sessionManager.getEntries()) {
            if (entry.type === "message" && entry.message.role === "assistant") {
              const message = entry.message as AssistantMessage;
              totalInput += message.usage.input;
              totalOutput += message.usage.output;
              totalCacheRead += message.usage.cacheRead;
              totalCacheWrite += message.usage.cacheWrite;
              totalCost += message.usage.cost.total;
            }
          }

          let pwd = ctx.sessionManager.getCwd();
          const home = process.env.HOME || process.env.USERPROFILE;
          if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;

          const branch = footerData.getGitBranch();
          if (branch) pwd = `${pwd} (${branch})`;

          const sessionName = ctx.sessionManager.getSessionName();
          if (sessionName) pwd = `${pwd} • ${sessionName}`;

          const prStatus = currentPr ? theme.fg("accent", linkedStatus(currentPr)) : "";
          const prStatusWidth = Math.min(visibleWidth(prStatus), Math.min(MAX_STATUS_WIDTH, Math.floor(width * 0.58)));
          const leftWidth = prStatus ? Math.max(10, width - prStatusWidth - 2) : width;
          const left = truncateToWidth(theme.fg("dim", pwd), leftWidth, theme.fg("dim", "..."));
          const leftActualWidth = visibleWidth(left);

          let pwdLine = left;
          if (prStatus) {
            const right = truncateToWidth(prStatus, Math.max(0, width - leftActualWidth - 2), "");
            const padding = " ".repeat(Math.max(1, width - leftActualWidth - visibleWidth(right)));
            pwdLine = truncateToWidth(left + padding + right, width, "");
          }

          const statsParts: string[] = [];
          if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
          if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
          if (totalCacheRead) statsParts.push(`R${formatTokens(totalCacheRead)}`);
          if (totalCacheWrite) statsParts.push(`W${formatTokens(totalCacheWrite)}`);

          const usingSubscription = ctx.model ? ctx.modelRegistry.isUsingOAuth(ctx.model) : false;
          if (totalCost || usingSubscription) {
            statsParts.push(`$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`);
          }

          const contextUsage = ctx.getContextUsage();
          const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
          const contextPercentValue = contextUsage?.percent ?? 0;
          const contextPercentDisplay = contextUsage?.percent === null || contextUsage?.percent === undefined
            ? `?/${formatTokens(contextWindow)} (auto)`
            : `${contextPercentValue.toFixed(1)}%/${formatTokens(contextWindow)} (auto)`;

          if (contextPercentValue > 90) {
            statsParts.push(theme.fg("error", contextPercentDisplay));
          } else if (contextPercentValue > 70) {
            statsParts.push(theme.fg("warning", contextPercentDisplay));
          } else {
            statsParts.push(contextPercentDisplay);
          }

          let statsLeft = statsParts.join(" ");
          let statsLeftWidth = visibleWidth(statsLeft);
          if (statsLeftWidth > width) {
            statsLeft = truncateToWidth(statsLeft, width, "...");
            statsLeftWidth = visibleWidth(statsLeft);
          }

          const modelName = ctx.model?.id || "no-model";
          const thinkingLevel = pi.getThinkingLevel();
          let rightSideWithoutProvider = modelName;
          if (ctx.model?.reasoning) {
            rightSideWithoutProvider = thinkingLevel === "off"
              ? `${modelName} • thinking off`
              : `${modelName} • ${thinkingLevel}`;
          }

          let rightSide = rightSideWithoutProvider;
          if (footerData.getAvailableProviderCount() > 1 && ctx.model) {
            const withProvider = `(${ctx.model.provider}) ${rightSideWithoutProvider}`;
            if (statsLeftWidth + 2 + visibleWidth(withProvider) <= width) rightSide = withProvider;
          }

          const rightSideWidth = visibleWidth(rightSide);
          let statsLine: string;
          if (statsLeftWidth + 2 + rightSideWidth <= width) {
            statsLine = statsLeft + " ".repeat(width - statsLeftWidth - rightSideWidth) + rightSide;
          } else {
            const availableForRight = width - statsLeftWidth - 2;
            if (availableForRight > 0) {
              const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
              statsLine = statsLeft + " ".repeat(Math.max(0, width - statsLeftWidth - visibleWidth(truncatedRight))) + truncatedRight;
            } else {
              statsLine = statsLeft;
            }
          }

          const lines = [pwdLine, theme.fg("dim", statsLine)];
          const extensionStatuses = footerData.getExtensionStatuses();
          const otherStatuses = Array.from(extensionStatuses.entries())
            .filter(([key]) => key !== STATUS_KEY)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => sanitizeStatusText(text));

          if (otherStatuses.length > 0) {
            lines.push(truncateToWidth(otherStatuses.join(" "), width, theme.fg("dim", "...")));
          }

          return lines;
        },
      };
    });
  }

  pi.registerCommand("current-pr", {
    description: "Refresh, pin, clear, or toggle the fast PR status footer",
    handler: async (args, ctx) => {
      latestCtx = ctx;
      const trimmed = args.trim();

      if (trimmed === "footer off") {
        customFooterEnabled = false;
        ctx.ui.setFooter(undefined);
        setCurrentPr(currentPr, ctx);
        ctx.ui.notify("Current PR custom footer off", "info");
        return;
      }

      if (trimmed === "footer on") {
        customFooterEnabled = true;
        ctx.ui.setStatus(STATUS_KEY, undefined);
        installFooter(ctx);
        ctx.ui.notify("Current PR custom footer on", "info");
        return;
      }

      if (trimmed === "clear") {
        pinnedPr = undefined;
        setCurrentPr(undefined, ctx);
        scheduleRefresh(0);
        ctx.ui.notify("PR pin cleared", "info");
        return;
      }

      const parsed = parsePrUrl(trimmed);
      if (parsed) {
        pinnedPr = parsed;
        await refresh(true);
        ctx.ui.notify(currentPr ? plainStatus(currentPr) : "PR not found", currentPr ? "info" : "warning");
        return;
      }

      await refresh(true);
      ctx.ui.notify(currentPr ? plainStatus(currentPr) : "No PR detected for this branch", currentPr ? "info" : "warning");
    },
  });

  pi.on("input", async (event, ctx) => {
    if (event.source !== "extension") {
      latestCtx = ctx;
      tryPinFromUrl(event.text, ctx);
    }

    return { action: "continue" as const };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    latestCtx = ctx;
    tryPinFromUrl(event.prompt, ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    latestCtx = ctx;
    if (refreshPending) scheduleRefresh(0);
  });

  pi.on("session_start", async (_event, ctx) => {
    latestCtx = ctx;
    installFooter(ctx);
    scheduleRefresh(250);
  });

  pi.on("session_shutdown", async () => {
    clearTimer();
    currentAbort?.abort();
  });
}
