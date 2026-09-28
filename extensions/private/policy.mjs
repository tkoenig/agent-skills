export const PROVIDER = "mlx-core";
export const MODEL = "mlx-community/Qwen3.8-27B-4bit";
export const MODEL_REF = `${PROVIDER}/${MODEL}`;

export function isPrivateModel(model) {
  return model?.provider === PROVIDER && model?.id === MODEL &&
    model?.api === "openai-completions" && model?.baseUrl === "http://127.0.0.1:1/v1";
}

export function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// An allowlist, not a blacklist: no cloud credentials, proxy variables,
// Intercom identifiers, NODE_OPTIONS, or parent-session settings are inherited.
export function privateEnv(home, profile, source = process.env) {
  const env = {
    HOME: home,
    PATH: "/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    LANG: "en_US.UTF-8",
    TERM: source.TERM || "xterm-256color",
    COLORTERM: "truecolor",
    PI_CODING_AGENT_DIR: profile,
    PI_PRIVATE_PROFILE: profile,
    PI_OFFLINE: "1",
  };
  for (const key of ["TMPDIR", "TERM_PROGRAM", "TERMINFO", "TERMINFO_DIRS"]) {
    if (source[key]) env[key] = source[key];
  }
  return env;
}

export function privateArgs(cli, runtime, prompt) {
  return [cli,
    "--offline", "--no-approve", "--no-context-files",
    "--no-extensions", "--extension", runtime,
    "--no-skills", "--no-prompt-templates", "--no-themes", "--no-tools",
    "--no-session", "--provider", PROVIDER, "--model", MODEL,
    "--models", MODEL_REF, "--thinking", "low",
    "--name", "Private · local Qwen", "--system-prompt", prompt,
  ];
}
