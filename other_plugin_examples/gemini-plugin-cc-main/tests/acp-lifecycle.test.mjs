import assert from "node:assert/strict";
import test from "node:test";
import {
  ACP_INIT_TIMEOUT_MS,
  clearFlagCache,
  createSession,
  detectAcpFlag,
  isAlive,
  spawnAcpClient,
} from "../plugins/gemini/scripts/lib/acp-lifecycle.mjs";
import {
  buildEnv,
  FAKE_GEMINI_BEHAVIOR,
  installFakeGemini,
} from "./fake-gemini-fixture.mjs";
import { makeTempDir } from "./helpers.mjs";

test("detectAcpFlag returns --acp for gemini >= 0.33.0", async () => {
  const binDir = makeTempDir();
  installFakeGemini(binDir, FAKE_GEMINI_BEHAVIOR.TASK_OK);
  clearFlagCache();
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}:${origPath}`;
  try {
    const flag = await detectAcpFlag("gemini");
    assert.equal(flag, "--acp");
  } finally {
    process.env.PATH = origPath;
    clearFlagCache();
  }
});

test("spawnAcpClient connects and completes initialize handshake", async () => {
  const binDir = makeTempDir();
  installFakeGemini(binDir, FAKE_GEMINI_BEHAVIOR.TASK_OK);
  clearFlagCache();
  const client = await spawnAcpClient({ env: buildEnv(binDir) });
  assert.ok(client.pid > 0);
  assert.equal(client.exited, false);
  await client.shutdown();
});

test("isAlive returns true for a live client", async () => {
  const binDir = makeTempDir();
  installFakeGemini(binDir, FAKE_GEMINI_BEHAVIOR.TASK_OK);
  clearFlagCache();
  const client = await spawnAcpClient({ env: buildEnv(binDir) });
  assert.equal(isAlive(client), true);
  await client.shutdown();
});

test("createSession returns a non-empty sessionId", async () => {
  const binDir = makeTempDir();
  installFakeGemini(binDir, FAKE_GEMINI_BEHAVIOR.TASK_OK);
  clearFlagCache();
  const { client, sessionId } = await createSession({ env: buildEnv(binDir) });
  assert.equal(typeof sessionId, "string");
  assert.ok(sessionId.length > 0);
  await client.shutdown();
});

test("ACP_INIT_TIMEOUT_MS defaults to 30s", () => {
  assert.equal(ACP_INIT_TIMEOUT_MS, 30_000);
});

test("spawnAcpClient times out and kills the child when gemini never responds to initialize", async () => {
  const binDir = makeTempDir();
  installFakeGemini(binDir, FAKE_GEMINI_BEHAVIOR.INIT_HANG);
  clearFlagCache();
  const env = buildEnv(binDir, { GEMINI_ACP_INIT_TIMEOUT_MS: "100" });
  await assert.rejects(
    () => spawnAcpClient({ env }),
    /ACP initialize timed out/,
  );
  // If the child leaks, the event loop stays open and this test hangs.
});
