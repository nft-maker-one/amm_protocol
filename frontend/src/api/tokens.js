// Simple token address book for Sepolia testing
// NOTE: These are ERC20 token contract addresses on Sepolia as provided by the user.

const DEFAULT_TOKENS = {
  USDC: {
    symbol: 'USDC',
    address: '0x5e1e0Dc58F4aAB02FC0bc40D914Bd1cFd6c27e14',
    decimalsHint: 6,
    isCustom: false,
  },
  USDT: {
    symbol: 'USDT',
    address: '0xCE48C856c88Fc401E2cBf6b48E42eBAE9522eDa8',
    decimalsHint: 6,
    isCustom: false,
  },
  DAI: {
    symbol: 'DAI',
    address: '0x3B4f31578AF7b45Bf9B23deF8B47807Da0027Cc3',
    decimalsHint: 18,
    isCustom: false,
  },
  WETH: {
    symbol: 'WETH',
    address: '0x74f1e680927180C3683B9bF4c3A486297b975702',
    decimalsHint: 18,
    isCustom: false,
  },
  WBTC: {
    symbol: 'WBTC',
    address: '0xe7955B8bAbF5cc516B530e63A68C8fD8F4604BEC',
    decimalsHint: 8,
    isCustom: false,
  },
  UNI: {
    symbol: 'UNI',
    address: '0x52426C56fe2487C4897Ee8d3C3174c59ad8b101b',
    decimalsHint: 18,
    isCustom: false,
  }
};

// 在内存中存储自定义 token 列表
let customTokens = [];

// 初始化：从 localStorage 加载自定义 token
function loadCustomTokens() {
  try {
    const saved = localStorage.getItem('customTokens');
    if (saved) {
      customTokens = JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Failed to load custom tokens from localStorage:', err);
  }
}

// 保存自定义 token 到 localStorage
function saveCustomTokens() {
  try {
    localStorage.setItem('customTokens', JSON.stringify(customTokens));
  } catch (err) {
    console.warn('Failed to save custom tokens to localStorage:', err);
  }
}

// 获取所有 token 列表（包括默认和自定义）
export function getTokenList() {
  loadCustomTokens();
  return [...Object.values(DEFAULT_TOKENS), ...customTokens];
}

export const TOKENS = DEFAULT_TOKENS;

// 为向后兼容，初始化 TOKEN_LIST
// 注意：这在模块首次加载时固定，如需动态更新请使用 getTokenList()
export let TOKEN_LIST = getTokenList();

// 添加自定义 token 到列表
export function addCustomToken(tokenData) {
  loadCustomTokens();
  
  // 检查是否已存在（地址）
  const exists = customTokens.some(t => 
    t.address.toLowerCase() === tokenData.address.toLowerCase()
  );
  
  if (exists) {
    console.warn('Token already exists:', tokenData.address);
    return false;
  }
  
  // 检查是否与默认 token 冲突
  const conflictsWithDefault = Object.values(DEFAULT_TOKENS).some(t =>
    t.address.toLowerCase() === tokenData.address.toLowerCase()
  );
  
  if (conflictsWithDefault) {
    console.warn('Token already in default list:', tokenData.address);
    return false;
  }
  
  const newToken = {
    ...tokenData,
    isCustom: true,
  };
  
  customTokens.push(newToken);
  saveCustomTokens();
  return true;
}

// 移除自定义 token
export function removeCustomToken(address) {
  loadCustomTokens();
  customTokens = customTokens.filter(t => 
    t.address.toLowerCase() !== address.toLowerCase()
  );
  saveCustomTokens();
}

// 获取自定义 token 列表
export function getCustomTokens() {
  loadCustomTokens();
  return customTokens;
}

export function normalizeAddress(addr) {
  return (addr || '').trim();
}

export function findTokenByAddress(addr) {
  const a = normalizeAddress(addr).toLowerCase();
  return getTokenList().find((t) => t.address.toLowerCase() === a) || null;
}

