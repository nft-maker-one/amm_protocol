import { ethers } from 'ethers';
import AMMPoolABI from './abi/AMMPool.json';
import AMMFactoryABI from './abi/AMMFactory.json';
import ERC20ABI from './abi/ERC20.json';

// Addresses (keep in sync with App.jsx TODOs)
// Your deployed pool on Sepolia (initialized)
export const AMMPOOL_ADDRESS = '0x0a0cba1059BE0867AA858e37E4459862Ef40b8d7';
export const FACTORY_ADDRESS = '0x79A1219d4aA0E7E9bcE45c2CbC17e34C50b3B915';
export const AMMFACTORY_ADDRESS = FACTORY_ADDRESS; // 别名，用于routing

// TickMath constants (copied from contracts/src/libraries/TickMath.sol)
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export async function ensureSepolia(provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 11155111) throw new Error('请切换 MetaMask 到 Sepolia 测试网');
}

export async function safeCallView(provider, address, abi, fnName, args = []) {
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData(fnName, args);
  const res = await provider.call({ to: address, data });
  if (!res || res === '0x') throw new Error(`${fnName} 返回空数据，函数可能在该合约上不存在或地址不正确`);
  return iface.decodeFunctionResult(fnName, res);
}

export function getFactory(provider) {
  return new ethers.Contract(FACTORY_ADDRESS, AMMFactoryABI, provider);
}

export async function getPool(provider, tokenA, tokenB, fee) {
  const factory = getFactory(provider);
  return await factory.getPool(tokenA, tokenB, fee);
}

export async function simulateCreatePool(provider, signer, tokenA, tokenB, fee) {
  const factoryWithSigner = getFactory(provider).connect(signer);
  try {
    if (factoryWithSigner.callStatic && factoryWithSigner.callStatic.createPool) {
      await factoryWithSigner.callStatic.createPool(tokenA, tokenB, fee);
    } else {
      const iface = new ethers.Interface(AMMFactoryABI);
      const data = iface.encodeFunctionData('createPool', [tokenA, tokenB, fee]);
      await provider.call({ to: FACTORY_ADDRESS, data });
    }
  } catch (err) {
    throw err;
  }
}

export async function createPool(provider, signer, tokenA, tokenB, fee) {
  const factoryWithSigner = getFactory(provider).connect(signer);
  const tx = await factoryWithSigner.createPool(tokenA, tokenB, fee);
  await tx.wait();
  return tx;
}

export async function readSlot0(provider, poolAddr) {
  const result = await safeCallView(provider, poolAddr, AMMPoolABI, 'slot0');
  return result; // slot0 returns a struct, keep as array
}

export async function readPoolTokens(provider, poolAddr) {
  const pool = new ethers.Contract(poolAddr, AMMPoolABI, provider);
  const t0 = await pool.token0();
  const t1 = await pool.token1();
  return { token0: t0, token1: t1 };
}

export async function mintToken(provider, signer, tokenAddr, toAddr, amount) {
  try {
    // First check if the current user is the owner
    const token = new ethers.Contract(tokenAddr, ERC20ABI, provider);
    let isOwner = false;
    
    try {
      const owner = await token.owner();
      const signerAddr = await signer.getAddress();
      isOwner = owner.toLowerCase() === signerAddr.toLowerCase();
      
      if (!isOwner) {
        throw new Error(`只有合约 owner (${owner}) 才能铸造代币。当前地址: ${signerAddr}`);
      }
    } catch (err) {
      // If owner() function doesn't exist, it might not be a MockToken
      console.warn('无法检查 owner，可能不是 MockToken 合约:', err.message);
    }
    
    const tokenWithSigner = token.connect(signer);
    const tx = await tokenWithSigner.mint(toAddr, amount);
    await tx.wait();
    return tx;
  } catch (error) {
    if (error.message.includes('owner')) {
      throw error; // Re-throw owner-related errors as-is
    } else if (error.code === 'CALL_EXCEPTION') {
      throw new Error('合约调用失败。可能原因：1) 您不是合约 owner，2) 合约地址错误，3) 参数无效');
    } else {
      throw new Error(`铸造失败: ${error.message}`);
    }
  }
}

export async function burnToken(provider, signer, tokenAddr, amount) {
  const token = new ethers.Contract(tokenAddr, ERC20ABI, signer);
  const tx = await token.burn(amount);
  await tx.wait();
  return tx;
}

export async function getTokenBalance(provider, tokenAddr, accountAddr) {
  const result = await safeCallView(provider, tokenAddr, ERC20ABI, 'balanceOf', [accountAddr]);
  return result[0];
}

export async function getTokenInfo(provider, tokenAddr) {
  const name = await safeCallView(provider, tokenAddr, ERC20ABI, 'name', []);
  const symbol = await safeCallView(provider, tokenAddr, ERC20ABI, 'symbol', []);
  const decimals = await safeCallView(provider, tokenAddr, ERC20ABI, 'decimals', []);
  const totalSupply = await safeCallView(provider, tokenAddr, ERC20ABI, 'totalSupply', []);
  return { 
    name: name[0], 
    symbol: symbol[0], 
    decimals: Number(decimals[0]), 
    totalSupply: totalSupply[0] 
  };
}

export function getPoolContract(providerOrSigner, poolAddr) {
  return new ethers.Contract(poolAddr, AMMPoolABI, providerOrSigner);
}

export function getErc20Contract(providerOrSigner, tokenAddr) {
  return new ethers.Contract(tokenAddr, ERC20ABI, providerOrSigner);
}

/**
 * 诊断函数：检查 Pool 的所有关键状态
 */
export async function diagnosePool(provider, poolAddr) {
  try {
    const pool = getPoolContract(provider, poolAddr);
    
    // 读取所有关键状态
    const [slot0, token0, token1, fee, tickSpacing, liquidity] = await Promise.all([
      pool.slot0(),
      pool.token0(),
      pool.token1(),
      pool.fee(),
      pool.tickSpacing(),
      pool.liquidity(),
    ]);

    const diagnosis = {
      poolAddress: poolAddr,
      initialized: slot0.sqrtPriceX96 !== 0n,
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      currentTick: slot0.tick.toString(),
      token0,
      token1,
      fee: fee.toString(),
      tickSpacing: tickSpacing.toString(),
      liquidity: liquidity.toString(),
      status: slot0.sqrtPriceX96 === 0n ? 'NOT_INITIALIZED' : 'INITIALIZED',
    };

    console.log('[diagnosePool] Pool 诊断结果:', diagnosis);
    return diagnosis;
  } catch (err) {
    console.error('[diagnosePool] 诊断失败:', err);
    throw err;
  }
}

/**
 * 预检查 mint 参数是否有效
 */
