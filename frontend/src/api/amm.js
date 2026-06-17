import { ethers } from 'ethers';
import AMMPoolABI from './abi/AMMPool.json';
import AMMFactoryABI from './abi/AMMFactory.json';
import ERC20ABI from './abi/ERC20.json';

// Addresses (keep in sync with App.jsx TODOs)
// Your deployed pool on Sepolia (initialized)
export const AMMPOOL_ADDRESS = '0x0a0cba1059BE0867AA858e37E4459862Ef40b8d7';
export const FACTORY_ADDRESS = '0x79A1219d4aA0E7E9bcE45c2CbC17e34C50b3B915';
export const AMMFACTORY_ADDRESS = FACTORY_ADDRESS; // Alias for routing

// TickMath constants (copied from contracts/src/libraries/TickMath.sol)
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export async function ensureSepolia(provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 11155111) throw new Error('Please switch MetaMask to Sepolia testnet');
}

export async function safeCallView(provider, address, abi, fnName, args = []) {
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData(fnName, args);
  const res = await provider.call({ to: address, data });
  if (!res || res === '0x') throw new Error(`${fnName} returned empty data. Function may not exist on this contract or address is incorrect`);
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
  // Validate fee value
  const VALID_FEES = [500, 3000, 10000];
  const feeNum = Number(fee);
  if (!VALID_FEES.includes(feeNum)) {
    throw new Error(`Invalid fee: ${fee}. Allowed fees are: ${VALID_FEES.join(', ')}`);
  }
  
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
        throw new Error(`Only contract owner (${owner}) can mint tokens. Current address: ${signerAddr}`);
      }
    } catch (err) {
      // If owner() function doesn't exist, it might not be a MockToken
      console.warn('Unable to check owner, may not be a MockToken contract:', err.message);
    }
    
    const tokenWithSigner = token.connect(signer);
    const tx = await tokenWithSigner.mint(toAddr, amount);
    await tx.wait();
    return tx;
  } catch (error) {
    if (error.message.includes('owner')) {
      throw error; // Re-throw owner-related errors as-is
    } else if (error.code === 'CALL_EXCEPTION') {
      throw new Error('Contract call failed. Possible reasons: 1) You are not the contract owner, 2) Invalid contract address, 3) Invalid parameters');
    } else {
      throw new Error(`Minting failed: ${error.message}`);
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
 * Diagnostic function: Check all critical states of the Pool
 */
export async function diagnosePool(provider, poolAddr) {
  try {
    const pool = getPoolContract(provider, poolAddr);
    
    // Read all critical states
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

    return diagnosis;
  } catch (err) {
    console.error('[diagnosePool] Diagnosis failed:', err);
    throw err;
  }
}

/**
 * Pre-check if mint parameters are valid
 */
export async function validateMintParams(provider, poolAddr, tickLower, tickUpper, liquidityAmount) {
  const pool = getPoolContract(provider, poolAddr);
  const [slot0, tickSpacing] = await Promise.all([
    pool.slot0(),
    pool.tickSpacing(),
  ]);

  const errors = [];
  const warnings = [];

  // Check Pool initialization
  if (slot0.sqrtPriceX96 === 0n) {
    errors.push('Pool not initialized (sqrtPriceX96 = 0)');
  }

  // Check basic range
  if (tickLower >= tickUpper) {
    errors.push(`tickLower (${tickLower}) must be less than tickUpper (${tickUpper})`);
  }

  // Check tick range (TickMath limits)
  if (tickLower < -887272) {
    errors.push(`tickLower (${tickLower}) is below minimum -887272`);
  }
  if (tickUpper > 887272) {
    errors.push(`tickUpper (${tickUpper}) exceeds maximum 887272`);
  }

  // Check tickSpacing alignment
  const tickSpacingNum = Number(tickSpacing);
  if (tickLower % tickSpacingNum !== 0) {
    errors.push(`tickLower (${tickLower}) must be multiple of tickSpacing (${tickSpacingNum})`);
  }
  if (tickUpper % tickSpacingNum !== 0) {
    errors.push(`tickUpper (${tickUpper}) must be multiple of tickSpacing (${tickSpacingNum})`);
  }

  // Check liquidity
  if (liquidityAmount <= 0n) {
    errors.push(`Liquidity amount must be greater than 0, current value: ${liquidityAmount.toString()}`);
  }

  // Current tick check
  const currentTick = Number(slot0.tick);
  if (currentTick < tickLower || currentTick > tickUpper) {
    warnings.push(`Warning: current tick (${currentTick}) is outside range [${tickLower}, ${tickUpper}]`);
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
 * Off-chain calculation of required token amounts for adding liquidity
 * This function does not depend on staticCall, so users don't need to have sufficient token balance first
 * Algorithm based on Uniswap V3 formula
 */
export async function quoteMint(provider, poolAddr, recipient, tickLower, tickUpper, liquidityAmount) {
  const pool = getPoolContract(provider, poolAddr);
  
  try {
    // Read pool information
    const [slot0, tickSpacing, token0, token1] = await Promise.all([
      pool.slot0(),
      pool.tickSpacing(),
      pool.token0(),
      pool.token1(),
    ]);
    
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const currentTick = Number(slot0.tick);
    const tickSpacingNum = Number(tickSpacing);

    // Check initialization
    if (sqrtPriceX96 === 0n) {
      throw new Error('Pool not initialized (sqrtPriceX96 = 0)');
    }

    // Validate tick alignment
    if (tickLower % tickSpacingNum !== 0) {
      throw new Error(`tickLower ${tickLower} must be a multiple of tickSpacing ${tickSpacingNum}`);
    }
    if (tickUpper % tickSpacingNum !== 0) {
      throw new Error(`tickUpper ${tickUpper} must be a multiple of tickSpacing ${tickSpacingNum}`);
    }
    if (tickLower >= tickUpper) {
      throw new Error(`tickLower ${tickLower} must be less than tickUpper ${tickUpper}`);
    }

    // Use off-chain calculation formula (Uniswap V3 style)
    const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower);
    const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper);
    
    let amount0 = 0n;
    let amount1 = 0n;
    const liquidity = BigInt(liquidityAmount);

    if (sqrtPriceX96 < sqrtRatioAX96) {
      amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
    } else if (sqrtPriceX96 < sqrtRatioBX96) {
      amount0 = getAmount0ForLiquidity(sqrtPriceX96, sqrtRatioBX96, liquidity);
      amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtPriceX96, liquidity);
    } else {
      amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
    }
    
    return { amount0, amount1, token0, token1, isOffchainEstimate: true };
  } catch (err) {
    console.error('💥 [quoteMint] Quote failed:', err.message);
    throw err;
  }
}

// ============ TickMath helper functions (JS version) ============

const Q96 = 2n ** 96n;

/**
 * Calculate sqrtPriceX96 based on tick
 * This is the JavaScript implementation of TickMath.getSqrtRatioAtTick
 */
function getSqrtRatioAtTick(tick) {
  const absTick = tick < 0 ? -tick : tick;
  
  if (absTick > 887272) {
    throw new Error(`Tick ${tick} is out of range [-887272, 887272]`);
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

  // Convert to Q96 format
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/**
 * Calculate the amount of token0 required for given liquidity and price range
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
 * Calculate the amount of token1 required for given liquidity and price range
 */
function getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
}

// ============ Keep old staticCall version for debugging ============

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
  console.log(`      🔍 estimateSwapOut: pool=${poolAddr.slice(0,8)}..., direction=${zeroForOne}, input=${amountIn.toString()}`);
  
  const pool = getPoolContract(provider, poolAddr);
  const [token0, token1, fee] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.fee(),
  ]);

  console.log(`      📝 Token info: Token0=${token0.slice(0,8)}..., Token1=${token1.slice(0,8)}..., Fee=${fee}`);

  const tokenIn = zeroForOne ? token0 : token1;
  const tokenOut = zeroForOne ? token1 : token0;

  const erc20Token0 = getErc20Contract(provider, token0);
  const erc20Token1 = getErc20Contract(provider, token1);
  const [balance0, balance1] = await Promise.all([
    erc20Token0.balanceOf(poolAddr),
    erc20Token1.balanceOf(poolAddr),
  ]);

  let amountInNet = BigInt(amountIn);
  const feeBI = BigInt(fee);
  const feeAmount = (amountInNet * feeBI) / 1000000n;
  amountInNet -= feeAmount;

  if (balance0 === 0n || balance1 === 0n) {
    throw new Error(`Pool has no liquidity: Token0 balance=${balance0.toString()}, Token1 balance=${balance1.toString()}`);
  }

  let amountOut;
  if (zeroForOne) {
    amountOut = (amountInNet * BigInt(balance1)) / (BigInt(balance0) + amountInNet);
  } else {
    amountOut = (amountInNet * BigInt(balance0)) / (BigInt(balance1) + amountInNet);
  }

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
  try {
    const poolStatus = await checkPoolStatus(provider, poolAddr);
    if (poolStatus.status !== 'INITIALIZED') {
      throw new Error(`Pool not initialized: ${poolStatus.message}`);
    }

    const poolRead = getPoolContract(provider, poolAddr);
    const recipient = await signer.getAddress();
    
    const [token0, token1] = await Promise.all([
      poolRead.token0(),
      poolRead.token1(),
    ]);

    const tokenIn = zeroForOne ? token0 : token1;
    const tokenOut = zeroForOne ? token1 : token0;

    // 2. Validate input amount
    const amountInBigInt = BigInt(amountIn);
    if (amountInBigInt <= 0n) {
      throw new Error(`Input amount must be greater than 0`);
    }

    // Approve token spending
    await approveIfNeeded(provider, signer, tokenIn, poolAddr, amountInBigInt);

    // Set price limit
    const sqrtPriceLimitX96 =
      sqrtPriceLimitX96Override !== undefined && sqrtPriceLimitX96Override !== null
        ? sqrtPriceLimitX96Override
        : (zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n);

    // Execute swap
    const poolWrite = getPoolContract(signer, poolAddr);
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
      // Provide more detailed error information
      if (err.code === 'CALL_EXCEPTION' || err.message.includes('reverted')) {
        throw new Error(`Swap execution failed (may be insufficient liquidity or price slippage exceeded): ${err.message}`);
      }
      throw err;
    }

    const receipt = await res.wait();

    return {
      tx: res,
      receipt,
      tokenIn,
      tokenOut,
      amountIn: amountInBigInt,
    };
  } catch (err) {
    console.error(`  ❌ Swap failed:`, err);
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
  
  // Validate input parameters
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
  
  // Token deployment starting
  
  const factory = new ethers.ContractFactory(MockTokenConstructorABI, tokenBytecode, signer);
  
  // Verify bytecode is not empty
  if (!factory.bytecode || factory.bytecode === '0x') {
    throw new Error('Failed to parse token bytecode. Please ensure VITE_TOKEN_BYTECODE is correctly set in .env.local');
  }
  
  let deployTx;
  try {
    const contract = await factory.deploy(name, symbol, decimals, BigInt(initialSupply));
    deployTx = contract.deploymentTransaction();
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    return {
      address,
      tx: deployTx
    };
  } catch (err) {
    if (err.message.includes('insufficient funds')) {
      throw new Error('Deployment failed: Account balance insufficient. Please ensure your account has enough ETH on Sepolia testnet');
    } else if (err.message.includes('transaction failed')) {
      throw new Error('Deployment failed: Transaction execution failed. This may be due to invalid bytecode or network issues');
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
 * Check pool initialization status
 */
export async function checkPoolStatus(provider, poolAddress) {
  const pool = getPoolContract(provider, poolAddress);
  
  try {
    // Check if pool address exists
    const code = await provider.getCode(poolAddress);
    if (code === '0x') {
      return { status: 'NOT_EXIST', message: 'Pool address does not exist or is not a contract' };
    }

    // Get basic information
    const [token0, token1, fee] = await Promise.all([
      pool.token0(),
      pool.token1(),
      pool.fee(),
    ]);

    // Check initialization status
    let slot0Data;
    try {
      slot0Data = await pool.slot0();
      const sqrtPriceX96 = slot0Data[0];
      const tick = slot0Data[1];
      
      if (sqrtPriceX96 === 0n) {
        return { 
          status: 'NOT_INITIALIZED', 
          message: 'Pool exists but not initialized (sqrtPriceX96 = 0)',
          token0, 
          token1, 
          fee 
        };
      }
      
      // Get liquidity
      const erc20Token0 = getErc20Contract(provider, token0);
      const erc20Token1 = getErc20Contract(provider, token1);
      const [balance0, balance1] = await Promise.all([
        erc20Token0.balanceOf(poolAddress),
        erc20Token1.balanceOf(poolAddress),
      ]);

      return {
        status: 'INITIALIZED',
        message: 'Pool is initialized',
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
        message: `Failed to read pool status: ${err.message}`,
        token0,
        token1,
        fee,
      };
    }
  } catch (err) {
    return {
      status: 'ERROR',
      message: `Failed to check pool status: ${err.message}`,
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
    const pool = getPoolContract(provider, poolAddr);
    const signer = provider.getSigner?.() || provider;
    
    // First validate basic information
    const [slot0, tickSpacing] = await Promise.all([
      pool.slot0(),
      pool.tickSpacing(),
    ]);

    // Check pool initialization
    if (slot0.sqrtPriceX96 === 0n) {
      throw new Error('Pool not initialized, cannot calculate burn');
    }

    // Check tick alignment
    const ts = Number(tickSpacing);
    if (tickLower % ts !== 0 || tickUpper % ts !== 0) {
      throw new Error(`Tick must be multiple of tickSpacing (${ts}). tickLower=${tickLower}, tickUpper=${tickUpper}`);
    }

    // Check tick range validity
    if (tickLower >= tickUpper) {
      throw new Error(`tickLower (${tickLower}) must be less than tickUpper (${tickUpper})`);
    }

    // Try staticCall
    try {
      const res = await pool.burn.staticCall(tickLower, tickUpper, liquidityAmount);
      return { amount0: res[0], amount1: res[1] };
    } catch (staticCallErr) {
      // When staticCall fails, check if this position has actual holdings
      if (staticCallErr.message.includes('Insufficient liquidity')) {
        try {
          // Try to get caller address
          let owner;
          try {
            const sig = await provider.getSigner?.();
            owner = await sig?.getAddress?.();
          } catch (e) {
            console.warn('[quoteBurn] Unable to get signer address:', e.message);
          }

          if (owner) {
            // Query actual holdings at this position
            const key = ethers.solidityPackedKeccak256(
              ['address', 'int24', 'int24'],
              [owner, tickLower, tickUpper]
            );
            const posData = await safeCallView(provider, poolAddr, AMMPoolABI, 'positions', [key]);
            const actualLiquidity = posData[0];
            console.log('[quoteBurn] Diagnostic info:');
            console.log('  - Actual liquidity at this position:', actualLiquidity.toString());
            console.log('  - Amount to burn:', liquidityAmount.toString());
            if (actualLiquidity === 0n) {
              throw new Error(
                `❌ You have no liquidity position in the Tick range [${tickLower}, ${tickUpper}]!\n\n` +
                `Possible reasons:\n` +
                `1. The Tick range when adding liquidity is different from now\n` +
                `2. Liquidity has been fully redeemed\n` +
                `3. Tick parameters are incorrect\n\n` +
                `Solutions:\n` +
                `• Click "🔍 Query My Positions" to check actual range\n` +
                `• Use "💡 Suggested Range" to find liquidity range`
              );
            }
            
            if (liquidityAmount > actualLiquidity) {
              throw new Error(
                `❌ Redemption amount too large!\n` +
                `Actual position: ${actualLiquidity.toString()} LP\n` +
                `To redeem: ${liquidityAmount.toString()} LP`
              );
            }
          }
        } catch (diagErr) {
          console.error('[quoteBurn] Diagnostic check failed:', diagErr.message);
          // If diagnostic check also fails, continue with off-chain calculation
        }
      }
      
      // Try off-chain calculation as fallback
      const offchainResult = await quoteBurnOffchain(provider, poolAddr, tickLower, tickUpper, liquidityAmount);
      return offchainResult;
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Off-chain calculation for redemption amount (alternative when staticCall fails)
 */
async function quoteBurnOffchain(provider, poolAddr, tickLower, tickUpper, liquidityAmount) {
  try {
    const pool = getPoolContract(provider, poolAddr);
    const [slot0, tickSpacing] = await Promise.all([
      pool.slot0(),
      pool.tickSpacing(),
    ]);

    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const currentTick = Number(slot0.tick);
    const ts = Number(tickSpacing);

    // Get sqrtRatio for this range
    const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower);
    const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper);

    // Off-chain calculation of redemption amount (reverse calculation)
    let amount0 = 0n;
    let amount1 = 0n;
    const L = BigInt(liquidityAmount);
    const Q96 = 2n ** 96n;

    if (sqrtPriceX96 < sqrtRatioAX96) {
      amount0 = (L * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
    } else if (sqrtPriceX96 < sqrtRatioBX96) {
      amount0 = (L * (sqrtRatioBX96 - sqrtPriceX96)) / Q96;
      amount1 = L * (sqrtPriceX96 - sqrtRatioAX96) / Q96;
    } else {
      amount1 = L * (sqrtRatioBX96 - sqrtRatioAX96) / Q96;
    }
    
    return { amount0, amount1 };
  } catch (err) {
    throw new Error(`Off-chain calculation failed: ${err.message}`);
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

/**
 * Get all pools created by the factory from blockchain events
 * This replaces localStorage dependency - works on all environments including Vercel
 * @param {ethers.Provider} provider - Ethers provider
 * @param {number} fromBlock - Starting block number (default: 0)
 * @param {number} toBlock - Ending block number (default: 'latest')
 * @returns {Promise<Array>} Array of pool objects with metadata
 */
export async function getAllPoolsFromBlockchain(provider, fromBlock = 0, toBlock = 'latest') {
  try {
    console.log('🔍 Fetching pools from blockchain...');
    const factory = getFactory(provider);
    
    // Query PoolCreated events
    const filter = factory.filters.PoolCreated();
    const events = await factory.queryFilter(filter, fromBlock, toBlock);
    
    console.log(`✅ Found ${events.length} PoolCreated events`);
    
    // Process events and get pool details
    const poolPromises = events.map(async (event) => {
      try {
        const { token0, token1, fee, tickSpacing, pool: poolAddress } = event.args;
        
        // Check if pool is initialized
        let isInitialized = false;
        let sqrtPriceX96 = '0';
        try {
          const slot0 = await readSlot0(provider, poolAddress);
          sqrtPriceX96 = slot0[0].toString();
          isInitialized = slot0[0] !== 0n;
        } catch (err) {
          console.warn(`⚠️ Could not read slot0 for pool ${poolAddress}:`, err.message);
        }
        
        return {
          address: poolAddress,
          token0: token0.toLowerCase(),
          token1: token1.toLowerCase(),
          fee: Number(fee),
          tickSpacing: Number(tickSpacing),
          isInitialized,
          sqrtPriceX96,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          createdAt: Date.now(), // Fallback timestamp
          updatedAt: Date.now()
        };
      } catch (err) {
        console.error(`❌ Error processing pool event:`, err);
        return null;
      }
    });
    
    const pools = await Promise.all(poolPromises);
    
    // Filter out null values (failed pools)
    const validPools = pools.filter(p => p !== null);
    
    console.log(`✅ Successfully loaded ${validPools.length} pools from blockchain`);
    return validPools;
    
  } catch (err) {
    console.error('❌ Failed to fetch pools from blockchain:', err);
    throw new Error(`Failed to fetch pools: ${err.message}`);
  }
}

/**
 * Get pools with token metadata
 * @param {ethers.Provider} provider - Ethers provider
 * @param {Array} tokenList - List of known tokens with metadata
 * @returns {Promise<Array>} Pools with token metadata attached
 */
export async function getPoolsWithMetadata(provider, tokenList) {
  try {
    const pools = await getAllPoolsFromBlockchain(provider);
    
    // Create a map for quick token lookup
    const tokenMap = new Map();
    tokenList.forEach(token => {
      tokenMap.set(token.address.toLowerCase(), token);
    });
    
    // Attach metadata to pools
    const poolsWithMetadata = pools.map(pool => ({
      ...pool,
      token0Meta: tokenMap.get(pool.token0) || { 
        address: pool.token0, 
        symbol: pool.token0.slice(0, 6) + '...', 
        decimalsHint: 18 
      },
      token1Meta: tokenMap.get(pool.token1) || { 
        address: pool.token1, 
        symbol: pool.token1.slice(0, 6) + '...', 
        decimalsHint: 18 
      }
    }));
    
    return poolsWithMetadata;
  } catch (err) {
    console.error('❌ Failed to get pools with metadata:', err);
    return [];
  }
}

// ========== Market analysis functions ==========

/**
 * Get pool's historical Swap events (with timestamps)
 */
export async function getSwapHistory(provider, poolAddr, fromBlock = 'latest', toBlock = 'latest', limit = 100) {
  try {
    const pool = getPoolContract(provider, poolAddr);
    
    // Check if Swap events are supported
    if (!pool.filters || typeof pool.filters.Swap !== 'function') {
      console.warn('Contract does not support Swap event filters');
      return [];
    }
    
    const filter = pool.filters.Swap();
    
    // Fetch recent events
    const events = await pool.queryFilter(filter, fromBlock === 'latest' ? -limit : fromBlock, toBlock);
    
    // Batch fetch block timestamps for efficiency
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
    console.warn('Failed to fetch transaction history, returning empty data:', err.message);
    return [];
  }
}

/**
 * Calculate pool's 24-hour trading volume
 */
export async function get24hVolume(provider, poolAddr) {
  try {
    const currentBlock = await provider.getBlockNumber();
    const blocksIn24h = Math.floor(24 * 60 * 60 / 12); // Assuming 12 seconds per block
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
    console.error('Failed to calculate 24h trading volume:', err);
    return { volume0: 0n, volume1: 0n, swapCount: 0 };
  }
}

/**
 * Calculate current price (based on sqrtPriceX96)
 * Based on Uniswap V3 SDK's precise algorithm
 */
export function calculatePrice(sqrtPriceX96, decimals0 = 18, decimals1 = 18) {
  if (!sqrtPriceX96 || sqrtPriceX96 === 0n) return 0;
  
  // Use the same precise algorithm as Uniswap V3 SDK
  // price = (sqrtPriceX96 / 2^96)^2 * (10^decimals1 / 10^decimals0)
  const Q96 = 2n ** 96n;
  const Q192 = Q96 ** 2n;
  
  try {
    // Prevent overflow by calculating square first
    const sqrtPriceSquared = BigInt(sqrtPriceX96) ** 2n;
    
    // Adjust decimal places
    const decimalAdjustment = (10n ** BigInt(decimals1)) / (10n ** BigInt(decimals0));
    
    // Calculate final price
    const price = (sqrtPriceSquared * decimalAdjustment) / Q192;
    
    // Convert to number format, maintaining 18-bit precision
    return Number(price * 10n ** 18n) / Number(10n ** 18n);
  } catch (error) {
    console.warn('Price calculation failed:', error);
    return 0;
  }
}

/**
 * Calculate price range between two ticks
 * @param {number} tickLower Lower price tick
 * @param {number} tickUpper Upper price tick
 * @param {number} decimals0 token0 decimal places
 * @param {number} decimals1 token1 decimal places
 */
export function calculateTickPriceRange(tickLower, tickUpper, decimals0 = 18, decimals1 = 18) {
  try {
    // Use TickMath formula to calculate sqrtPrice
    // sqrtPrice = 1.0001^(tick/2)
    const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
    const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);
    
    // Convert to sqrtPriceX96 format
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
    console.warn('Tick price range calculation failed:', error);
    return { priceLower: 0, priceUpper: 0, sqrtPriceLowerX96: 0n, sqrtPriceUpperX96: 0n };
  }
}

/**
 * Calculate TVL (Total Locked Value)
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
    
    // Get token balances in the pool
    const [balance0, balance1] = await Promise.all([
      getTokenBalance(provider, tokens.token0, poolAddr),
      getTokenBalance(provider, tokens.token1, poolAddr)
    ]);
    
    // Calculate TVL
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
    console.error('Failed to calculate TVL:', err);
    throw err;
  }
}

/**
 * Calculate impermanent loss
 */
export function calculateImpermanentLoss(initialPrice, currentPrice) {
  if (initialPrice <= 0 || currentPrice <= 0) return 0;
  
  const ratio = currentPrice / initialPrice;
  const sqrtRatio = Math.sqrt(ratio);
  const impermanentLoss = 2 * sqrtRatio / (1 + ratio) - 1;
  
  return impermanentLoss * 100; // Return as percentage
}

/**
 * Get price change trend
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
    console.error('Failed to get price trend:', err);
    return { trend: 'neutral', change: 0 };
  }
}

/**
 * Get liquidity distribution (active tick range)
 * Based on Uniswap V3 SDK's TickListDataProvider pattern
 */
export async function getLiquidityDistribution(provider, poolAddr, tickRange = 100) {
  try {
    const [slot0Data, poolContract] = await Promise.all([
      readSlot0(provider, poolAddr),
      Promise.resolve(getPoolContract(provider, poolAddr))
    ]);
    
    const currentTick = Number(slot0Data[1]);
    const fee = await poolContract.fee();
    
    // Get tickSpacing
    let tickSpacing;
    try {
      tickSpacing = await getFeeAmountTickSpacing(provider, Number(fee));
    } catch {
      // Fallback to default values
      const feeNum = Number(fee);
      tickSpacing = feeNum === 500 ? 10 : feeNum === 3000 ? 60 : feeNum === 10000 ? 200 : 60;
    }
    
    const distribution = [];
    const promises = [];
    
    // Query liquidity distribution around current tick, aligned by tickSpacing
    for (let i = -tickRange; i <= tickRange; i += Math.max(tickSpacing, 10)) {
      const tick = currentTick + i;
      // Ensure tick is a multiple of tickSpacing
      const alignedTick = Math.floor(tick / tickSpacing) * tickSpacing;
      
      promises.push(
        getTickInfo(provider, poolAddr, alignedTick)
          .then(tickInfo => {
            if (tickInfo.initialized && tickInfo.liquidityGross > 0n) {
              // Calculate price range for this tick
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
          .catch(() => null) // Ignore errors
      );
    }
    
    const results = await Promise.all(promises);
    const validResults = results.filter(result => result !== null);
    
    // Sort by distance from current tick
    return validResults.sort((a, b) => a.distanceFromCurrent - b.distanceFromCurrent);
  } catch (err) {
    console.error('Failed to get liquidity distribution:', err);
    return [];
  }
}

// ========== Price Oracle Related Functions ==========

/**
 * Get pool's historical price observation data (TWAP)
 * Based on Uniswap V3's Oracle mechanism
 */
export async function getPoolPriceObservations(provider, poolAddr, secondsAgo = [3600, 0]) {
  try {
    const pool = getPoolContract(provider, poolAddr);
    
    // Check if observe function is supported
    if (typeof pool.observe !== 'function') {
      console.warn('Contract does not support observe function, using current price instead');
      
      // Fallback: use current price instead
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
    
    // Fetch observation data
    const observations = await pool.observe(secondsAgo);
    
    if (observations.length >= 2) {
      const tickCumulatives = observations[0];
      const secondsPerLiquidityCumulatives = observations[1];
      
      // Calculate TWAP price
      const timeWeightedTick = (
        Number(tickCumulatives[tickCumulatives.length - 1]) - 
        Number(tickCumulatives[0])
      ) / (secondsAgo[0] - secondsAgo[secondsAgo.length - 1]);
      
      // Calculate time-weighted average price
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
    
    throw new Error('Insufficient observation data');
  } catch (err) {
    console.warn('Failed to get price observation data, using current price instead:', err.message);
    
    // Fallback mechanism
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
      console.error('Failed to get price observation data:', fallbackErr);
      throw fallbackErr;
    }
  }
}

/**
 * Calculate price impact (Price Impact)
 * Based on Uniswap V3 SDK's Trade class
 */
export async function calculatePriceImpact(provider, poolAddr, amountIn, zeroForOne) {
  try {
    const [slot0Data, liquidity] = await Promise.all([
      readSlot0(provider, poolAddr),
      getPoolLiquidity(provider, poolAddr)
    ]);
    
    const currentSqrtPrice = slot0Data[0];
    const currentPrice = calculatePrice(currentSqrtPrice);
    
    // Simulate swap to calculate new price
    // Use simplified algorithm here, should use SwapMath.computeSwapStep in production
    const liquidityBigInt = BigInt(liquidity);
    const amountInBigInt = BigInt(amountIn);
    
    // Simplified price impact calculation
    let priceImpact;
    if (liquidityBigInt > 0n) {
      const liquidityRatio = Number(amountInBigInt) / Number(liquidityBigInt);
      priceImpact = liquidityRatio * 0.1; // Simplified formula
    } else {
      priceImpact = 0;
    }
    
    return {
      priceImpact: Math.min(priceImpact * 100, 100), // Return as percentage, max 100%
      currentPrice,
      estimatedNewPrice: currentPrice * (1 + (zeroForOne ? -priceImpact : priceImpact))
    };
  } catch (err) {
    console.error('Failed to calculate price impact:', err);
    return { priceImpact: 0, currentPrice: 0, estimatedNewPrice: 0 };
  }
}

/**
 * Get pool's active liquidity range
 * Based on Uniswap V3 SDK's Position class
 */
export async function getActiveLiquidityRange(provider, poolAddr) {
  try {
    const [slot0Data, liquidity] = await Promise.all([
      readSlot0(provider, poolAddr),
      getPoolLiquidity(provider, poolAddr)
    ]);
    
    const currentTick = Number(slot0Data[1]);
    const currentSqrtPrice = slot0Data[0];
    
    // Find nearest active tick range
    const searchRange = 1000; // Search range
    const activeTicks = [];
    
    for (let i = -searchRange; i <= searchRange; i += 60) { // Use tickSpacing of 60
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
        // Ignore errors
      }
    }
    
    // Find nearest upper and lower bounds
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
    console.error('Failed to get active liquidity range:', err);
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
