# AMM Protocol Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying and testing the AMM protocol using Foundry and Anvil.

## Prerequisites
- Foundry installed
- OpenZeppelin contracts installed (`forge install OpenZeppelin/openzeppelin-contracts`)

## Quick Start Commands

### 1. Compile Contracts
```bash
forge build
```

### 2. Run Tests
```bash
forge test
forge test -vv  # verbose output
forge test --gas-report  # with gas reporting
```

### 3. Start Anvil Local Chain
```bash
anvil
# Or fork mainnet:
anvil --fork-url https://eth-mainnet.alchemyapi.io/v2/KEY
```

### 4. Deploy Contracts

#### Deploy Tokens
```bash
forge script script/DeployTokens.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

forge script script/AddLiquidityAndSwap.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 -vvvv

#### Deploy AMM Protocol
```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

#### Interact with Deployed Contracts
```bash
# First, update addresses in script/Interact.s.sol with deployed contract addresses
forge script script/Interact.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

## Contract Interfaces

### 1. AMMFactory Interface

#### Main Functions:
- `createPool(address tokenA, address tokenB, uint24 fee)` - Create new trading pair
- `getPool(address tokenA, address tokenB, uint24 fee)` - Get pool address
- `enableFeeAmount(uint24 fee, int24 tickSpacing)` - Enable new fee tier (owner only)

#### Events:
- `PoolCreated(address token0, address token1, uint24 fee, int24 tickSpacing, address pool)`

### 2. AMMPool Interface

#### Core Functions:
- `initialize(uint160 sqrtPriceX96)` - Initialize pool price
- `mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes data)` - Add liquidity
- `burn(int24 tickLower, int24 tickUpper, uint128 amount)` - Remove liquidity
- `swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes data)` - Execute trade
- `collect(address recipient, int24 tickLower, int24 tickUpper, uint128 amount0Requested, uint128 amount1Requested)` - Collect fees

#### View Functions:
- `slot0()` - Current price and tick info
- `liquidity()` - Current active liquidity
- `positions(bytes32 key)` - Position details
- `ticks(int24 tick)` - Tick information

### 3. MockToken Interface (ERC20)
- `mint(address to, uint256 amount)` - Mint tokens (owner only)
- `burn(uint256 amount)` - Burn your tokens
- Standard ERC20 functions: `transfer`, `approve`, `balanceOf`, etc.

## Key Features Implemented

### ✅ Concentrated Liquidity
- Liquidity providers can specify price ranges (tickLower to tickUpper)
- More capital efficient than traditional AMMs
- Multiple positions per user supported

### ✅ Trading/Swapping
- Basic swap functionality with fee collection
- Support for exact input swaps
- Price impact calculation
- Slippage protection via price limits

### ✅ Pool Creation
- Factory pattern for creating new trading pairs
- Multiple fee tiers: 0.05%, 0.3%, 1%
- Automatic token ordering (token0 < token1)

### ✅ Fee Collection
- Protocol fees on trades
- Fee accumulation for liquidity providers
- Manual fee collection by LPs

## Example Usage Flow

1. **Deploy tokens and AMM contracts**
2. **Create a pool:**
   ```solidity
   address pool = factory.createPool(tokenA, tokenB, 3000); // 0.3% fee
   ```

3. **Initialize pool price:**
   ```solidity
   AMMPool(pool).initialize(79228162514264337593543950336); // price = 1
   ```

4. **Add liquidity:**
   ```solidity
   pool.mint(user, -60, 60, 1000 * 1e18, "");
   ```

5. **Execute swap:**
   ```solidity
   pool.swap(user, true, 100 * 1e18, minSqrtPrice, "");
   ```

## Testing Commands

### Run Specific Tests
```bash
forge test --match-test test_CreatePool
forge test --match-test test_AddLiquidity
forge test --match-test test_Swap
```

### Run Tests with Coverage
```bash
forge coverage
```

### Run Gas Snapshot
```bash
forge snapshot
```

## Deployment on Different Networks

### Local Anvil
```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key YOUR_PRIVATE_KEY --broadcast
```

### Testnet (Sepolia)
```bash
forge script script/Deploy.s.sol --rpc-url https://sepolia.infura.io/v3/YOUR_API_KEY --private-key YOUR_PRIVATE_KEY --broadcast --verify
```

### Mainnet Fork Testing
```bash
anvil --fork-url https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key YOUR_PRIVATE_KEY --broadcast
```

## Important Notes

1. **Token Ordering**: The protocol automatically sorts tokens (token0 < token1)
2. **Tick Spacing**: Each fee tier has specific tick spacing (60 for 0.3%)
3. **Price Format**: Prices use sqrtPriceX96 format for precision
4. **Gas Optimization**: Basic optimizations implemented, can be further improved
5. **Security**: This is a simplified implementation - additional security measures needed for production

## Default Anvil Account
Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`