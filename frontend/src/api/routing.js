import { ethers } from 'ethers';
import { getPoolContract, readSlot0, readPoolTokens, estimateSwapOut, swapExactIn, getPool } from './amm';
import { TOKENS } from './tokens';

/**
 * Multi-hop routing implementation for AMM
 * Based on Uniswap V3 routing concepts
 */

// 常用代币地址配置
export const COMMON_TOKENS = {
  WETH: TOKENS.WETH.address,
  USDC: TOKENS.USDC.address,
  USDT: TOKENS.USDT.address,
  DAI: TOKENS.DAI.address,
  WBTC: TOKENS.WBTC.address,
  UNI: TOKENS.UNI.address
};

// 常见的费率设置
export const COMMON_FEES = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

// 支持的区块链网络配置
export const COMMON_CHAINS = [
  { id: 11155111, name: 'Sepolia Ethereum', label: 'Sepolia', isTestnet: true },
  { id: 1, name: 'Ethereum', label: 'Mainnet', isTestnet: false },
  { id: 10, name: 'Optimism', label: 'Optimism', isTestnet: false },
  { id: 42161, name: 'Arbitrum One', label: 'Arbitrum', isTestnet: false }
];

/**
 * 路由路径结构
 */
export class RoutePath {
  constructor(tokens, fees) {
    this.tokens = tokens; // [tokenA, tokenB, tokenC] 
    this.fees = fees;     // [fee1, fee2] (n-1 fees for n tokens)
    this.pools = [];      // 池子地址数组
    this.quotes = [];     // 每一跳的报价
  }

  get hops() {
    return this.tokens.length - 1;
  }
}

/**
 * 路由器主类
 */
export class MultiHopRouter {
  constructor(provider, factoryAddress) {
    this.provider = provider;
    this.factoryAddress = factoryAddress;
    this.poolCache = new Map(); // 缓存池子地址
  }

  /**
   * 获取两个代币之间的池子地址
   */
  async getPoolAddress(tokenA, tokenB, fee) {
    const key = `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}-${fee}`;
    
    if (this.poolCache.has(key)) {
      return this.poolCache.get(key);
    }

    try {
      // 使用工厂合约的getPool方法
      const poolAddress = await getPool(this.provider, tokenA, tokenB, fee);
      
      // 验证池子是否存在
      if (poolAddress && poolAddress !== ethers.ZeroAddress) {
        const poolExists = await this.verifyPoolExists(poolAddress);
        
        if (poolExists) {
          this.poolCache.set(key, poolAddress);
          return poolAddress;
        }
      }
      
      return null;
    } catch (err) {
      console.warn(`获取池子地址失败: ${tokenA}-${tokenB}-${fee}:`, err.message);
      return null;
    }
  }

  /**
   * 验证池子是否存在
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
   * 寻找最优路由路径
   */
  async findBestRoute(tokenIn, tokenOut, amountIn, maxHops = 3) {
    const allRoutes = await this.generatePossibleRoutes(tokenIn, tokenOut, maxHops);
    
    if (allRoutes.length === 0) {
      throw new Error('找不到可用的交易路径');
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
        console.warn(`路径报价失败:`, err.message);
      }
    }

    if (!bestRoute) {
      throw new Error('所有路径都无法获取有效报价');
    }

