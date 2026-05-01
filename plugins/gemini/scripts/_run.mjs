import { spawn } from "node:child_process";
import process from "node:process";

// Runs `gemini` with -o json appended, captures stdout, prints the
// response text plus a one-line token-usage footer, then exits.
// On any failure (spawn error, non-zero exit, malformed JSON) falls
// back to passing through whatever raw output was captured.
export function runGemini({ args, stdinInput, errorLabel }) {
  const child = spawn("gemini", [...args, "-o", "json"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: [stdinInput == null ? "ignore" : "pipe", "pipe", "inherit"],
  });

  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.on("error", (err) => {
    if (err.code === "ENOENT") {
      process.stderr.write(
        `${errorLabel}: gemini CLI not found on PATH. Install from https://github.com/google-gemini/gemini-cli\n`
      );
    } else {
      process.stderr.write(`${errorLabel}: failed to launch gemini CLI: ${err.message}\n`);
    }
    process.exit(1);
  });

  if (stdinInput != null) {
    child.stdin.on("error", () => {});
    child.stdin.end(stdinInput);
  }

  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    if (code !== 0) {
      process.stdout.write(stdout);
      process.exit(code ?? 1);
    }
    emitFromJson(stdout);
    process.exit(0);
  });
}

function emitFromJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stdout.write(raw);
    return;
  }
  const text = typeof parsed.response === "string" ? parsed.response : raw;
  process.stdout.write(text);
  if (!text.endsWith("\n")) process.stdout.write("\n");
  const footer = formatTokenFooter(parsed?.stats?.models);
  if (footer) process.stdout.write(footer + "\n");
}

function formatTokenFooter(models) {
  if (!models || typeof models !== "object") return null;
  let input = 0;
  let output = 0;
  let total = 0;
  let reasoning = 0;
  let tool = 0;
  let modelName = null;
  for (const [name, m] of Object.entries(models)) {
    const t = m?.tokens || {};
    input += Number(t.input || t.prompt || 0);
    output += Number(t.candidates || 0);
    total += Number(t.total || 0);
    reasoning += Number(t.thoughts || 0);
    tool += Number(t.tool || 0);
    if (!modelName) modelName = name;
  }
  if (total === 0 && input === 0 && output === 0) return null;
  const fmt = (n) => n.toLocaleString("en-US");
  const parts = [`${fmt(input)} in`, `${fmt(output)} out`];
  if (reasoning > 0) parts.push(`${fmt(reasoning)} reasoning`);
  if (tool > 0) parts.push(`${fmt(tool)} tool`);
  return `\n— ${fmt(total)} tokens · ${parts.join(" / ")}${modelName ? ` · ${modelName}` : ""}`;
}
