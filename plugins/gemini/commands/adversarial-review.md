---
description: Get an adversarial second opinion from Gemini — attacks the design, not the bugs
argument-hint: '[--base <ref>] [--scope auto|working-tree|branch|codebase] [--model <name>] [focus text or codebase instructions]'
allowed-tools: Bash(node:*)
disable-model-invocation: true
---

Run an *adversarial* Gemini review.

Adversarial mode is different from `/gemini:review`. The regular review hunts
for bugs (correctness, edge cases, security holes). Adversarial review attacks
the design itself — questions the architecture, points out abstraction leaks,
names alternatives the author didn't consider, and assumes the approach is
wrong unless proven otherwise. Use it to stress-test a design decision, not
to catch implementation bugs.

This is a read-only second opinion. Do not fix issues, apply patches, or
suggest you are about to. Your only job is to run the review and return
Gemini's output verbatim.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" --rubric adversarial $ARGUMENTS
```