export async function validateMintParams(provider, poolAddr, tickLower, tickUpper, liquidityAmount) {
  const pool = getPoolContract(provider, poolAddr);
  const [slot0, tickSpacing] = await Promise.all([
    pool.slot0(),
    pool.tickSpacing(),
  ]);

  const errors = [];
  const warnings = [];

  // 检查 Pool 初始化
  if (slot0.sqrtPriceX96 === 0n) {
    errors.push('Pool 未初始化 (sqrtPriceX96 = 0)');
  }

  // 检查基本范围
  if (tickLower >= tickUpper) {
    errors.push(`tickLower (${tickLower}) 必须小于 tickUpper (${tickUpper})`);
  }

  // 检查 tick 范围（TickMath 的限制）
  if (tickLower < -887272) {
    errors.push(`tickLower (${tickLower}) 低于最小值 -887272`);
  }
  if (tickUpper > 887272) {
    errors.push(`tickUpper (${tickUpper}) 超过最大值 887272`);
  }

  // 检查 tickSpacing 对齐
  const tickSpacingNum = Number(tickSpacing);
  if (tickLower % tickSpacingNum !== 0) {
    errors.push(`tickLower (${tickLower}) 不是 tickSpacing (${tickSpacingNum}) 的倍数`);
  }
  if (tickUpper % tickSpacingNum !== 0) {
    errors.push(`tickUpper (${tickUpper}) 不是 tickSpacing (${tickSpacingNum}) 的倍数`);
  }

  // 检查流动性
  if (liquidityAmount <= 0n) {
    errors.push(`流动性数量必须大于 0，当前值: ${liquidityAmount.toString()}`);
  }

  // 当前 tick 检查
  const currentTick = Number(slot0.tick);
  if (currentTick < tickLower || currentTick > tickUpper) {
    warnings.push(`警告: 当前 tick (${currentTick}) 在范围 [${tickLower}, ${tickUpper}] 之外`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      poolInitialized: slot0.sqrtPriceX96 !== 0n,
      currentTick: Number(slot0.tick),
      tickSpacing: tickSpacingNum,
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    },
  };
}

/**
 * Quote required token0/token1 amounts for mint by static calling pool.mint
 * Returns { amount0, amount1 } as BigInt.
 */
/**
 * 离链计算添加流动性所需的代币数量
 * 这个函数不依赖于 staticCall，因此不需要用户先有足够的代币余额
 * 算法基于 Uniswap V3 的公式
 */
export async function quoteMint(provider, poolAddr, recipient, tickLower, tickUpper, liquidityAmount) {
  console.log('🔥🔥🔥 [quoteMint v3.0 离链计算版] 开始报价 🔥🔥🔥');
  console.log('  poolAddr:', poolAddr);
  console.log('  tickLower:', tickLower);
  console.log('  tickUpper:', tickUpper);
  console.log('  liquidityAmount:', liquidityAmount.toString());

  const pool = getPoolContract(provider, poolAddr);
  
  try {
    // 读取 pool 信息
    console.log('[quoteMint] 读取 Pool 信息...');
    const [slot0, tickSpacing, token0, token1] = await Promise.all([
      pool.slot0(),
      pool.tickSpacing(),
      pool.token0(),
      pool.token1(),
    ]);
    
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const currentTick = Number(slot0.tick);
    const tickSpacingNum = Number(tickSpacing);
    
    console.log('[quoteMint] Pool 状态:');
    console.log('  - sqrtPriceX96:', sqrtPriceX96.toString());
    console.log('  - currentTick:', currentTick);
    console.log('  - tickSpacing:', tickSpacingNum);
    console.log('  - token0:', token0);
    console.log('  - token1:', token1);

    // 检查初始化
    if (sqrtPriceX96 === 0n) {
      throw new Error('Pool 未初始化 (sqrtPriceX96 = 0)');
    }

    // 验证 tick 对齐
    if (tickLower % tickSpacingNum !== 0) {
      throw new Error(`tickLower ${tickLower} 必须是 tickSpacing ${tickSpacingNum} 的倍数`);
    }
    if (tickUpper % tickSpacingNum !== 0) {
      throw new Error(`tickUpper ${tickUpper} 必须是 tickSpacing ${tickSpacingNum} 的倍数`);
    }
    if (tickLower >= tickUpper) {
      throw new Error(`tickLower ${tickLower} 必须小于 tickUpper ${tickUpper}`);
    }

    console.log('✅ 参数验证通过，开始离链计算...');

    // 使用离链计算公式 (Uniswap V3 style)
    const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower);
    const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper);
    
    console.log('  - sqrtRatioAX96 (tickLower):', sqrtRatioAX96.toString());
    console.log('  - sqrtRatioBX96 (tickUpper):', sqrtRatioBX96.toString());
    
    let amount0 = 0n;
    let amount1 = 0n;
    const liquidity = BigInt(liquidityAmount);

    if (sqrtPriceX96 < sqrtRatioAX96) {
      // 当前价格低于范围，只需要 token0
      amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
      console.log('  当前价格低于范围，只需 token0');
    } else if (sqrtPriceX96 < sqrtRatioBX96) {
      // 当前价格在范围内，需要两种代币
      amount0 = getAmount0ForLiquidity(sqrtPriceX96, sqrtRatioBX96, liquidity);
      amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtPriceX96, liquidity);
      console.log('  当前价格在范围内，需要两种代币');
    } else {
      // 当前价格高于范围，只需要 token1
      amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
      console.log('  当前价格高于范围，只需 token1');
    }

    console.log('[quoteMint] 离链计算完成!');
    console.log('  - amount0:', amount0.toString());
    console.log('  - amount1:', amount1.toString());
    
    return { amount0, amount1, token0, token1, isOffchainEstimate: true };
  } catch (err) {
    console.error('💥 [quoteMint] 报价失败:', err.message);
    throw err;
  }
}

// ============ TickMath 辅助函数 (JS 版本) ============

const Q96 = 2n ** 96n;

/**
 * 根据 tick 计算 sqrtPriceX96
 * 这是 TickMath.getSqrtRatioAtTick 的 JavaScript 实现
 */
function getSqrtRatioAtTick(tick) {
  const absTick = tick < 0 ? -tick : tick;
  
  if (absTick > 887272) {
    throw new Error(`Tick ${tick} 超出范围 [-887272, 887272]`);
  }

  let ratio = (absTick & 0x1) !== 0 
    ? 0xfffcb933bd6fad37aa2d162d1a594001n 
    : 0x100000000000000000000000000000000n;
  
  if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) {
    ratio = (2n ** 256n - 1n) / ratio;
  }

  // 转换为 Q96 格式
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/**
 * 计算给定流动性和价格范围所需的 token0 数量
 */
function getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  const numerator = liquidity * Q96 * (sqrtRatioBX96 - sqrtRatioAX96);
  const denominator = sqrtRatioBX96 * sqrtRatioAX96;
  
  return numerator / denominator;
}

/**
 * 计算给定流动性和价格范围所需的 token1 数量
 */
function getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
}

// ============ 保留旧的 staticCall 版本用于调试 ============

export async function quoteMintDebug(provider, poolAddr, recipient, tickLower, tickUpper, liquidityAmount) {
  console.log('[quoteMintDebug] 开始调试报价...');
  console.log('  - poolAddr:', poolAddr);
  console.log('  - recipient:', recipient);
  console.log('  - tickLower:', tickLower);
  console.log('  - tickUpper:', tickUpper);
  console.log('  - liquidityAmount:', liquidityAmount.toString());

  const pool = getPoolContract(provider, poolAddr);
  
  try {
    // 先读取 pool 的基本信息
    console.log('[quoteMintDebug] 读取 Pool 信息...');
    const [slot0, token0, token1, fee, tickSpacing, liquidity] = await Promise.all([
      pool.slot0(),
      pool.token0(),
      pool.token1(),
      pool.fee(),
      pool.tickSpacing(),
      pool.liquidity(),
    ]);
    
    console.log('[quoteMintDebug] Pool 信息:');
    console.log('  - sqrtPriceX96:', slot0.sqrtPriceX96.toString());
    console.log('  - currentTick:', slot0.tick.toString());
    console.log('  - token0:', token0);
    console.log('  - token1:', token1);
    console.log('  - fee:', fee.toString());
    console.log('  - tickSpacing:', tickSpacing.toString());
    console.log('  - liquidity:', liquidity.toString());

    // 检查是否初始化
    if (slot0.sqrtPriceX96 === 0n) {
      throw new Error('Pool 未初始化 (sqrtPriceX96 = 0)');
    }

    // 检查 tick 参数
    const tickSpacingNum = Number(tickSpacing);
    if (tickLower % tickSpacingNum !== 0) {
      throw new Error(`tickLower (${tickLower}) must be multiple of tickSpacing (${tickSpacingNum}). Remainder: ${tickLower % tickSpacingNum}`);
    }
    if (tickUpper % tickSpacingNum !== 0) {
      throw new Error(`tickUpper (${tickUpper}) must be multiple of tickSpacing (${tickSpacingNum}). Remainder: ${tickUpper % tickSpacingNum}`);
    }

    // 尝试 staticCall
    console.log('[quoteMintDebug] 尝试调用 mint.staticCall...');
    const res = await pool.mint.staticCall(recipient, tickLower, tickUpper, liquidityAmount, '0x');
    console.log('[quoteMintDebug] staticCall 成功:', { amount0: res[0].toString(), amount1: res[1].toString() });
    
    return { amount0: res[0], amount1: res[1] };
  } catch (err) {
    console.error('[quoteMintDebug] 错误:', err);
    throw err;
  }
}

