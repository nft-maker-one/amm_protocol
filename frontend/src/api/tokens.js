// Simple token address book for Sepolia testing
// NOTE: These are ERC20 token contract addresses on Sepolia as provided by the user.

export const TOKENS = {
  USDT: {
    symbol: 'USDT',
    address: '0x36160274b0ed3673e67f2ca5923560a7a0c523aa',
    decimalsHint: 6,
  },
  USDC: {
    symbol: 'USDC',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimalsHint: 6,
  },
  // This is an ERC20-like token contract address (often WETH on testnets). User labeled it as ETH.
  ETH: {
    symbol: 'ETH',
    address: '0xe90de40758bd289543200934c2af0650e6182f5b',
    decimalsHint: 18,
  },
  DAI: {
    symbol: 'DAI',
    address: '0x82fb927676b53b6ee07904780c7be9b4b50db80b',
    decimalsHint: 18,
  },
  WBTC: {
    symbol: 'WBTC',
    address: '0xae7c08f2fc56719b8f403c29f02e99cf809f8e34',
    decimalsHint: 18,
  },
  BTC: {
    symbol: 'BTC',
    address: '0x0f86141Ff41F397602AD169b59dbe6f318987234',
    decimalsHint: 18,
  },
  UNI: {
    symbol: 'UNI',
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    decimalsHint: 18,
  }
};

export const TOKEN_LIST = Object.values(TOKENS);

export function normalizeAddress(addr) {
  return (addr || '').trim();
}

export function findTokenByAddress(addr) {
  const a = normalizeAddress(addr).toLowerCase();
  return TOKEN_LIST.find((t) => t.address.toLowerCase() === a) || null;
}

