import { randomUUID } from "node:crypto";
import { Message, Role } from "@a2a-js/sdk";
import { a2aResultParts, sendRmnTask } from "@emsenn/a2a-rmn-task-client-service";
import { extractRmnPart, rmnPart } from "@emsenn/a2a-rmn-part-service";
import { decodeSemantic, semanticBytes, semanticId } from "@emsenn/rmn-semantic-conformance";
import { decodeRelationalValue, encodeRelationalValue } from "@emsenn/rmn-semantic-conformance/relational-value";
import { SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION } from "@emsenn/rmn-semantic-conformance/hierarchical-circuit";
import { validateInfomaterialPatchEvidence } from "./patch-evidence.mjs";

const responseParts = a2aResultParts;

/** Invoke any signed provider occupying the common patch-evidence socket. The
 * request remains provider-law-specific RMN; only the output carrier is shared. */
export async function requestInfomaterialPatchEvidence({ agentUrl, request, signal }) {
  const encoded = encodeRelationalValue(request);
  const inputBytes = semanticBytes(["ascribe", encoded.type, encoded.term]);
  const message = Message.toJSON({
    messageId: randomUUID(), contextId: "", taskId: "", role: Role.ROLE_USER,
    parts: [rmnPart(inputBytes, "infomaterial-patch-request.rmn.cbor")],
    metadata: {}, extensions: [], referenceTaskIds: [],
  });
  const exchange = await sendRmnTask({
    agentUrl, extensions: [SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION], message,
    requireSignature: true, ...(signal ? { signal } : {}),
  });
  const output = extractRmnPart(responseParts(exchange.result));
  const term = decodeSemantic(output.bytes);
  if (!semanticBytes(term).equals(output.bytes) || term?.[0] !== "ascribe" || term.length !== 3) throw new Error("patch provider returned noncanonical RMN");
  const receipt = { ...decodeRelationalValue(term[1], term[2]), semanticId: semanticId(term), canonicalBytesBase64: output.bytes.toString("base64") };
  validateInfomaterialPatchEvidence(receipt);
  return { receipt, exchange };
}
