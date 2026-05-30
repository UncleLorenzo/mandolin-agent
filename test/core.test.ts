import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate every test in a throwaway home so we never touch a real ~/.mandolin.
process.env.MANDOLIN_HOME = mkdtempSync(join(tmpdir(), "mandolin-test-"));

import { ensureHome } from "../src/home.ts";
import { scaffoldSignature, learn, signatureDepth, readSignature } from "../src/core/signature.ts";
import { propose, promote, list, verify } from "../src/core/skills.ts";
import { decide, findTool, executeTool } from "../src/core/tools.ts";
import { setCapability } from "../src/core/provider.ts";
import { reflectFromInterview } from "../src/core/reflect.ts";

ensureHome();

test("signature scaffolds, then learns with provenance", () => {
  scaffoldSignature();
  assert.match(readSignature(), /## Voice/);
  const before = signatureDepth();
  learn("Voice", "writes in lowercase, never hypes", "session test");
  assert.equal(signatureDepth(), before + 1);
  assert.match(readSignature(), /never hypes/);
});

test("a proposed skill is inert until you promote it", () => {
  const slug = propose({ name: "Test instinct", description: "d", whenToUse: "w", procedure: ["one", "two"], origin: "test" });
  assert.ok(list("proposed").some((s) => s.name === "Test instinct"));
  const s = promote(slug);
  assert.equal(s.trust, "trusted");
  assert.ok(verify(s));
  assert.ok(list("trusted").some((x) => x.name === "Test instinct"));
  assert.ok(!list("proposed").some((x) => x.name === "Test instinct"));
});

test("a tampered trusted skill fails its digest check", () => {
  const s = list("trusted")[0];
  assert.ok(s);
  assert.ok(verify(s));
  assert.ok(!verify({ ...s, body: s.body + "\nrm -rf /  # injected" }));
});

test("gate: reads inside the project are free, outside must ask", () => {
  const read = findTool("read_file");
  assert.ok(read);
  assert.equal(decide(read, { path: "." }).decision, "allow");
  assert.equal(decide(read, { path: "/etc/hosts" }).decision, "ask");
});

test("gate: exec is denied by default, allowed only once granted", () => {
  const shell = findTool("run_shell");
  assert.ok(shell);
  setCapability("exec", false);
  assert.equal(decide(shell, { command: "echo hi" }).decision, "ask");
  setCapability("exec", true);
  assert.equal(decide(shell, { command: "echo hi" }).decision, "allow");
  setCapability("exec", false);
});

test("executeTool: a gated action with no approver is denied", async () => {
  setCapability("exec", false);
  const out = await executeTool({ tool: "run_shell", input: { command: "echo nope" } });
  assert.equal(out.decision, "deny");
  assert.equal(out.ok, false);
});

test("executeTool: approval lets it run for real", async () => {
  setCapability("exec", false);
  const out = await executeTool({ tool: "run_shell", input: { command: "echo hello-test" } }, async () => true);
  assert.equal(out.decision, "allow");
  assert.ok(out.ok);
  assert.match(out.output, /hello-test/);
});

test("executeTool: reading a file inside the project needs no approval", async () => {
  const out = await executeTool({ tool: "read_file", input: { path: "package.json" } });
  assert.equal(out.decision, "allow");
  assert.match(out.output, /mandolin-agent/);
});

test("reflect turns an interview into signature deltas + a proposed instinct", () => {
  const r = reflectFromInterview("sess-test", { voice: "terse", standards: "taste over volume" });
  assert.equal(r.deltas.length, 2);
  assert.ok(r.proposed);
});
