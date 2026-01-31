- [ ] Innovative AMM Frontend

  This is the frontend repository for our Group Project: **Innovative AMM Protocol**.
  It allows users to swap tokens, manage liquidity, and view market analytics interactively.

  ## Tech Stack (Environment)

  - **Runtime**: Node.js (v20.x or higher recommended)
  - **Build Tool**: Vite
  - **Framework**: React.js
  - **Web3 Library**: ethers.js (v6.x)
  - **Routing**: react-router-dom
  - **Icons**: Lucide React

  ## Getting Started

  ### 1. Prerequisites
  Ensure you have `Node.js` installed.

      node -v
      # Should be v18+ or v20+

  ### 2. Installation
  Clone the repository and install dependencies:

      git clone <repository-url>
      cd my-amm-project
      npm install

  ### 3. Running Locally
  Start the development server:

      npm run dev

  Open http://localhost:5173 in your browser.

  ---

  ## Backend & Smart Contract Integration

  To connect the frontend with the smart contracts, we need to configure the **ABI** and **Contract Address**.

  ### 1. Contract Address
  Please update the contract address constant in `src/utils/constants.js` (or `.env` file):

      export const CONTRACT_ADDRESS = "0x..."; // <--- Replace with deployed address

  ### 2. ABI (Application Binary Interface)
  Place the compiled contract ABI JSON file in the `src` folder (or `src/abis/`).
  * **File Name**: `SwapABI.json` (or similar)
  * **Required Functions**:
      * `swap(tokenIn, amountIn, minAmountOut, deadline)`
      * `addLiquidity(tokenA, tokenB, amountA, amountB)`
      * `removeLiquidity(percent)`
      * `getReserves()` (for price fetching)

  ---

  ## Project Structure

      my-amm-project/
      ├── src/
      │   ├── components/      # Reusable UI components
      │   ├── pages/           # Main views (Swap, Liquidity, Trade, Analytics)
      │   ├── App.jsx          # Main application logic & Routing
      │   ├── index.css        # Global styles
      │   └── main.jsx         # Entry point
      ├── public/              # Static assets
      └── package.json         # Dependencies

  ## Features Checklist (Frontend)

  - [x] **Swap Interface**: Token exchange UI with slippage settings.
  - [x] **Liquidity Management**: Add/Remove liquidity dashboard.
  - [x] **Advanced Routing**: Cross-chain & multi-hop settings UI.
  - [x] **Analytics**: Price charts and TVL display placeholders.
  - [ ] **Integration**: Pending smart contract deployment.
