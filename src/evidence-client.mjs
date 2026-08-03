import { randomUUID } from "node:crypto";
import { Message, Role } from "@a2a-js/sdk";
import { a2aResultParts, sendRmnTask } from "@red-cup-engineering/a2a-rmn-task-client-service";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { decodeSemantic, semanticBytes } from "@red-cup-engineering/relation-model-notation-runtime";
import { decodeRelationalValue, encodeRelationalValue } from "@red-cup-engineering/relation-model-notation-runtime/relational-value";
import { SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION } from "@red-cup-engineering/relation-model-notation-runtime/hierarchical-circuit";
import { validateInfomaterialPatchEvidence } from "./patch-evidence.mjs";
import { jsonId } from "./semantic-identity.mjs";

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
  const value = decodeRelationalValue(term[1], term[2]);
  const objectKind = value?.type === "InfomaterialPatchObservation"
    ? "lenticule.infomaterial.patch-observation"
    : "lenticule.infomaterial.patch-cover-receipt";
  const receipt = { ...value, semanticId: jsonId(term, objectKind), canonicalBytesBase64: output.bytes.toString("base64") };
  validateInfomaterialPatchEvidence(receipt);
  return { receipt, exchange };
}
