// scripts/sign-link-verify.ts
import nacl from "tweetnacl";
import bs58 from "bs58";

// ✅ Same private key as your device
const devicePrivateKeyBase58 = "3oDgCR7KZEn2ywD6ECkq1xFGATm28okhTkR4VRhXexth7utXkyuDpxSNmyYQhjZDnXz5Sj31uJrMtobbxZrcxAj2";

// ✅ Paste the challenge you got from POST /node/link/request
const challenge = "22acc0f216a971eeea2687d2b56ee67b13f4c8f0e1a5b9b2783cfc8731e08b66";

const keypair = nacl.sign.keyPair.fromSecretKey(bs58.decode(devicePrivateKeyBase58));

// 🔐 Sign the raw challenge string (NOT JSON-wrapped)
const signature = nacl.sign.detached(
  new TextEncoder().encode(challenge),
  keypair.secretKey
);

console.log("devicePublicKey:", bs58.encode(keypair.publicKey));
console.log("signature:      ", bs58.encode(signature));
console.log("\n📋 Ready-to-paste body for POST /node/link/verify:");
console.log(JSON.stringify({
  devicePublicKey: bs58.encode(keypair.publicKey),
  signature: bs58.encode(signature),
  email: "node100@breezo.io",       // 👈 change to your email
  wallet: "6VR8bAqHt35qypKanyw3PKFTm4Rv3ZBZU33qmhakEj85"    // 👈 change to your wallet address
}, null, 2));
