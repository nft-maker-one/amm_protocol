import { ethers } from 'ethers';
import { getPoolContract, readSlot0, readPoolTokens, estimateSwapOut, swapExactIn, getPool } from './amm';
import { TOKENS } from './tokens';

/**
 * Multi-hop routing implementation for AMM
 * Based on Uniswap V3 routing concepts
 */

// Common token address configuration
export const COMMON_TOKENS = {
  WETH: TOKENS.WETH.address,
  USDC: TOKENS.USDC.address,
  USDT: TOKENS.USDT.address,
  DAI: TOKENS.DAI.address,
  WBTC: TOKENS.WBTC.address,
  UNI: TOKENS.UNI.address
};

// Common fee rate settings
export const COMMON_FEES = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

// Supported blockchain network configurations
export const COMMON_CHAINS = [
  { id: 11155111, name: 'Sepolia Ethereum', label: 'Sepolia', isTestnet: true },
  { id: 1, name: 'Ethereum', label: 'Mainnet', isTestnet: false },
  { id: 10, name: 'Optimism', label: 'Optimism', isTestnet: false },
  { id: 42161, name: 'Arbitrum One', label: 'Arbitrum', isTestnet: false }
];

/**
 * Route path structure
 */
export class RoutePath {
  constructor(tokens, fees) {
    this.tokens = tokens; // [tokenA, tokenB, tokenC] 
    this.fees = fees;     // [fee1, fee2] (n-1 fees for n tokens)
    this.pools = [];      // Pool address array
    this.quotes = [];     // Quote for each hop
  }

  get hops() {
    return this.tokens.length - 1;
  }
}

/**
 * Main Router class
 */
export class MultiHopRouter {
  constructor(provider, factoryAddress) {
    this.provider = provider;
    this.factoryAddress = factoryAddress;
    this.poolCache = new Map(); // Cache pool addresses
  }

  /**
   * Get pool address between two tokens
   */
  async getPoolAddress(tokenA, tokenB, fee) {
    const key = `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}-${fee}`;
    
    if (this.poolCache.has(key)) {
      return this.poolCache.get(key);
    }

    try {
      // Use factory contract's getPool method
      const poolAddress = await getPool(this.provider, tokenA, tokenB, fee);
      
      // Verify if pool exists
      if (poolAddress && poolAddress !== ethers.ZeroAddress) {
        const poolExists = await this.verifyPoolExists(poolAddress);
        
        if (poolExists) {
          this.poolCache.set(key, poolAddress);
          return poolAddress;
        }
      }
      
      return null;
    } catch (err) {
      console.warn(`Failed to get pool address: ${tokenA}-${tokenB}-${fee}:`, err.message);
      return null;
    }
  }

  /**
   * Verify if pool exists
   */
  async verifyPoolExists(poolAddress) {
    try {
      const code = await this.provider.getCode(poolAddress);
      return code !== '0x';
    } catch {
      return false;
    }
  }

  /**
   * Find optimal routing path
   */
  async findBestRoute(tokenIn, tokenOut, amountIn, maxHops = 3) {
    const allRoutes = await this.generatePossibleRoutes(tokenIn, tokenOut, maxHops);
    
    if (allRoutes.length === 0) {
      throw new Error('No available trading path found');
    }

    let bestRoute = null;
    let bestAmountOut = 0n;

    for (const route of allRoutes) {
      try {
        const quote = await this.getRouteQuote(route, amountIn);
        if (quote.amountOut > bestAmountOut) {
          bestAmountOut = quote.amountOut;
          bestRoute = { ...route, quote };
        }
      } catch (err) {
        console.warn(`Route quote failed:`, err.message);
      }
    }

    if (!bestRoute) {
      throw new Error('All routes cannot get valid quotes');
    }

    return bestRoute;
  }

  /**
   * Generate possible routing paths
   */
  async generatePossibleRoutes(tokenIn, tokenOut, maxHops) {
    const routes = [];

    // Direct path
    if (maxHops >= 1) {
      for (const fee of COMMON_FEES) {
        const poolAddress = await this.getPoolAddress(tokenIn, tokenOut, fee);
        if (poolAddress) {
          routes.push(new RoutePath([tokenIn, tokenOut], [fee]));
        }
      }
    }

    // Paths through WETH
    if (maxHops >= 2 && COMMON_TOKENS.WETH) {
      const weth = COMMON_TOKENS.WETH;
      if (tokenIn !== weth && tokenOut !== weth) {
        for (const fee1 of COMMON_FEES) {
          for (const fee2 of COMMON_FEES) {
            const pool1 = await this.getPoolAddress(tokenIn, weth, fee1);
            const pool2 = await this.getPoolAddress(weth, tokenOut, fee2);
            if (pool1 && pool2) {
              routes.push(new RoutePath([tokenIn, weth, tokenOut], [fee1, fee2]));
            }
          }
        }
      }
    }

    // Paths through stablecoins
    if (maxHops >= 2) {
      for (const stableCoin of [COMMON_TOKENS.USDC, COMMON_TOKENS.USDT, COMMON_TOKENS.DAI]) {
        if (!stableCoin || tokenIn === stableCoin || tokenOut === stableCoin) continue;
        
        for (const fee1 of COMMON_FEES) {
          for (const fee2 of COMMON_FEES) {
            const pool1 = await this.getPoolAddress(tokenIn, stableCoin, fee1);
            const pool2 = await this.getPoolAddress(stableCoin, tokenOut, fee2);
            if (pool1 && pool2) {
              routes.push(new RoutePath([tokenIn, stableCoin, tokenOut], [fee1, fee2]));
            }
          }
        }
      }
    }

    return routes;
  }