export async function approveIfNeeded(provider, signer, tokenAddr, spender, requiredAmount) {
  const token = getErc20Contract(signer, tokenAddr);
  const owner = await signer.getAddress();
  const current = await token.allowance(owner, spender);
  if (current >= requiredAmount) return null;
  const tx = await token.approve(spender, requiredAmount);
  await tx.wait();
  return tx;
}

/**
 * Add liquidity via pool.mint. This function:
 * - reads token0/token1 from pool
 * - quotes required amounts via staticCall
 * - approves pool to spend token0/token1 if needed
 * - sends mint tx
 */
export async function addLiquidity(provider, signer, poolAddr, tickLower, tickUpper, liquidityAmount) {
  const poolRead = getPoolContract(provider, poolAddr);
  const recipient = await signer.getAddress();
  const [token0, token1] = await Promise.all([poolRead.token0(), poolRead.token1()]);

  const { amount0, amount1 } = await quoteMint(
    provider,
    poolAddr,
    recipient,
    tickLower,
    tickUpper,
    liquidityAmount
  );

  // Approve only if needed
  if (amount0 > 0n) await approveIfNeeded(provider, signer, token0, poolAddr, amount0);
  if (amount1 > 0n) await approveIfNeeded(provider, signer, token1, poolAddr, amount1);

  const poolWrite = getPoolContract(signer, poolAddr);
  const tx = await poolWrite.mint(recipient, tickLower, tickUpper, liquidityAmount, '0x');
  await tx.wait();
  return { tx, token0, token1, amount0, amount1 };
}

/**
 * Estimate swap output using the same formula as AMMPool.swap (exact input).
 * This is an off-chain estimation and may differ slightly from on-chain result
 * if pool balances change between estimation and execution.
 */
export async function estimateSwapOut(provider, poolAddr, zeroForOne, amountIn) {
  console.log(`      🔍 estimateSwapOut: 池子=${poolAddr.slice(0,8)}..., 方向=${zeroForOne}, 输入=${amountIn.toString()}`);
  
  const pool = getPoolContract(provider, poolAddr);
  const [token0, token1, fee] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.fee(),
  ]);

  console.log(`      📝 代币信息: Token0=${token0.slice(0,8)}..., Token1=${token1.slice(0,8)}..., Fee=${fee}`);

  const tokenIn = zeroForOne ? token0 : token1;
  const tokenOut = zeroForOne ? token1 : token0;

  const erc20Token0 = getErc20Contract(provider, token0);
  const erc20Token1 = getErc20Contract(provider, token1);
  const [balance0, balance1] = await Promise.all([
    erc20Token0.balanceOf(poolAddr),
    erc20Token1.balanceOf(poolAddr),
  ]);

  console.log(`      💰 池子余额: Token0=${balance0.toString()}, Token1=${balance1.toString()}`);

  let amountInNet = BigInt(amountIn);
  const feeBI = BigInt(fee);
  const feeAmount = (amountInNet * feeBI) / 1000000n;
  amountInNet -= feeAmount;

  console.log(`      📊 计算详情: 原始输入=${amountIn.toString()}, 手续费=${feeAmount.toString()}, 净输入=${amountInNet.toString()}`);

  if (balance0 === 0n || balance1 === 0n) {
    console.log(`      ❌ 池子余额为0，无法进行交换`);
    throw new Error(`池子无流动性: Token0余额=${balance0.toString()}, Token1余额=${balance1.toString()}`);
  }

  let amountOut;
  if (zeroForOne) {
    // selling token0 for token1
    amountOut = (amountInNet * BigInt(balance1)) / (BigInt(balance0) + amountInNet);
    console.log(`      ⬇️ Token0→Token1: (${amountInNet.toString()} * ${balance1.toString()}) / (${balance0.toString()} + ${amountInNet.toString()}) = ${amountOut.toString()}`);
  } else {
    // selling token1 for token0
    amountOut = (amountInNet * BigInt(balance0)) / (BigInt(balance1) + amountInNet);
    console.log(`      ⬇️ Token1→Token0: (${amountInNet.toString()} * ${balance0.toString()}) / (${balance1.toString()} + ${amountInNet.toString()}) = ${amountOut.toString()}`);
  }

  if (amountOut === 0n) {
    console.log(`      ❌ 计算结果为0，可能是输入金额太小或池子流动性不足`);
  }

  console.log(`      ✅ 报价计算完成: 输出=${amountOut.toString()}`);

  return {
    amountOut,
    tokenIn,
    tokenOut,
    fee: feeBI,
  };
}

/**
 * Swap exact input amount via AMMPool.swap.
 * - zeroForOne: true means token0 -> token1, false means token1 -> token0
 * - amountIn: bigint (in smallest unit, e.g. wei)
 * Returns { tx, amountIn, amountOut, tokenIn, tokenOut }.
 */
export async function swapExactIn(provider, signer, poolAddr, zeroForOne, amountIn, sqrtPriceLimitX96Override) {
  console.log(`🔄 开始交换: 池子=${poolAddr.slice(0,8)}..., 方向=${zeroForOne}, 金额=${amountIn.toString()}`);
  
  try {
    // 1. 检查池子是否初始化
    console.log(`  📍 检查池子初始化状态...`);
    const poolStatus = await checkPoolStatus(provider, poolAddr);
    if (poolStatus.status !== 'INITIALIZED') {
      throw new Error(`池子未初始化: ${poolStatus.message}`);
    }
    console.log(`  ✅ 池子已初始化`);

    const poolRead = getPoolContract(provider, poolAddr);
    const recipient = await signer.getAddress();
    console.log(`  👤 接收者: ${recipient.slice(0,8)}...`);
    
    const [token0, token1] = await Promise.all([
      poolRead.token0(),
      poolRead.token1(),
    ]);

    const tokenIn = zeroForOne ? token0 : token1;
    const tokenOut = zeroForOne ? token1 : token0;
    console.log(`  📤 输入代币: ${tokenIn.slice(0,8)}...`);
    console.log(`  📥 输出代币: ${tokenOut.slice(0,8)}...`);

    // 2. 验证输入金额
    const amountInBigInt = BigInt(amountIn);
    if (amountInBigInt <= 0n) {
      throw new Error(`输入金额必须大于0`);
    }

    // 3. 批准代币支出
    console.log(`  ✅ 批准代币支出...`);
    await approveIfNeeded(provider, signer, tokenIn, poolAddr, amountInBigInt);

    // 4. 设置价格限制
    const sqrtPriceLimitX96 =
      sqrtPriceLimitX96Override !== undefined && sqrtPriceLimitX96Override !== null
        ? sqrtPriceLimitX96Override
        : (zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n);
    
    console.log(`  🎯 价格限制: ${sqrtPriceLimitX96.toString().slice(0, 20)}...`);

    // 5. 执行交换
    const poolWrite = getPoolContract(signer, poolAddr);
    console.log(`  💫 发起交换交易...`);
    let res;
    try {
      res = await poolWrite.swap(
        recipient,
        zeroForOne,
        amountInBigInt,
        sqrtPriceLimitX96,
        '0x'
      );
    } catch (err) {
      // 提供更详细的错误信息
      if (err.code === 'CALL_EXCEPTION' || err.message.includes('reverted')) {
        throw new Error(`交换执行失败 (可能是流动性不足或价格滑点超限): ${err.message}`);
      }
      throw err;
    }

    console.log(`  ⏳ 等待交易确认...`);
    const receipt = await res.wait();
    console.log(`  ✅ 交换完成! Tx: ${res.hash.slice(0,10)}...`);

    return {
      tx: res,
      receipt,
      tokenIn,
      tokenOut,
      amountIn: amountInBigInt,
    };
  } catch (err) {
    console.error(`  ❌ 交换失败:`, err);
    throw err;
  }
}

