---
description: Get a second-opinion code review from Gemini CLI
argument-hint: '[--base <ref>] [--scope auto|working-tree|branch|codebase] [--model <name>] [focus text or codebase instructions]'
allowed-tools: Bash(node:*)
---

Run a Gemini code review.

By default reviews current git changes (working tree if dirty, otherwise
branch vs the default branch). Pass `--scope codebase` plus instructions to
review the whole codebase instead — e.g. `--scope codebase audit for SQL
injection`.

This is a read-only second opinion. Do not fix issues, apply patches, or
suggest you are about to. Your only job is to run the review and return
Gemini's output verbatim.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" $ARGUMENTS
```
