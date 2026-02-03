# AMM 协议前端使用说明

## 概述

这是一个基于创新曲线设计的自动做市商（AMM）协议前端界面，提供完整的池子管理、代币兑换、流动性管理等功能。

## 前置要求

1. **编译合约获取bytecode**
   - 进入 `contracts` 目录
   - 运行 `forge build` 编译合约
   - bytecode文件位置：
     - Factory: `out/AMMFactory.sol/AMMFactory.json` → `bytecode.object`
     - Token: `out/MockToken.sol/MockToken.json` → `bytecode.object`

2. **连接钱包**
   - 确保已安装MetaMask
   - 连接到Sepolia测试网

## 主要功能模块

### 1. 代币兑换 (SwapPage)

**核心功能**:
- 智能路由系统支持直接和多跳交换
- 实时价格预估和滑点保护
- 集成池子管理系统

**使用步骤**:
1. **选择交换代币**
   - 支付代币（Token A）：选择要支付的代币和数量
   - 接收代币（Token B）：选择要接收的代币
   - 系统提供预设代币列表，也支持自定义合约地址

2. **池子管理**
   - 使用"池子选择器"查看和管理已创建的池子列表
   - 通过Token A、Token B地址和fee查找现有池子
   - 创建新池子功能（仅限池子不存在时）
   - 独立的Slot0状态读取功能

3. **执行交换**
   - 系统自动进行价格预估和滑点计算
   - 支持自定义滑点百分比设置
   - 一键执行兑换交易

**高级功能**:
- 多跳路由：通过共同代币（WETH、USDC等）实现间接交换
- 路径优化：自动选择最优交换路径和最佳价格
- 调试信息：路由计算过程的详细日志

### 2. 流动性管理 (LiquidityPage)

**功能说明**:
- 为交易池添加和移除流动性
- 支持指定价格范围的集中流动性
- 流动性位置管理和收益计算

### 3. 高级交易 (AdvancedTradePage)

**权限管理**:
- Factory Owner专属功能（仅Owner可见）
- 实时权限状态检查
- 条件性UI渲染

**Owner专属功能**:
- Factory合约管理
- 高级参数配置
- 系统级操作权限

### 4. 分析与数据 (AnalyticsPage)

**数据展示**:
- 池子交易数据和统计分析
- 价格走势图表
- 流动性分布可视化

### 5. 智能合约部署 (DeploymentPage)

**部署功能**:
- Factory合约部署
- MockToken代币部署
- 池子初始化操作

### 6. Mock代币管理 (MockTokenPage)

**代币操作**:
- 创建测试代币
- 代币余额查询
- 转账和授权操作

## 池子管理系统

### 核心特性

1. **持久化存储**: 使用localStorage保存池子列表，页面刷新后数据不丢失
2. **智能检测**: 自动检测和添加新发现的池子
3. **状态同步**: 实时更新池子初始化状态和价格信息
4. **分离关注点**: 池子创建和状态查询功能完全分离

### API接口

**池子管理API** (`src/api/pools.js`):
- `getPoolList()` - 获取池子列表
- `addPoolToList(poolInfo)` - 添加池子到列表
- `updatePoolInList(address, updates)` - 更新池子信息
- `createAndAddPool()` - 创建新池子并添加到列表
- `refreshPoolStatus()` - 刷新池子状态
- `getPoolDisplayName()` - 获取格式化显示名称

### 池子信息结构

```javascript
{
  address: "0x...",           // 池子合约地址
  token0: "0x...",           // Token0地址（按字典序排列）
  token1: "0x...",           // Token1地址
  token0Meta: {...},         // Token0元数据（符号、小数等）
  token1Meta: {...},         // Token1元数据
  fee: 3000,                 // 手续费（基点）
  isInitialized: true,       // 是否已初始化
  sqrtPriceX96: "...",      // 当前价格（sqrt格式）
  currentTick: "...",        // 当前tick
  createdAt: 1234567890,     // 创建时间戳
  updatedAt: 1234567890      // 最后更新时间
}
```

