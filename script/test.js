// scripts/sign-challenge.ts
import nacl from "tweetnacl";
import bs58 from "bs58";

const challenge = "3525e5d3ea0b7080af7f656f60df545f9a2e590d2204185bed650480733b1d52"; // from step 2
const devicePrivateKeyBase58 = "3oDgCR7KZEn2ywD6ECkq1xFGATm28okhTkR4VRhXexth7utXkyuDpxSNmyYQhjZDnXz5Sj31uJrMtobbxZrcxAj2";

const keypair = nacl.sign.keyPair.fromSecretKey(bs58.decode(devicePrivateKeyBase58));
const signature = nacl.sign.detached(new TextEncoder().encode(challenge), keypair.secretKey);

console.log("signature:", bs58.encode(signature));
console.log("publicKey:", bs58.encode(keypair.publicKey));
