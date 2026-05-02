// scripts/get-discriminators.ts
import crypto from "crypto";

function discriminator(name) {
  const hash = crypto.createHash("sha256")
    .update(`global:${name}`)
    .digest();
  return Array.from(hash.slice(0, 8));
}

console.log("initNode:   ", discriminator("init_node"));
console.log("addReward:  ", discriminator("add_reward"));
console.log("claimReward:", discriminator("claim_reward"));
