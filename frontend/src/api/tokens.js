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

// Store custom token list in memory
let customTokens = [];

// Initialize: load custom tokens from localStorage
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

// Save custom tokens to localStorage
function saveCustomTokens() {
  try {
    localStorage.setItem('customTokens', JSON.stringify(customTokens));
  } catch (err) {
    console.warn('Failed to save custom tokens to localStorage:', err);
  }
}

// Get all token list (including default and custom)
export function getTokenList() {
  loadCustomTokens();
  return [...Object.values(DEFAULT_TOKENS), ...customTokens];
}

export const TOKENS = DEFAULT_TOKENS;

// For backward compatibility, initialize TOKEN_LIST
// Note: This is fixed when the module is first loaded, use getTokenList() for dynamic updates
export let TOKEN_LIST = getTokenList();

// Add custom token to list
export function addCustomToken(tokenData) {
  loadCustomTokens();
  
  // Check if already exists (by address)
  const exists = customTokens.some(t => 
    t.address.toLowerCase() === tokenData.address.toLowerCase()
  );
  
  if (exists) {
    console.warn('Token already exists:', tokenData.address);
    return false;
  }
  
  // Check if conflicts with default tokens
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

// Remove custom token
export function removeCustomToken(address) {
  loadCustomTokens();
  customTokens = customTokens.filter(t => 
    t.address.toLowerCase() !== address.toLowerCase()
  );
  saveCustomTokens();
}

// Get custom token list
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

