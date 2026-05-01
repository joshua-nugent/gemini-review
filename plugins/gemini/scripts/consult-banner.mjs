#!/usr/bin/env node
// PreToolUse hook: if Claude is invoking the gemini-consultant subagent,
// write a loud banner to stderr so the user sees that it happened.
// Always exits 0 — never blocks the tool call.
import process from "node:process";

let raw = "";
process.stdin.on("data", (c) => {
  raw += c;
});
process.stdin.on("end", () => {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const subagent = event?.tool_input?.subagent_type;
  if (subagent !== "gemini-consultant") process.exit(0);

  const description = event?.tool_input?.description || "";
  const bar = "━".repeat(64);
  process.stderr.write(
    `\n${bar}\n🤝 CLAUDE IS CONSULTING GEMINI${description ? ` — ${description}` : ""}\n${bar}\n\n`
  );
  process.exit(0);
});
