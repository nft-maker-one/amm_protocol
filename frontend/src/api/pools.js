// Pool management functionality
import { ethers } from 'ethers';
import { getPool, readSlot0 } from './amm';
import { getTokenList } from './tokens';

// Local storage keys
const POOL_LIST_KEY = 'amm_pool_list';
const SELECTED_POOL_KEY = 'amm_selected_pool';

/**
 * Pool list structure
 */
export const getPoolList = () => {
  try {
    const stored = localStorage.getItem(POOL_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Get filtered pool list - only includes pools where both tokens exist in the current token list
 */
export const getFilteredPoolList = () => {
  const pools = getPoolList();
  const tokenList = getTokenList();
  
  // Create a set of valid token addresses for quick lookup
  const validTokenAddresses = new Set(
    tokenList.map(t => t.address.toLowerCase())
  );
  
  // Filter pools: keep only those where both token0 and token1 are valid
  return pools.filter(pool => {
    const token0Valid = validTokenAddresses.has(pool.token0.toLowerCase());
    const token1Valid = validTokenAddresses.has(pool.token1.toLowerCase());
    return token0Valid && token1Valid;
  });
};

export const savePoolList = (pools) => {
  localStorage.setItem(POOL_LIST_KEY, JSON.stringify(pools));
};

export const addPoolToList = (poolInfo) => {
  const pools = getPoolList();
  const existingIndex = pools.findIndex(p => p.address.toLowerCase() === poolInfo.address.toLowerCase());
  
  if (existingIndex >= 0) {
    // Update existing pool
    pools[existingIndex] = { ...pools[existingIndex], ...poolInfo, updatedAt: Date.now() };
  } else {
    // Add new pool
    pools.push({
      ...poolInfo,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  
  savePoolList(pools);
  return pools;
};

export const removePoolFromList = (poolAddress) => {
  const pools = getPoolList().filter(p => p.address.toLowerCase() !== poolAddress.toLowerCase());
  savePoolList(pools);
  return pools;
};

export const updatePoolInList = (poolAddress, updates) => {
  const pools = getPoolList();
  const index = pools.findIndex(p => p.address.toLowerCase() === poolAddress.toLowerCase());
  
  if (index >= 0) {
    pools[index] = { ...pools[index], ...updates, updatedAt: Date.now() };
    savePoolList(pools);
    return pools[index];
  }
  
  return null;
};

export const getSelectedPool = () => {
  try {
    const stored = localStorage.getItem(SELECTED_POOL_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const setSelectedPool = (poolInfo) => {
  localStorage.setItem(SELECTED_POOL_KEY, JSON.stringify(poolInfo));
};

/**
 * Create a new pool and add it to the list
 */
export const createAndAddPool = async (provider, signer, tokenA, tokenB, fee, tokenAMeta, tokenBMeta) => {
  const { createPool, simulateCreatePool, getPool } = await import('./amm');
  
  // Simulate first
  await simulateCreatePool(provider, signer, tokenA, tokenB, fee);
  
  // Create the pool
  const tx = await createPool(provider, signer, tokenA, tokenB, fee);
  
  // Get the new pool address
  const newPoolAddr = await getPool(provider, tokenA, tokenB, fee);
  if (!newPoolAddr || newPoolAddr === ethers.ZeroAddress) {
    throw new Error('Failed to return valid pool address after creation');
  }
  
  // Prepare pool info
  const poolInfo = {
    address: newPoolAddr,
    token0: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenA : tokenB,
    token1: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenB : tokenA,
    token0Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenAMeta : tokenBMeta,
    token1Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenBMeta : tokenAMeta,
    fee: Number(fee),
    txHash: tx.hash,
    isInitialized: false,
    sqrtPriceX96: null,
    currentTick: null
  };
  
  // Add to list
  addPoolToList(poolInfo);
  
  return {
    poolAddress: newPoolAddr,
    poolInfo,
    tx
  };
};

/**
 * Initialize a pool and update its info
 */
export const initializePoolAndUpdate = async (provider, signer, poolAddress, sqrtPriceX96) => {
  const { initializePool } = await import('./amm');
  
  // Initialize the pool
  const tx = await initializePool(provider, signer, poolAddress, sqrtPriceX96);
  
  // Read current slot0
  try {
    const slot0Data = await readSlot0(provider, poolAddress);
    
    // Update pool in list
    const pools = getPoolList();
    const poolIndex = pools.findIndex(p => p.address.toLowerCase() === poolAddress.toLowerCase());
    
    if (poolIndex >= 0) {
      pools[poolIndex] = {
        ...pools[poolIndex],
        isInitialized: true,
        sqrtPriceX96: slot0Data[0].toString(),
        currentTick: slot0Data[1].toString(),
        initTxHash: tx.hash,
        updatedAt: Date.now()
      };
      savePoolList(pools);
    }
    
    return {
      tx,
      slot0Data,
      poolInfo: pools[poolIndex]
    };
  } catch (err) {
    console.warn('Failed to read slot0, but initialization may have succeeded:', err);
    return { tx };
  }
};

/**
 * Refresh pool status
 */
export const refreshPoolStatus = async (provider, poolAddress) => {
  try {
    const slot0Data = await readSlot0(provider, poolAddress);
    const pools = getPoolList();
    const poolIndex = pools.findIndex(p => p.address.toLowerCase() === poolAddress.toLowerCase());
    
    if (poolIndex >= 0) {
      pools[poolIndex] = {
        ...pools[poolIndex],
        isInitialized: true,
        sqrtPriceX96: slot0Data[0].toString(),
        currentTick: slot0Data[1].toString(),
        updatedAt: Date.now()
      };
      savePoolList(pools);
      return pools[poolIndex];
    }
    
    return null;
  } catch (err) {
    console.warn('Failed to refresh pool status:', err);
    return null;
  }
};

/**
 * Get pool info with current status
 */
export const getPoolInfo = async (provider, poolAddress) => {
  const pools = getPoolList();
  let poolInfo = pools.find(p => p.address.toLowerCase() === poolAddress.toLowerCase());
  
  if (poolInfo) {
    // Try to refresh status
    const refreshed = await refreshPoolStatus(provider, poolAddress);
    return refreshed || poolInfo;
  }
  
  return null;
};

/**
 * Get formatted pool display name
 */
export const getPoolDisplayName = (pool) => {
  if (!pool.token0Meta || !pool.token1Meta) {
    return `${pool.token0.slice(0,6)}.../${pool.token1.slice(0,6)}... (${pool.fee/10000}%)`;
  }
  return `${pool.token0Meta.symbol}/${pool.token1Meta.symbol} (${pool.fee/10000}%)`;
};

/**
 * Check if pool needs initialization
 */
export const poolNeedsInitialization = (pool) => {
  return !pool.isInitialized || !pool.sqrtPriceX96;
};