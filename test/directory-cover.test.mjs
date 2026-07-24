import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { observeInfomaterial } from "../../infomaterial-observation/src/material-merkle.mjs";
import { observeDirectoryPlate } from "../../infomaterial-directory-plate-observation/src/directory-plate.mjs";
import { assembleDirectoryCover } from "../src/directory-cover.mjs";
import { validateDirectoryPatchCoverReceipt } from "../src/cover-receipt.mjs";

async function materialReceipt(path, observedAt) {
  const result = await observeInfomaterial(path);
  return { ...result.observation, semanticId: result.semanticId, canonicalBytesBase64: result.canonicalBytes.toString("base64"), patchRoot: path, observedAt };
}
async function plateReceipt(path, observedAt) {
  const result = await observeDirectoryPlate(path, { observedAt });
  return { ...result.observation, semanticId: result.semanticId, canonicalBytesBase64: result.canonicalBytes.toString("base64") };
}

test("pure receipt assembly reconstructs the same material root as recursive observation", async () => {
  const root = await mkdtemp(join(tmpdir(), "infomaterial-cover-"));
  await writeFile(join(root, "a.txt"), "alpha");
  await mkdir(join(root, "nested")); await writeFile(join(root, "nested", "b.txt"), "beta");
  const plate = await plateReceipt(root, "2026-07-20T00:00:00.000Z");
  const bindings = [
    { mount: "a.txt", receipt: await materialReceipt(join(root, "a.txt"), "2026-07-20T00:00:01.000Z") },
    { mount: "nested", receipt: await materialReceipt(join(root, "nested"), "2026-07-20T00:00:02.000Z") },
  ];
  const assembled = await assembleDirectoryCover(plate, bindings, { coveredAt: "2026-07-20T00:00:03.000Z" });
  const whole = await observeInfomaterial(root);
  assert.equal(assembled.cover.materialRoot, whole.observation.materialRoot);
  assert.equal(assembled.cover.gapFree, true);
  assert.equal(assembled.cover.nonOverlapping, true);
  assert.equal(assembled.cover.childInteriorsRead, false);
  assert.equal(Object.hasOwn(assembled.cover, "directoryRoot"), false);
  const carrier = { ...assembled.cover, semanticId: assembled.semanticId, canonicalBytesBase64: assembled.canonicalBytes.toString("base64") };
  assert.equal(validateDirectoryPatchCoverReceipt(carrier).materialRoot, whole.observation.materialRoot);
});

test("a composed directory cover occupies the same patch-evidence socket as a direct observation", async () => {
  const root = await mkdtemp(join(tmpdir(), "infomaterial-recursive-cover-"));
  await mkdir(join(root, "nested"));
  await writeFile(join(root, "nested", "leaf"), "recursive");
  const innerPlate = await plateReceipt(join(root, "nested"), "2026-07-20T00:00:00.000Z");
  const inner = await assembleDirectoryCover(innerPlate, [
    { mount: "leaf", receipt: await materialReceipt(join(root, "nested", "leaf"), "2026-07-20T00:00:01.000Z") },
  ], { coveredAt: "2026-07-20T00:00:02.000Z" });
  const innerReceipt = { ...inner.cover, semanticId: inner.semanticId, canonicalBytesBase64: inner.canonicalBytes.toString("base64") };
  const outerPlate = await plateReceipt(root, "2026-07-20T00:00:03.000Z");
  const outer = await assembleDirectoryCover(outerPlate, [{ mount: "nested", receipt: innerReceipt }], { coveredAt: "2026-07-20T00:00:04.000Z" });
  const whole = await observeInfomaterial(root);
  assert.equal(outer.cover.materialRoot, whole.observation.materialRoot);
  assert.equal(outer.cover.mounts[0].observation, inner.semanticId);
});

test("the assembler refuses gaps, duplicates, and mount-kind mismatches", async () => {
  const root = await mkdtemp(join(tmpdir(), "infomaterial-cover-refusal-"));
  await writeFile(join(root, "a"), "a"); await mkdir(join(root, "d"));
  const plate = await plateReceipt(root, "2026-07-20T00:00:00.000Z");
  const a = await materialReceipt(join(root, "a"), "2026-07-20T00:00:01.000Z");
  const d = await materialReceipt(join(root, "d"), "2026-07-20T00:00:02.000Z");
  await assert.rejects(assembleDirectoryCover(plate, [{ mount: "a", receipt: a }]), /cover the direct-name set/u);
  await assert.rejects(assembleDirectoryCover(plate, [{ mount: "a", receipt: a }, { mount: "a", receipt: a }]), /duplicate child receipt/u);
  await assert.rejects(assembleDirectoryCover(plate, [{ mount: "a", receipt: d }, { mount: "d", receipt: a }]), /kind does not match/u);
});

test("assembly does not depend on child provider filesystem paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "infomaterial-cover-remote-")); await writeFile(join(root, "a"), "same");
  const remote = await mkdtemp(join(tmpdir(), "infomaterial-cover-provider-")); await writeFile(join(remote, "copy"), "same");
  const plate = await plateReceipt(root, "2026-07-20T00:00:00.000Z");
  const receipt = await materialReceipt(join(remote, "copy"), "2026-07-20T00:00:01.000Z");
  const assembled = await assembleDirectoryCover(plate, [{ mount: "a", receipt }]);
  const whole = await observeInfomaterial(root);
  assert.equal(assembled.cover.materialRoot, whole.observation.materialRoot);
});

test("a child receipt cannot lie about its canonical identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "infomaterial-cover-identity-")); await writeFile(join(root, "a"), "a");
  const plate = await plateReceipt(root, "2026-07-20T00:00:00.000Z");
  const child = await materialReceipt(join(root, "a"), "2026-07-20T00:00:01.000Z"); child.materialRoot = `ni:///sha-256;${"A".repeat(43)}`;
  await assert.rejects(assembleDirectoryCover(plate, [{ mount: "a", receipt: child }]), /differs from its canonical RMN object/u);
});
