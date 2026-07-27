import { readFileSync } from "node:fs";
import { compileRmlLaw } from "@red-cup-engineering/rmn-semantic-conformance/law";

export const DIRECTORY_PATCH_COVER_LAW = compileRmlLaw(
  readFileSync(new URL("../content/contracts/directory-patch-cover.rml", import.meta.url), "utf8"),
);

