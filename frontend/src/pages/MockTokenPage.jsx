import React, { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; // 1. 引入 Toast
import { 
  Coins, 
  Flame, 
  Search, 
  User, 
  Wallet, 
  AlertCircle, 
  ArrowRight,
  CheckCircle,
  XCircle,
  Copy
} from 'lucide-react'; // 2. 引入图标

import { TOKEN_LIST } from '../api/tokens';
import {
  ensureSepolia,
  getTokenBalance,
  getTokenInfo,
  mintToken,
  burnToken,
} from '../api/amm';
import ERC20ABI from '../api/abi/ERC20.json';

const MockTokenPage = () => {
  const [tokenAddr, setTokenAddr] = useState(TOKEN_LIST[0]?.address || '');
  const [toAddr, setToAddr] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenOwner, setTokenOwner] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- 逻辑部分 (保留队友原始逻辑) ---

  const handleQueryBalance = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!ethers.isAddress(tokenAddr)) return toast.error('Token 地址无效');
    
    const toastId = toast.loading('正在查询合约数据...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const userAddr = await signer.getAddress();
      
      const bal = await getTokenBalance(provider, tokenAddr, userAddr);
      const info = await getTokenInfo(provider, tokenAddr);
      
      // Try to get token owner (队友逻辑: 兼容非 standard ERC20)
      let owner = null;
      let currentUserIsOwner = false;
      try {
        const token = new ethers.Contract(tokenAddr, ERC20ABI, provider);
        // 这里可能会 revert 如果合约没有 owner() 方法
        owner = await token.owner();
        setTokenOwner(owner);
        
        // Check if current user is the owner
        currentUserIsOwner = owner.toLowerCase() === userAddr.toLowerCase();
        setIsOwner(currentUserIsOwner);
      } catch (err) {
        console.warn("此代币可能没有 owner() 方法或调用失败", err);
        setTokenOwner(null);
        setIsOwner(false); 
      }
      
      setBalance(ethers.formatUnits(bal, info.decimals));
      setTokenInfo(info);
      
      toast.success('查询成功', { id: toastId });
    } catch (err) {
      toast.error('查询失败: ' + (err.message || err), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!ethers.isAddress(tokenAddr)) return toast.error('Token 地址无效');
    if (!toAddr || !ethers.isAddress(toAddr)) return toast.error('目标地址无效');
    if (!amount || Number(amount) <= 0) return toast.error('数量必须大于 0');
    
    const toastId = toast.loading('正在铸造代币...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const info = await getTokenInfo(provider, tokenAddr);
      const amountWei = ethers.parseUnits(amount, info.decimals);
      
      await mintToken(provider, signer, tokenAddr, toAddr, amountWei);
      
      toast.success((t) => (
        <div>
           <b>铸造成功!</b>
           <div style={{fontSize:'0.9rem', marginTop:5}}>
             +{amount} {info.symbol} <br/>
             To: {toAddr.slice(0,6)}...{toAddr.slice(-4)}
           </div>
        </div>
      ), { id: toastId });

      setAmount('');
      // 这里不自动清空 toAddr，方便用户连续操作
      // setToAddr(''); 
      handleQueryBalance(); // 刷新余额
    } catch (err) {
      toast.error('铸造失败: ' + (err.message || err), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!ethers.isAddress(tokenAddr)) return toast.error('Token 地址无效');
    if (!amount || Number(amount) <= 0) return toast.error('数量必须大于 0');
    
    const toastId = toast.loading('正在销毁代币...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const info = await getTokenInfo(provider, tokenAddr);
      const amountWei = ethers.parseUnits(amount, info.decimals);
      
      await burnToken(provider, signer, tokenAddr, amountWei);
      
      toast.success((t) => (
        <div>
           <b>销毁成功!</b>
           <div style={{fontSize:'0.9rem', marginTop:5}}>
             -{amount} {info.symbol} <br/>
             <span style={{fontSize:'0.8rem', color:'#888'}}>供应量已减少</span>
           </div>
        </div>
      ), { id: toastId });

      setAmount('');
      handleQueryBalance(); // 刷新余额
    } catch (err) {
      toast.error('销毁失败: ' + (err.message || err), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // --- UI 部分 ---

  return (
    <div className="container">
      <h2 style={{display:'flex', alignItems:'center', gap:10}}><Coins size={24} color="#FFD700"/> MockToken 管理</h2>
      <p style={{color: '#888', marginBottom: '20px'}}>
        管理测试代币的铸造 (Mint) 与销毁 (Burn)，仅适用于实现了 owner 权限的测试币。
      </p>
      
      {/* 1. 地址选择与查询 */}
      <div className="data-card" style={{borderLeft: '4px solid #646cff'}}>
        <div className="input-group">
          <label>Token 地址</label>
          <select value={tokenAddr} onChange={e => setTokenAddr(e.target.value)} style={{marginBottom: '10px', width: '100%'}}>
            {TOKEN_LIST.map(token => (
              <option key={token.address} value={token.address}>
                {token.symbol} - {token.address}
              </option>
            ))}
          </select>
          <div style={{display:'flex', gap:10}}>
             <input 
               placeholder="或输入自定义地址 0x..." 
               value={tokenAddr} 
               onChange={e => setTokenAddr(e.target.value)}
               style={{flex:1}}
             />
             <button onClick={handleQueryBalance} disabled={loading} style={{display:'flex', alignItems:'center', gap:5, padding:'0 20px'}}>
               {loading ? '查询中...' : <><Search size={16}/> 查询</>}
             </button>
          </div>
        </div>
      </div>

      {/* 2. 代币详情卡片 */}
      {tokenInfo && (
        <div className="data-card fade-in" style={{marginTop: 20}}>
           <div style={{display: 'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                 <h3 style={{margin:0, display:'flex', alignItems:'center', gap:8}}>
                    {tokenInfo.name} <span style={{fontSize:'0.9rem', color:'#888'}}>({tokenInfo.symbol})</span>
                 </h3>
                 <div style={{marginTop:10, fontSize:'0.9rem', color:'#aaa'}}>
                    <div>Total Supply: {ethers.formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)}</div>
                    <div>Owner: {tokenOwner ? `${tokenOwner.slice(0,6)}...${tokenOwner.slice(-4)}` : '无 / 未知'}</div>
                 </div>
              </div>
              <div style={{textAlign:'right'}}>
                 <div style={{fontSize:'0.8rem', color:'#aaa'}}>当前余额</div>
                 <div style={{fontSize:'1.8rem', fontWeight:'bold', color:'#646cff'}}>
                    {parseFloat(balance).toLocaleString()} <span style={{fontSize:'1rem'}}>{tokenInfo.symbol}</span>
                 </div>
              </div>
           </div>
           
           {/* 权限状态条 */}
           <div style={{marginTop:15, padding:'8px 12px', background: isOwner ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius:6, display:'flex', alignItems:'center', gap:8}}>
              {isOwner ? <CheckCircle size={16} color="#4ade80"/> : <XCircle size={16} color="#ef4444"/>}
              <span style={{fontSize:'0.9rem', color: isOwner ? '#4ade80' : '#ef4444'}}>
                 {isOwner ? '验证通过: 您是该合约的 Owner，拥有铸造权限' : '权限受限: 您不是 Owner，无法执行铸造操作'}
              </span>
           </div>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginTop:20}}>
        
        {/* 3. 铸造区域 (仅 Owner) */}
        {isOwner ? (
          <div className="data-card" style={{border: '1px solid #4ade80'}}>
             <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8, color:'#4ade80'}}>
                <Wallet size={18}/> 铸造 (Mint)
             </h4>
             
             <div className="input-group">
                <label>目标地址 (To)</label>
                <div style={{display:'flex', gap:5}}>
                  <input 
                    placeholder="0x..." 
                    value={toAddr} 
                    onChange={e => setToAddr(e.target.value)}
                  />
                  <button 
                    onClick={() => setToAddr(window.ethereum?.selectedAddress || '')}
                    style={{padding:'0 10px', fontSize:'0.8rem', whiteSpace:'nowrap'}}
                    title="填入自己"
                  >
                    <User size={16}/>
                  </button>
                </div>
             </div>

             <div className="input-group">
                <label>数量 (Amount)</label>
                <input 
                  type="number" 
                  placeholder="0.0" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                />
             </div>

             <button className="action-btn" onClick={handleMint} disabled={loading} style={{background: '#2e7d32'}}>
                {loading ? '铸造中...' : '确认铸造'}
             </button>
          </div>
        ) : (
          <div className="data-card" style={{opacity: 0.6, pointerEvents: tokenInfo ? 'auto' : 'none'}}>
             <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8, color:'#888'}}>
                <Wallet size={18}/> 铸造 (Mint)
             </h4>
             <div style={{height:'150px', display:'flex', alignItems:'center', justifyContent:'center', color:'#666', fontSize:'0.9rem', textAlign:'center'}}>
                {tokenInfo ? '需要 Owner 权限' : '请先查询代币'}
             </div>
          </div>
        )}

        {/* 4. 销毁区域 (任何人) */}
        <div className="data-card" style={{border: '1px solid #e63946'}}>
           <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8, color:'#e63946'}}>
              <Flame size={18}/> 销毁 (Burn)
           </h4>
           
           <div className="input-group">
              <label>销毁数量</label>
              <input 
                type="number" 
                placeholder="0.0" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
              />
              <small style={{color:'#888', marginTop:5, display:'block'}}>
                 🔥 警告: 代币将被永久移除
              </small>
           </div>
           
           <div style={{marginTop:'auto'}}>
             <button 
               className="action-btn" 
               style={{backgroundColor: '#b91c1c', marginTop: 25}} 
               onClick={handleBurn} 
               disabled={loading || !tokenInfo}
             >
               {loading ? '销毁中...' : '确认销毁'}
             </button>
           </div>
        </div>
      </div>
      
      {/* 底部提示 */}
      {!isOwner && tokenOwner && (
        <div style={{marginTop: 20, padding: 15, background: '#2a1810', border: '1px solid #f59e0b', borderRadius: 8, fontSize: '0.9rem', color: '#f59e0b', display:'flex', gap: 10}}>
           <AlertTriangle size={20} style={{flexShrink:0}}/>
           <div>
              <b>无法铸造?</b><br/>
              当前代币 Owner 为 <code style={{color:'#fff'}}>{tokenOwner.slice(0,6)}...</code>。
              如果这是测试币，请联系部署者；或者在"部署"页面发行您自己的 Token。
           </div>
        </div>
      )}
    </div>
  );
};

export default MockTokenPage;