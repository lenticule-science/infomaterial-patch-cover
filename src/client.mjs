import { randomUUID } from "node:crypto";
import { Message, Role } from "@a2a-js/sdk";
import { a2aResultParts, sendRmnTask } from "@red-cup-engineering/a2a-rmn-task-client-service";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { checkTerm, decodeSemantic, semanticBytes, semanticId } from "@red-cup-engineering/rmn-semantic-conformance";
import { decodeRelationalValue, encodeRelationalValue, RELATIONAL_VALUE_TYPE } from "@red-cup-engineering/rmn-semantic-conformance/relational-value";
import { SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION } from "@red-cup-engineering/rmn-semantic-conformance/hierarchical-circuit";
import { validateDirectoryPatchCoverReceipt } from "./cover-receipt.mjs";
const responseParts = a2aResultParts;
export function encodeDirectoryCoverTaskRequest({ plateReceipt, bindings }) { const encoded = encodeRelationalValue({ kind: "DirectoryPatchCoverTask", plateReceipt, bindings }); return ["ascribe", encoded.type, encoded.term]; }
export function decodeDirectoryCoverTaskRequest(bytes) {
  const term = decodeSemantic(bytes); if (!semanticBytes(term).equals(bytes) || term?.[0] !== "ascribe" || term.length !== 3 || JSON.stringify(term[1]) !== JSON.stringify(RELATIONAL_VALUE_TYPE)) throw new Error("directory cover task must be canonical relational RMN");
  checkTerm(term[2], term[1]); const value = decodeRelationalValue(term[1], term[2]);
  if (value?.kind !== "DirectoryPatchCoverTask" || Object.keys(value).sort().join("\0") !== "bindings\0kind\0plateReceipt" || !Array.isArray(value.bindings) || !value.plateReceipt) throw new Error("directory cover task has an invalid shape"); return value;
}
export async function requestDirectoryCover({ agentUrl, plateReceipt, bindings, signal }) {
  const request = encodeDirectoryCoverTaskRequest({ plateReceipt, bindings }); const message = Message.toJSON({ messageId: randomUUID(), contextId: "", taskId: "", role: Role.ROLE_USER, parts: [rmnPart(semanticBytes(request), "directory-cover-task.rmn.cbor")], metadata: {}, extensions: [], referenceTaskIds: [] });
  const exchange = await sendRmnTask({ agentUrl, extensions: [SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION], message, ...(signal ? { signal } : {}) }); const output = extractRmnPart(responseParts(exchange.result)); const term = decodeSemantic(output.bytes);
  if (!semanticBytes(term).equals(output.bytes) || term?.[0] !== "ascribe" || term.length !== 3) throw new Error("directory cover provider returned noncanonical RMN"); const value = decodeRelationalValue(term[1], term[2]);
  const receipt = { ...value, semanticId: semanticId(term), canonicalBytesBase64: output.bytes.toString("base64") }; validateDirectoryPatchCoverReceipt(receipt); return { receipt, exchange };
}
