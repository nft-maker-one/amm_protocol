/**
 * Pre-compiled contract Bytecodes
 * Generated after running forge build in contracts directory
 * Source file locations:
 * - Factory: out/AMMFactory.sol/AMMFactory.json -> bytecode.object
 * - Token: out/MockToken.sol/MockToken.json -> bytecode.object
 */

// Read from .env.local (if configured)
// VITE_FACTORY_BYTECODE=0x...
// VITE_TOKEN_BYTECODE=0x...

export const FACTORY_BYTECODE = import.meta.env.VITE_FACTORY_BYTECODE || '';

export const TOKEN_BYTECODE = import.meta.env.VITE_TOKEN_BYTECODE || '';

// Default parameters (for quick testing)
export const DEFAULT_TOKEN_PARAMS = {
  name: 'Test Token',
  symbol: 'TST',
  decimals: 18,
  initialSupply: '1000000'
};

// Check if bytecode is configured
export function isFactoryBytecodeReady() {
  return FACTORY_BYTECODE && FACTORY_BYTECODE.startsWith('0x') && FACTORY_BYTECODE.length > 10;
}

export function isTokenBytecodeReady() {
  return TOKEN_BYTECODE && TOKEN_BYTECODE.startsWith('0x') && TOKEN_BYTECODE.length > 10;
}
