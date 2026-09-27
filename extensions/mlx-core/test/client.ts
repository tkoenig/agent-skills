import { createLifecycle } from "../lifecycle.ts";
const manager = createLifecycle(JSON.parse(process.env.MLX_TEST_OPTIONS!));
process.on("message", async (command: string) => {
  try {
    if (command === "ensure") process.send?.({ state: await manager.ensure() });
    if (command === "release") { await manager.release(); process.send?.({ released: true }); }
    if (command === "quit") { await manager.dispose("quit"); process.send?.({ quit: true }); process.disconnect(); }
    if (command === "crash") process.exit(0);
  } catch (error) { process.send?.({ error: String(error) }); }
});
process.send?.({ ready: true });
