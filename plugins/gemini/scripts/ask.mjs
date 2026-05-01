#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import process from "node:process";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    model: { type: "string" },
  },
  allowPositionals: true,
});

const prompt = positionals.join(" ").trim();
if (!prompt) {
  process.stderr.write(
    "gemini-ask: usage: /gemini:ask [--model <name>] <your question>\n"
  );
  process.exit(1);
}

const geminiArgs = ["-p", prompt, "--approval-mode", "plan", "--skip-trust"];
if (values.model) geminiArgs.push("-m", values.model);

const child = spawn("gemini", geminiArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "inherit", "inherit"],
});

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    process.stderr.write(
      "gemini-ask: gemini CLI not found on PATH. Install from https://github.com/google-gemini/gemini-cli\n"
    );
    process.exit(1);
  }
  process.stderr.write(`gemini-ask: failed to launch gemini CLI: ${err.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
