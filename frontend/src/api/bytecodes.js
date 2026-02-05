/**
 * 预编译的合约 Bytecodes
 * 从 contracts 目录运行 forge build 后生成
 * 源文件位置：
 * - Factory: out/AMMFactory.sol/AMMFactory.json -> bytecode.object
 * - Token: out/MockToken.sol/MockToken.json -> bytecode.object
 */

// 从 .env.local 读取（如果配置了）
// VITE_FACTORY_BYTECODE=0x...
// VITE_TOKEN_BYTECODE=0x...

export const FACTORY_BYTECODE = import.meta.env.VITE_FACTORY_BYTECODE || '';

export const TOKEN_BYTECODE = import.meta.env.VITE_TOKEN_BYTECODE || '';

// 默认参数（用于快速测试）
export const DEFAULT_TOKEN_PARAMS = {
  name: 'Test Token',
  symbol: 'TST',
  decimals: 18,
  initialSupply: '1000000'
};

// 检查 bytecode 是否已配置
export function isFactoryBytecodeReady() {
  return FACTORY_BYTECODE && FACTORY_BYTECODE.startsWith('0x') && FACTORY_BYTECODE.length > 10;
}

export function isTokenBytecodeReady() {
  return TOKEN_BYTECODE && TOKEN_BYTECODE.startsWith('0x') && TOKEN_BYTECODE.length > 10;
}
