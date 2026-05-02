import crypto from "crypto";

export function generateApiKey() {
  return "brz_" + crypto.randomBytes(24).toString("hex");
}
