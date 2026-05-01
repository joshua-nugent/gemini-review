---
description: Check whether the local Gemini CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup --json $ARGUMENTS
```

If the result says Gemini is unavailable:
- Tell the user to install the Gemini CLI. Refer them to https://developers.google.com/gemini-cli
- Do not attempt to install it yourself.

If Gemini is installed but not authenticated:
- Tell the user to set the `GOOGLE_API_KEY` environment variable or configure Application Default Credentials.
- Preserve any guidance in the setup output.

If setup passes but `/gemini:review`, `/gemini:rescue`, or `/gemini:task` fail with "ACP initialize timed out":
- Tell the user to set `GEMINI_ACP_INIT_TIMEOUT_MS` to a higher value (e.g. `60000`). Common on Homebrew installs where keytar falls back to a file-based keychain.

Output rules:
- Present the final setup output to the user.
