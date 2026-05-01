---
description: Ask Gemini CLI a free-text question (read-only access to the repo)
argument-hint: '[--model <name>] <your question>'
allowed-tools: Bash(node:*)
disable-model-invocation: true
---

Forward a free-text query to Gemini CLI for a second opinion. Gemini gets
read-only access to the current working directory — it can read files,
search, and list directories, but cannot write or execute commands.

Return Gemini's response verbatim. Do not summarize, paraphrase, or take
action on what Gemini says.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ask.mjs" $ARGUMENTS
```
