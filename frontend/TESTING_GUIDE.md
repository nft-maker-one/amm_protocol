# 快速测试指南

## 验证Vercel部署能否看到Pools

### 步骤 1: 本地测试

```bash
cd frontend
npm run dev
```

1. 打开 http://localhost:5173/deploy
2. 连接MetaMask钱包到Sepolia
3. 查看是否显示pools（带刷新按钮）
4. 点击"Refresh Pools"按钮，观察是否从区块链同步

### 步骤 2: Vercel测试

1. 打开 https://amm-protocol-fb7d.vercel.app/deploy
2. 连接MetaMask钱包到Sepolia
3. 等待5-10秒（首次同步）
4. **应该看到与localhost相同的pools**

### 步骤 3: 验证同步

在浏览器控制台（F12）查看日志：

```
✅ 看到这些日志表示成功：
🔍 Fetching pools from blockchain...
✅ Found X PoolCreated events
✅ Successfully loaded X pools from blockchain
✅ Using cached pools (synced X seconds ago)

❌ 如果看到错误：
检查是否连接了钱包
检查是否在Sepolia测试网
检查Factory地址是否正确
```

### 步骤 4: 测试缓存

1. 刷新页面（F5）
2. 应该看到 "Using cached pools" 日志
3. 不会重新查询区块链（5分钟内）

### 步骤 5: 测试强制刷新

1. 点击 "Refresh Pools" 按钮
2. 应该看到重新从区块链同步
3. "Syncing..." 状态显示

## 常见问题

### Q: Vercel上不显示pools怎么办？

A: 检查以下几点：
1. 是否已连接MetaMask？
2. 是否切换到Sepolia网络？
3. 控制台是否有错误日志？
4. Factory地址是否正确？(0x79A1219d4aA0E7E9bcE45c2CbC17e34C50b3B915)

### Q: 首次加载很慢？

A: 正常现象
- 首次需要从区块链查询所有PoolCreated事件
- 取决于pool数量和RPC速度
- 后续访问会使用缓存，很快

### Q: 创建新pool后看不到？

A: 
1. 等待交易确认
2. 点击"Refresh Pools"按钮手动同步
3. 缓存5分钟后会自动刷新

### Q: 本地能看到，Vercel看不到？

A: 确保两边都：
- 连接了相同的钱包网络（Sepolia）
- 使用相同的Factory地址
- 点击了"Refresh Pools"

## 技术验证

### 验证PoolCreated事件

在浏览器控制台执行：

```javascript
const provider = new ethers.BrowserProvider(window.ethereum);
const factory = new ethers.Contract(
  '0x79A1219d4aA0E7E9bcE45c2CbC17e34C50b3B915',
  [/* ABI */],
  provider
);

const filter = factory.filters.PoolCreated();
const events = await factory.queryFilter(filter, 0, 'latest');
console.log('Found pools:', events.length);
```

### 查看localStorage缓存

```javascript
// 查看缓存的pools
console.log(localStorage.getItem('amm_pool_list'));

// 查看上次同步时间
console.log(localStorage.getItem('amm_pool_sync_timestamp'));

// 清除缓存（强制重新同步）
localStorage.removeItem('amm_pool_list');
localStorage.removeItem('amm_pool_sync_timestamp');
```

## 部署到Vercel

如果还未部署，运行：

```bash
cd frontend
npm run build
vercel --prod
```

确保环境变量已配置：
- `VITE_FACTORY_BYTECODE`
- `VITE_TOKEN_BYTECODE`

## 成功标志

✅ **本地和Vercel显示相同的pools**
✅ **刷新按钮可以从区块链同步**
✅ **缓存机制正常工作（5分钟）**
✅ **控制台无错误日志**
✅ **创建新pool后可以同步到所有环境**
