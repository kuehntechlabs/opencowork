import * as api from "../api/client";

export function parseSlashCommand(text: string): {
  command: string;
  args: string;
} | null {
  const value = text.trim();
  if (!value.startsWith("/")) return null;
  const [head, ...tail] = value.split(/\s+/);
  const command = head.slice(1).trim();
  if (!command) return null;
  return {
    command,
    args: tail.join(" "),
  };
}

export async function executeKnownCustomSlashCommand(input: {
  sessionId: string;
  text: string;
  model?: string;
  variant?: string;
  directory?: string;
}) {
  const parsed = parseSlashCommand(input.text);
  if (!parsed) return false;
  const commands = await api.listCommands();
  const normalized = parsed.command.toLowerCase();
  const known = commands.some((cmd) => cmd.name.toLowerCase() === normalized);
  if (!known) return false;
  await api.executeCommand(
    input.sessionId,
    normalized,
    parsed.args,
    {
      model: input.model,
      variant: input.variant,
    },
    input.directory,
  );
  return true;
}