## 路由系统

### 智能路由算法

1. **直接路径**: 检查两个代币间是否存在直接交易池
2. **多跳路径**: 通过共同代币实现间接交换
3. **价格比较**: 自动选择最优汇率的路径
4. **路径验证**: 确保所有路径上的池子都可用

### 支持的路由策略

- **单跳交换**: TokenA → TokenB（直接路径）
- **双跳交换**: TokenA → CommonToken → TokenB
- **最优选择**: 比较所有可能路径，选择最佳汇率

### 共同代币配置

系统预设的路由中转代币包括：
- WETH（Wrapped Ethereum）
- USDC（USD Coin）
- USDT（Tether USD）
- DAI（Dai Stablecoin）

## 完整使用流程

### 初始设置

1. **部署基础合约**
   - 部署Factory合约
   - 部署测试代币（TokenA、TokenB）
   - 记录所有合约地址

2. **创建交易池**
   - 在"代币兑换"页面选择TokenA和TokenB
   - 设置手续费率（通常3000 = 0.3%）
   - 点击"查找池子"，如未找到选择"创建新池子"

3. **初始化池子**
   - 在"部署"页面初始化池子价格
   - 或在创建池子时自动初始化

### 日常交易操作

1. **代币兑换**
   - 选择要交换的代币对
   - 输入交换数量
   - 确认价格和滑点
   - 执行交易

2. **提供流动性**
   - 在"流动性"页面选择池子
   - 指定流动性范围
   - 添加流动性资金

3. **监控和分析**
   - 使用"分析"页面查看交易数据
   - 监控流动性收益情况
   - 跟踪价格变化趋势

## 配置说明

### 网络配置

默认连接Sepolia测试网：
- Chain ID: 11155111
- RPC URL: 自动使用MetaMask配置
- 浏览器: https://sepolia.etherscan.io/

### 代币列表配置

预设代币列表包含常见的测试代币，位置：`src/api/tokens.js`

### 手续费设置

支持的手续费层级：
- 500 (0.05%) - 稳定币对
- 3000 (0.3%) - 标准费率
- 10000 (1%) - 高风险资产

## 故障排除

### 常见问题

1. **"池子未找到"**
   - 确认代币地址正确
   - 检查手续费设置
   - 使用"创建新池子"功能

2. **"交易失败"**
   - 检查代币授权额度
   - 确认钱包余额充足
   - 调整滑点设置

3. **"读取失败"**
   - 确认网络连接正常
   - 检查合约地址有效性
   - 重试操作

### 调试功能

- 浏览器控制台查看详细错误信息
- 路由计算过程的调试日志
- 合约调用的模拟测试

## API参考

### 核心API文件

- `src/api/amm.js` - AMM合约交互
- `src/api/pools.js` - 池子管理
- `src/api/routing.js` - 路由计算
- `src/api/tokens.js` - 代币管理

### 关键函数

```javascript
// 交换相关
swapExactIn(provider, signer, poolAddress, zeroForOne, amountIn)
estimateSwapOut(provider, poolAddress, zeroForOne, amountIn)

// 池子管理
getPool(provider, tokenA, tokenB, fee)
createPool(provider, signer, tokenA, tokenB, fee)
readSlot0(provider, poolAddress)

// 路由计算
findBestRoute(provider, tokenIn, tokenOut, amountIn)
executeMultiHopSwap(provider, signer, route, amountIn)
```

## 安全注意事项

1. **测试环境**: 当前为Sepolia测试网，请勿使用真实资金
2. **私钥安全**: 使用测试钱包，避免暴露主网私钥
3. **合约验证**: 确保使用的合约地址已验证
4. **滑点设置**: 根据市场情况合理设置滑点保护
5. **授权管理**: 定期检查和撤销不必要的代币授权
