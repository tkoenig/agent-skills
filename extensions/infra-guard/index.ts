/**
 * Infrastructure Guard Extension
 *
 * Blocks SSH connections and infrastructure commands (Ansible, Terraform)
 * to prevent accidental remote server access. These commands should be
 * executed by the user, not the AI agent.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName !== "bash") return;

    const cmd = event.input.command || "";

    // Block SSH connections to any server
    // Matches: ssh user@host, ssh staging, ssh production, etc.
    if (/\bssh\s+\S+@/.test(cmd) || /\bssh\s+(staging|production|[\w-]+-\w+)/.test(cmd)) {
      return {
        block: true,
        reason: "SSH to remote servers is forbidden. The user must execute infrastructure commands themselves.",
      };
    }

    // Block Ansible playbook/task execution
    if (/\b(ansible-playbook|ansible)\s/.test(cmd)) {
      return {
        block: true,
        reason: "Ansible commands are forbidden. The user must execute infrastructure commands themselves.",
      };
    }

    // Block Terraform execution (apply, destroy, plan with -auto-approve, etc.)
    if (/\bterraform\s+(apply|destroy|plan|import|taint|untaint|state\s+rm)/.test(cmd)) {
      return {
        block: true,
        reason: "Terraform commands are forbidden. The user must execute infrastructure commands themselves.",
      };
    }

    // Block other remote execution tools
    if (/\b(rsync|scp)\s+.*@/.test(cmd)) {
      return {
        block: true,
        reason: "Remote file transfer commands are forbidden. The user must execute infrastructure commands themselves.",
      };
    }
  });
}