    return bestRoute;
  }

  /**
   * 生成可能的路由路径
   */
  async generatePossibleRoutes(tokenIn, tokenOut, maxHops) {
    const routes = [];

    // 直接路径
    if (maxHops >= 1) {
      for (const fee of COMMON_FEES) {
        const poolAddress = await this.getPoolAddress(tokenIn, tokenOut, fee);
        if (poolAddress) {
          routes.push(new RoutePath([tokenIn, tokenOut], [fee]));
        }
      }
    }

    // 通过WETH的路径
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

    // 通过稳定币的路径
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
   * 获取路径的报价
   */
  async getRouteQuote(route, amountIn) {
    console.log(`🔍 开始获取路径报价: ${route.tokens.join(' → ')}`);
    console.log(`💰 输入金额: ${amountIn.toString()} wei (${(Number(amountIn) / 1e18).toFixed(6)} ETH)`);
    
    let currentAmountIn = BigInt(amountIn);
    const quotes = [];

    for (let i = 0; i < route.hops; i++) {
      const tokenIn = route.tokens[i];
      const tokenOut = route.tokens[i + 1];
      const fee = route.fees[i];

      console.log(`  🔄 第${i+1}跳: ${tokenIn.slice(0,8)}... → ${tokenOut.slice(0,8)}... (费率: ${fee})`);

      const poolAddress = await this.getPoolAddress(tokenIn, tokenOut, fee);
      if (!poolAddress) {
        throw new Error(`池子不存在: ${tokenIn}-${tokenOut}-${fee}`);
      }
      
      console.log(`    📍 池子地址: ${poolAddress}`);

      // 确定交易方向
      const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase();
      console.log(`    ⬇️ 交易方向: ${zeroForOne ? 'Token0→Token1' : 'Token1→Token0'}`);
      console.log(`    💵 当前输入: ${currentAmountIn.toString()} wei (${(Number(currentAmountIn) / 1e18).toFixed(6)} ETH)`);
      
      try {
        const quote = await estimateSwapOut(this.provider, poolAddress, zeroForOne, currentAmountIn);
        console.log(`    ✅ 报价成功:`);
        console.log(`       输出: ${quote.amountOut.toString()} wei (${(Number(quote.amountOut) / 1e18).toFixed(6)} ETH)`);
        console.log(`       费率: ${quote.fee.toString()}`);
        
        if (quote.amountOut === 0n) {
          throw new Error(`第${i+1}跳输出为0，可能是池子无流动性或输入金额过小`);
        }
        
        quotes.push(quote);
        currentAmountIn = quote.amountOut;
      } catch (err) {
        console.log(`    ❌ 报价失败: ${err.message}`);
        throw new Error(`获取报价失败在第${i+1}跳: ${err.message}`);
      }
    }

    const finalAmountOut = currentAmountIn;
    console.log(`🏁 路径报价完成:`);
    console.log(`   最终输出: ${finalAmountOut.toString()} wei (${(Number(finalAmountOut) / 1e18).toFixed(6)} ETH)`);

    return {
      amountOut: finalAmountOut,
      quotes,
      priceImpact: this.calculateTotalPriceImpact(quotes),
      gas: this.estimateGasForRoute(route)
    };
  }

  /**
   * 执行多跳交换
   */
  async executeMultiHopSwap(signer, route, amountIn, minAmountOut, deadline) {
    if (route.hops === 1) {
      // 单跳交换
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
      // 多跳交换 - 需要自定义路由合约或者逐个执行
      return await this.executeMultiHopSwapSequential(signer, route, amountIn, minAmountOut, deadline);
    }
  }

  /**
   * 顺序执行多跳交换
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

        // 检查最后一跳的滑点保护
        if (isLastHop && currentAmountIn < minAmountOut) {
          throw new Error(`滑点过大: 期望 ${minAmountOut}, 实际 ${currentAmountIn}`);
        }
      } catch (err) {
        throw new Error(`第${i+1}跳交换失败: ${err.message}`);
      }
    }

    return {
      results,
      totalAmountOut: currentAmountIn,
      route: route
    };
  }

  /**
   * 计算总价格影响
   */
  calculateTotalPriceImpact(quotes) {
    // 简化的价格影响计算
    return quotes.reduce((total, quote) => {
      // 这里需要根据具体的报价计算价格影响
      return total + 0.1; // 占位符
    }, 0);
  }

  /**
   * 估算路由的Gas费用
   */
  estimateGasForRoute(route) {
    // 基础Gas + 每一跳的额外Gas
    const baseGas = 100000;
    const gasPerHop = 150000;
    return baseGas + (route.hops * gasPerHop);
  }
}

/**
 * 便捷函数：寻找最佳交易路径
 */
export async function findBestTrade(provider, factoryAddress, tokenIn, tokenOut, amountIn, maxHops = 3) {
  const router = new MultiHopRouter(provider, factoryAddress);
  return await router.findBestRoute(tokenIn, tokenOut, amountIn, maxHops);
}

/**
 * 便捷函数：执行最佳交易
 */
export async function executeBestTrade(provider, signer, factoryAddress, tokenIn, tokenOut, amountIn, slippageTolerance = 0.5, maxHops = 3) {
  const router = new MultiHopRouter(provider, factoryAddress);
  
  // 寻找最佳路径
  const bestRoute = await router.findBestRoute(tokenIn, tokenOut, amountIn, maxHops);
  
  // 计算最小输出金额（考虑滑点）
  const minAmountOut = BigInt(Math.floor(Number(bestRoute.quote.amountOut) * (100 - slippageTolerance) / 100));
  
  // 执行交换
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20分钟
  return await router.executeMultiHopSwap(signer, bestRoute, amountIn, minAmountOut, deadline);
}