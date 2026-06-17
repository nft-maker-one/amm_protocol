# AMM Protocol Frontend User Guide

## Overview

This is an automated market maker (AMM) protocol frontend interface based on innovative curve design, providing comprehensive pool management, token swapping, and liquidity management features.

## Prerequisites

1. **Compile contract to get bytecode**
   - Enter the `contracts` directory
   - Run `forge build` to compile contracts
   - Bytecode file locations:
     - Factory: `out/AMMFactory.sol/AMMFactory.json` → `bytecode.object`
     - Token: `out/MockToken.sol/MockToken.json` → `bytecode.object`

2. **Connect wallet**
   - Ensure MetaMask is installed
   - Connect to Sepolia testnet

## Main Function Modules

### 1. Token Swapping (SwapPage)

**Core Features**:
- Smart routing system supports direct and multi-hop swaps
- Real-time price estimation and slippage protection
- Integrated pool management system

**Usage Steps**:
1. **Select swap tokens**
   - Payment token (Token A): Select the token and amount to pay
   - Receive token (Token B): Select the token to receive
   - System provides preset token list and supports custom contract addresses

2. **Pool management**
   - Use "Pool Selector" to view and manage pool lists
   - Find existing pools via Token A, Token B addresses and fee
   - Create new pool feature (only when pool doesn't exist)
   - Independent Slot0 status reading feature

3. **Execute swap**
   - System automatically performs price estimation and slippage calculation
   - Supports custom slippage percentage settings
   - One-click swap execution

**Advanced Features**:
- Multi-hop routing: Indirect swaps via common tokens (WETH, USDC, etc.)
- Path optimization: Automatically selects optimal swap path and best price
- Debug information: Detailed logs of routing calculation process

### 2. Liquidity Management (LiquidityPage)

**Features**:
- Add and remove liquidity for trading pools
- Support concentrated liquidity with specified price ranges
- Liquidity position management and yield calculation

### 3. Advanced Trading (AdvancedTradePage)

**Permission Management**:
- Factory Owner exclusive features (Owner only)
- Real-time permission status checking
- Conditional UI rendering

**Owner Exclusive Features**:
- Factory contract management
- Advanced parameter configuration
- System-level operation permissions

### 4. Analytics and Data (AnalyticsPage)

**Data Display**:
- Pool trading data and statistical analysis
- Price trend charts
- Liquidity distribution visualization

### 5. Smart Contract Deployment (DeploymentPage)

**Deployment Features**:
- Factory contract deployment
- MockToken deployment
- Pool initialization

### 6. Mock Token Management (MockTokenPage)

**Token Operations**:
- Create test tokens
- Token balance queries
- Transfer and approval operations

## Pool Management System

### Core Features

1. **Persistent Storage**: Uses localStorage to save pool lists, data persists after page refresh
2. **Smart Detection**: Automatically detects and adds newly discovered pools
3. **State Synchronization**: Real-time updates of pool initialization status and price information
4. **Separation of Concerns**: Pool creation and status query functions are completely separate

### API Interface

**Pool Management API** (`src/api/pools.js`):
- `getPoolList()` - Get pool list
- `addPoolToList(poolInfo)` - Add pool to list
- `updatePoolInList(address, updates)` - Update pool information
- `createAndAddPool()` - Create new pool and add to list
- `refreshPoolStatus()` - Refresh pool status
- `getPoolDisplayName()` - Get formatted display name

### Pool Information Structure

```javascript
{
  address: "0x...",           // Pool contract address
  token0: "0x...",           // Token0 address (lexicographically sorted)
  token1: "0x...",           // Token1 address
  token0Meta: {...},         // Token0 metadata (symbol, decimals, etc.)
  token1Meta: {...},         // Token1 metadata
  fee: 3000,                 // Fee amount (basis points)
  isInitialized: true,       // Whether initialized
  sqrtPriceX96: "...",      // Current price (sqrt format)
  currentTick: "...",        // Current tick
  createdAt: 1234567890,     // Creation timestamp
  updatedAt: 1234567890      // Last update time
}
```

## Routing System

### Smart Routing Algorithm

1. **Direct Path**: Check if direct trading pool exists between two tokens
2. **Multi-hop Path**: Indirect swaps via common tokens
3. **Price Comparison**: Automatically select path with optimal exchange rate
4. **Path Validation**: Ensure all pools on the path are available

### Supported Routing Strategies

- **Single-hop swap**: TokenA → TokenB (direct path)
- **Dual-hop swap**: TokenA → CommonToken → TokenB
- **Optimal Selection**: Compare all possible paths and choose best rate

### Common Token Configuration

System preset routing relay tokens include:
- WETH (Wrapped Ethereum)
- USDC (USD Coin)
- USDT (Tether USD)
- DAI (Dai Stablecoin)

## Complete Usage Flow

### Initial Setup

1. **Deploy base contracts**
   - Deploy Factory contract
   - Deploy test tokens (TokenA, TokenB)
   - Record all contract addresses

2. **Create trading pool**
   - Select TokenA and TokenB on "Token Swap" page
   - Set fee rate (usually 3000 = 0.3%)
   - Click "Find Pool", if not found choose "Create New Pool"

3. **Initialize pool**
   - Initialize pool price on "Deployment" page
   - Or auto-initialize when creating pool

### Daily Trading Operations

1. **Token Swap**
   - Select token pair to swap
   - Enter swap amount
   - Confirm price and slippage
   - Execute transaction

2. **Provide Liquidity**
   - Select pool on "Liquidity" page
   - Specify liquidity range
   - Add liquidity funds

3. **Monitor and Analyze**
   - Use "Analytics" page to view trading data
   - Monitor liquidity yield
   - Track price trends

## Configuration Guide

### Network Configuration

Default connection to Sepolia testnet:
- Chain ID: 11155111
- RPC URL: Auto-use MetaMask configuration
- Explorer: https://sepolia.etherscan.io/

### Token List Configuration

Preset token list contains common test tokens, location: `src/api/tokens.js`

### Fee Settings

Supported fee tiers:
- 500 (0.05%) - Stablecoin pairs
- 3000 (0.3%) - Standard rate
- 10000 (1%) - High-risk assets

## Troubleshooting

### Common Issues

1. **"Pool not found"**
   - Confirm token addresses are correct
   - Check fee settings
   - Use "Create New Pool" feature

2. **"Transaction failed"**
   - Check token approval amount
   - Confirm wallet balance is sufficient
   - Adjust slippage settings

3. **"Read failed"**
   - Confirm network connection is normal
   - Check contract address validity
   - Retry operation

### Debug Features

- View detailed error information in browser console
- Debug logs for routing calculation process
- Simulated testing for contract calls

## API Reference

### Core API Files

- `src/api/amm.js` - AMM contract interaction
- `src/api/pools.js` - Pool management
- `src/api/routing.js` - Routing calculation
- `src/api/tokens.js` - Token management

### Key Functions

```javascript
// Swap related functions
swapExactIn(provider, signer, poolAddress, zeroForOne, amountIn)
estimateSwapOut(provider, poolAddress, zeroForOne, amountIn)

// Pool management
getPool(provider, tokenA, tokenB, fee)
createPool(provider, signer, tokenA, tokenB, fee)
readSlot0(provider, poolAddress)

// Routing calculation
findBestRoute(provider, tokenIn, tokenOut, amountIn)
executeMultiHopSwap(provider, signer, route, amountIn)
```

## Security Considerations

1. **Test Environment**: Currently on Sepolia testnet, do not use real funds
2. **Private Key Security**: Use test wallets, avoid exposing mainnet private keys
3. **Contract Verification**: Ensure contract addresses used are verified
4. **Slippage Settings**: Set slippage protection reasonably based on market conditions
5. **Authorization Management**: Regularly review and revoke unnecessary token approvals