  /**
   * Get route quote
   */
  async getRouteQuote(route, amountIn) {
    let currentAmountIn = BigInt(amountIn);
    const quotes = [];

    for (let i = 0; i < route.hops; i++) {
      const tokenIn = route.tokens[i];
      const tokenOut = route.tokens[i + 1];
      const fee = route.fees[i];


      const poolAddress = await this.getPoolAddress(tokenIn, tokenOut, fee);
      if (!poolAddress) {
        throw new Error(`Pool does not exist: ${tokenIn}-${tokenOut}-${fee}`);
      }

      // Determine swap direction
      const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase();
      
      try {
        const quote = await estimateSwapOut(this.provider, poolAddress, zeroForOne, currentAmountIn);
        
        if (quote.amountOut === 0n) {
          throw new Error(`Hop ${i+1} output is 0, may be due to insufficient pool liquidity or input amount`);
        }
        
        quotes.push(quote);
        currentAmountIn = quote.amountOut;
      } catch (err) {
        throw new Error(`Failed to get quote at hop ${i+1}: ${err.message}`);
      }
    }

    const finalAmountOut = currentAmountIn;

    return {
      amountOut: finalAmountOut,
      quotes,
      priceImpact: this.calculateTotalPriceImpact(quotes),
      gas: this.estimateGasForRoute(route)
    };
  }

  /**
   * Execute multi-hop swap
   */
  async executeMultiHopSwap(signer, route, amountIn, minAmountOut, deadline) {
    if (route.hops === 1) {
      // Single-hop swap
      const poolAddress = await this.getPoolAddress(route.tokens[0], route.tokens[1], route.fees[0]);
      const zeroForOne = route.tokens[0].toLowerCase() < route.tokens[1].toLowerCase();
      
      return await swapExactIn(
        this.provider, 
        signer, 
        poolAddress, 
        zeroForOne, 
        amountIn, 
        0n // sqrtPriceLimitX96
      );
    } else {
      // Multi-hop swap - requires custom routing contract or sequential execution
      return await this.executeMultiHopSwapSequential(signer, route, amountIn, minAmountOut, deadline);
    }
  }

  /**
   * Sequential execution of multi-hop swap
   */
  async executeMultiHopSwapSequential(signer, route, amountIn, minAmountOut, deadline) {
    let currentAmountIn = BigInt(amountIn);
    const results = [];

    for (let i = 0; i < route.hops; i++) {
      const isLastHop = i === route.hops - 1;
      const minAmountOutForHop = isLastHop ? minAmountOut : 0n;

      const poolAddress = await this.getPoolAddress(route.tokens[i], route.tokens[i + 1], route.fees[i]);
      const zeroForOne = route.tokens[i].toLowerCase() < route.tokens[i + 1].toLowerCase();

      try {
        const result = await swapExactIn(
          this.provider,
          signer,
          poolAddress,
          zeroForOne,
          currentAmountIn,
          0n
        );

        results.push(result);
        currentAmountIn = result.amountOut;

        // Check slippage protection for the final hop
        if (isLastHop && currentAmountIn < minAmountOut) {
          throw new Error(`Slippage too large: expected ${minAmountOut}, actual ${currentAmountIn}`);
        }
      } catch (err) {
        throw new Error(`Swap failed at hop ${i+1}: ${err.message}`);
      }
    }

    return {
      results,
      totalAmountOut: currentAmountIn,
      route: route
    };
  }

  /**
   * Calculate total price impact
   */
  calculateTotalPriceImpact(quotes) {
    // Simplified price impact calculation
    return quotes.reduce((total, quote) => {
      // Here we need to calculate price impact based on specific quotes
      return total + 0.1; // Placeholder
    }, 0);
  }

  /**
   * Estimate gas cost for route
   */
  estimateGasForRoute(route) {
    // Base gas + additional gas per hop
    const baseGas = 100000;
    const gasPerHop = 150000;
    return baseGas + (route.hops * gasPerHop);
  }
}

/**
 * Convenience function: find best trading path
 */
export async function findBestTrade(provider, factoryAddress, tokenIn, tokenOut, amountIn, maxHops = 3) {
  const router = new MultiHopRouter(provider, factoryAddress);
  return await router.findBestRoute(tokenIn, tokenOut, amountIn, maxHops);
}

/**
 * Convenience function: execute best trade
 */
export async function executeBestTrade(provider, signer, factoryAddress, tokenIn, tokenOut, amountIn, slippageTolerance = 0.5, maxHops = 3) {
  const router = new MultiHopRouter(provider, factoryAddress);
  
  // Find best path
  const bestRoute = await router.findBestRoute(tokenIn, tokenOut, amountIn, maxHops);
  
  // Calculate minimum output amount (considering slippage)
  const minAmountOut = BigInt(Math.floor(Number(bestRoute.quote.amountOut) * (100 - slippageTolerance) / 100));
  
  // Execute swap
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
  return await router.executeMultiHopSwap(signer, bestRoute, amountIn, minAmountOut, deadline);
}