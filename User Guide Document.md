# AMM Protocol User Guide


---

## 1. Prerequisites
1. Install and enable MetaMask.
2. Switch to Sepolia testnet (Chain ID: 11155111).
3. Ensure frontend addresses are synced (see [frontend/src/api/amm.js](frontend/src/api/amm.js)).

---

## 2. Page Overview and Interaction Flows

### 2.1 Swap
Page: [frontend/src/pages/SwapPage.jsx](frontend/src/pages/SwapPage.jsx)

What you can do:
- Select Token A / Token B
- Estimate output and slippage
- Find or create pools
- Submit swap transactions

Recommended flow:
1. Select Token A / Token B
2. Click “Find Pool” to confirm the pool exists
3. Enter amount, click “Swap Now”
4. Sign in the confirmation modal

Notes:
- If no pool exists, the page will prompt you to create one
- Ensure the pool has liquidity before swapping

---

### 2.2 Liquidity Management
Page: [frontend/src/pages/LiquidityPage.jsx](frontend/src/pages/LiquidityPage.jsx)

What you can do:
- Select a pool
- Add liquidity (mint)
- Remove liquidity (burn)
- Collect fees

Recommended flow:
1. Select a pool (prefer PoolSelector in the UI)
2. Set tickLower / tickUpper
3. Click “Quote” to preview required token amounts
4. Confirm add liquidity
5. To exit: remove liquidity first, then collect fees

Notes:
- Adding liquidity requires two steps: approve + mint
- After removal, tokens are not transferred immediately; click “Collect Fees”

---

### 2.3 Advanced Routing & Settings
Page: [frontend/src/pages/AdvancedTradePage.jsx](frontend/src/pages/AdvancedTradePage.jsx)

What you can do:
- Query Factory owner
- Enable new fee tiers (owner only)
- Run multi-hop routing tests

Recommended flow:
1. Check whether current wallet is the Factory owner
2. Only the owner can enable new fee tiers
3. Use routing tests to inspect available paths and estimates

---

### 2.4 Analytics
Page: [frontend/src/pages/AnalyticsPage.jsx](frontend/src/pages/AnalyticsPage.jsx)

What you can do:
- Read core pool data (slot0/liquidity)
- View TVL, 24h volume, price trend
- Analyze liquidity distribution, impermanent loss, price impact

Recommended flow:
1. Select a pool and click “Load Data”
2. Review key metrics and charts
3. Use the tool panel for slippage and IL calculations

---

### 2.5 Deployment Center
Page: [frontend/src/pages/DeploymentPage.jsx](frontend/src/pages/DeploymentPage.jsx)

What you can do:
- Deploy Factory
- Deploy MockToken
- Create Pool
- Initialize Pool price

Recommended flow:
1. Factory → 2. Token → 3. Create Pool → 4. Initialize
2. After initialization, proceed to Swap/Liquidity

Notes:
- Bytecode must be copied from compiled contract artifacts
- Sync deployed addresses back to frontend configuration

---

### 2.6 MockToken Management
Page: [frontend/src/pages/MockTokenPage.jsx](frontend/src/pages/MockTokenPage.jsx)

What you can do:
- Query token info and balance
- Mint tokens (owner only)
- Burn tokens (anyone)

Recommended flow:
1. Select or input a token address
2. Query balance and owner info
3. Owner can mint; anyone can burn

---

## 3. Pool List and State Persistence
Pool management uses local storage. Entry point:
- [frontend/src/api/pools.js](frontend/src/api/pools.js)

Key points:
- Pool list is stored in browser localStorage
- Refreshing does not lose the list
- Selected pool is shared across pages

---

## 4. Common Interaction Issues
- Cannot find pool: verify token addresses and fee tier
- Swap fails: ensure pool is initialized and has liquidity
- Mint fails: ensure current wallet is token owner

---

## 5. Recommended Daily Flow
1. Deploy or select tokens
2. Create a pool and initialize price
3. Add liquidity
4. Swap
5. Check analytics