// ========== Deployment Functions ==========

/**
 * Deploy AMMFactory contract
 * @param {ethers.Provider} provider - Ethers provider
 * @param {ethers.Signer} signer - Ethers signer
 * @param {string} factoryBytecode - Compiled bytecode of AMMFactory contract
 * @returns {Promise<{address: string, tx: ethers.TransactionResponse}>}
 */
export async function deployFactory(provider, signer, factoryBytecode) {
  if (!factoryBytecode || factoryBytecode === '0x') {
    throw new Error('Factory bytecode is required. Please compile the contract first.');
  }
  
  const factory = new ethers.ContractFactory(AMMFactoryABI, factoryBytecode, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  return {
    address,
    tx: contract.deploymentTransaction()
  };
}

/**
 * Deploy MockToken contract
 * @param {ethers.Provider} provider - Ethers provider
 * @param {ethers.Signer} signer - Ethers signer
 * @param {string} tokenBytecode - Compiled bytecode of MockToken contract
 * @param {string} name - Token name
 * @param {string} symbol - Token symbol
 * @param {number} decimals - Token decimals (e.g., 18)
 * @param {string} initialSupply - Initial supply in base units (e.g., "1000000" = 1M tokens if decimals=18, this will become 1M * 10^18)
 * @returns {Promise<{address: string, tx: ethers.TransactionResponse}>}
 */
export async function deployToken(provider, signer, tokenBytecode, name, symbol, decimals, initialSupply) {
  if (!tokenBytecode || tokenBytecode === '0x') {
    throw new Error('Token bytecode is required. Please compile the contract first.');
  }
  
  // 验证输入参数
  if (!name || !symbol) {
    throw new Error('Token name and symbol are required');
  }
  if (decimals < 0 || decimals > 18) {
    throw new Error('Decimals must be between 0 and 18');
  }
  if (!initialSupply || initialSupply === '0') {
    throw new Error('Initial supply must be greater than 0');
  }
  
  // MockToken constructor: (string memory name, string memory symbol, uint8 decimals_, uint256 initialSupply)
  // Create ABI with constructor - ContractFactory only needs constructor for deployment
  // The bytecode already contains the constructor logic
  const MockTokenConstructorABI = [
    {
      "type": "constructor",
      "inputs": [
        { "name": "name", "type": "string" },
        { "name": "symbol", "type": "string" },
        { "name": "decimals_", "type": "uint8" },
        { "name": "initialSupply", "type": "uint256" }
      ]
    }
  ];
  
  console.log('🔄 [deployToken] 开始部署 Token:');
  console.log('  名称:', name);
  console.log('  符号:', symbol);
  console.log('  小数位:', decimals);
  console.log('  初始供应量:', initialSupply);
  
  const factory = new ethers.ContractFactory(MockTokenConstructorABI, tokenBytecode, signer);
  
  // 验证bytecode不为空
  if (!factory.bytecode || factory.bytecode === '0x') {
    throw new Error('Failed to parse token bytecode. Please ensure VITE_TOKEN_BYTECODE is correctly set in .env.local');
  }
  
  let deployTx;
  try {
    console.log('  ⏳ 正在发送部署交易...');
    const contract = await factory.deploy(name, symbol, decimals, BigInt(initialSupply));
    console.log('  ⏳ 等待部署确认...');
    deployTx = contract.deploymentTransaction();
    console.log('  📝 交易哈希:', deployTx?.hash);
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log('  ✅ Token 部署成功!');
    console.log('  📍 合约地址:', address);
    
    return {
      address,
      tx: deployTx
    };
  } catch (err) {
    console.error('  ❌ Token 部署失败:', err.message);
    if (err.message.includes('insufficient funds')) {
      throw new Error('部署失败：账户余额不足。请确保你的账户在 Sepolia 测试网中有足够的 ETH');
    } else if (err.message.includes('transaction failed')) {
      throw new Error('部署失败：交易执行失败。这可能是因为 bytecode 无效或网络问题');
    }
    throw err;
  }
}

/**
 * Initialize a pool with a price
 * @param {ethers.Provider} provider - Ethers provider
 * @param {ethers.Signer} signer - Ethers signer
 * @param {string} poolAddress - Address of the pool to initialize
 * @param {string} sqrtPriceX96 - Initial sqrt price in X96 format (as string or BigInt)
 * @returns {Promise<ethers.TransactionResponse>}
 */
export async function initializePool(provider, signer, poolAddress, sqrtPriceX96) {
  const pool = new ethers.Contract(poolAddress, AMMPoolABI, signer);
  const tx = await pool.initialize(sqrtPriceX96);
  await tx.wait();
  return tx;
}

/**
 * 检查池子的初始化状态
 */
export async function checkPoolStatus(provider, poolAddress) {
  const pool = getPoolContract(provider, poolAddress);
  
  try {
    // 检查池子是否存在
    const code = await provider.getCode(poolAddress);
    if (code === '0x') {
      return { status: 'NOT_EXIST', message: '池子地址不存在或不是合约' };
    }

    // 获取基本信息
    const [token0, token1, fee] = await Promise.all([
      pool.token0(),
      pool.token1(),
      pool.fee(),
    ]);

    // 检查初始化状态
    let slot0Data;
    try {
      slot0Data = await pool.slot0();
      const sqrtPriceX96 = slot0Data[0];
      const tick = slot0Data[1];
      
      if (sqrtPriceX96 === 0n) {
        return { 
          status: 'NOT_INITIALIZED', 
          message: '池子存在但未初始化 (sqrtPriceX96 = 0)',
          token0, 
          token1, 
          fee 
        };
      }
      
      // 获取流动性
      const erc20Token0 = getErc20Contract(provider, token0);
      const erc20Token1 = getErc20Contract(provider, token1);
      const [balance0, balance1] = await Promise.all([
        erc20Token0.balanceOf(poolAddress),
        erc20Token1.balanceOf(poolAddress),
      ]);

      return {
        status: 'INITIALIZED',
        message: '池子已初始化',
        token0,
        token1,
        fee,
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick: tick.toString(),
        balance0: balance0.toString(),
        balance1: balance1.toString(),
      };
    } catch (err) {
      return {
        status: 'ERROR_READING_STATE',
        message: `读取池子状态失败: ${err.message}`,
        token0,
        token1,
        fee,
      };
    }
  } catch (err) {
    return {
      status: 'ERROR',
      message: `检查池子状态失败: ${err.message}`,
    };
  }
}

/**
 * Calculate sqrtPriceX96 from a price ratio
 * For example, if token0/token1 = 1, then sqrtPriceX96 = sqrt(1) * 2^96
 * @param {string|number} price - Price ratio (token0/token1)
 * @returns {string} sqrtPriceX96 as hex string
 */
export function calculateSqrtPriceX96(price) {
  // sqrtPriceX96 = sqrt(price) * 2^96
  // For price = 1: sqrt(1) * 2^96 = 2^96 = 79228162514264337593543950336
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  const sqrtPrice = Math.sqrt(priceNum);
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Math.pow(2, 96)));
  return sqrtPriceX96.toString();
}

