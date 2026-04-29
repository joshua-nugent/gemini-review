---
description: Get a second-opinion code review from Gemini CLI
argument-hint: '[--base <ref>] [--scope auto|working-tree|branch] [--model <name>] [focus text]'
allowed-tools: Bash(node:*)
---

Run a Gemini code review on the current git state.

This is a read-only second opinion. Do not fix issues, apply patches, or
suggest you are about to. Your only job is to run the review and return
Gemini's output verbatim.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" $ARGUMENTS
```
