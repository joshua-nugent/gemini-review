#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import process from "node:process";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    base: { type: "string" },
    scope: { type: "string", default: "auto" },
    model: { type: "string" },
  },
  allowPositionals: true,
});

const cwd = process.cwd();
const focusText = positionals.join(" ").trim();

const validScopes = new Set(["auto", "working-tree", "branch", "codebase"]);
if (!validScopes.has(values.scope)) {
  fail(`--scope must be one of: auto, working-tree, branch, codebase (got "${values.scope}")`);
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

let prompt;
if (values.scope === "codebase") {
  if (!focusText) {
    fail('--scope codebase requires instructions, e.g. "review for security vulnerabilities".');
  }
  prompt = `You are a senior engineer reviewing the codebase rooted at the current working directory (${cwd}).

Use your read-only tools (read_file, list_directory, glob, grep, etc.) to explore the codebase as needed to address the request below. Start by orienting yourself with the project layout (top-level files, package manifests, entrypoints), then dig into the relevant code paths.

Be specific. Prioritize correctness, security, and concurrency issues over style. Cite file:line for every finding. Skip nits unless they materially affect readability.

For each finding use this format:
  [SEVERITY] file:line — short title
  Why it's a problem.
  Suggested fix.

Severities: critical, high, medium, low.
End with one line: "VERDICT: LGTM" or "VERDICT: NEEDS CHANGES — <one-line summary>".

## review request from the user
${focusText}
`;
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

  const focusBlock = focusText
    ? `\n\n## additional focus from the user\n${focusText}\n`
    : "";

  prompt = `You are a senior engineer giving a second-opinion code review on the changes below.

Be specific. Prioritize correctness, security, and concurrency issues over style.
Cite file:line for every finding. Skip nits unless they materially affect readability.

For each finding use this format:
  [SEVERITY] file:line — short title
  Why it's a problem.
  Suggested fix.

Severities: critical, high, medium, low.
End with one line: "VERDICT: LGTM" or "VERDICT: NEEDS CHANGES — <one-line summary>".${focusBlock}

${block}
`;
}

const geminiArgs = ["-p", "Provide your code review now.", "--approval-mode", "plan"];
if (values.model) geminiArgs.push("-m", values.model);

const child = spawn("gemini", geminiArgs, {
  cwd,
  env: process.env,
  stdio: ["pipe", "inherit", "inherit"],
});

child.on("error", (err) => {
  if (err.code === "ENOENT") fail("gemini CLI not found on PATH. Install from https://github.com/google-gemini/gemini-cli");
  fail(`failed to launch gemini CLI: ${err.message}`);
});

child.stdin.on("error", () => {});
child.stdin.end(prompt);

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
