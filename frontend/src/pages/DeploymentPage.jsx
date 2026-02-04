import React, { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; // 1. 引入 Toast
import { 
  Layers, 
  PlusCircle, 
  PlayCircle, 
  Code, 
  CheckCircle, 
  Terminal, 
  Info,
  Copy
} from 'lucide-react'; // 2. 引入图标

// 3. 引入 API (如果有本地 Mock 需求请自行替换)
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
  const [poolPrice, setPoolPrice] = useState('1'); 
  const [poolSqrtPriceX96, setPoolSqrtPriceX96] = useState('79228162514264337593543950336'); 

  // --- 1. 部署 Factory ---
  const handleDeployFactory = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!factoryBytecode || factoryBytecode.trim() === '') {
      return toast.error('请输入Factory合约的bytecode');
    }
    
    const toastId = toast.loading('正在部署 Factory...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const result = await deployFactory(provider, signer, factoryBytecode);
      setDeployedFactory(result.address);
      
      toast.success((t) => (
        <span>
          <b>Factory 部署成功!</b><br/>
          地址: {result.address.substring(0,8)}...
        </span>
      ), { id: toastId, duration: 5000 });

    } catch (err) {
      toast.error('部署失败: ' + (err.message || err), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // --- 2. 部署 Token ---
  const handleDeployToken = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!tokenBytecode || tokenBytecode.trim() === '') return toast.error('请输入Token bytecode');
    if (!tokenName || !tokenSymbol) return toast.error('请输入代币名称和符号');
    
    const toastId = toast.loading('正在部署 Token...');
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
      
      toast.success((t) => (
        <span>
          <b>Token 部署成功!</b><br/>
          地址: {result.address.substring(0,8)}...
        </span>
      ), { id: toastId });
    } catch (err) {
      toast.error('部署失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // --- 3. 创建 Pool ---
  const getCreateTokenA = () => createTokenAChoice === 'custom' ? createTokenACustom : createTokenAChoice;
  const getCreateTokenB = () => createTokenBChoice === 'custom' ? createTokenBCustom : createTokenBChoice;

  const handleCreatePool = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    const tokenA = getCreateTokenA();
    const tokenB = getCreateTokenB();
    
    if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) return toast.error('地址无效');
    if (tokenA.toLowerCase() === tokenB.toLowerCase()) return toast.error('地址不能相同');
    
    const toastId = toast.loading('正在创建 Pool...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const fee = Number(createFee);

      // 检查存在
      const existingPool = await getPool(provider, tokenA, tokenB, fee);
      if (existingPool && existingPool !== ethers.ZeroAddress) {
        toast.dismiss(toastId);
        return toast.error(`池子已存在: ${existingPool}`);
      }
      
      const signer = await provider.getSigner();
      
      // 模拟
      try {
        await simulateCreatePool(provider, signer, tokenA, tokenB, fee);
      } catch (simErr) {
        toast.dismiss(toastId);
        return toast.error('模拟失败(会 revert): ' + simErr.message);
      }
      
      // 执行
      await createPool(provider, signer, tokenA, tokenB, fee);
      
      // 获取结果
      const newPool = await getPool(provider, tokenA, tokenB, fee);
      
      // 添加到列表
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
      
      if (addPoolToList) addPoolToList(poolInfo);
      setSelectedPool(poolInfo);
      setPoolAddress(newPool);
      
      toast.success('Pool 创建成功! 即将跳转初始化...', { id: toastId });
      setTimeout(() => setActiveTab('pool'), 1500); // 自动跳转

    } catch (err) {
      toast.error('创建失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // --- 4. 初始化 Pool ---
  const handleCalculateSqrtPrice = () => {
    try {
      const price = parseFloat(poolPrice);
      if (isNaN(price) || price <= 0) return toast.error('请输入有效价格');
      const sqrtPrice = calculateSqrtPriceX96(price);
      setPoolSqrtPriceX96(sqrtPrice);
      toast.success('计算完成');
    } catch (err) {
      toast.error('计算失败');
    }
  };

  const handleInitializePool = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!poolAddress || !ethers.isAddress(poolAddress)) return toast.error('无效 Pool 地址');
    
    const toastId = toast.loading('正在初始化价格...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const sqrtPrice = BigInt(poolSqrtPriceX96);
      await initializePool(provider, signer, poolAddress, sqrtPrice);
      
      // 更新列表状态
      if (selectedPool && updatePoolInList) {
        updatePoolInList(selectedPool.address, {
          isInitialized: true,
          sqrtPriceX96: poolSqrtPriceX96,
          initializedAt: Date.now()
        });
      }
      
      toast.success('Pool 初始化成功!', { id: toastId });
    } catch (err) {
      toast.error('初始化失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    if (pool) setPoolAddress(pool.address);
  };

  // --- UI 组件 helper ---
  const TabButton = ({ id, label, icon: Icon }) => (
    <button 
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1,
        padding: '12px', 
        background: activeTab === id ? 'var(--primary)' : '#333', 
        color: activeTab === id ? 'white' : '#aaa', 
        border: 'none', 
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.2s',
        fontWeight: activeTab === id ? 'bold' : 'normal'
      }}
    >
      {Icon && <Icon size={16} />}
      {label}
    </button>
  );

  return (
    <div className="container">
      <h2 style={{display:'flex', alignItems:'center', gap:10}}>🚀 合约部署中心</h2>
      <p style={{color: '#888', marginBottom: '20px'}}>
        一站式管理 AMM 协议的部署流程：Factory &rarr; Token &rarr; Create Pool &rarr; Initialize
      </p>

      {/* Tabs */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '25px', background: '#1a1a1a', padding: 5, borderRadius: 10}}>
        <TabButton id="factory" label="1. Factory" icon={Layers} />
        <TabButton id="token" label="2. Token" icon={Code} />
        <TabButton id="create-pool" label="3. Create Pool" icon={PlusCircle} />
        <TabButton id="pool" label="4. Initialize" icon={PlayCircle} />
      </div>

      {/* --- Tab 1: Factory --- */}
      {activeTab === 'factory' && (
        <div className="fade-in">
          <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a1a1a', borderLeft: '4px solid #646cff'}}>
            <h4 style={{marginTop: 0, display:'flex', alignItems:'center', gap:5}}><Terminal size={16}/> 获取 Bytecode 指南</h4>
            <ol style={{textAlign: 'left', paddingLeft: '20px', color: '#aaa', fontSize: '0.9rem', margin:0}}>
              <li>运行 <code style={{background: '#000', padding: '2px 4px'}}>forge build</code></li>
              <li>打开 <code style={{background: '#000', padding: '2px 4px'}}>out/AMMFactory.sol/AMMFactory.json</code></li>
              <li>复制 <code style={{background: '#000', padding: '2px 4px'}}>bytecode.object</code> (以 0x 开头)</li>
            </ol>
          </div>

          <div className="input-group">
            <label>Factory Bytecode</label>
            <textarea 
              placeholder="0x608060405234801561001057600080fd5b50..."
              value={factoryBytecode}
              onChange={e => setFactoryBytecode(e.target.value)}
              style={{
                width: '100%', minHeight: '120px', fontFamily: 'monospace',
                fontSize: '12px', padding: '10px', background: '#111',
                color: '#fff', border: '1px solid #333', borderRadius: '4px'
              }}
            />
          </div>

          {deployedFactory && (
            <div className="data-card" style={{backgroundColor: '#1a3a1a', display:'flex', alignItems:'center', gap:10}}>
              <CheckCircle color="#4ade80" size={20}/>
              <div>
                 <div style={{color:'#aaa', fontSize:'0.8rem'}}>Factory Deployed at:</div>
                 <code style={{color: '#4ade80', fontSize:'1rem'}}>{deployedFactory}</code>
              </div>
            </div>
          )}

          <button className="action-btn" onClick={handleDeployFactory} disabled={loading}>
            {loading ? '部署中...' : '部署 Factory 合约'}
          </button>
        </div>
      )}

      {/* --- Tab 2: Token --- */}
      {activeTab === 'token' && (
        <div className="fade-in">
           <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a1a1a', borderLeft: '4px solid #646cff'}}>
            <h4 style={{marginTop: 0, display:'flex', alignItems:'center', gap:5}}><Terminal size={16}/> 获取 Token Bytecode 指南</h4>
            <p style={{color: '#aaa', fontSize: '0.9rem', margin:0}}>
               请复制 <code style={{background: '#000', padding: '2px 4px'}}>out/MockToken.sol/MockToken.json</code> 中的 bytecode。
            </p>
          </div>

          <div className="input-group">
            <label>Token Bytecode</label>
            <textarea 
              placeholder="0x..."
              value={tokenBytecode}
              onChange={e => setTokenBytecode(e.target.value)}
              style={{
                width: '100%', minHeight: '80px', fontFamily: 'monospace',
                fontSize: '12px', padding: '10px', background: '#111',
                color: '#fff', border: '1px solid #333', borderRadius: '4px'
              }}
            />
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
             <div className="input-group">
                <label>Name</label>
                <input type="text" placeholder="Token A" value={tokenName} onChange={e => setTokenName(e.target.value)} />
             </div>
             <div className="input-group">
                <label>Symbol</label>
                <input type="text" placeholder="TKNA" value={tokenSymbol} onChange={e => setTokenSymbol(e.target.value)} />
             </div>
          </div>
          
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
             <div className="input-group">
                <label>Decimals</label>
                <input type="number" placeholder="18" value={tokenDecimals} onChange={e => setTokenDecimals(e.target.value)} />
             </div>
             <div className="input-group">
                <label>Initial Supply</label>
                <input type="text" placeholder="1000000" value={tokenInitialSupply} onChange={e => setTokenInitialSupply(e.target.value)} />
             </div>
          </div>

          {deployedToken && (
            <div className="data-card" style={{backgroundColor: '#1a3a1a', display:'flex', alignItems:'center', gap:10}}>
              <CheckCircle color="#4ade80" size={20}/>
              <div>
                 <div style={{color:'#aaa', fontSize:'0.8rem'}}>Token Deployed at:</div>
                 <code style={{color: '#4ade80', fontSize:'1rem'}}>{deployedToken}</code>
              </div>
            </div>
          )}

          <button className="action-btn" onClick={handleDeployToken} disabled={loading}>
            {loading ? '部署中...' : '部署 Token 合约'}
          </button>
        </div>
      )}

      {/* --- Tab 3: Create Pool --- */}
      {activeTab === 'create-pool' && (
        <div className="fade-in">
          <div className="data-card" style={{marginBottom: 20}}>
             <h4 style={{margin:0, display:'flex', alignItems:'center', gap:8}}><Info size={16}/> 创建交易对</h4>
             <p style={{fontSize:'0.9rem', color:'#888', margin:'5px 0 0 0'}}>
                选择两个代币和费率层级。创建成功后会自动跳转到初始化页面。
             </p>
          </div>

          <div className="input-group">
            <label>Token A</label>
            <select value={createTokenAChoice} onChange={e=>setCreateTokenAChoice(e.target.value)} style={{width: '100%', marginBottom: '10px'}}>
              <option value="">-- 选择 Token A --</option>
              {TOKEN_LIST.map(t => (
                <option key={t.address} value={t.address}>{t.symbol} ({t.address.slice(0,6)}...)</option>
              ))}
              <option value="custom">自定义地址...</option>
            </select>
            {createTokenAChoice === 'custom' && (
              <input placeholder="0x..." value={createTokenACustom} onChange={e => setCreateTokenACustom(e.target.value)} />
            )}
          </div>

          <div className="input-group">
            <label>Token B</label>
            <select value={createTokenBChoice} onChange={e=>setCreateTokenBChoice(e.target.value)} style={{width: '100%', marginBottom: '10px'}}>
              <option value="">-- 选择 Token B --</option>
              {TOKEN_LIST.map(t => (
                <option key={t.address} value={t.address}>{t.symbol} ({t.address.slice(0,6)}...)</option>
              ))}
              <option value="custom">自定义地址...</option>
            </select>
            {createTokenBChoice === 'custom' && (
              <input placeholder="0x..." value={createTokenBCustom} onChange={e => setCreateTokenBCustom(e.target.value)} />
            )}
          </div>

          <div className="input-group">
            <label>Fee Tier (3000 = 0.3%)</label>
            <input type="number" placeholder="3000" value={createFee} onChange={e => setCreateFee(e.target.value)} />
          </div>

          <button className="action-btn" onClick={handleCreatePool} disabled={loading}>
            {loading ? '创建中...' : 'Create Pool'}
          </button>
        </div>
      )}

      {/* --- Tab 4: Initialize Pool --- */}
      {activeTab === 'pool' && (
        <div className="fade-in">
           <div className="data-card" style={{marginBottom: 20}}>
             <h4 style={{margin:0, display:'flex', alignItems:'center', gap:8}}><Info size={16}/> 初始化价格</h4>
             <p style={{fontSize:'0.9rem', color:'#888', margin:'5px 0 0 0'}}>
                新池子必须先初始化初始价格 (SqrtPriceX96) 才能开始交易。
             </p>
          </div>

          {/* 池子选择器 */}
          <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #333', borderRadius: '8px', background: '#1a1a1a' }}>
            <h4 style={{margin: '0 0 10px 0', fontSize:'0.9rem', color:'#aaa'}}>选择目标池子</h4>
            <PoolSelector selectedPool={selectedPool} onPoolSelect={handlePoolSelect} />
            
            {selectedPool && (
               <div style={{marginTop: 10, padding: 8, background: 'rgba(74, 222, 128, 0.1)', borderRadius: 4, fontSize: '0.85rem'}}>
                  <div style={{color: '#4ade80'}}><b>已选:</b> {selectedPool.token0Meta?.symbol}/{selectedPool.token1Meta?.symbol}</div>
                  <div style={{color: '#aaa'}}>{selectedPool.address}</div>
                  <div style={{marginTop:4}}>{selectedPool.isInitialized ? '✅ 已初始化' : '⚠️ 未初始化'}</div>
               </div>
            )}
          </div>

          <div className="input-group">
            <label>Pool Address</label>
            <input 
              placeholder="0x..." 
              value={poolAddress}
              onChange={e => setPoolAddress(e.target.value)}
              disabled={!!selectedPool}
              style={{backgroundColor: selectedPool ? '#222' : '#111', color: selectedPool ? '#888' : 'white'}}
            />
          </div>

          <div className="input-group">
            <label>初始价格比例 (Token0 / Token1)</label>
            <div style={{display: 'flex', gap: '10px'}}>
              <input 
                type="number" 
                placeholder="1.0" 
                value={poolPrice} 
                onChange={e => setPoolPrice(e.target.value)} 
              />
              <button onClick={handleCalculateSqrtPrice} style={{whiteSpace:'nowrap', padding: '0 15px', cursor:'pointer'}}>
                计算 SqrtPrice
              </button>
            </div>
          </div>

          <div className="input-group">
            <label>SqrtPriceX96 (计算结果)</label>
            <input 
              value={poolSqrtPriceX96}
              onChange={e => setPoolSqrtPriceX96(e.target.value)}
              placeholder="79228..."
            />
          </div>

          <button className="action-btn" onClick={handleInitializePool} disabled={loading}>
            {loading ? '初始化中...' : 'Initialize Pool'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DeploymentPage;