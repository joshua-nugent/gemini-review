# gemini

A small Claude Code plugin that exposes the
[Gemini CLI](https://github.com/google-gemini/gemini-cli) as two slash
commands so you can get a second opinion without leaving Claude Code:

- `/gemini:review` — read-only code review of your current git state (or
  the whole codebase via `--scope codebase`).
- `/gemini:ask` — free-text query forwarded to Gemini, with read-only
  access to the working directory if Gemini wants to consult files.

## Requirements

- **Gemini CLI** installed and on your `PATH`, with credentials configured
  (either `GOOGLE_API_KEY` or `gcloud auth application-default login`).
- **Node.js 18+**.
- For `/gemini:review`: a git repository.

## Install

In Claude Code:

```
/plugin marketplace add joshua-nugent/gemini-review
/plugin install gemini@joshua-nugent-gemini-review
```

Then `/reload-plugins` and you should see `/gemini:review` and `/gemini:ask`.

## Usage

### `/gemini:ask` — free-text second opinion

```
/gemini:ask in one paragraph, when should i prefer rust over go for a cli tool
/gemini:ask what does scripts/review.mjs do
/gemini:ask --model gemini-2.5-pro how should i think about prompt caching
```

Gemini runs in `--approval-mode plan` — it can read files, search, and list
directories, but cannot write or execute commands.

### `/gemini:review` — code review

Review current git changes (default):

```
/gemini:review
/gemini:review --base main
/gemini:review --scope working-tree
/gemini:review --model gemini-2.5-pro focus on the new auth code
```

Review the whole codebase against free-form instructions:

```
/gemini:review --scope codebase audit for SQL injection
/gemini:review --scope codebase look for missing input validation in the API handlers
/gemini:review --scope codebase --model gemini-2.5-pro review concurrency in the worker pool
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

Each command in `commands/*.md` invokes a Node script in `scripts/` that
shells out to the `gemini` CLI with the relevant flags and streams the
response back. Both commands set `disable-model-invocation: true` — only
the user can trigger them, Claude can't auto-invoke.

## Inspiration

Modeled as a stripped-down version of
[abiswas97/gemini-plugin-cc](https://github.com/abiswas97/gemini-plugin-cc)
(which itself is based on `openai/codex-plugin-cc`). That plugin has the full
feature set — background jobs, ACP companion, review gate, rescue subagent.
This one is just the two single-shot commands.

## License

MIT.