// ========== Additional AMMPool Functions ==========

/**
 * Remove liquidity via pool.burn
 * @param {ethers.Provider} provider - Ethers provider
 * @param {ethers.Signer} signer - Ethers signer
 * @param {string} poolAddr - Pool address
 * @param {number} tickLower - Lower tick
 * @param {number} tickUpper - Upper tick
 * @param {bigint} liquidityAmount - Amount of liquidity to burn
 * @returns {Promise<{tx: ethers.TransactionResponse, amount0: bigint, amount1: bigint}>}
 */
export async function removeLiquidity(provider, signer, poolAddr, tickLower, tickUpper, liquidityAmount) {
  const pool = getPoolContract(signer, poolAddr);
  const tx = await pool.burn(tickLower, tickUpper, liquidityAmount);
  const receipt = await tx.wait();
  
  // Parse logs to get amount0 and amount1 burned
  // For simplicity, we return the tx; UI can call quoteBurn for estimation
  return {
    tx,
    receipt
  };
}

/**
 * Collect fees via pool.collect
 * @param {ethers.Provider} provider - Ethers provider
 * @param {ethers.Signer} signer - Ethers signer
 * @param {string} poolAddr - Pool address
 * @param {number} tickLower - Lower tick
 * @param {number} tickUpper - Upper tick
 * @param {bigint} amount0Requested - Max amount0 to collect (use MaxUint128 for all)
 * @param {bigint} amount1Requested - Max amount1 to collect (use MaxUint128 for all)
 * @returns {Promise<ethers.TransactionResponse>}
 */
export async function collectFees(provider, signer, poolAddr, tickLower, tickUpper, amount0Requested, amount1Requested) {
  const pool = getPoolContract(signer, poolAddr);
  const recipient = await signer.getAddress();
  
  const tx = await pool.collect(
    recipient,
    tickLower,
    tickUpper,
    amount0Requested,
    amount1Requested
  );
  await tx.wait();
  return tx;
}

/**
 * Get current liquidity of the pool
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} poolAddr - Pool address
 * @returns {Promise<bigint>} Current liquidity
 */
export async function getPoolLiquidity(provider, poolAddr) {
  const result = await safeCallView(provider, poolAddr, AMMPoolABI, 'liquidity');
  return result[0];
}

/**
 * Get position info for a given key
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} poolAddr - Pool address
 * @param {string} owner - Position owner address
 * @param {number} tickLower - Lower tick
 * @param {number} tickUpper - Upper tick
 * @returns {Promise<{liquidity: bigint, feeGrowthInside0LastX128: bigint, feeGrowthInside1LastX128: bigint, tokensOwed0: bigint, tokensOwed1: bigint}>}
 */
export async function getPosition(provider, poolAddr, owner, tickLower, tickUpper) {
  // Position key = keccak256(abi.encodePacked(owner, tickLower, tickUpper))
  const key = ethers.solidityPackedKeccak256(
    ['address', 'int24', 'int24'],
    [owner, tickLower, tickUpper]
  );
  
  const result = await safeCallView(provider, poolAddr, AMMPoolABI, 'positions', [key]);
  return {
    liquidity: result[0],
    feeGrowthInside0LastX128: result[1],
    feeGrowthInside1LastX128: result[2],
    tokensOwed0: result[3],
    tokensOwed1: result[4]
  };
}

/**
 * Get tick info
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} poolAddr - Pool address
 * @param {number} tick - Tick to query
 * @returns {Promise<{liquidityGross: bigint, liquidityNet: bigint, feeGrowthOutside0X128: bigint, feeGrowthOutside1X128: bigint, tickCumulativeOutside: bigint, secondsPerLiquidityOutsideX128: bigint, secondsOutside: number, initialized: boolean}>}
 */
export async function getTickInfo(provider, poolAddr, tick) {
  const result = await safeCallView(provider, poolAddr, AMMPoolABI, 'ticks', [tick]);
  return {
    liquidityGross: result[0],
    liquidityNet: result[1],
    feeGrowthOutside0X128: result[2],
    feeGrowthOutside1X128: result[3],
    tickCumulativeOutside: result[4],
    secondsPerLiquidityOutsideX128: result[5],
    secondsOutside: Number(result[6]),
    initialized: result[7]
  };
}

/**
 * Enable fee amount (only owner can call this)
 * @param {ethers.Provider} provider - Ethers provider
 * @param {ethers.Signer} signer - Ethers signer (must be factory owner)
 * @param {number} fee - Fee amount (e.g., 500 for 0.05%)
 * @param {number} tickSpacing - Tick spacing for this fee tier
 * @returns {Promise<ethers.TransactionResponse>}
 */
export async function enableFeeAmount(provider, signer, fee, tickSpacing) {
  const factory = getFactory(provider).connect(signer);
  const tx = await factory.enableFeeAmount(fee, tickSpacing);
  await tx.wait();
  return tx;
}

/**
 * Quote burn amounts (staticCall to estimate what burn will return)
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} poolAddr - Pool address
 * @param {number} tickLower - Lower tick
 * @param {number} tickUpper - Upper tick
 * @param {bigint} liquidityAmount - Amount of liquidity to burn
 * @returns {Promise<{amount0: bigint, amount1: bigint}>}
 */
