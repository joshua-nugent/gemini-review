# gemini-review

A small Claude Code plugin: run a one-shot, read-only code review from the
[Gemini CLI](https://github.com/google-gemini/gemini-cli) on your current git
state without leaving Claude Code.

## Requirements

- **Gemini CLI** installed and on your `PATH`, with credentials configured
  (either `GOOGLE_API_KEY` or `gcloud auth application-default login`).
- **Node.js 18+**.
- A git repository (the command operates on `git diff` / `git log`).

## Install

In Claude Code:

```
/plugin marketplace add joshua-nugent/gemini-review
/plugin install gemini-review@joshua-nugent-gemini-review
```

Then reload plugins (`/reload-plugins`) and you should see `/gemini-review:review`.

## Usage

Review current git changes (default):

```
/gemini-review:review
/gemini-review:review --base main
/gemini-review:review --scope working-tree
/gemini-review:review --model gemini-2.5-pro focus on the new auth code
```

Review the whole codebase against free-form instructions:

```
/gemini-review:review --scope codebase audit for SQL injection
/gemini-review:review --scope codebase look for missing input validation in the API handlers
/gemini-review:review --scope codebase --model gemini-2.5-pro review concurrency in the worker pool
```

| Flag | Default | Notes |
|---|---|---|
| `--base <ref>` | auto-detected (origin/HEAD → main → master → trunk) | Compare branch against this ref. Ignored under `--scope codebase`. |
| `--scope auto\|working-tree\|branch\|codebase` | `auto` | `auto` picks `working-tree` if dirty, otherwise `branch`. `codebase` skips git entirely and lets Gemini explore the repo. |
| `--model <name>` | Gemini CLI default | Passed through to `gemini -m`. |
| trailing text | — | For diff scopes, additional focus. For `--scope codebase`, the primary review instruction (required). |

The command is read-only: Gemini gets `--approval-mode plan` so it can read
files and run searches but cannot write or execute. It returns findings in
`[SEVERITY] file:line — title` form and a final `VERDICT:` line.

## How it works

`commands/review.md` invokes `scripts/review.mjs`, which:

1. **Diff scopes (`auto`, `working-tree`, `branch`).** Picks a target
   (working tree diff, or `merge-base..HEAD` against the base ref) and builds
   a prompt containing the diff + a senior-engineer review rubric.
2. **Codebase scope (`codebase`).** Skips git, builds a prompt that asks
   Gemini to explore the repo using its read-only file/search tools to
   address the user's instructions.
3. Pipes the prompt to `gemini -p ... --approval-mode plan` and streams the
   response back through Claude Code.

## Inspiration

Modeled as a stripped-down version of
[abiswas97/gemini-plugin-cc](https://github.com/abiswas97/gemini-plugin-cc)
(which itself is based on `openai/codex-plugin-cc`). That plugin has the full
feature set — background jobs, ACP companion, review gate, rescue subagent.
This one is just the single-shot review.

## License

MIT.
