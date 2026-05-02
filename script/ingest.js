import nacl from "tweetnacl";
import bs58 from "bs58";

// CONFIGURATION
const NODE_ID = "NODE_100";
const PRIVATE_KEY_B58 = "3oDgCR7KZEn2ywD6ECkq1xFGATm28okhTkR4VRhXexth7utXkyuDpxSNmyYQhjZDnXz5Sj31uJrMtobbxZrcxAj2";



async function generateRequest() {
  // 1. Prepare Payload
  const payload = {
    temperature: 28.5,
    humidity: 62.3,
    pm25: 45.2,
    pm10: 67.8,
    aqi: 112,
    aqiLevel: "MODERATE",
    location: { lat: 28.6139, lng: 77.2090 }
  };

  // 2. Create the Identity Signature
  // MUST match the string format in the backend exactly
  const message = `auth-node-${NODE_ID}`;
  const secretKey = bs58.decode(PRIVATE_KEY_B58);
  const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);

  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    keypair.secretKey
  );

  // 3. Construct Final Object
  const requestBody = {
    nodeId: NODE_ID,
    signature: bs58.encode(signature),
    timestamp: Date.now(),
    payload
  };

  console.log("--- GENERATED REQUEST BODY ---");
  console.log(JSON.stringify(requestBody, null, 2));
}

generateRequest();
