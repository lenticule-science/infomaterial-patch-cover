#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { semanticId } from "@emsenn/rmn-semantic-conformance";
import { encodeRelationalValue } from "@emsenn/rmn-semantic-conformance/relational-value";
import { createSettlementStore } from "@emsenn/rwil-rdf-services/client";
import { assembleDirectoryCover } from "./directory-cover.mjs";
import { DIRECTORY_PATCH_COVER_LAW } from "./law.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ACTOR = "urn:ame:infomaterial-patch-cover", CONTEXT = "https://www.w3.org/ns/activitystreams";
function id(value) { const encoded = encodeRelationalValue(value); return semanticId(["ascribe", encoded.type, encoded.term]); }
function response(type, source, object, at) { const body = { "@context": CONTEXT, type, actor: ACTOR, target: source?.actor ?? null, inReplyTo: source?.id ?? null, object, published: at }; return { id: id(body), ...body }; }
function requestOf(activity) { return activity?.object?.request ?? activity?.object?.sourceActivity?.object; }
function validateRequest(request) {
  if (request?.type !== "DirectoryPatchCoverRequest" || request.purpose !== "assemble an exact recursive material cover") throw new Error("exact directory patch cover request required");
  if (!request.plateReceipt || !Array.isArray(request.bindings)) throw new Error("plateReceipt and bindings are required");
  for (const forbidden of ["directoryRoot", "path", "exclude", "ignore", "followSymlinks", "readChildInteriors", "command", "argv"]) if (Object.hasOwn(request, forbidden)) throw new Error(`caller-selected ${forbidden} is forbidden`);
  return request;
}
function validateCapability(capability, offer, customer, at) {
  if (capability?.type !== "InvocationCapability" || capability.issuer !== customer || capability.holder !== ACTOR || capability.invocationTarget !== ACTOR) throw new Error("exact invocation capability required");
  if (capability.parentOffer !== offer.id || capability.attenuation?.request !== offer.object.requestIdentity || capability.singleUse !== true || Date.parse(capability.expires) <= Date.parse(at)) throw new Error("capability is changed, reusable, or expired");
  if (!capability.allowedActions?.includes("assemble-directory-cover") || capability.allowedActions.includes("read-filesystem") || capability.allowedActions.includes("mutate-territory")) throw new Error("capability effects are absent or overbroad");
}
async function handle(operation, activity, at) {
  if (operation === "solicit-service") {
    if (activity?.["@context"] !== CONTEXT || activity.type !== "Offer" || activity.target !== ACTOR || activity.object?.type !== "ServiceSolicitation") throw new Error("ActivityStreams Offer<ServiceSolicitation> targeted to this provider required");
    const request = validateRequest(requestOf(activity));
    return response("Offer", activity, { type: "ExecutableServiceOffer", law: DIRECTORY_PATCH_COVER_LAW.id, request, requestIdentity: id(request), operation: "invoke-service", effects: ["verify-rmn-receipts", "assemble-directory-cover", "write-provider-rwil"], filesystemAccess: false, customerMutation: false }, at);
  }
  if (operation !== "invoke-service" || activity?.["@context"] !== CONTEXT || activity.type !== "Accept" || activity.target !== ACTOR) throw new Error("ActivityStreams Accept<ServiceContract> targeted to this provider required");
  const offer = activity.object?.offer;
  if (offer?.type !== "Offer" || offer.actor !== ACTOR || offer.target !== activity.actor || offer.object?.law !== DIRECTORY_PATCH_COVER_LAW.id) throw new Error("exact provider offer required");
  const request = validateRequest(offer.object.request);
  if (offer.object.requestIdentity !== id(request)) throw new Error("request identity changed after offer");
  validateCapability(activity.object?.capability, offer, activity.actor, at);
  const store = createSettlementStore({ settlementRoot: ROOT, dataRoot: join(ROOT, "data"), agentUrl: process.env.RWIL_RDF_AGENT });
  const result = await assembleDirectoryCover(request.plateReceipt, request.bindings, { coveredAt: at });
  const receipt = { ...result.cover, semanticId: result.semanticId, canonicalBytesBase64: result.canonicalBytes.toString("base64"), provider: ACTOR, law: DIRECTORY_PATCH_COVER_LAW.id, customerMutation: false };
  await store.record({ category: "infomaterial-directory-cover.receipt", recordedAt: at, record: receipt });
  return response("Accept", activity, receipt, at);
}
async function input() { let source = ""; process.stdin.setEncoding("utf8"); for await (const chunk of process.stdin) source += chunk; return JSON.parse(source); }
const operationIndex = process.argv.indexOf("--operation"), operation = operationIndex < 0 ? "invoke-service" : process.argv[operationIndex + 1];
const nowIndex = process.argv.indexOf("--now"), at = nowIndex < 0 ? new Date().toISOString() : process.argv[nowIndex + 1];
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const activity = await input();
  try { process.stdout.write(`${JSON.stringify(await handle(operation, activity, at), (_, value) => typeof value === "bigint" ? value.toString() : value)}\n`); }
  catch (error) { process.stdout.write(`${JSON.stringify(response("Reject", activity, { type: "DirectoryPatchCoverRefusal", law: DIRECTORY_PATCH_COVER_LAW.id, reason: error.message, partialSuccessClaimed: false, customerMutation: false }, at))}\n`); process.exitCode = 2; }
}
