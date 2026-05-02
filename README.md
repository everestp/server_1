# 🌿 Breezo Network

> **Decentralized Physical Infrastructure (DePIN) for real-world air quality monitoring — powered by Solana.**

Breezo connects physical ESP32 air quality sensors to the Solana blockchain. Sensor operators earn **BREEZO tokens** for contributing verifiable environmental data. Developers access that data via a token-gated REST API.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [NodeService — Backend Brain](#nodeservice--backend-brain)
- [Smart Contract](#smart-contract)
- [API Reference](#api-reference)
- [Reward Engine](#reward-engine)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Tech Stack](#tech-stack)

---

## Overview

Breezo is a full-stack DePIN project with three layers:

| Layer | What it does |
|---|---|
| **Hardware** | ESP32 devices measure PM2.5, PM10, temperature, humidity, and AQI |
| **Backend** | Node.js server ingests sensor data, verifies cryptographic signatures, manages rewards |
| **Blockchain** | Anchor program on Solana handles on-chain node registration, reward crediting, and token claims |

Token rewards flow automatically — no manual intervention required. When a node accumulates ≥ 10 BREEZO, the backend syncs to Solana and the user can claim to their wallet.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Breezo Network                          │
├──────────────┬──────────────────────┬───────────────────────────┤
│   Hardware   │       Backend        │        Blockchain         │
│              │                      │                           │
│  ESP32       │  Node.js + MongoDB   │  Solana (Devnet/Mainnet)  │
│  Sensor      │                      │  Anchor Program           │
│              │  ┌────────────────┐  │                           │
│  PM2.5  ─────┼─►│  ingestData()  │  │  ┌──────────────────┐    │
│  PM10        │  │  verifySign()  ├──┼─►│  NodeAccount PDA │    │
│  Temp        │  │  calcReward()  │  │  │  rewardBalance   │    │
│  Humidity    │  │  syncSolana()  ├──┼─►│  addReward()     │    │
│  AQI         │  └────────────────┘  │  │  claimReward()   │    │
│              │                      │  └──────────────────┘    │
│              │  REST API            │                           │
│              │  ┌────────────────┐  │  ┌──────────────────┐    │
│              │  │  /weather/*    │  │  │  Treasury PDA    │    │
│              │  │  /nodes        │  │  │  BREEZO tokens   │    │
│              │  │  /credit/add   │  │  │  SPL transfers   │    │
│              │  └────────────────┘  │  └──────────────────┘    │
└──────────────┴──────────────────────┴───────────────────────────┘
```

---

## How It Works

### Device Lifecycle

```
1. Admin registers ESP32 in DB (createNode)
        │
        ▼
2. User calls requestLink → gets challenge string
        │
        ▼
3. ESP32 signs challenge with its NaCl private key
        │
        ▼
4. verifyLink → confirms signature → creates Node PDA on Solana
        │
        ▼
5. Node is live — starts sending sensor data
```

### Reward Lifecycle

```
ESP32 sends reading
        │
        ▼
ingestData()
  ├─ Reject if timestamp > 60s old      (replay attack protection)
  ├─ Verify NaCl device signature       (anti-spoofing)
  ├─ Save reading to NodeLatest         (latest state)
  ├─ calculateReward(pm25)              (reward engine)
  └─ accumulated reward >= 10?
            │ YES
            ▼
    syncToSolana()
      └─ addReward(amount) on-chain     (Anchor CPI)

User opens dashboard
        │
        ▼
claimReward()
  ├─ Verify wallet owns the node
  ├─ Check on-chain rewardBalance > 0
  └─ claimReward(amount) on-chain       (SPL transfer: Treasury → User ATA)
```

---

## NodeService — Backend Brain

The `NodeService` is the core backend module. Every sensor interaction, reward calculation, and on-chain sync flows through it.

---

### `ingestData` — Receive Sensor Reading

The ESP32 device sends air quality data to the backend endpoint. This function:

- Validates the node exists and is linked to a wallet
- **Rejects requests older than 60 seconds** — prevents replay attacks where old packets are re-submitted
- **Verifies the device's NaCl cryptographic signature** — only the real hardware can submit valid readings
- Saves the latest reading to `NodeLatest` in MongoDB
- Calculates a token reward based on PM2.5 value via `calculateReward()`
- If accumulated reward hits **≥ 10 BREEZO**, fires `syncToSolanaAsync()` automatically

```js
// Payload from ESP32
{
  nodeId:    "abc123",
  pm25:      12.4,
  pm10:      18.7,
  temp:      28.5,
  humidity:  64,
  aqi:       90,
  timestamp: 1714298320,
  signature: "base64encodedNaClsig..."
}
```

---

### `requestLink` — Start Device Linking

Generates a **random challenge string** and stores it against the device in MongoDB. The ESP32 must sign this challenge to prove it owns the corresponding private key. This prevents someone from claiming a device they don't physically control.

```
Server → challenge: "f3a9c2...random...91b4"
ESP32  ← sign with device private key
```

---

### `verifyLink` — Complete Device Linking

Receives the signed challenge from the ESP32. If the signature is valid:

1. Creates a **Node PDA account on Solana** via `createNodeOnChain()`
2. Saves the `walletAddress` + `email` association to MongoDB
3. Node is now fully linked and ready to earn rewards

---

### `createNodeOnChain` — Deploy Node PDA to Solana

Derives a **Program Derived Address (PDA)** using seeds `["node", ownerPubkey, devicePubkey]` and calls `initNode` on the Anchor program. This is the permanent on-chain identity of the sensor — it stores the owner, device public key, and reward balance.

```
PDA seeds: ["node", owner.pubkey, device.pubkey]
Program:   2CZ1WzjHhgbBFaRaTxhLpdKQKAEsYDFga6bbuQRHfCJu
```

---

### `syncToSolanaAsync` — Fire-and-Forget Solana Sync

A safe wrapper around `syncToSolana`. Designed to be called without `await` so sensor ingestion doesn't block waiting for Solana confirmation. It:

- Calls `syncToSolana()` with the accumulated reward
- Resets the Web2 reward counter to 0 on success
- Logs errors without crashing the ingestion pipeline
- **Always clears the `syncing` flag** in the `finally` block — the node can never get permanently stuck in a locked state

---

### `syncToSolana` — Write Reward to Solana

The actual on-chain write. Before calling `addReward`, it:

1. Verifies the **on-chain `node.owner` matches the expected wallet** — security check against data tampering
2. Calls `addReward(amount)` on the Anchor program to credit tokens to the node's `rewardBalance`

```
addReward(amount) → node.rewardBalance += amount
```

---

### `claimReward` — User Claims Their Tokens

Called when a user clicks "Claim" on the frontend. It:

1. Verifies the caller's wallet owns the node
2. Checks `rewardBalance > 0` on-chain
3. Calls `claimReward(amount)` on Solana — this performs an **SPL token transfer** from the Treasury ATA to the user's ATA
4. Resets the reward counter after successful claim

```
Treasury ATA ──► SPL Transfer ──► User's Wallet ATA
node.rewardBalance = 0
```

---

### `getUserDashboard` — Fetch All User Nodes

Returns all nodes and their latest sensor readings for a given user email. Powers the frontend dashboard — node cards, AQI levels, reward balances, and claim states.

---

### `createNode` — Register a New Node (Off-chain)

Admin/setup function. Registers a new ESP32 device in MongoDB with its `nodeId` and device public key. Creates an empty `NodeLatest` record ready to receive data. Run once per physical device.

---

## Smart Contract

The Anchor program lives at `2CZ1WzjHhgbBFaRaTxhLpdKQKAEsYDFga6bbuQRHfCJu`.

### Instructions

| Instruction | Who calls it | What it does |
|---|---|---|
| `initNode` | Backend (on link) | Creates Node PDA, stores owner + device key |
| `addReward` | Backend (auto sync) | Increments `rewardBalance` on the node |
| `claimReward` | User (frontend) | SPL transfer: Treasury → User ATA, resets balance |
| `buyProduct` | User (API purchase) | SPL transfer: User ATA → Treasury |
| `withdrawTreasury` | Admin only | Moves tokens from treasury to admin wallet |

### Accounts

```
NodeAccount (PDA)
  ├─ owner:           Pubkey   — linked wallet address
  ├─ devicePublicKey: Pubkey   — ESP32 NaCl public key
  ├─ rewardBalance:   u64      — tokens ready to claim
  └─ bump:            u8       — PDA bump seed

Treasury (PDA)
  └─ seed: ["treasury"]        — holds BREEZO token pool
```

### Key Addresses

| Name | Address |
|---|---|
| Program ID | `2CZ1WzjHhgbBFaRaTxhLpdKQKAEsYDFga6bbuQRHfCJu` |
| BREEZO Mint | `soQUnxjoEMCMxBroyS4AvrtVn2JCtPZnR3N53NA5AvU` |
| Admin Wallet | `4faW5GHsCXwGgQAMmAL7sSENpaezCb63cncWvzGc8iJa` |

---

## API Reference

Base URL: `https://api.breezonetwork.xyz/api/v1`

All endpoints require: `x-api-key: YOUR_API_KEY`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/weather/current?nodeId=` | Latest reading from a node |
| `GET` | `/weather/nearby?lat=&lng=&radius=` | Readings from nearby nodes |
| `GET` | `/weather/history?nodeId=&days=` | Historical data (up to 30 days) |
| `GET` | `/nodes` | List all active nodes |
| `POST` | `/credit/add` | Add API request credits |

### API Access Plans

| Plan | BREEZO Cost | Requests/month |
|---|---|---|
| Basic | 50 BREEZO | 10,000 |
| Intermediate | 250 BREEZO | 100,000 |
| Enterprise | 1,000+ BREEZO | Unlimited / custom |

API credits are purchased on-chain via `buyProduct`. The backend activates quota after on-chain confirmation.

---

## Reward Engine

```js
function calculateReward(pm25) {
  if (pm25 < 50)             return 0.02   // Clean air
  if (pm25 < 100)            return 0.01   // Moderate
  if (pm25 < 300)            return 0.005  // Polluted
  return 0                                 // Hazardous — no reward
}
```

| PM2.5 Range | Air Quality | Reward per Reading |
|---|---|---|
| < 50 | 🟢 Clean | 0.02 BREEZO |
| 50 – 100 | 🟡 Moderate | 0.01 BREEZO |
| 100 – 300 | 🔴 Polluted | 0.005 BREEZO |
| > 300 | ⚫ Hazardous | 0 BREEZO |

Rewards accumulate in `NodeLatest.reward`. Once the threshold of **10 BREEZO** is reached, the backend automatically syncs to Solana via `addReward` and resets the counter.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB
- Solana CLI + Anchor CLI
- A funded Solana wallet (backend keypair)

### Installation

```bash
git clone https://github.com/your-org/breezo-network
cd breezo-network
npm install
```

### Run the backend

```bash
cp .env.example .env
# Fill in your environment variables
npm run dev
```

### Deploy the Anchor program

```bash
cd program
anchor build
anchor deploy --provider.cluster devnet
```

### Initialize the Treasury (one time only)

```bash
node scripts/initTreasury.js
```

This creates the Treasury ATA for the BREEZO mint. Must be run once before any claims can succeed. Then fund it:

```bash
spl-token transfer <BREEZO_MINT> 10000 <TREASURY_ATA> --fund-recipient
```

---

## Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Solana
SOLANA_RPC=https://api.devnet.solana.com
BACKEND_KEYPAIR=[ ... ]          # JSON array of the backend signing keypair

# Program
PROGRAM_ID=2CZ1WzjHhgbBFaRaTxhLpdKQKAEsYDFga6bbuQRHfCJu
BREEZO_MINT=soQUnxjoEMCMxBroyS4AvrtVn2JCtPZnR3N53NA5AvU

# Auth
JWT_SECRET=your_jwt_secret
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hardware | ESP32, NaCl (TweetNaCl), C++ |
| Backend | Node.js, Express, MongoDB, Mongoose |
| Blockchain | Solana, Anchor framework, SPL Token |
| Frontend | React, Vite, `@solana/wallet-adapter` |
| Auth | JWT |

---

## Security

- **Replay attack protection** — sensor packets older than 60 seconds are rejected
- **NaCl signature verification** — only the physical device can submit valid readings
- **On-chain ownership check** — backend verifies `node.owner === expectedWallet` before every sync
- **PDA authority** — treasury funds can only move via program instructions, not direct transfers
- **Admin-only withdrawal** — `withdrawTreasury` checks `admin.key() === ADMIN_WALLET` on-chain

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<div align="center">
  <strong>Built with 🌿 for cleaner air and open data.</strong>
</div>
