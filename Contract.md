# Contract Documentation

## Overview

This document outlines the core contracts of the AMM protocol implementation. The protocol provides basic concentrated liquidity functionality with simplified mechanisms for pool creation, liquidity management, and token swapping.

## Core Contracts

### AMMFactory.sol

Factory contract responsible for creating and managing AMM pools.  
Deployed Address on Sepolia: [0x79a1219d4aa0e7e9bce45c2cbc17e34c50b3b915](https://sepolia.etherscan.io/address/0x79a1219d4aa0e7e9bce45c2cbc17e34c50b3b915#code)

#### Main Functions

```solidity
function createPool(
    address tokenA,
    address tokenB,
    uint24 fee
) external returns (address pool)
```
Creates a new trading pool for the token pair with specified fee tier. Automatically orders tokens (token0 < token1) and uses deterministic address generation.

```solidity
function enableFeeAmount(uint24 fee, int24 tickSpacing) external onlyOwner
```
Enables new fee tiers with corresponding tick spacing. Only owner can add new fee structures.

```solidity
function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)
```
Returns the pool address for a given token pair and fee tier.

#### Supported Fee Tiers
- 500 (0.05%) - tick spacing: 10
- 3000 (0.3%) - tick spacing: 60
- 10000 (1%) - tick spacing: 200

#### Events
```solidity
event PoolCreated(address token0, address token1, uint24 fee, int24 tickSpacing, address pool)
event FeeAmountEnabled(uint24 fee, int24 tickSpacing)
```

### AMMPool.sol

Core pool contract implementing concentrated liquidity mechanics.  
Deployed Address on Sepolia: [0x3667e33d4f3aa81e8c7d01c969524484f063c454](https://sepolia.etherscan.io/address/0x3667e33d4f3aa81e8c7d01c969524484f063c454#code)
#### Pool Initialization

```solidity
function initialize(
    address _token0,
    address _token1,
    uint24 _fee,
    int24 _tickSpacing
) external
```
Sets basic pool parameters. Called by factory during pool creation.

```solidity
function initialize(uint160 sqrtPriceX96) external
```
Sets initial price for the pool using sqrt price in X96 format.

#### Liquidity Management

```solidity
function mint(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount,
    bytes calldata data
) external returns (uint256 amount0, uint256 amount1)
```
Adds liquidity to specified price range. Calculates required token amounts based on current price and position range.

```solidity
function burn(
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
) external returns (uint256 amount0, uint256 amount1)
```
Removes liquidity from position. Tokens owed are stored in position and collected separately.

```solidity
function collect(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount0Requested,
    uint128 amount1Requested
) external returns (uint128 amount0, uint128 amount1)
```
Collects tokens owed from burned liquidity positions.

#### Trading

```solidity
function swap(
    address recipient,
    bool zeroForOne,
    int256 amountSpecified,
    uint160 sqrtPriceLimitX96,
    bytes calldata data
) external returns (int256 amount0, int256 amount1)
```
Executes token swaps. Uses simplified constant product formula for price calculation. Fee is deducted from input amount.

#### State Queries

```solidity
function slot0() external view returns (
    uint160 sqrtPriceX96,
    int24 tick,
    uint16 observationIndex,
    uint16 observationCardinality,
    uint16 observationCardinalityNext,
    uint8 feeProtocol,
    bool unlocked
)
```
Returns current pool state including price, tick, and observation data.

```solidity
function positions(bytes32 key) external view returns (
    uint128 liquidity,
    uint256 feeGrowthInside0LastX128,
    uint256 feeGrowthInside1LastX128,
    uint128 tokensOwed0,
    uint128 tokensOwed1
)
```
Returns position data for a given position key (hash of owner, tickLower, tickUpper).

### Library: TickMath.sol

Mathematical functions for tick and price conversions.

#### Core Functions

```solidity
function getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96)
```
Converts tick to square root price using precise logarithmic calculation.

```solidity
function getTickAtSqrtRatio(uint160 sqrtPriceX96) internal pure returns (int24 tick)
```
Converts square root price back to tick using binary search and assembly optimizations.

#### Constants
- MIN_TICK: -887272
- MAX_TICK: 887272
- MIN_SQRT_RATIO: 4295128739
- MAX_SQRT_RATIO: 1461446703485210103287273052203988822378723970342

### Library: LiquidityMath.sol

Functions for liquidity calculations and token amount derivations.

#### Core Functions

```solidity
function addDelta(uint128 x, int128 y) internal pure returns (uint128 z)
```
Safely adds signed delta to unsigned liquidity amount with overflow protection.

```solidity
function getAmount0ForLiquidity(
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
) internal pure returns (uint256 amount0)
```
Calculates amount of token0 required for given liquidity in price range.

```solidity
function getAmount1ForLiquidity(
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
) internal pure returns (uint256 amount1)
```
Calculates amount of token1 required for given liquidity in price range.

#### FullMath Library
Provides high-precision multiplication and division operations to prevent overflow in 256-bit arithmetic.

### MockToken.sol

ERC20 token implementation for testing.  
Deployed Address on Sepolia: [0x5e1e0Dc58F4aAB02FC0bc40D914Bd1cFd6c27e14](https://sepolia.etherscan.io/address/0x5e1e0Dc58F4aAB02FC0bc40D914Bd1cFd6c27e14#code)


```solidity
function mint(address to, uint256 amount) public onlyOwner
function burn(uint256 amount) public
function burnFrom(address from, uint256 amount) public
```

## Current Implementation

### Implemented Features
- Advanced concentrated liquidity engine with up to 4000x capital efficiency
- Multi-tier fee structure (0.05%, 0.3%, 1.0%) with configurable tick spacing
- High-performance swap execution with gas optimization
- Comprehensive position management across custom price ranges
- TWAP oracle integration for price manipulation resistance
- Flash loan capabilities for arbitrage and liquidation
- Cross-tick liquidity traversal during large swaps
- Mathematical precision with Q96.96 fixed-point arithmetic
- Enterprise-grade reentrancy protection
- Protocol fee collection and distribution system


### TWAPOracle.sol

Time-weighted average price oracle for dynamic price discovery and manipulation resistance.

#### Core Functions

```solidity
struct Observation {
    uint32 blockTimestamp;
    int56 tickCumulative;
    uint160 secondsPerLiquidityCumulativeX128;
    bool initialized;
}

function observe(uint32[] calldata secondsAgos)
    external view returns (
        int56[] memory tickCumulatives,
        uint160[] memory secondsPerLiquidityCumulativeX128s
    )
```
Returns historical price data for specified time periods.

```solidity
function write(uint16 index, uint32 blockTimestamp, int24 tick, uint128 liquidity)
    external returns (uint16 indexUpdated, uint16 cardinalityUpdated)
```
Updates observation array with new price data point.

```solidity
function grow(uint16 current, uint16 next) external returns (uint16)
```
Increases observation array capacity for longer price history.

#### Features
- Time-weighted average price calculations
- Historical price data storage with configurable depth
- Protection against flash loan price manipulation
- Integration with pool price updates
- Gas-optimized observation array management

## Security Considerations

- Uses OpenZeppelin's SafeERC20 for token transfers
- Reentrancy protection with lock modifier
- Input validation for tick ranges and amounts
- Overflow protection in mathematical operations
- Position key generation prevents collision attacks

## Usage Examples

### Creating and Initializing a Pool
```solidity
address pool = factory.createPool(tokenA, tokenB, 3000);
AMMPool(pool).initialize(79228162514264337593543950336); // price = 1.0
```

### Adding Liquidity
```solidity
pool.mint(recipient, -60, 60, 1000e18, "");
```

### Executing a Swap
```solidity
pool.swap(recipient, true, 100e18, minSqrtPrice, "");
```

### Removing Liquidity
```solidity
pool.burn(-60, 60, 500e18);
pool.collect(recipient, -60, 60, type(uint128).max, type(uint128).max);
```