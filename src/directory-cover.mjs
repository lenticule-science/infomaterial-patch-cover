import { semanticBytes } from "@red-cup-engineering/relation-model-notation-runtime";
import { encodeRelationalValue } from "@red-cup-engineering/relation-model-notation-runtime/relational-value";
import { validateDirectoryPlateReceipt } from "@lenticule-science/infomaterial-directory-plate-observation";
import { validateInfomaterialPatchEvidence } from "./patch-evidence.mjs";
import { jsonId } from "./semantic-identity.mjs";

export const MATERIAL_PROFILE = "org.emsenn.infomaterial.merkle.v2";
export const COVER_PROFILE = "org.emsenn.infomaterial.patch-cover.v2";

function typed(value, objectKind) {
  const encoded = encodeRelationalValue(value), term = ["ascribe", encoded.type, encoded.term];
  return { id: jsonId(term, objectKind), bytes: semanticBytes(term) };
}

export async function assembleDirectoryCover(plateReceipt, bindings, { coveredAt = new Date().toISOString() } = {}) {
  const plate = validateDirectoryPlateReceipt(plateReceipt);
  if (!Array.isArray(bindings)) throw new Error("bindings must be an array");
  if (!Number.isFinite(Date.parse(coveredAt))) throw new Error("coveredAt must be an ISO timestamp");
  const supplied = new Map();
  for (const binding of bindings) {
    if (!binding || Object.keys(binding).sort().join("\0") !== "mount\0receipt" || typeof binding.mount !== "string") throw new Error("each child binding must expose exactly mount and receipt");
    const name = binding.mount.normalize("NFC");
    if (supplied.has(name)) throw new Error(`duplicate child receipt for mount ${name}`);
    supplied.set(name, validateInfomaterialPatchEvidence(binding.receipt));
  }
  if (supplied.size !== plate.mounts.length) throw new Error("child receipts do not cover the direct-name set exactly");
  const mounts = plate.mounts.map(({ name, kind }) => {
    const receipt = supplied.get(name);
    if (!receipt) throw new Error(`missing child receipt for mount ${name}`);
    if (receipt.rootKind !== kind) throw new Error(`child receipt kind does not match mount ${name}`);
    return { name, kind, materialRoot: receipt.materialRoot, observation: receipt.semanticId, observedAt: receipt.observedAt ?? null };
  });
  const materialRoot = typed({ profile: MATERIAL_PROFILE, kind: "directory", mode: plate.mode, children: mounts.map(({ name, kind, materialRoot: id }) => ({ name, kind, id })) }, "lenticule.infomaterial.directory-node").id;
  const cover = {
    type: "InfomaterialDirectoryPatchCover", profile: COVER_PROFILE,
    plateObservation: plateReceipt.semanticId, plateRoot: plate.plateRoot,
    rootKind: "directory", materialRoot, mounts,
    gapFree: true, nonOverlapping: true, vectorTimed: true,
    globalInstantClaimed: false, childInteriorsRead: false, coveredAt,
  };
  const document = typed(cover, "lenticule.infomaterial.patch-cover-receipt");
  return { cover, semanticId: document.id, canonicalBytes: document.bytes };
}
