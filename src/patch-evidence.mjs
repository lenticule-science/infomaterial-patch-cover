import { validateInfomaterialObservationReceipt } from "@lenticule-science/infomaterial-observation/receipt";
import { validateDirectoryPatchCoverReceipt } from "./cover-receipt.mjs";

/** The recursive carrier is a genuine sum: a finite patch is evidenced either
 * by direct observation or by a gap-free cover of independently evidenced
 * child patches. Both variants carry the same rootKind/materialRoot pins. */
export function validateInfomaterialPatchEvidence(receipt) {
  if (receipt?.type === "InfomaterialPatchObservation") return validateInfomaterialObservationReceipt(receipt);
  if (receipt?.type === "InfomaterialDirectoryPatchCover") return validateDirectoryPatchCoverReceipt(receipt);
  throw new Error("canonical direct observation or recursive directory cover evidence required");
}
