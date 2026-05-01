#!/usr/bin/env node
// PreToolUse hook for the gemini-consultant subagent.
//
// Three notification channels, none of which fight with Claude Code's TUI:
//   1. Audit log:    appends to ~/.claude/gemini-consult.log so the user can
//                    `tail -f` for live monitoring or audit history later.
//   2. macOS notif:  pops a Notification Center banner via osascript.
//   3. additionalContext: injects the banner into Claude's prompt context so
//                    Claude itself is aware of the consultation.
//
// Always exits 0 — the hook never blocks the tool call.
import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const LOG_PATH = path.join(os.homedir(), ".claude", "gemini-consult.log");

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

  const subagent = event?.tool_input?.subagent_type || "";
  if (!subagent.endsWith("gemini-consultant")) process.exit(0);

  const description = event?.tool_input?.description || "(no description)";
  const ts = new Date().toISOString();
  const banner = `🤝 CLAUDE IS CONSULTING GEMINI — ${description}`;

  // Channel 1: audit log
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, `${ts} ${description}\n`);
  } catch {
    // ignore log failures
  }

  // Channel 2: macOS notification
  if (process.platform === "darwin") {
    try {
      const safe = description.replace(/["\\]/g, "");
      execFileSync(
        "osascript",
        [
          "-e",
          `display notification "${safe}" with title "🤝 Claude is consulting Gemini"`,
        ],
        { timeout: 2000, stdio: "ignore" }
      );
    } catch {
      // osascript may be missing or sandboxed — fail silently
    }
  }

  // Channel 3: additionalContext for Claude
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
