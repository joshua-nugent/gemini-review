#!/usr/bin/env node
import { parseArgs } from "node:util";
import process from "node:process";
import { runGemini } from "./_run.mjs";

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

runGemini({ args: geminiArgs, errorLabel: "gemini-ask" });
