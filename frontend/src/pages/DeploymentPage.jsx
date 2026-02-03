import React, { useState } from 'react';
import { ethers } from 'ethers';
import { getPoolList, getSelectedPool, setSelectedPool, updatePoolInList, addPoolToList } from '../api/pools';
import PoolSelector from '../components/ui/PoolSelector';
import { TOKEN_LIST, findTokenByAddress } from '../api/tokens';
import {
  ensureSepolia,
  deployFactory,
  deployToken,
  initializePool,
  calculateSqrtPriceX96,
  getPool,
  createPool,
  simulateCreatePool,
} from '../api/amm';

const DeploymentPage = () => {
  const [activeTab, setActiveTab] = useState('factory'); // 'factory', 'token', 'create-pool', 'pool'
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  
  // Create pool state
  const [createTokenAChoice, setCreateTokenAChoice] = useState('');
  const [createTokenBChoice, setCreateTokenBChoice] = useState('');
  const [createTokenACustom, setCreateTokenACustom] = useState('');
  const [createTokenBCustom, setCreateTokenBCustom] = useState('');
  const [createFee, setCreateFee] = useState('3000');
  
  // Factory deployment state
  const [factoryBytecode, setFactoryBytecode] = useState('');
  const [deployedFactory, setDeployedFactory] = useState('');
  
  // Token deployment state
  const [tokenBytecode, setTokenBytecode] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('18');
  const [tokenInitialSupply, setTokenInitialSupply] = useState('1000000');
  const [deployedToken, setDeployedToken] = useState('');

  // Pool initialization state
  const [poolAddress, setPoolAddress] = useState('');
  const [poolPrice, setPoolPrice] = useState('1'); // Price ratio (token0/token1)
  const [poolSqrtPriceX96, setPoolSqrtPriceX96] = useState('79228162514264337593543950336'); // Default: price = 1

  const handleDeployFactory = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!factoryBytecode || factoryBytecode.trim() === '') {
      return alert('请输入Factory合约的bytecode');
    }
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const result = await deployFactory(provider, signer, factoryBytecode);
      setDeployedFactory(result.address);
      alert(`Factory部署成功！\n地址: ${result.address}\n交易哈希: ${result.tx.hash}`);
    } catch (err) {
      alert('部署失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeployToken = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!tokenBytecode || tokenBytecode.trim() === '') {
      return alert('请输入Token合约的bytecode');
    }
    if (!tokenName || !tokenSymbol) {
      return alert('请输入代币名称和符号');
    }
    if (!tokenDecimals || Number(tokenDecimals) < 0 || Number(tokenDecimals) > 18) {
      return alert('请输入有效的decimals (0-18)');
    }
    if (!tokenInitialSupply || Number(tokenInitialSupply) <= 0) {
      return alert('请输入有效的初始供应量');
    }
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const result = await deployToken(
        provider, 
        signer, 
        tokenBytecode, 
        tokenName, 
        tokenSymbol, 
        Number(tokenDecimals), 
        tokenInitialSupply
      );
      setDeployedToken(result.address);
      alert(`Token部署成功！\n地址: ${result.address}\n交易哈希: ${result.tx.hash}`);
    } catch (err) {
      alert('部署失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleInitializePool = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!poolAddress || !ethers.isAddress(poolAddress)) {
      return alert('请输入有效的Pool地址');
    }
    if (!poolSqrtPriceX96 || poolSqrtPriceX96.trim() === '') {
      return alert('请输入sqrtPriceX96');
    }
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const sqrtPrice = BigInt(poolSqrtPriceX96);
      await initializePool(provider, signer, poolAddress, sqrtPrice);
      
      // 更新池子状态
      if (selectedPool) {
        updatePoolInList(selectedPool.address, {
          isInitialized: true,
          sqrtPriceX96: poolSqrtPriceX96,
          initializedAt: Date.now()
        });
      }
      
      alert(`Pool初始化成功！\nPool地址: ${poolAddress}\nsqrtPriceX96: ${poolSqrtPriceX96}`);
    } catch (err) {
      alert('初始化失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // 处理创建池子的token选择
  const getCreateTokenA = () => createTokenAChoice === 'custom' ? createTokenACustom : createTokenAChoice;
  const getCreateTokenB = () => createTokenBChoice === 'custom' ? createTokenBCustom : createTokenBChoice;

  // 创建池子功能
  const handleCreatePool = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    
    const tokenA = getCreateTokenA();
    const tokenB = getCreateTokenB();
    
    if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) {
      return alert('token 地址无效');
    }
    if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
      return alert('两个 token 地址不能相同');
    }
    
    const fee = Number(createFee);
    if (fee <= 0) {
      return alert('手续费必须大于0');
    }
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      // 检查是否已经存在
      const existingPool = await getPool(provider, tokenA, tokenB, fee);
      if (existingPool && existingPool !== ethers.ZeroAddress) {
        return alert(`池子已存在: ${existingPool}`);
      }
      
      const signer = await provider.getSigner();
      
      // 模拟创建
      try {
        await simulateCreatePool(provider, signer, tokenA, tokenB, fee);
      } catch (simErr) {
        const msg = (simErr && simErr.message) ? simErr.message : String(simErr);
        return alert('模拟 createPool 失败（会 revert）：' + msg);
      }
      
      // 创建池子
      await createPool(provider, signer, tokenA, tokenB, fee);
      
      // 获取新创建的池子地址
      const newPool = await getPool(provider, tokenA, tokenB, fee);
      if (!newPool || newPool === ethers.ZeroAddress) {
        return alert('创建后未返回有效池子地址');
      }
      
      // 添加到池子列表
      const tokenAMeta = findTokenByAddress(tokenA);
      const tokenBMeta = findTokenByAddress(tokenB);
      const poolInfo = {
        address: newPool,
        token0: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenA : tokenB,
        token1: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenB : tokenA,
        token0Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenAMeta : tokenBMeta,
        token1Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenBMeta : tokenAMeta,
        fee: fee,
        isInitialized: false
      };
      
      addPoolToList(poolInfo);
      setSelectedPool(poolInfo);
      setPoolAddress(newPool);
      setActiveTab('pool'); // 跳转到初始化标签页
      
      alert(`池子创建成功！\n地址: ${newPool}\n请继续初始化池子价格`);
    } catch (err) {
      alert('创建失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateSqrtPrice = () => {
    try {
      const price = parseFloat(poolPrice);
      if (isNaN(price) || price <= 0) {
        return alert('请输入有效的价格（大于0）');
      }
      const sqrtPrice = calculateSqrtPriceX96(price);
      setPoolSqrtPriceX96(sqrtPrice);
    } catch (err) {
      alert('计算失败: ' + (err.message || err));
    }
  };

  // 当选择池子时更新池子地址
  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    if (pool) {
      setPoolAddress(pool.address);
    }
  };

  return (
    <div className="container">
      <h2>🚀 合约部署</h2>
      <p style={{color: '#888', marginBottom: '20px'}}>
        部署AMM协议相关的智能合约。需要先编译合约获取bytecode。
      </p>

      <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
        <button 
          onClick={() => setActiveTab('factory')}
          style={{
            padding: '8px 16px', 
            background: activeTab === 'factory' ? '#646cff' : '#333', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >部署Factory</button>
        <button 
          onClick={() => setActiveTab('token')}
          style={{
            padding: '8px 16px', 
            background: activeTab === 'token' ? '#646cff' : '#333', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >部署Token</button>
        <button 
          onClick={() => setActiveTab('create-pool')}
          style={{
            padding: '8px 16px', 
            background: activeTab === 'create-pool' ? '#646cff' : '#333', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >创建Pool</button>
        <button 
          onClick={() => setActiveTab('pool')}
          style={{
            padding: '8px 16px', 
            background: activeTab === 'pool' ? '#646cff' : '#333', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >初始化Pool</button>
      </div>

      {activeTab === 'factory' && (
        <div>
          <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a1a1a'}}>
            <h4 style={{marginTop: 0}}>📝 如何获取Factory Bytecode</h4>
            <ol style={{textAlign: 'left', paddingLeft: '20px', color: '#aaa'}}>
              <li>在contracts目录下运行: <code style={{background: '#000', padding: '2px 6px', borderRadius: '3px'}}>forge build</code></li>
              <li>在<code style={{background: '#000', padding: '2px 6px', borderRadius: '3px'}}>out/AMMFactory.sol/AMMFactory.json</code>中找到<code style={{background: '#000', padding: '2px 6px', borderRadius: '3px'}}>bytecode.object</code>字段</li>
              <li>复制bytecode（以0x开头）并粘贴到下方</li>
            </ol>
          </div>

          <div className="input-group">
            <label>Factory Bytecode</label>
            <textarea 
              placeholder="0x608060405234801561001057600080fd5b50..."
              value={factoryBytecode}
              onChange={e => setFactoryBytecode(e.target.value)}
              style={{
                width: '100%',
                minHeight: '100px',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '10px',
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: '4px'
              }}
            />
          </div>

          {deployedFactory && (
            <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a3a1a'}}>
              <p style={{margin: 0}}>✅ 已部署Factory: <code style={{color: '#4ade80'}}>{deployedFactory}</code></p>
            </div>
          )}

          <button 
            className="action-btn" 
            onClick={handleDeployFactory} 
            disabled={loading}
          >
            {loading ? '部署中...' : '部署Factory合约'}
          </button>
        </div>
      )}

      {activeTab === 'token' && (
        <div>
          <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a1a1a'}}>
            <h4 style={{marginTop: 0}}>📝 如何获取Token Bytecode</h4>
            <ol style={{textAlign: 'left', paddingLeft: '20px', color: '#aaa'}}>
              <li>在contracts目录下运行: <code style={{background: '#000', padding: '2px 6px', borderRadius: '3px'}}>forge build</code></li>
              <li>在<code style={{background: '#000', padding: '2px 6px', borderRadius: '3px'}}>out/MockToken.sol/MockToken.json</code>中找到<code style={{background: '#000', padding: '2px 6px', borderRadius: '3px'}}>bytecode.object</code>字段</li>
              <li>复制bytecode（以0x开头）并粘贴到下方</li>
            </ol>
          </div>

          <div className="input-group">
            <label>Token Bytecode</label>
            <textarea 
              placeholder="0x608060405234801561001057600080fd5b50..."
              value={tokenBytecode}
              onChange={e => setTokenBytecode(e.target.value)}
              style={{
                width: '100%',
                minHeight: '100px',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '10px',
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: '4px'
              }}
            />
          </div>

          <div className="input-group">
            <label>代币名称 (Name)</label>
            <input 
              type="text" 
              placeholder="例如: Token A" 
              value={tokenName}
              onChange={e => setTokenName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>代币符号 (Symbol)</label>
            <input 
              type="text" 
              placeholder="例如: TKNA" 
              value={tokenSymbol}
              onChange={e => setTokenSymbol(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>小数位数 (Decimals)</label>
            <input 
              type="number" 
              placeholder="18" 
              value={tokenDecimals}
              onChange={e => setTokenDecimals(e.target.value)}
              min="0"
              max="18"
            />
          </div>

          <div className="input-group">
            <label>初始供应量 (Initial Supply)</label>
            <input 
              type="text" 
              placeholder="1000000" 
              value={tokenInitialSupply}
              onChange={e => setTokenInitialSupply(e.target.value)}
            />
            <small style={{color: '#888', marginTop: '5px', display: 'block'}}>
              注意：实际铸造数量 = {tokenInitialSupply || '0'} × 10^{tokenDecimals || '18'}
            </small>
          </div>

          {deployedToken && (
            <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a3a1a'}}>
              <p style={{margin: 0}}>✅ 已部署Token: <code style={{color: '#4ade80'}}>{deployedToken}</code></p>
            </div>
          )}

          <button 
            className="action-btn" 
            onClick={handleDeployToken} 
            disabled={loading}
          >
            {loading ? '部署中...' : '部署Token合约'}
          </button>
        </div>
      )}

      {activeTab === 'create-pool' && (
        <div>
          <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a1a1a'}}>
            <h4 style={{marginTop: 0}}>🏊‍♂️ 创建Pool说明</h4>
            <p style={{color: '#aaa', margin: '10px 0', textAlign: 'left'}}>
              创建Pool需要指定两个代币和手续费率。<br/>
              创建成功后，还需要初始化价格才能开始交易。<br/>
              系统会自动将新创建的Pool添加到Pool列表中。
            </p>
          </div>

          <div className="input-group">
            <label>Token A</label>
            <select value={createTokenAChoice} onChange={e=>setCreateTokenAChoice(e.target.value)} style={{width: '100%', marginBottom: '10px'}}>
              <option value="">选择Token A</option>
              {TOKEN_LIST.map(t => (
                <option key={t.address} value={t.address}>{t.symbol} - {t.address.slice(0,6)}...{t.address.slice(-4)}</option>
              ))}
              <option value="custom">自定义地址...</option>
            </select>
            {createTokenAChoice === 'custom' && (
              <input
                placeholder="TokenA 自定义合约地址 0x..."
                value={createTokenACustom}
                onChange={e => setCreateTokenACustom(e.target.value)}
                style={{width: '100%'}}
              />
            )}
          </div>

          <div className="input-group">
            <label>Token B</label>
            <select value={createTokenBChoice} onChange={e=>setCreateTokenBChoice(e.target.value)} style={{width: '100%', marginBottom: '10px'}}>
              <option value="">选择Token B</option>
              {TOKEN_LIST.map(t => (
                <option key={t.address} value={t.address}>{t.symbol} - {t.address.slice(0,6)}...{t.address.slice(-4)}</option>
              ))}
              <option value="custom">自定义地址...</option>
            </select>
            {createTokenBChoice === 'custom' && (
              <input
                placeholder="TokenB 自定义合约地址 0x..."
                value={createTokenBCustom}
                onChange={e => setCreateTokenBCustom(e.target.value)}
                style={{width: '100%'}}
              />
            )}
          </div>

          <div className="input-group">
            <label>手续费 (基点, 3000 = 0.3%)</label>
            <input
              type="number"
              placeholder="3000"
              value={createFee}
              onChange={e => setCreateFee(e.target.value)}
              style={{width: '100%'}}
            />
          </div>

          <button 
            onClick={handleCreatePool} 
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#888' : '#646cff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '创建中...' : '创建Pool合约'}
          </button>

          <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#333', borderRadius: '5px'}}>
            <h4 style={{margin: '0 0 10px 0', color: '#fff'}}>创建流程说明:</h4>
            <ol style={{color: '#aaa', paddingLeft: '20px', margin: 0}}>
              <li>选择两个要创建交易对的代币</li>
              <li>设置手续费率（常用: 500=0.05%, 3000=0.3%, 10000=1%）</li>
              <li>点击"创建Pool合约"执行创建</li>
              <li>创建成功后自动跳转到"初始化Pool"页面</li>
              <li>设置初始价格完成Pool的完整部署</li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === 'pool' && (
        <div>
          <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a1a1a'}}>
            <h4 style={{marginTop: 0}}>💡 初始化Pool说明</h4>
            <p style={{color: '#aaa', margin: '10px 0', textAlign: 'left'}}>
              在创建Pool后，需要初始化价格才能开始交易。<br/>
              sqrtPriceX96是价格的平方根乘以2^96的格式。<br/>
              如果token0/token1的价格比例为1，可以使用默认值。
            </p>
          </div>

          {/* 池子选择器 */}
          <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h4>选择要初始化的池子</h4>
            <PoolSelector 
              selectedPool={selectedPool} 
              onPoolSelect={handlePoolSelect}
            />
            {selectedPool && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e8f5e8', borderRadius: '5px' }}>
                <strong>选中池子:</strong> {selectedPool.address}<br/>
                <strong>代币对:</strong> {selectedPool.token0Meta?.symbol || 'TOKEN0'}/{selectedPool.token1Meta?.symbol || 'TOKEN1'}<br/>
                <strong>状态:</strong> {selectedPool.isInitialized ? '已初始化' : '未初始化'}
              </div>
            )}
          </div>

          <div className="input-group">
            <label>Pool地址 {selectedPool && <span style={{color: '#888'}}>(自动填充)</span>}</label>
            <input 
              placeholder="0x..." 
              value={poolAddress}
              onChange={e => setPoolAddress(e.target.value)}
              disabled={!!selectedPool}
              style={{backgroundColor: selectedPool ? '#f5f5f5' : 'white'}}
            />
          </div>

          <div className="input-group">
            <label>价格比例 (token0/token1)</label>
            <div style={{display: 'flex', gap: '10px'}}>
              <input 
                type="number" 
                placeholder="1.0" 
                value={poolPrice}
                onChange={e => setPoolPrice(e.target.value)}
                style={{flex: 1}}
              />
              <button 
                onClick={handleCalculateSqrtPrice}
                style={{
                  padding: '8px 16px',
                  background: '#333',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                计算
              </button>
            </div>
          </div>

          <div className="input-group">
            <label>sqrtPriceX96</label>
            <input 
              placeholder="79228162514264337593543950336" 
              value={poolSqrtPriceX96}
              onChange={e => setPoolSqrtPriceX96(e.target.value)}
            />
            <small style={{color: '#888', marginTop: '5px', display: 'block'}}>
              默认值 (价格=1): 79228162514264337593543950336
            </small>
          </div>

          <button 
            className="action-btn" 
            onClick={handleInitializePool} 
            disabled={loading}
          >
            {loading ? '初始化中...' : '初始化Pool'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DeploymentPage;