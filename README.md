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

```
/gemini-review:review
/gemini-review:review --base main
/gemini-review:review --scope working-tree
/gemini-review:review --model gemini-2.5-pro focus on the new auth code
```

| Flag | Default | Notes |
|---|---|---|
| `--base <ref>` | auto-detected (origin/HEAD → main → master → trunk) | Compare branch against this ref. |
| `--scope auto\|working-tree\|branch` | `auto` | `auto` picks `working-tree` if dirty, otherwise `branch`. |
| `--model <name>` | Gemini CLI default | Passed through to `gemini -m`. |
| trailing text | — | Appended to the prompt as additional focus. |

The command is read-only: Gemini gets `--approval-mode plan` so it cannot
write files. It returns findings in `[SEVERITY] file:line — title` form and a
final `VERDICT:` line.

## How it works

`commands/review.md` invokes `scripts/review.mjs`, which:

1. Picks a target (working tree diff, or `merge-base..HEAD` against the base ref).
2. Builds a prompt containing the diff + a senior-engineer review rubric.
3. Pipes that prompt to `gemini -p ... --approval-mode plan` and streams the
   response back through Claude Code.

## Inspiration

Modeled as a stripped-down version of
[abiswas97/gemini-plugin-cc](https://github.com/abiswas97/gemini-plugin-cc)
(which itself is based on `openai/codex-plugin-cc`). That plugin has the full
feature set — background jobs, ACP companion, review gate, rescue subagent.
This one is just the single-shot review.

## License

MIT.
