// Bounded polling overlay adapted from Armin Ronacher's pi-ds4 log viewer (MIT).
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, type Component, type TUI } from "@earendil-works/pi-tui";
import { open, stat } from "node:fs/promises";

export async function readLogTail(path: string): Promise<string[]> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return ["Log path is not a file"];
    const bytes = Math.min(info.size, 256 * 1024);
    const buffer = Buffer.alloc(bytes);
    const file = await open(path, "r");
    try { await file.read(buffer, 0, bytes, info.size - bytes); }
    finally { await file.close(); }
    let text = buffer.toString("utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/\r\n?/g, "\n");
    if (info.size > bytes) text = `[showing last ${bytes} bytes of ${info.size}]\n` + text.slice(text.indexOf("\n") + 1);
    return text.split("\n").slice(-2000);
  } catch (error: any) {
    return [error.code === "ENOENT" ? "No log yet" : `Could not read log: ${error.message}`];
  }
}

export async function showLogs(ctx: ExtensionCommandContext, paths: string[]): Promise<void> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify(`Local logs (not sent to model): ${paths.join(", ")}`, "info");
    return;
  }
  let viewer: LogViewer | undefined;
  try {
    await ctx.ui.custom<void>((tui, _theme, _keys, done) => {
      viewer = new LogViewer(tui, done, paths);
      return viewer;
    }, { overlay: true, overlayOptions: { width: "90%", minWidth: 40, maxHeight: "85%", anchor: "center", margin: 1 } });
  } finally { viewer?.dispose(); }
}

class LogViewer implements Component {
  private lines: string[] = [];
  private scroll = 0;
  private timer: ReturnType<typeof setInterval>;
  private selected = 0;
  private tui: TUI;
  private done: () => void;
  private paths: string[];
  constructor(tui: TUI, done: () => void, paths: string[]) {
    this.tui = tui;
    this.done = done;
    this.paths = paths;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), 1000);
    this.timer.unref?.();
  }
  private async refresh() {
    this.lines = await readLogTail(this.paths[this.selected]);
    this.tui.requestRender();
  }
  handleInput(data: string) {
    if (matchesKey(data, "escape") || data === "q") { this.done(); return; }
    if (matchesKey(data, "tab")) { this.selected = (this.selected + 1) % this.paths.length; this.scroll = 0; void this.refresh(); return; }
    const page = Math.max(1, Math.min(35, this.tui.terminal.rows - 8));
    if (matchesKey(data, "up") || data === "k") this.scroll++;
    else if (matchesKey(data, "down") || data === "j") this.scroll--;
    else if (matchesKey(data, "pageUp")) this.scroll += page;
    else if (matchesKey(data, "pageDown")) this.scroll -= page;
    else if (matchesKey(data, "home")) this.scroll = this.lines.length;
    else if (matchesKey(data, "end")) this.scroll = 0;
    this.scroll = Math.max(0, Math.min(this.scroll, this.lines.length - 1));
    this.tui.requestRender();
  }
  render(width: number): string[] {
    const height = Math.max(3, Math.min(40, this.tui.terminal.rows - 7));
    const start = Math.max(0, this.lines.length - height - this.scroll);
    const body = this.lines.slice(start, start + height);
    const row = (s: string) => truncateToWidth(s.replace(/[\x00-\x1f\x7f]/g, " "), Math.max(1, width));
    return [row(`MLX local log: ${this.paths[this.selected]}`), ...body.map(row), row("↑↓/Pg scroll · End follow · Tab switch log · q/Esc close")];
  }
  invalidate() {}
  dispose() { clearInterval(this.timer); }
}
