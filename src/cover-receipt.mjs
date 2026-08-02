import { checkTerm, decodeSemantic, semanticId } from "@red-cup-engineering/relation-model-notation-runtime";
import { decodeRelationalValue } from "@red-cup-engineering/relation-model-notation-runtime/relational-value";
const COVER_PROFILE = "org.emsenn.infomaterial.patch-cover.v2";

const NI = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;

export function validateDirectoryPatchCoverReceipt(carrier) {
  if (carrier?.type !== "InfomaterialDirectoryPatchCover" || carrier.profile !== COVER_PROFILE || !NI.test(carrier.semanticId ?? "") || typeof carrier.canonicalBytesBase64 !== "string") throw new Error("canonical infomaterial directory patch cover required");
  const bytes = Buffer.from(carrier.canonicalBytesBase64, "base64");
  if (bytes.toString("base64") !== carrier.canonicalBytesBase64) throw new Error("patch cover bytes are not canonical base64");
  const term = decodeSemantic(bytes);
  if (term?.[0] !== "ascribe" || term.length !== 3) throw new Error("patch cover object is not an RMN ascription");
  checkTerm(term[2], term[1]);
  if (semanticId(term) !== carrier.semanticId) throw new Error("patch cover identity differs from its canonical bytes");
  const value = decodeRelationalValue(term[1], term[2]);
  if (value.type !== "InfomaterialDirectoryPatchCover" || value.profile !== COVER_PROFILE || value.gapFree !== true || value.nonOverlapping !== true || value.vectorTimed !== true || value.globalInstantClaimed !== false || value.childInteriorsRead !== false || !NI.test(value.plateObservation ?? "") || !NI.test(value.plateRoot ?? "") || !NI.test(value.materialRoot ?? "") || !Array.isArray(value.mounts)) throw new Error("patch cover payload does not prove the required recursive material boundary");
  for (const mount of value.mounts) if (typeof mount?.name !== "string" || !["file", "directory", "symbolic-link"].includes(mount.kind) || !NI.test(mount.materialRoot ?? "") || !NI.test(mount.observation ?? "")) throw new Error("patch cover contains a malformed mount");
  return { ...value, semanticId: carrier.semanticId, canonicalBytesBase64: carrier.canonicalBytesBase64 };
}
