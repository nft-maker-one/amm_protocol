# Deployment Guide

## 1. Purpose
This guide emphasizes “where each deployment step lives”: contract directory, script directory, and frontend directory. Follow the order: contracts first, frontend second, then end-to-end verification.

## 2. Step Distribution Map (Read First)

| Module | Location | Responsibilities | Outputs / Sync Targets |
|---|---|---|---|
| Contract build & script deploy | [contracts](contracts) | Foundry build/tests, script deployment for Factory/Token/Pool | Contract addresses, ABI/bytecode artifacts |
| Frontend setup & configuration | [frontend](frontend) | Run frontend, sync addresses/ABI, validate UI flows | Update contract addresses & ABI, verify UI functions |
| Interaction scripts (optional) | [contracts/script](contracts/script) | Quick non-UI validation & interactions | Cross-check with UI behavior |

---

## 3. Contract-Side Deployment (contracts)

### 3.1 Build & Test
In [contracts](contracts):
- `forge build`
- `forge test`

Build outputs bytecode and ABI under contracts/out, used by the frontend deploy page or to refresh frontend ABI files.

### 3.2 Start a Local Chain or Use Testnet
- Local: `anvil`
- Testnet: Sepolia RPC

### 3.3 Deployment Steps (Scripts)
Scripts are in [contracts/script](contracts/script):
1. Deploy MockToken: DeployTokens.s.sol
2. Deploy Factory/Pool: Deploy.s.sol
3. Interaction checks (optional): Interact.s.sol

Recommended order: Token → Factory → Pool → Initialize


### 3.4 Contract Reference
For detailed script usage, see:
- [contracts/DEPLOYMENT_GUIDE.md](contracts/DEPLOYMENT_GUIDE.md)

---

## 4. Frontend Deployment (frontend)

### 4.1 Install & Run
In [frontend](frontend):
- `npm install`
- `npm run dev`

### 4.2 Sync Contract Addresses (Required)
Frontend address constants live in:
- [frontend/src/api/amm.js](frontend/src/api/amm.js)

Update:
- `AMMPOOL_ADDRESS`
- `FACTORY_ADDRESS` / `AMMFACTORY_ADDRESS`

> If you deployed a new Pool or Factory and do not update these, the UI will not read/write correctly.

### 4.3 Sync ABI (Recommended)
Frontend ABI files are under:
- [frontend/src/api/abi](frontend/src/api/abi)

If contracts change, copy the matching ABI from contracts/out into this directory.

### 4.4 Token Address Book
Token list config is here:
- [frontend/src/api/tokens.js](frontend/src/api/tokens.js)

If you deployed new MockToken(s), update addresses and decimals here.

---

## 5. Recommended Deployment Order (Strict)
1. contracts: build & test → ensure passing
2. contracts: deploy Token & Factory → record addresses
3. contracts or frontend: create Pool and initialize price
4. frontend: update addresses & ABI → ensure read/write works
5. frontend: validate features → Swap/Liquidity/Analytics

---

## 6. Common Issues
- Frontend read failures: check the latest addresses in [frontend/src/api/amm.js](frontend/src/api/amm.js).
- Pool creation fails: confirm Factory address and fee tier are enabled.
- Swap fails: check pool is initialized and has liquidity.

---

## 7. Frontend Deployment Page (Optional Alternative)
You can also deploy Factory/Token/Pool and initialize via the UI:
- Page file: [frontend/src/pages/DeploymentPage.jsx](frontend/src/pages/DeploymentPage.jsx)

