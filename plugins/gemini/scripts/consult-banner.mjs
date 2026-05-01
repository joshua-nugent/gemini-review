#!/usr/bin/env node
// PreToolUse hook for the gemini-consultant subagent.
// Prints a banner that the user can see in their transcript whenever
// Claude auto-invokes the consultant — independent of whether Claude
// itself decides to announce the consultation.
//
// Mechanism: write banner to stderr and exit with code 1. Per Claude
// Code's hook contract, exit codes other than 0/2 are treated as a
// "non-blocking error" — the tool call still proceeds, but stderr is
// surfaced in the user's transcript. We also emit additionalContext
// on stdout so Claude itself sees the banner in its context.
import process from "node:process";
import fs from "node:fs";

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

  // Only fire for the gemini-consultant subagent.
  const subagent = event?.tool_input?.subagent_type || "";
  if (!subagent.endsWith("gemini-consultant")) process.exit(0);

  const description = event?.tool_input?.description || "";
  const bar = "━".repeat(64);
  const banner = `${bar}\n🤝 CLAUDE IS CONSULTING GEMINI${description ? ` — ${description}` : ""}\n${bar}`;

  // Channel 1: /dev/tty — direct write to the controlling terminal,
  // bypassing whatever stdio handling Claude Code does for hook output.
  try {
    fs.writeFileSync("/dev/tty", "\n" + banner + "\n\n");
  } catch {
    // No TTY available (e.g. CI / wrapped session) — fall through.
  }

  // Channel 2: stderr (debugging — may or may not surface).
  process.stderr.write(banner + "\n");

  // Channel 3: additionalContext for Claude's awareness (always works).
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: banner,
      },
    })
  );

  process.exit(0);
});
