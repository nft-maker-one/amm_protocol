import React, { useState } from 'react';
import { ethers } from 'ethers';
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

  const handleQueryBalance = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(tokenAddr)) return alert('Token 地址无效');
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const userAddr = await signer.getAddress();
      
      const bal = await getTokenBalance(provider, tokenAddr, userAddr);
      const info = await getTokenInfo(provider, tokenAddr);
      
      // Try to get token owner
      let owner = null;
      let currentUserIsOwner = false;
      try {
        const token = new ethers.Contract(tokenAddr, ERC20ABI, provider);
        owner = await token.owner();
        setTokenOwner(owner);
        
        // Check if current user is the owner
        currentUserIsOwner = owner.toLowerCase() === userAddr.toLowerCase();
        setIsOwner(currentUserIsOwner);
      } catch (err) {
        setTokenOwner(null);
        setIsOwner(false); // Not a MockToken or doesn't have owner function
      }
      
      setBalance(ethers.formatUnits(bal, info.decimals));
      setTokenInfo(info);
    } catch (err) {
      alert('查询失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(tokenAddr)) return alert('Token 地址无效');
    if (!toAddr || !ethers.isAddress(toAddr)) return alert('目标地址无效');
    if (!amount || Number(amount) <= 0) return alert('数量必须大于 0');
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const info = await getTokenInfo(provider, tokenAddr);
      const amountWei = ethers.parseUnits(amount, info.decimals);
      
      await mintToken(provider, signer, tokenAddr, toAddr, amountWei);
      alert(`成功铸造 ${amount} ${info.symbol} 到 ${toAddr}`);
      setAmount('');
      setToAddr('');
      handleQueryBalance();
    } catch (err) {
      alert('铸造失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(tokenAddr)) return alert('Token 地址无效');
    if (!amount || Number(amount) <= 0) return alert('数量必须大于 0');
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const info = await getTokenInfo(provider, tokenAddr);
      const amountWei = ethers.parseUnits(amount, info.decimals);
      
      await burnToken(provider, signer, tokenAddr, amountWei);
      alert(`成功销毁 ${amount} ${info.symbol}`);
      setAmount('');
      handleQueryBalance();
    } catch (err) {
      alert('销毁失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>🪙 MockToken 管理</h2>
      <p style={{color: '#888', marginBottom: '20px'}}>
        铸造和销毁测试代币用于 AMM 交易。
      </p>
      
      <div className="input-group">
        <label>Token 地址</label>
        <select value={tokenAddr} onChange={e => setTokenAddr(e.target.value)} style={{marginBottom: '10px'}}>
          {TOKEN_LIST.map(token => (
            <option key={token.address} value={token.address}>
              {token.symbol} - {token.address.slice(0,6)}...{token.address.slice(-4)}
            </option>
          ))}
        </select>
        <input 
          placeholder="或输入自定义地址 0x..." 
          value={tokenAddr} 
          onChange={e => setTokenAddr(e.target.value)}
        />
      </div>

      <div className="data-card">
        <button onClick={handleQueryBalance} disabled={loading} style={{width: '100%', marginBottom: '10px'}}>
          {loading ? '查询中...' : '查询余额 & 代币信息'}
        </button>
        {tokenInfo && (
          <>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px'}}>
              <div>
                <span style={{color: '#888', fontSize: '0.9rem'}}>代币名称</span>
                <p style={{margin: '5px 0'}}>{tokenInfo.name}</p>
              </div>
              <div>
                <span style={{color: '#888', fontSize: '0.9rem'}}>符号</span>
                <p style={{margin: '5px 0'}}>{tokenInfo.symbol}</p>
              </div>
            </div>
            <div style={{marginTop: '10px'}}>
              <span style={{color: '#888', fontSize: '0.9rem'}}>您的余额</span>
              <p style={{margin: '5px 0', fontSize: '1.3rem', color: '#646cff'}}>{balance} {tokenInfo.symbol}</p>
            </div>
            <div style={{marginTop: '10px'}}>
              <span style={{color: '#888', fontSize: '0.9rem'}}>总供应量</span>
              <p style={{margin: '5px 0'}}>{ethers.formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)} {tokenInfo.symbol}</p>
            </div>
            {tokenOwner && (
              <div style={{marginTop: '10px'}}>
                <span style={{color: '#888', fontSize: '0.9rem'}}>合约 Owner</span>
                <p style={{margin: '5px 0', fontSize: '0.9rem', fontFamily: 'monospace'}}>
                  {tokenOwner}
                  <br />
                  <span style={{fontSize: '0.8rem', color: isOwner ? '#4ade80' : '#e63946'}}>
                    {isOwner ? 
                      '✅ 您是 owner，可以铸造代币' : 
                      '❌ 您不是 owner，无法铸造代币'
                    }
                  </span>
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {isOwner && (
        <>
          <h3 style={{marginTop: '20px'}}>铸造 (Mint)</h3>
          <div className="input-group">
            <label>目标地址</label>
            <input 
              placeholder="0x..." 
              value={toAddr} 
              onChange={e => setToAddr(e.target.value)}
            />
            <button 
              onClick={() => setToAddr(window.ethereum?.selectedAddress || '')}
              style={{marginTop: '5px', padding: '5px 10px', fontSize: '12px'}}
            >
              使用当前连接的地址
            </button>
          </div>

          <div className="input-group">
            <label>铸造数量</label>
            <input 
              type="number" 
              placeholder="0.0" 
              value={amount} 
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          <button className="action-btn" onClick={handleMint} disabled={loading} style={{marginBottom: '10px'}}>
            {loading ? '处理中...' : '铸造代币'}
          </button>
        </>
      )}

      {!isOwner && tokenOwner && (
        <div className="data-card" style={{marginTop: '20px', backgroundColor: '#2a1810', border: '1px solid #f59e0b'}}>
          <h4 style={{color: '#f59e0b', marginTop: 0}}>🔒 铸造权限受限</h4>
          <p style={{margin: '10px 0 0 0', fontSize: '14px', color: '#f59e0b'}}>
            只有代币合约的 owner 才能铸造新代币。<br/>
            当前 owner: <code style={{background: '#000', padding: '2px 4px', borderRadius: '2px'}}>{tokenOwner.slice(0,6)}...{tokenOwner.slice(-4)}</code><br/>
            您可以：<br/>
            • 联系 owner 为您铸造代币<br/>
            • 在"部署"页面创建您自己的代币合约
          </p>
        </div>
      )}

      <h3 style={{marginTop: '20px'}}>销毁 (Burn)</h3>
      <div className="input-group">
        <label>销毁数量</label>
        <input 
          type="number" 
          placeholder="0.0" 
          value={amount} 
          onChange={e => setAmount(e.target.value)}
        />
        <small style={{color: '#888', marginTop: '5px', display: 'block'}}>
          销毁的代币将从您的钱包余额中扣除
        </small>
      </div>

      <button 
        className="action-btn" 
        style={{backgroundColor: '#e63946'}} 
        onClick={handleBurn} 
        disabled={loading}
      >
        {loading ? '处理中...' : '销毁代币'}
      </button>
      
      <div className="data-card" style={{marginTop: '20px'}}>
        <h4>💡 使用提示</h4>
        <ul style={{textAlign: 'left', paddingLeft: '20px', color: '#888', fontSize: '14px'}}>
          <li>销毁功能会销毁您钱包中的代币</li>
          <li>销毁的代币不可恢复，请谨慎操作</li>
          {isOwner ? (
            <>
              <li style={{color: '#4ade80'}}>✅ 您是该代币的 owner，可以铸造新代币</li>
              <li>铸造的代币可用于测试 AMM 交易功能</li>
              <li>建议先铸造一些代币到自己地址用于测试</li>
            </>
          ) : (
            <>
              <li style={{color: '#e63946'}}>❌ 您不是该代币的 owner，无法铸造代币</li>
              <li><strong>获取测试代币的方法：</strong></li>
              <li style={{marginLeft: '20px'}}>→ 在"部署"页面创建属于您的代币合约</li>
              <li style={{marginLeft: '20px'}}>→ 联系当前代币的 owner 为您铸造代币</li>
              <li style={{marginLeft: '20px'}}>→ 选择其他您有权限的代币地址</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default MockTokenPage;