export async function quoteBurn(provider, poolAddr, tickLower, tickUpper, liquidityAmount) {
  try {
    console.log('[quoteBurn] 开始赎回报价:');
    console.log('  - poolAddr:', poolAddr);
    console.log('  - tickLower:', tickLower);
    console.log('  - tickUpper:', tickUpper);
    console.log('  - liquidityAmount:', liquidityAmount.toString());

    const pool = getPoolContract(provider, poolAddr);
    const signer = provider.getSigner?.() || provider;
    
    // 先验证基本信息
    const [slot0, tickSpacing] = await Promise.all([
      pool.slot0(),
      pool.tickSpacing(),
    ]);

    // 检查池子初始化
    if (slot0.sqrtPriceX96 === 0n) {
      throw new Error('池子未初始化，无法计算赎回');
    }

    // 检查 tick 对齐
    const ts = Number(tickSpacing);
    if (tickLower % ts !== 0 || tickUpper % ts !== 0) {
      throw new Error(`Tick 必须是 tickSpacing (${ts}) 的倍数。tickLower=${tickLower}, tickUpper=${tickUpper}`);
    }

    // 检查 tick 范围有效性
    if (tickLower >= tickUpper) {
      throw new Error(`tickLower (${tickLower}) 必须小于 tickUpper (${tickUpper})`);
    }

    // 尝试 staticCall
    console.log('[quoteBurn] 尝试调用 burn.staticCall...');
    try {
      const res = await pool.burn.staticCall(tickLower, tickUpper, liquidityAmount);
      console.log('[quoteBurn] staticCall 成功:', { amount0: res[0].toString(), amount1: res[1].toString() });
      return { amount0: res[0], amount1: res[1] };
    } catch (staticCallErr) {
      console.warn('[quoteBurn] staticCall 失败:', staticCallErr.message);
      
      // staticCall 失败时，检查该位置是否真的有持仓
      if (staticCallErr.message.includes('Insufficient liquidity')) {
        try {
          // 尝试获取调用者地址
          let owner;
          try {
            const sig = await provider.getSigner?.();
            owner = await sig?.getAddress?.();
          } catch (e) {
            console.warn('[quoteBurn] 无法获取签者地址:', e.message);
          }

          if (owner) {
            // 查询该位置的实际持仓
            const key = ethers.solidityPackedKeccak256(
              ['address', 'int24', 'int24'],
              [owner, tickLower, tickUpper]
            );
            const posData = await safeCallView(provider, poolAddr, AMMPoolABI, 'positions', [key]);
            const actualLiquidity = posData[0];
            
            console.log('[quoteBurn] 诊断信息:');
            console.log('  - 该位置的实际流动性:', actualLiquidity.toString());
            console.log('  - 您要赎回的数量:', liquidityAmount.toString());
            
            if (actualLiquidity === 0n) {
              throw new Error(
                `❌ 您在 Tick 范围 [${tickLower}, ${tickUpper}] 内没有流动性持仓！\n\n` +
                `可能原因：\n` +
                `1. 添加流动性时的 Tick 范围与现在不同\n` +
                `2. 流动性已经被完全赎回\n` +
                `3. Tick 参数不正确\n\n` +
                `解决方案：\n` +
                `• 点击"🔍 查询我的持仓"检查实际范围\n` +
                `• 使用"💡 建议范围"找到有流动性的范围`
              );
            }
            
            if (liquidityAmount > actualLiquidity) {
              throw new Error(
                `❌ 赎回数量过多！\n` +
                `实际持仓: ${actualLiquidity.toString()} LP\n` +
                `要赎回: ${liquidityAmount.toString()} LP`
              );
            }
          }
        } catch (diagErr) {
          console.error('[quoteBurn] 诊断检查失败:', diagErr.message);
          // 如果诊断也失败，继续使用离链计算
        }
      }
      
      // 尝试离链计算作为备选
      console.log('[quoteBurn] 尝试离链计算...');
      const offchainResult = await quoteBurnOffchain(provider, poolAddr, tickLower, tickUpper, liquidityAmount);
      console.log('[quoteBurn] 离链计算结果:', offchainResult);
      return offchainResult;
    }
  } catch (err) {
    console.error('[quoteBurn] 赎回报价失败:', err.message);
    throw err;
  }
}

/**
 * 离链计算赎回金额（备选方案，当 staticCall 失败时使用）
 */
async function quoteBurnOffchain(provider, poolAddr, tickLower, tickUpper, liquidityAmount) {
  console.log('[quoteBurnOffchain] 开始离链计算...');
  console.log('  - liquidityAmount:', liquidityAmount.toString());
  
  try {
    const pool = getPoolContract(provider, poolAddr);
    const [slot0, tickSpacing] = await Promise.all([
      pool.slot0(),
      pool.tickSpacing(),
    ]);

    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const currentTick = Number(slot0.tick);
    const ts = Number(tickSpacing);

    console.log('[quoteBurnOffchain] 池子信息:');
    console.log('  - currentTick:', currentTick);
    console.log('  - tickSpacing:', ts);
    console.log('  - sqrtPriceX96:', sqrtPriceX96.toString());

    // 得到该范围的 sqrtRatio
    const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower);
    const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper);

    console.log('[quoteBurnOffchain] 计算范围:');
    console.log('  - tickLower:', tickLower, '-> sqrtRatioA:', sqrtRatioAX96.toString());
    console.log('  - tickUpper:', tickUpper, '-> sqrtRatioB:', sqrtRatioBX96.toString());

    // 离链计算赎回金额（反向计算）
    let amount0 = 0n;
    let amount1 = 0n;
    const L = BigInt(liquidityAmount);
    const Q96 = 2n ** 96n;

    if (sqrtPriceX96 < sqrtRatioAX96) {
      // 当前价格低于范围，取回 token0
      console.log('[quoteBurnOffchain] 价格模式: 低于范围 (取回 token0)');
      amount0 = (L * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
    } else if (sqrtPriceX96 < sqrtRatioBX96) {
      // 当前价格在范围内，取回两种
      console.log('[quoteBurnOffchain] 价格模式: 在范围内 (取回两种)');
      amount0 = (L * (sqrtRatioBX96 - sqrtPriceX96)) / Q96;
      amount1 = L * (sqrtPriceX96 - sqrtRatioAX96) / Q96;
    } else {
      // 当前价格高于范围，取回 token1
      console.log('[quoteBurnOffchain] 价格模式: 高于范围 (取回 token1)');
      amount1 = L * (sqrtRatioBX96 - sqrtRatioAX96) / Q96;
    }

    console.log('[quoteBurnOffchain] 计算结果:');
    console.log('  - amount0:', amount0.toString());
    console.log('  - amount1:', amount1.toString());
    
    return { amount0, amount1 };
  } catch (err) {
    console.error('[quoteBurnOffchain] 离链计算失败:', err.message);
    throw new Error(`离链计算失败: ${err.message}`);
  }
}

// ========== Additional Factory Functions ==========

/**
 * Get the owner of the factory contract
 * @param {ethers.Provider} provider - Ethers provider
 * @returns {Promise<string>} Factory owner address
 */
export async function getFactoryOwner(provider) {
  const result = await safeCallView(provider, FACTORY_ADDRESS, AMMFactoryABI, 'owner');
  return result[0];
}

/**
 * Get tick spacing for a given fee amount
 * @param {ethers.Provider} provider - Ethers provider
 * @param {number} fee - Fee amount (e.g., 3000 for 0.3%)
 * @returns {Promise<number>} Tick spacing for the fee tier
 */
export async function getFeeAmountTickSpacing(provider, fee) {
  const result = await safeCallView(provider, FACTORY_ADDRESS, AMMFactoryABI, 'feeAmountTickSpacing', [fee]);
  return Number(result[0]);
}

// ========== 市场分析相关函数 ==========

/**
 * 获取池子的历史 Swap 事件（带时间戳）
 */
export async function getSwapHistory(provider, poolAddr, fromBlock = 'latest', toBlock = 'latest', limit = 100) {
  try {
    const pool = getPoolContract(provider, poolAddr);
    
    // 检查是否支持Swap事件
    if (!pool.filters || typeof pool.filters.Swap !== 'function') {
      console.warn('合约不支持Swap事件过滤器');
      return [];
    }
    
    const filter = pool.filters.Swap();
    
    // 获取最近的事件
    const events = await pool.queryFilter(filter, fromBlock === 'latest' ? -limit : fromBlock, toBlock);
    
    // 批量获取区块时间戳以提高效率
    const blockNumbers = [...new Set(events.map(e => e.blockNumber))];
    const blockPromises = blockNumbers.map(bn => provider.getBlock(bn));
    const blocks = await Promise.all(blockPromises);
    const blockTimeMap = new Map();
    blocks.forEach(block => {
      blockTimeMap.set(block.number, block.timestamp);
    });
    
    return events.map(event => ({
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      sender: event.args.sender,
      recipient: event.args.recipient,
      amount0: event.args.amount0,
      amount1: event.args.amount1,
      sqrtPriceX96: event.args.sqrtPriceX96,
      liquidity: event.args.liquidity,
      tick: event.args.tick,
      timestamp: blockTimeMap.get(event.blockNumber),
      blockTimestamp: blockTimeMap.get(event.blockNumber)
    }));
  } catch (err) {
    console.warn('获取交易历史失败，返回空数据:', err.message);
    return [];
  }
}

