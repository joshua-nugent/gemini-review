# Changelog

## [1.0.1] - 2026-04-19

### Added

- Session resume support for Gemini tasks (#8) (thanks @patelnav)
- `last-review` subcommand to retrieve the most recent review result (#4) (thanks @Co-Messi)
- Review→rescue context handoff via per-repo save (#4) (thanks @Co-Messi)
- Release pipeline with CHANGELOG automation (#14)

### Fixed

- ACP init timeout raised to 30 s; child process is now killed on timeout (#9)
- `resolveInitTimeoutMs` now reads from the spawned process env, not the parent env (#9)
- Permission handler updated to nested ACP shape required by Gemini CLI ≥ 0.36.0 (#7) (thanks @GrimoireScribe)
- Adversarial-review prompt verdicts aligned with JSON schema (#6) (thanks @Co-Messi)
- EPIPE crash on stdin error; review output aligned with Codex format (#5) (thanks @Co-Messi)
- Dangling `confidence` reference removed after field was dropped (#5) (thanks @Co-Messi)

### Changed

- README updated with current model aliases and `GEMINI_ACP_INIT_TIMEOUT_MS` documentation (#9)

