export const PROVIDER = "mlx-core";
export const MODEL = "mlx-community/Qwen3.8-27B-4bit";
export const MODEL_REF = `${PROVIDER}/${MODEL}`;

export function isLocalModel(model) {
  return model?.provider === PROVIDER;
}

export function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// Normal Pi configuration, tools, extensions, credentials, and persistence.
// Only model selection and the local-session marker differ.
export function privateArgs(cli, runtime, prompt) {
  return [cli,
    "--provider", PROVIDER, "--model", MODEL,
    "--extension", runtime,
    "--name", "Private · local model", "--append-system-prompt", prompt,
  ];
}
