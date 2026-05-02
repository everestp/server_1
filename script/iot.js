import axios from "axios";

// ================= CONFIG =================
const API_URL = "http://localhost:5000/api/v1/node/ingest";

const SIGNATURE =
  "KJXG3pULqQnKhDPk3RgoRWz2XoWUcEfCrEM6z5uFM64fHcBPqLpywuzMP6UgmxGjGsfzDmJYH2c6UHVuXGYSsFb";

const INTERVAL = 60 * 1000; // 1 minute

// Each node has FIXED coordinates (never change)
const NODES = [
  {
    nodeId: "NODE_100",
    location: { lat: 27.7172, lng: 85.3240 }, // Kathmandu
  },
  {
    nodeId: "NODE_101",
    location: { lat: 27.6700, lng: 85.3200 }, // Lalitpur area
  },
  {
    nodeId: "NODE_102",
    location: { lat: 27.7000, lng: 85.3300 }, // Bhaktapur direction
  },
];

// ==========================================


// Random sensor generator (changes every request)
function generateSensorData() {
  const temperature = +(18 + Math.random() * 18).toFixed(2);
  const humidity = +(35 + Math.random() * 50).toFixed(2);
  const pm25 = +(5 + Math.random() * 120).toFixed(2);
  const pm10 = +(10 + Math.random() * 180).toFixed(2);

  const aqi = Math.round(pm25 + pm10 / 2);

  let aqiLevel = "GOOD";
  if (aqi > 50) aqiLevel = "MODERATE";
  if (aqi > 100) aqiLevel = "UNHEALTHY";
  if (aqi > 150) aqiLevel = "VERY_UNHEALTHY";

  return {
    temperature,
    humidity,
    pm25,
    pm10,
    aqi,
    aqiLevel,
  };
}


// Send request for one node
async function sendNodeData(node) {
  const payload = {
    nodeId: node.nodeId,
    signature: SIGNATURE,
    timestamp: Date.now(),
    payload: {
      ...generateSensorData(),
      location: node.location, // FIXED per node
    },
  };

  try {
    const res = await axios.post(API_URL, payload);
    console.log(`✅ ${node.nodeId} sent`, payload.payload);
  } catch (err) {
    console.error(`❌ ${node.nodeId} error`, err?.response?.data || err.message);
  }
}


// Run all nodes in parallel
async function runCycle() {
  console.log("\n🚀 Sending data from all nodes...");

  await Promise.all(NODES.map((node) => sendNodeData(node)));
}


// Start loop
function start() {
  runCycle(); // immediate run
  setInterval(runCycle, INTERVAL);
}

start();