/**
 * 计算池子的 24 小时交易量
 */
export async function get24hVolume(provider, poolAddr) {
  try {
    const currentBlock = await provider.getBlockNumber();
    const blocksIn24h = Math.floor(24 * 60 * 60 / 12); // 假设12秒一个区块
    const fromBlock = currentBlock - blocksIn24h;
    
    const swapEvents = await getSwapHistory(provider, poolAddr, fromBlock, 'latest', 1000);
    
    let volume0 = 0n;
    let volume1 = 0n;
    
    swapEvents.forEach(event => {
      volume0 += event.amount0 > 0 ? event.amount0 : -event.amount0;
      volume1 += event.amount1 > 0 ? event.amount1 : -event.amount1;
    });
    
    return { volume0, volume1, swapCount: swapEvents.length };
  } catch (err) {
    console.error('计算24h交易量失败:', err);
    return { volume0: 0n, volume1: 0n, swapCount: 0 };
  }
}

/**
 * 计算当前价格（基于 sqrtPriceX96）
 * 基于Uniswap V3 SDK的精确算法
 */
export function calculatePrice(sqrtPriceX96, decimals0 = 18, decimals1 = 18) {
  if (!sqrtPriceX96 || sqrtPriceX96 === 0n) return 0;
  
  // 使用Uniswap V3 SDK相同的精确算法
  // price = (sqrtPriceX96 / 2^96)^2 * (10^decimals1 / 10^decimals0)
  const Q96 = 2n ** 96n;
  const Q192 = Q96 ** 2n;
  
  try {
    // 防止溢出，先计算平方
    const sqrtPriceSquared = BigInt(sqrtPriceX96) ** 2n;
    
    // 调整小数位
    const decimalAdjustment = (10n ** BigInt(decimals1)) / (10n ** BigInt(decimals0));
    
    // 计算最终价格
    const price = (sqrtPriceSquared * decimalAdjustment) / Q192;
    
    // 转换为数字格式，保持18位精度
    return Number(price * 10n ** 18n) / Number(10n ** 18n);
  } catch (error) {
    console.warn('价格计算失败:', error);
    return 0;
  }
}

/**
 * 计算两个tick之间的价格范围
 * @param {number} tickLower 低价tick
 * @param {number} tickUpper 高价tick
 * @param {number} decimals0 token0精度
 * @param {number} decimals1 token1精度
 */
export function calculateTickPriceRange(tickLower, tickUpper, decimals0 = 18, decimals1 = 18) {
  try {
    // 使用TickMath公式计算sqrtPrice
    // sqrtPrice = 1.0001^(tick/2)
    const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
    const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);
    
    // 转换为sqrtPriceX96格式
    const Q96 = Math.pow(2, 96);
    const sqrtPriceLowerX96 = BigInt(Math.floor(sqrtPriceLower * Q96));
    const sqrtPriceUpperX96 = BigInt(Math.floor(sqrtPriceUpper * Q96));
    
    return {
      priceLower: calculatePrice(sqrtPriceLowerX96, decimals0, decimals1),
      priceUpper: calculatePrice(sqrtPriceUpperX96, decimals0, decimals1),
      sqrtPriceLowerX96,
      sqrtPriceUpperX96
    };
  } catch (error) {
    console.warn('Tick价格范围计算失败:', error);
    return { priceLower: 0, priceUpper: 0, sqrtPriceLowerX96: 0n, sqrtPriceUpperX96: 0n };
  }
}

/**
 * 计算TVL（总锁定价值）
 */
export async function calculateTVL(provider, poolAddr, token0Price = 1, token1Price = 1) {
  try {
    const [liquidity, slot0Data, tokens] = await Promise.all([
      getPoolLiquidity(provider, poolAddr),
      readSlot0(provider, poolAddr),
      readPoolTokens(provider, poolAddr)
    ]);
    
    const [token0Info, token1Info] = await Promise.all([
      getTokenInfo(provider, tokens.token0),
      getTokenInfo(provider, tokens.token1)
    ]);
    
    // 获取池子中的代币余额
    const [balance0, balance1] = await Promise.all([
      getTokenBalance(provider, tokens.token0, poolAddr),
      getTokenBalance(provider, tokens.token1, poolAddr)
    ]);
    
    // 计算TVL
    const tvl0 = Number(balance0) / Number(10n ** BigInt(token0Info.decimals)) * token0Price;
    const tvl1 = Number(balance1) / Number(10n ** BigInt(token1Info.decimals)) * token1Price;
    
    return {
      totalTVL: tvl0 + tvl1,
      token0TVL: tvl0,
      token1TVL: tvl1,
      token0Balance: balance0,
      token1Balance: balance1
    };
  } catch (err) {
    console.error('计算TVL失败:', err);
    throw err;
  }
}

/**
 * 计算无常损失
 */
export function calculateImpermanentLoss(initialPrice, currentPrice) {
  if (initialPrice <= 0 || currentPrice <= 0) return 0;
  
  const ratio = currentPrice / initialPrice;
  const sqrtRatio = Math.sqrt(ratio);
  const impermanentLoss = 2 * sqrtRatio / (1 + ratio) - 1;
  
  return impermanentLoss * 100; // 返回百分比
}

/**
 * 获取价格变化趋势
 */
export async function getPriceTrend(provider, poolAddr, timeframeBocks = 100) {
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - timeframeBocks;
    
    const swapEvents = await getSwapHistory(provider, poolAddr, fromBlock, 'latest');
    
    if (swapEvents.length === 0) {
      return { trend: 'neutral', change: 0 };
    }
    
    const firstPrice = calculatePrice(swapEvents[0].sqrtPriceX96);
    const lastPrice = calculatePrice(swapEvents[swapEvents.length - 1].sqrtPriceX96);
    
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    const trend = change > 1 ? 'up' : change < -1 ? 'down' : 'neutral';
    
    return { trend, change, firstPrice, lastPrice };
  } catch (err) {
    console.error('获取价格趋势失败:', err);
    return { trend: 'neutral', change: 0 };
  }
}

/**
 * 获取流动性分布（活跃的tick范围）
 * 基于Uniswap V3 SDK的TickListDataProvider模式
 */
export async function getLiquidityDistribution(provider, poolAddr, tickRange = 100) {
  try {
    const [slot0Data, poolContract] = await Promise.all([
      readSlot0(provider, poolAddr),
      Promise.resolve(getPoolContract(provider, poolAddr))
    ]);
    
    const currentTick = Number(slot0Data[1]);
    const fee = await poolContract.fee();
    
    // 获取tickSpacing
    let tickSpacing;
    try {
      tickSpacing = await getFeeAmountTickSpacing(provider, Number(fee));
    } catch {
      // fallback到默认值
      const feeNum = Number(fee);
      tickSpacing = feeNum === 500 ? 10 : feeNum === 3000 ? 60 : feeNum === 10000 ? 200 : 60;
    }
    
    const distribution = [];
    const promises = [];
    
    // 查询当前tick周围的流动性分布，按tickSpacing对齐
    for (let i = -tickRange; i <= tickRange; i += Math.max(tickSpacing, 10)) {
      const tick = currentTick + i;
      // 确保 tick 是 tickSpacing 的倍数
      const alignedTick = Math.floor(tick / tickSpacing) * tickSpacing;
      
      promises.push(
        getTickInfo(provider, poolAddr, alignedTick)
          .then(tickInfo => {
            if (tickInfo.initialized && tickInfo.liquidityGross > 0n) {
              // 计算该tick的价格范围
              const priceRange = calculateTickPriceRange(
                alignedTick, 
                alignedTick + tickSpacing
              );
              
              return {
                tick: alignedTick,
                liquidityGross: tickInfo.liquidityGross,
                liquidityNet: tickInfo.liquidityNet,
                feeGrowthOutside0X128: tickInfo.feeGrowthOutside0X128,
                feeGrowthOutside1X128: tickInfo.feeGrowthOutside1X128,
                tickCumulativeOutside: tickInfo.tickCumulativeOutside,
                secondsOutside: tickInfo.secondsOutside,
                priceRange,
                distanceFromCurrent: Math.abs(alignedTick - currentTick)
              };
            }
            return null;
          })
          .catch(() => null) // 忽略错误
      );
    }
    
    const results = await Promise.all(promises);
    const validResults = results.filter(result => result !== null);
    
    // 按距离当前tick的远近排序
    return validResults.sort((a, b) => a.distanceFromCurrent - b.distanceFromCurrent);
  } catch (err) {
    console.error('获取流动性分布失败:', err);
    return [];
  }
}

