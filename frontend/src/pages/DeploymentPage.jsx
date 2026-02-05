import React, { useState, useEffect } from 'react';
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
  Copy,
  Eye,
  Trash2,
  X
} from 'lucide-react'; // 2. 引入图标

// 3. 引入 API (如果有本地 Mock 需求请自行替换)
import { getPoolList, getSelectedPool, setSelectedPool, updatePoolInList, addPoolToList } from '../api/pools';
import PoolSelector from '../components/ui/PoolSelector';
import { TOKEN_LIST, findTokenByAddress, addCustomToken, getTokenList, removeCustomToken, getCustomTokens } from '../api/tokens';
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
import { FACTORY_BYTECODE, TOKEN_BYTECODE, isFactoryBytecodeReady, isTokenBytecodeReady } from '../api/bytecodes';

const DeploymentPage = () => {
  const [activeTab, setActiveTab] = useState('factory'); // 'factory', 'token', 'create-pool', 'pool'
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  
  // 动态 token 列表
  const [tokenList, setTokenList] = useState(getTokenList());
  const [customTokens, setCustomTokens] = useState(getCustomTokens());
  
  // Create pool state
  const [createTokenAChoice, setCreateTokenAChoice] = useState('');
  const [createTokenBChoice, setCreateTokenBChoice] = useState('');
  const [createTokenACustom, setCreateTokenACustom] = useState('');
  const [createTokenBCustom, setCreateTokenBCustom] = useState('');
  const [createFee, setCreateFee] = useState('3000');
  
  // Factory deployment state
  const [factoryBytecode, setFactoryBytecode] = useState(FACTORY_BYTECODE);
  const [deployedFactory, setDeployedFactory] = useState('');
  const [factoryAddresses, setFactoryAddresses] = useState([]);
  
  // Token deployment state
  const [tokenBytecode, setTokenBytecode] = useState(TOKEN_BYTECODE);
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('18');
  const [tokenInitialSupply, setTokenInitialSupply] = useState('1000000');
  const [deployedToken, setDeployedToken] = useState('');

  // Pool initialization state
  const [poolAddress, setPoolAddress] = useState('');
  const [poolPrice, setPoolPrice] = useState('1'); 
  const [poolSqrtPriceX96, setPoolSqrtPriceX96] = useState('79228162514264337593543950336');

  // 已有交易对展示模态框
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [poolList, setPoolList] = useState(getPoolList());

  // --- 1. 部署 Factory (改成只读展示) ---
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
      
      // 保存 Factory 地址到列表
      setFactoryAddresses([...factoryAddresses, result.address]);
      
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

  // --- 2. 部署 Token 并动态添加到列表 ---
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
      
      // 自动添加到 token 列表中
      const newToken = {
        symbol: tokenSymbol,
        address: result.address,
        decimalsHint: Number(tokenDecimals),
        isCustom: true,
      };
      
      const success = addCustomToken(newToken);
      if (success) {
        // 更新本地列表
        setTokenList(getTokenList());
        setCustomTokens(getCustomTokens());
        toast.success((t) => (
          <span>
            <b>Token 部署成功!</b><br/>
            地址: {result.address.substring(0,8)}...<br/>
            <span style={{fontSize:'0.85rem', color:'#4ade80'}}>✓ 已添加到列表</span>
          </span>
        ), { id: toastId });
      } else {
        toast.success((t) => (
          <span>
            <b>Token 部署成功!</b><br/>
            地址: {result.address.substring(0,8)}...
          </span>
        ), { id: toastId });
      }
      
      // 清空表单
      setTokenName('');
      setTokenSymbol('');
      setDeployedToken('');
      
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
    if (!selectedPool || !ethers.isAddress(selectedPool.address)) return toast.error('请先选择一个有效的池子');
    
    const toastId = toast.loading('正在初始化价格...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const sqrtPrice = BigInt(poolSqrtPriceX96);
      await initializePool(provider, signer, selectedPool.address, sqrtPrice);
      
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

      {/* --- Tab 1: Factory (只读显示) --- */}
      {activeTab === 'factory' && (
        <div className="fade-in">
          <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a1a1a', borderLeft: '4px solid #646cff'}}>
            <h4 style={{marginTop: 0, display:'flex', alignItems:'center', gap:5}}><Terminal size={16}/> Factory 合约信息</h4>
            <p style={{color: '#aaa', fontSize: '0.9rem', margin:0}}>
              一个 AMM 系统通常只需要一个 Factory。下方展示的是本次会话部署的 Factory 实例。
            </p>
          </div>

          <div className="data-card" style={{backgroundColor: '#1a2a1a', borderLeft: '4px solid #4ade80'}}>
            <h4 style={{marginTop: 0, color:'#4ade80', display:'flex', alignItems:'center', gap:8}}>
              <Eye size={16}/> Factory 部署历史
            </h4>
            {factoryAddresses.length === 0 ? (
              <p style={{color:'#888', margin:0}}>本会话未部署任何 Factory。部署 Factory 后会显示在此。</p>
            ) : (
              <div>
                {factoryAddresses.map((addr, idx) => (
                  <div key={idx} style={{
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: '#111',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{fontSize:'0.85rem', color:'#aaa'}}>Factory #{idx + 1}</div>
                      <code style={{color:'#4ade80', fontSize:'0.9rem', wordBreak:'break-all'}}>{addr}</code>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(addr);
                        toast.success('已复制');
                      }}
                      style={{padding:'6px 12px', background:'#333', border:'none', borderRadius:'4px', cursor:'pointer'}}
                    >
                      <Copy size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Factory 部分（只读） */}
          <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#1a2a1a', borderRadius: '8px', borderLeft: '4px solid #f59e0b', opacity: 0.8}}>
            <h4 style={{marginTop: 0, display:'flex', alignItems:'center', gap:5, color:'#f59e0b'}}>ℹ️ Factory 信息（只读）</h4>
            <p style={{color: '#aaa', fontSize: '0.9rem', margin:'10px 0 15px 0'}}>
              Factory 合约是 AMM 系统的核心，通常由管理员部署并维护。此部分为只读状态。
            </p>
            
            <div className="input-group">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                <label>Factory Bytecode</label>
                {isFactoryBytecodeReady() && (
                  <span style={{fontSize: '0.8rem', color: '#4ade80'}}>✓ 已预配置</span>
                )}
              </div>
              <textarea 
                placeholder="0x608060405234801561001057600080fd5b50..."
                value={factoryBytecode}
                disabled={true}
                style={{
                  width: '100%', minHeight: '100px', fontFamily: 'monospace',
                  fontSize: '12px', padding: '10px', background: '#111',
                  color: '#999', border: '1px solid #444', borderRadius: '4px',
                  cursor: 'not-allowed', opacity: 0.7
                }}
              />
              <p style={{color: '#f59e0b', fontSize: '0.85rem', marginTop: 8}}>
                🔒 Factory Bytecode 为只读状态，无法修改。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 2: Token (展示列表 + 部署功能) --- */}
      {activeTab === 'token' && (
        <div className="fade-in">
          {/* Token 列表卡片 */}
          <div className="data-card" style={{marginBottom: '20px', backgroundColor: '#1a2a1a', borderLeft: '4px solid #4ade80'}}>
            <h4 style={{marginTop: 0, color:'#4ade80', display:'flex', alignItems:'center', gap:8}}>
              <Eye size={16}/> 已有的 Token ({tokenList.length})
            </h4>
            <div style={{maxHeight: '300px', overflowY: 'auto'}}>
              {tokenList.map((token) => (
                <div key={token.address} style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: token.isCustom ? '#2a1a1a' : '#111',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderLeft: token.isCustom ? '3px solid #fb923c' : '3px solid #646cff'
                }}>
                  <div style={{flex: 1}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontWeight:'bold', color:'#fff'}}>{token.symbol}</span>
                      {token.isCustom && <span style={{fontSize:'0.75rem', color:'#fb923c', background:'rgba(251,146,60,0.2)', padding:'2px 6px', borderRadius:'2px'}}>Custom</span>}
                    </div>
                    <code style={{fontSize:'0.8rem', color:'#888', wordBreak:'break-all'}}>{token.address}</code>
                    <div style={{fontSize:'0.75rem', color:'#666', marginTop:'4px'}}>Decimals: {token.decimalsHint}</div>
                  </div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(token.address);
                        toast.success('已复制地址');
                      }}
                      style={{padding:'6px 10px', background:'#333', border:'none', borderRadius:'4px', cursor:'pointer', color:'#aaa'}}
                      title="复制地址"
                    >
                      <Copy size={14}/>
                    </button>
                    {token.isCustom && (
                      <button 
                        onClick={() => {
                          removeCustomToken(token.address);
                          setTokenList(getTokenList());
                          setCustomTokens(getCustomTokens());
                          toast.success('已移除');
                        }}
                        style={{padding:'6px 10px', background:'rgba(239,68,68,0.2)', border:'none', borderRadius:'4px', cursor:'pointer', color:'#ef4444'}}
                        title="移除自定义 Token"
                      >
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 部署新 Token 表单 */}
          <div style={{padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px', borderLeft: '4px solid #646cff', marginBottom: '20px'}}>
            <h4 style={{marginTop: 0, display:'flex', alignItems:'center', gap:5}}>📝 部署新的 Token</h4>
            <p style={{color: '#aaa', fontSize: '0.9rem', margin:'5px 0 15px 0'}}>
               部署后的 Token 会自动添加到上方列表中，可以在创建交易对时选择使用。
            </p>

            <div className="input-group">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                <label>Token Bytecode</label>
                {isTokenBytecodeReady() && (
                  <span style={{fontSize: '0.8rem', color: '#4ade80'}}>✓ 已预配置</span>
                )}
              </div>
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
              {!isTokenBytecodeReady() && (
                <p style={{color: '#f87171', fontSize: '0.85rem', marginTop: 8}}>
                  ⚠️ Token bytecode 未配置。请将编译后的 bytecode 粘贴到上方。
                </p>
              )}
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
              <div className="data-card" style={{backgroundColor: '#1a3a1a', display:'flex', alignItems:'center', gap:10, marginBottom: 15}}>
                <CheckCircle color="#4ade80" size={20}/>
                <div>
                   <div style={{color:'#aaa', fontSize:'0.8rem'}}>刚刚部署的 Token:</div>
                   <code style={{color: '#4ade80', fontSize:'0.9rem'}}>{deployedToken}</code>
                </div>
              </div>
            )}

            <button className="action-btn" onClick={handleDeployToken} disabled={loading}>
              {loading ? '部署中...' : '✨ 部署 Token 合约'}
            </button>
          </div>
        </div>
      )}

      {/* --- Tab 3: Create Pool --- */}
      {activeTab === 'create-pool' && (
        <div className="fade-in">
          <div className="data-card" style={{marginBottom: 20}}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
               <div style={{flex:1}}>
                 <h4 style={{margin:0, display:'flex', alignItems:'center', gap:8}}><Info size={16}/> 创建交易对</h4>
                 <p style={{fontSize:'0.9rem', color:'#888', margin:'5px 0 0 0'}}>
                    选择两个代币和费率层级。创建成功后会自动跳转到初始化页面。
                 </p>
               </div>
               <button 
                 onClick={() => setIsPoolModalOpen(true)}
                 style={{
                   padding: '8px 16px',
                   background: '#333',
                   border: '1px solid #555',
                   borderRadius: '4px',
                   color: '#aaa',
                   cursor: 'pointer',
                   fontSize: '0.9rem',
                   display: 'flex',
                   alignItems: 'center',
                   gap: '6px',
                   whiteSpace: 'nowrap'
                 }}
                 title="查看已有的交易对"
               >
                 <Eye size={16} /> 查看已有交易对
               </button>
             </div>
          </div>

          <div className="input-group">
            <label>Token A</label>
            <select value={createTokenAChoice} onChange={e=>setCreateTokenAChoice(e.target.value)} style={{width: '100%', marginBottom: '10px'}}>
              <option value="">-- 选择 Token A --</option>
              {tokenList.map(t => (
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
              {tokenList.map(t => (
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

      {/* 已有交易对模态框 */}
      {isPoolModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #333',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '20px',
            width: '90%'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
              <h3 style={{margin:0}}>已有的交易对</h3>
              <button 
                onClick={() => setIsPoolModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '24px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            {poolList.length === 0 ? (
              <div style={{textAlign:'center', color:'#888', padding:'40px 20px'}}>
                <p>暂无已创建的交易对</p>
                <p style={{fontSize:'0.9rem'}}>创建新的交易对后，它会显示在这里。</p>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                {poolList.map((pool, idx) => (
                  <div key={pool.address} style={{
                    padding: '15px',
                    backgroundColor: '#222',
                    borderRadius: '8px',
                    borderLeft: '4px solid #646cff'
                  }}>
                    <div style={{marginBottom:'8px'}}>
                      <div style={{fontSize:'0.9rem', fontWeight:'bold', color:'#fff'}}>
                        #{idx + 1} {pool.token0Meta?.symbol}/{pool.token1Meta?.symbol} (Fee: {pool.fee})
                      </div>
                      <div style={{fontSize:'0.75rem', color:'#888', marginTop:'4px'}}>
                        {pool.isInitialized ? '✅ 已初始化' : '⚠️ 未初始化'}
                      </div>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: '8px',
                      alignItems: 'center',
                      fontSize: '0.8rem'
                    }}>
                      <span style={{color:'#aaa'}}>地址:</span>
                      <code style={{color:'#4ade80', wordBreak:'break-all'}}>{pool.address}</code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(pool.address);
                          toast.success('已复制');
                        }}
                        style={{padding:'4px 8px', background:'#333', border:'none', borderRadius:'4px', cursor:'pointer'}}
                      >
                        <Copy size={14}/>
                      </button>
                    </div>
                    {pool.sqrtPriceX96 && (
                      <div style={{marginTop:'8px', fontSize:'0.8rem', color:'#888'}}>
                        SqrtPrice: {pool.sqrtPriceX96}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentPage;