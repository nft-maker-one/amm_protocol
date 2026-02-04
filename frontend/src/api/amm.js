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
 * Quote required token0/token1 amounts for mint by static calling pool.mint
 * Returns { amount0, amount1 } as BigInt.
 */
export async function quoteMint(provider, poolAddr, recipient, tickLower, tickUpper, liquidityAmount) {
  const pool = getPoolContract(provider, poolAddr);
  // ethers v6: use .mint.staticCall(...)
  const res = await pool.mint.staticCall(recipient, tickLower, tickUpper, liquidityAmount, '0x');
  // res is [amount0, amount1]
  return { amount0: res[0], amount1: res[1] };
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
  const poolRead = getPoolContract(provider, poolAddr);
  const recipient = await signer.getAddress();
  const [token0, token1] = await Promise.all([poolRead.token0(), poolRead.token1()]);

  const tokenIn = zeroForOne ? token0 : token1;
  const tokenOut = zeroForOne ? token1 : token0;

  // Approve pool to spend tokenIn if needed
  await approveIfNeeded(provider, signer, tokenIn, poolAddr, amountIn);

  const poolWrite = getPoolContract(signer, poolAddr);

  const sqrtPriceLimitX96 =
    sqrtPriceLimitX96Override !== undefined && sqrtPriceLimitX96Override !== null
      ? sqrtPriceLimitX96Override
      : (zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n);

  const amountSpecified = BigInt(amountIn);

  const res = await poolWrite.swap(
    recipient,
    zeroForOne,
    amountSpecified,
    sqrtPriceLimitX96,
    '0x'
  );

  const receipt = await res.wait();

  // Decode logs is overkill; easier: re-read balances difference off-chain if needed.
  // For now we just return tx object; UI can optionally re-query balances.
  return {
    tx: res,
    receipt,
    tokenIn,
    tokenOut,
    amountIn,
  };
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
 * @param {string} initialSupply - Initial supply (as string, e.g., "1000000")
 * @returns {Promise<{address: string, tx: ethers.TransactionResponse}>}
 */
export async function deployToken(provider, signer, tokenBytecode, name, symbol, decimals, initialSupply) {
  if (!tokenBytecode || tokenBytecode === '0x') {
    throw new Error('Token bytecode is required. Please compile the contract first.');
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
  
  const factory = new ethers.ContractFactory(MockTokenConstructorABI, tokenBytecode, signer);
  const contract = await factory.deploy(name, symbol, decimals, initialSupply);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  return {
    address,
    tx: contract.deploymentTransaction()
  };
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
  const pool = getPoolContract(provider, poolAddr);
  const res = await pool.burn.staticCall(tickLower, tickUpper, liquidityAmount);
  return { amount0: res[0], amount1: res[1] };
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