// ========== 价格预言机相关功能 ==========

/**
 * 获取池子的历史价格观察数据（TWAP）
 * 基于Uniswap V3的Oracle机制
 */
export async function getPoolPriceObservations(provider, poolAddr, secondsAgo = [3600, 0]) {
  try {
    const pool = getPoolContract(provider, poolAddr);
    
    // 检查是否支持observe函数
    if (typeof pool.observe !== 'function') {
      console.warn('合约不支持observe函数，使用当前价格代替');
      
      // Fallback: 使用当前价格代替
      const slot0Data = await readSlot0(provider, poolAddr);
      const currentTick = Number(slot0Data[1]);
      const currentPrice = Math.pow(1.0001, currentTick);
      
      return {
        timeWeightedTick: currentTick,
        twapPrice: currentPrice,
        tickCumulatives: [currentTick.toString()],
        secondsPerLiquidityCumulatives: ['0'],
        period: secondsAgo[0] - secondsAgo[secondsAgo.length - 1],
        fallback: true
      };
    }
    
    // 获取观察数据
    const observations = await pool.observe(secondsAgo);
    
    if (observations.length >= 2) {
      const tickCumulatives = observations[0];
      const secondsPerLiquidityCumulatives = observations[1];
      
      // 计算TWAP价格
      const timeWeightedTick = (
        Number(tickCumulatives[tickCumulatives.length - 1]) - 
        Number(tickCumulatives[0])
      ) / (secondsAgo[0] - secondsAgo[secondsAgo.length - 1]);
      
      // 计算时间加权平均价格
      const twapPrice = Math.pow(1.0001, timeWeightedTick);
      
      return {
        timeWeightedTick,
        twapPrice,
        tickCumulatives: tickCumulatives.map(t => t.toString()),
        secondsPerLiquidityCumulatives: secondsPerLiquidityCumulatives.map(s => s.toString()),
        period: secondsAgo[0] - secondsAgo[secondsAgo.length - 1],
        fallback: false
      };
    }
    
    throw new Error('观察数据不足');
  } catch (err) {
    console.warn('获取价格观察数据失败，使用当前价格代替:', err.message);
    
    // Fallback机制
    try {
      const slot0Data = await readSlot0(provider, poolAddr);
      const currentTick = Number(slot0Data[1]);
      const currentPrice = Math.pow(1.0001, currentTick);
      
      return {
        timeWeightedTick: currentTick,
        twapPrice: currentPrice,
        tickCumulatives: [currentTick.toString()],
        secondsPerLiquidityCumulatives: ['0'],
        period: secondsAgo[0] - secondsAgo[secondsAgo.length - 1],
        fallback: true
      };
    } catch (fallbackErr) {
      console.error('获取价格观察数据失败:', fallbackErr);
      throw fallbackErr;
    }
  }
}

/**
 * 计算价格影响（Price Impact）
 * 基于Uniswap V3 SDK的Trade类
 */
export async function calculatePriceImpact(provider, poolAddr, amountIn, zeroForOne) {
  try {
    const [slot0Data, liquidity] = await Promise.all([
      readSlot0(provider, poolAddr),
      getPoolLiquidity(provider, poolAddr)
    ]);
    
    const currentSqrtPrice = slot0Data[0];
    const currentPrice = calculatePrice(currentSqrtPrice);
    
    // 模拟swap计算新价格
    // 这里使用简化算法，实际应该使用SwapMath.computeSwapStep
    const liquidityBigInt = BigInt(liquidity);
    const amountInBigInt = BigInt(amountIn);
    
    // 简化的价格影响计算
    let priceImpact;
    if (liquidityBigInt > 0n) {
      const liquidityRatio = Number(amountInBigInt) / Number(liquidityBigInt);
      priceImpact = liquidityRatio * 0.1; // 简化公式
    } else {
      priceImpact = 0;
    }
    
    return {
      priceImpact: Math.min(priceImpact * 100, 100), // 返回百分比，最多100%
      currentPrice,
      estimatedNewPrice: currentPrice * (1 + (zeroForOne ? -priceImpact : priceImpact))
    };
  } catch (err) {
    console.error('计算价格影响失败:', err);
    return { priceImpact: 0, currentPrice: 0, estimatedNewPrice: 0 };
  }
}

/**
 * 获取池子的活跃流动性范围
 * 基于Uniswap V3 SDK的Position类
 */
export async function getActiveLiquidityRange(provider, poolAddr) {
  try {
    const [slot0Data, liquidity] = await Promise.all([
      readSlot0(provider, poolAddr),
      getPoolLiquidity(provider, poolAddr)
    ]);
    
    const currentTick = Number(slot0Data[1]);
    const currentSqrtPrice = slot0Data[0];
    
    // 查找最近的活跃tick范围
    const searchRange = 1000; // 搜索范围
    const activeTicks = [];
    
    for (let i = -searchRange; i <= searchRange; i += 60) { // 使用60的tickSpacing
      const tick = currentTick + i;
      try {
        const tickInfo = await getTickInfo(provider, poolAddr, tick);
        if (tickInfo.initialized && tickInfo.liquidityGross > 0n) {
          const tickPrice = Math.pow(1.0001, tick);
          activeTicks.push({
            tick,
            price: tickPrice,
            liquidityGross: tickInfo.liquidityGross,
            liquidityNet: tickInfo.liquidityNet,
            distanceFromCurrent: Math.abs(tick - currentTick)
          });
        }
      } catch {
        // 忽略错误
      }
    }
    
    // 找到最近的上下界
    const ticksBelow = activeTicks.filter(t => t.tick < currentTick).sort((a, b) => b.tick - a.tick);
    const ticksAbove = activeTicks.filter(t => t.tick > currentTick).sort((a, b) => a.tick - b.tick);
    
    const lowerBound = ticksBelow.length > 0 ? ticksBelow[0] : null;
    const upperBound = ticksAbove.length > 0 ? ticksAbove[0] : null;
    
    return {
      currentTick,
      currentPrice: calculatePrice(currentSqrtPrice),
      lowerBound,
      upperBound,
      activeTicks: activeTicks.sort((a, b) => a.distanceFromCurrent - b.distanceFromCurrent),
      totalActiveLiquidity: activeTicks.reduce((sum, tick) => sum + Number(tick.liquidityGross), 0)
    };
  } catch (err) {
    console.error('获取活跃流动性范围失败:', err);
    return {
      currentTick: 0,
      currentPrice: 0,
      lowerBound: null,
      upperBound: null,
      activeTicks: [],
      totalActiveLiquidity: 0
    };
  }
}
