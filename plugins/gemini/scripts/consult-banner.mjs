#!/usr/bin/env node
// PreToolUse hook for gemini-consultant subagent invocations.
// Writes an audit log to /tmp/gemini-consult-hook.log on every PreToolUse
// so we can verify the hook is being called at all, then tries multiple
// display mechanisms (stderr, stdout JSON additionalContext) to surface
// a banner to the user.
// Always exits 0 — never blocks the tool call.
import process from "node:process";
import fs from "node:fs";

const LOG_PATH = "/tmp/gemini-consult-hook.log";

let raw = "";
process.stdin.on("data", (c) => {
  raw += c;
});
process.stdin.on("end", () => {
  // Always append a log line — proves whether the hook fired at all.
  const ts = new Date().toISOString();
  try {
    fs.appendFileSync(LOG_PATH, `${ts} stdin=${raw.replace(/\n/g, "\\n")}\n`);
  } catch {
    // ignore log failures
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Only act if this is the gemini-consultant subagent.
  // Plugin namespacing means the value may be "gemini:gemini-consultant"
  // rather than the bare "gemini-consultant".
  const subagent = event?.tool_input?.subagent_type || "";
  if (!subagent.endsWith("gemini-consultant")) process.exit(0);

  const description = event?.tool_input?.description || "";
  const bar = "━".repeat(64);
  const banner = `\n${bar}\n🤝 CLAUDE IS CONSULTING GEMINI${description ? ` — ${description}` : ""}\n${bar}\n`;

  // Mechanism 1: stderr (some sources say this surfaces to transcript on
  // non-zero exit, others say it never surfaces from plugin hooks).
  process.stderr.write(banner + "\n");

  // Mechanism 2: stdout JSON with additionalContext — gets injected into
  // Claude's context so Claude can mention it.
  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: banner.trim(),
    },
  };
  process.stdout.write(JSON.stringify(out));

  process.exit(0);
});
