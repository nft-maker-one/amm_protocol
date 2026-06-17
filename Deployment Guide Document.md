# AMM Protocol Full-Stack Deployment Guide

## 1. Overview & Architecture

This guide details the end-to-end deployment process for the AMM Protocol, covering both the Smart Contract (Foundry) and Frontend (React/Vite) layers.

### Directory Structure & Responsibilities

| Module        | Location     | Responsibilities                          | Key Outputs                            |
| ------------- | ------------ | ----------------------------------------- | -------------------------------------- |
| **Contracts** | `contracts/` | Build, Test, Deploy (Factory/Pool/Tokens) | Contract Addresses, ABI Artifacts      |
| **Frontend**  | `frontend/`  | UI Logic, Interaction, Data Display       | Updated `src/api` Config, Validated UI |

---

## 2. Prerequisites

Ensure the following are installed before starting:

- **Foundry**: (`forge`, `anvil`, `cast`)
- **Node.js & npm**
- **OpenZeppelin Contracts**: Installed via `forge install OpenZeppelin/openzeppelin-contracts` inside the `contracts` directory.

---

## 3. Part I: Contract Deployment (`contracts/`)

**All commands in this section should be run inside the `contracts/` directory.**

### 3.1 Build & Test

Compile contracts and run the test suite to ensure stability.

```bash
forge build
forge test
forge test -vv          # Verbose output
forge test --gas-report # Gas usage report

```

### 3.2 Start Local Blockchain

Open a new terminal window and run Anvil. **Keep this window open.**

```bash
anvil
# Or fork mainnet:
# anvil --fork-url [https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY](https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY)

```

> **Default Anvil Account (for testing):**
>
> * **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
> * **Private Key:** `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
>
> 

### 3.3 Deploy Scripts

Run the deployment scripts in the following order.

#### Step A: Deploy Mock Tokens

```bash
forge script script/DeployTokens.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast

```

*Action: Record the Token addresses from the output.*

#### Step B: Deploy AMM Protocol (Factory)

```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast

```

*Action: Record the Factory address from the output.*

#### Step C: Add Liquidity & Swap (Optional Script Interaction)

To quickly initialize a pool and swap without the UI:

```bash
forge script script/AddLiquidityAndSwap.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 -vvvv

```

---

## 4. Part II: Frontend Integration (`frontend/`)

**All commands in this section should be run inside the `frontend/` directory.**

### 4.1 Install Dependencies

```bash
npm install

```

### 4.2 Sync Contract Addresses (CRITICAL)

You must update the frontend configuration to point to your new Anvil deployment.

1. Open **`frontend/src/api/amm.js`**.
2. Update the following constants with addresses from **Section 3.3**:

* `FACTORY_ADDRESS` (or `AMMFACTORY_ADDRESS`)
* `AMMPOOL_ADDRESS` (if a pool was pre-deployed)


3. Open **`frontend/src/api/tokens.js`**.

* Update Token addresses and decimals if you deployed new MockTokens.



### 4.3 Sync ABIs

If you modified the Solidity code, update the ABI files:

1. Locate the JSON artifacts in `contracts/out/`.
2. Copy/Paste the ABI content into the corresponding files in **`frontend/src/api/abi/`**.

### 4.4 Start Frontend

```bash
npm run dev

```

Access the UI at `http://localhost:5173` (or the port shown in your terminal).

---

## 5. Usage & Verification Flow

Follow this strict order to verify the system end-to-end:

1. **Deploy Contracts**: (Section 3) Ensure Factory and Tokens are live.
2. **Create Pool (UI or Script)**:

* Call `factory.createPool(tokenA, tokenB, fee)`.
* *Note: Ensure the fee tier (e.g., 3000 for 0.3%) is enabled.*


3. **Initialize Pool**:

* Set the initial price (`sqrtPriceX96`).


4. **Add Liquidity**:

* Mint a position with a valid tick range (`tickLower`, `tickUpper`).


5. **Swap**:

* Perform a trade and verify that balances update and fees are collected.



---

## 6. Technical Reference

### Key Contract Interfaces

* **AMMFactory**:
* `createPool(tokenA, tokenB, fee)`: Deploys a new pool.
* `enableFeeAmount(fee, tickSpacing)`: Admin only.


* **AMMPool**:
* `initialize(sqrtPriceX96)`: Sets initial price.
* `mint(...)`: Adds liquidity (requires Price Range).
* `swap(...)`: Executes trade (Exact Input/Output).
* `collect(...)`: Claims accumulated fees.



### Key Features

* ✅ **Concentrated Liquidity**: LPs specify custom price ranges.
* ✅ **Multiple Fee Tiers**: Supports 0.05%, 0.3%, 1%.
* ✅ **Slippage Protection**: Supported via `sqrtPriceLimitX96`.

---

## 7. Troubleshooting

| Issue                      | Solution                                                     |
| -------------------------- | ------------------------------------------------------------ |
| **Frontend Read Failures** | Check `frontend/src/api/amm.js`. Addresses must match the *current* Anvil session. |
| **Pool Creation Fails**    | Verify the Factory address is correct and the Fee Tier is enabled in the contract. |
| **Swap Fails**             | Ensure the pool is **Initialized** and has **Liquidity** in the current price range. |
| **Metamask Issues**        | Reset Metamask account ("Settings > Advanced > Clear Activity Tab Data") to clear old nonces. |

---

## 8. Network Deployment Cheat Sheet

### Sepolia Testnet

```bash
forge script script/Deploy.s.sol --rpc-url [https://sepolia.infura.io/v3/YOUR_API_KEY](https://sepolia.infura.io/v3/YOUR_API_KEY) --private-key YOUR_PRIVATE_KEY --broadcast --verify

```

### Mainnet Fork (Local)

```bash
anvil --fork-url [https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY](https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY)
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key YOUR_PRIVATE_KEY --broadcast

```
