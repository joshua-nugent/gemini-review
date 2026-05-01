#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import process from "node:process";
import { runGemini } from "./_run.mjs";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    base: { type: "string" },
    scope: { type: "string", default: "auto" },
    model: { type: "string" },
    rubric: { type: "string", default: "review" },
  },
  allowPositionals: true,
});

const cwd = process.cwd();
const focusText = positionals.join(" ").trim();

const validScopes = new Set(["auto", "working-tree", "branch", "codebase"]);
if (!validScopes.has(values.scope)) {
  fail(`--scope must be one of: auto, working-tree, branch, codebase (got "${values.scope}")`);
}

const validRubrics = new Set(["review", "adversarial"]);
if (!validRubrics.has(values.rubric)) {
  fail(`--rubric must be one of: review, adversarial (got "${values.rubric}")`);
}

function fail(msg, code = 1) {
  process.stderr.write(`gemini-review: ${msg}\n`);
  process.exit(code);
}

function git(args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function gitChecked(args) {
  const r = git(args);
  if (r.error?.code === "ENOENT") fail("git is not installed.");
  if (r.status !== 0) fail(`git ${args.join(" ")} failed: ${(r.stderr || "").trim()}`);
  return r.stdout;
}

if (values.scope !== "codebase" && git(["rev-parse", "--show-toplevel"]).status !== 0) {
  fail("Not inside a git repository.");
}

function detectDefaultBranch() {
  const sym = git(["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (sym.status === 0) {
    const ref = sym.stdout.trim();
    const prefix = "refs/remotes/origin/";
    if (ref.startsWith(prefix)) return ref.slice(prefix.length);
  }
  for (const b of ["main", "master", "trunk"]) {
    if (git(["show-ref", "--verify", "--quiet", `refs/heads/${b}`]).status === 0) return b;
    if (git(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${b}`]).status === 0) return `origin/${b}`;
  }
  return null;
}

function isDirty() {
  return gitChecked(["status", "--porcelain"]).trim().length > 0;
}

function buildWorkingTreeBlock() {
  const status = gitChecked(["status", "--short"]).trim();
  const staged = gitChecked(["diff", "--cached"]);
  const unstaged = gitChecked(["diff"]);
  if (!status && !staged && !unstaged) return null;
  return [
    "## target: working tree (staged + unstaged)",
    "",
    "### git status --short",
    status || "(clean)",
    "",
    "### staged diff",
    staged.trim() || "(none)",
    "",
    "### unstaged diff",
    unstaged.trim() || "(none)",
  ].join("\n");
}

function buildBranchBlock(baseRef) {
  const mergeBase = gitChecked(["merge-base", "HEAD", baseRef]).trim();
  const range = `${mergeBase}..HEAD`;
  const log = gitChecked(["log", "--oneline", range]).trim();
  if (!log) return null;
  const stat = gitChecked(["diff", "--stat", range]).trim();
  const diff = gitChecked(["diff", range]);
  return [
    `## target: branch vs ${baseRef} (merge-base ${mergeBase})`,
    "",
    "### commits",
    log,
    "",
    "### diff stat",
    stat || "(none)",
    "",
    "### diff",
    diff.trim() || "(none)",
  ].join("\n");
}

const RUBRIC_BODIES = {
  review: ({ target }) => `You are reviewing ${target} as a senior engineer hunting for bugs. Your job is to find things that are *wrong* — not things that could be prettier.

Look hard for:
- Correctness errors: off-by-one, wrong comparison operator, missing null/undefined check, type confusion, wrong variable used.
- Edge cases the change doesn't handle: empty input, single-element input, max-size input, unicode, negative numbers, leap years, timezones.
- Concurrency hazards: race conditions, missing locks, data shared across closures/threads, async functions that swallow errors.
- Resource issues: leaks, unbounded growth, files/sockets/handles not closed, missing cleanup on error paths.
- Security: injection (SQL, shell, HTML), unvalidated input, privilege boundary mistakes, secrets in logs, weak crypto.
- Silent failures: caught exceptions that hide problems, fallbacks that mask bad state, defaults that look right but mean "we don't know."

Do not comment on style, naming, formatting, or "you could DRY this up" unless the duplication is causing or hiding a bug. Skip nits.

For each real bug:
  [SEVERITY] file:line — short title
  What goes wrong (specific scenario or input that triggers it).
  Suggested fix.

Severities: critical, high, medium, low.
End with one line: "VERDICT: LGTM" or "VERDICT: NEEDS CHANGES — <one-line summary>".`,

  adversarial: ({ target }) => `You are a hostile architectural reviewer of ${target}. Your job is not to spot bugs — it's to attack the *premise* of the design.

Argue against the approach. Specifically:
- Was the right abstraction chosen? Where will it leak first under future requirements?
- Is the boundary in the right place? Could this responsibility live elsewhere with less coupling?
- What alternatives did the author skip past? For at least two, name them and explain when they'd beat this approach.
- Where is the API fragile to change? What's the migration story when the schema/shape grows?
- What invariants does this code assume but not enforce? What goes wrong when those invariants break?
- Is the naming honest? Where does the name promise something the code doesn't actually do?
- What gets ugly when this scales 100×? 10,000×?

Be specific and pointed. Cite file:line where relevant. Don't list bugs unless a bug is symptomatic of a deeper design issue. No "looks good" hedging — assume the design is wrong and prove yourself right.

End with one line: "VERDICT: KEEP THE APPROACH" or "VERDICT: RECONSIDER — <one-line reason>".`,
};

function buildPrompt({ rubric, scope, block, focusText, cwd }) {
  const target = scope === "codebase" ? "the codebase" : "the changes below";
  const body = RUBRIC_BODIES[rubric]({ target });
  if (scope === "codebase") {
    return `${body}

You are operating against the codebase rooted at the current working directory (${cwd}). Use your read-only tools (read_file, list_directory, glob, grep, etc.) to explore as needed. Start by orienting yourself with the project layout (top-level files, package manifests, entrypoints), then dig into the relevant code paths.

## review request from the user
${focusText}
`;
  }
  const focusBlock = focusText ? `\n\n## additional focus from the user\n${focusText}\n` : "";
  return `${body}${focusBlock}

${block}
`;
}

let prompt;
if (values.scope === "codebase") {
  if (!focusText) {
    fail('--scope codebase requires instructions, e.g. "review for security vulnerabilities".');
  }
  prompt = buildPrompt({ rubric: values.rubric, scope: "codebase", focusText, cwd });
} else {
  let block;
  if (values.scope === "working-tree" || (values.scope === "auto" && !values.base && isDirty())) {
    block = buildWorkingTreeBlock();
    if (!block) fail("Working tree is clean — nothing to review.", 0);
  } else {
    const baseRef = values.base || detectDefaultBranch();
    if (!baseRef) fail("Could not detect default branch. Pass --base <ref>.");
    block = buildBranchBlock(baseRef);
    if (!block) fail(`No commits between HEAD and ${baseRef} — nothing to review.`, 0);
  }
  prompt = buildPrompt({ rubric: values.rubric, scope: values.scope, block, focusText, cwd });
}

const geminiArgs = [
  "-p", "Provide your review now.",
  "--approval-mode", "plan",
  "--skip-trust",
];
if (values.model) geminiArgs.push("-m", values.model);

runGemini({ args: geminiArgs, stdinInput: prompt, errorLabel: "gemini-review" });
