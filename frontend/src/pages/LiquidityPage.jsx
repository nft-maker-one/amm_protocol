import React, { useState } from 'react';
import { ethers } from 'ethers';
import { findTokenByAddress } from '../api/tokens';
import { getPoolList, getSelectedPool, setSelectedPool } from '../api/pools';
import PoolSelector from '../components/ui/PoolSelector';
import {
  AMMPOOL_ADDRESS,
  ensureSepolia,
  getPoolContract,
  quoteMint,
  addLiquidity,
  removeLiquidity,
  collectFees,
  quoteBurn,
  getPosition,
} from '../api/amm';

const LiquidityPage = () => {
  const [mode, setMode] = useState('add'); // 'add', 'remove', 'collect'
  const [selectedPool, setSelectedPool] = useState(null);
  const [poolAddr, setPoolAddr] = useState(AMMPOOL_ADDRESS);
  const [tickLower, setTickLower] = useState('-60');
  const [tickUpper, setTickUpper] = useState('60');
  const [liqAmount, setLiqAmount] = useState('1000');
  const [quote, setQuote] = useState(null); // { amount0, amount1, token0, token1 }
  const [burnQuote, setBurnQuote] = useState(null); // for remove liquidity
  const [position, setPosition] = useState(null); // position info
  const [busy, setBusy] = useState(false);

  // 当选择池子时更新池子地址
  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    if (pool) {
      setPoolAddr(pool.address);
    }
  };

  const handleQuote = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    if (!tickLower || !tickUpper) return alert('请输入 tickLower / tickUpper');
    if (Number.isNaN(Number(tickLower)) || Number.isNaN(Number(tickUpper))) return alert('tickLower / tickUpper 必须是整数');
    if (!liqAmount || !/^\d+$/.test(liqAmount)) return alert('流动性数量必须是非负整数（uint128）');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const recipient = await signer.getAddress();
      const pool = getPoolContract(provider, poolAddr);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);

      const q = await quoteMint(
        provider,
        poolAddr,
        recipient,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      setQuote({ ...q, token0: t0, token1: t1 });

      const t0Meta = findTokenByAddress(t0);
      const t1Meta = findTokenByAddress(t1);
      alert(
        `报价完成（mint 将从你钱包扣款，需要先approve）\n` +
        `token0: ${t0Meta?.symbol || t0}\n` +
        `token1: ${t1Meta?.symbol || t1}\n` +
        `需要 amount0: ${q.amount0}\n` +
        `需要 amount1: ${q.amount1}`
      );
    } catch (err) {
      alert('报价失败: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    if (!tickLower || !tickUpper) return alert('请输入 tickLower / tickUpper');
    if (Number.isNaN(Number(tickLower)) || Number.isNaN(Number(tickUpper))) return alert('tickLower / tickUpper 必须是整数');
    if (!liqAmount || !/^\d+$/.test(liqAmount)) return alert('流动性数量必须是非负整数（uint128）');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();

      const res = await addLiquidity(
        provider,
        signer,
        poolAddr,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );

      const t0Meta = findTokenByAddress(res.token0);
      const t1Meta = findTokenByAddress(res.token1);
      alert(
        `添加流动性成功！\n` +
        `pool: ${poolAddr}\n` +
        `token0: ${t0Meta?.symbol || res.token0}\n` +
        `token1: ${t1Meta?.symbol || res.token1}\n` +
        `扣款 amount0: ${res.amount0}\n` +
        `扣款 amount1: ${res.amount1}\n` +
        `tx: ${res.tx.hash}`
      );
    } catch (err) {
      alert('添加流动性失败: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleQuoteBurn = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    if (!tickLower || !tickUpper) return alert('请输入 tickLower / tickUpper');
    if (Number.isNaN(Number(tickLower)) || Number.isNaN(Number(tickUpper))) return alert('tickLower / tickUpper 必须是整数');
    if (!liqAmount || !/^\d+$/.test(liqAmount)) return alert('流动性数量必须是非负整数（uint128）');
    
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const pool = getPoolContract(provider, poolAddr);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);
      
      const q = await quoteBurn(
        provider,
        poolAddr,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      
      setBurnQuote({ ...q, token0: t0, token1: t1 });
      
      const t0Meta = findTokenByAddress(t0);
      const t1Meta = findTokenByAddress(t1);
      alert(
        `移除流动性报价完成\n` +
        `token0: ${t0Meta?.symbol || t0}\n` +
        `token1: ${t1Meta?.symbol || t1}\n` +
        `将获得 amount0: ${q.amount0}\n` +
        `将获得 amount1: ${q.amount1}`
      );
    } catch (err) {
      alert('移除流动性报价失败: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    if (!tickLower || !tickUpper) return alert('请输入 tickLower / tickUpper');
    if (Number.isNaN(Number(tickLower)) || Number.isNaN(Number(tickUpper))) return alert('tickLower / tickUpper 必须是整数');
    if (!liqAmount || !/^\d+$/.test(liqAmount)) return alert('流动性数量必须是非负整数（uint128）');
    
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const res = await removeLiquidity(
        provider,
        signer,
        poolAddr,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      
      alert(
        `移除流动性成功！\n` +
        `pool: ${poolAddr}\n` +
        `移除流动性数量: ${liqAmount}\n` +
        `tx: ${res.tx.hash}\n\n` +
        `注意：代币已释放到池子中，需要调用 collect 来提取到钱包`
      );
    } catch (err) {
      alert('移除流动性失败: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleGetPosition = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    if (!tickLower || !tickUpper) return alert('请输入 tickLower / tickUpper');
    
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      
      const pos = await getPosition(
        provider,
        poolAddr,
        owner,
        Number(tickLower),
        Number(tickUpper)
      );
      
      setPosition(pos);
      
      alert(
        `持仓信息查询成功\n` +
        `流动性: ${pos.liquidity.toString()}\n` +
        `待收集 token0: ${pos.tokensOwed0.toString()}\n` +
        `待收集 token1: ${pos.tokensOwed1.toString()}`
      );
    } catch (err) {
      alert('查询持仓失败: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleCollectFees = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    if (!tickLower || !tickUpper) return alert('请输入 tickLower / tickUpper');
    
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      // 使用 MaxUint128 收集所有可用费用
      const MaxUint128 = 2n ** 128n - 1n;
      
      const tx = await collectFees(
        provider,
        signer,
        poolAddr,
        Number(tickLower),
        Number(tickUpper),
        MaxUint128,
        MaxUint128
      );
      
      alert(
        `收集费用成功！\n` +
        `pool: ${poolAddr}\n` +
        `tx: ${tx.hash}\n\n` +
        `所有可用的 token0 和 token1 费用已提取到您的钱包`
      );
    } catch (err) {
      alert('收集费用失败: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <h2>💧 流动性管理</h2>
      
      {/* 池子选择器 */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>选择池子</h3>
        <PoolSelector 
          selectedPool={selectedPool} 
          onPoolSelect={handlePoolSelect}
        />
        {selectedPool && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e8f5e8', borderRadius: '5px' }}>
            <strong>当前池子:</strong> {selectedPool.address}<br/>
            <strong>代币对:</strong> {selectedPool.token0Meta?.symbol || 'TOKEN0'}/{selectedPool.token1Meta?.symbol || 'TOKEN1'}<br/>
            <strong>手续费:</strong> {selectedPool.fee/10000}%
          </div>
        )}
      </div>

      <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
        <button 
          onClick={() => setMode('add')}
          style={{padding: '5px 15px', background: mode==='add'?'#646cff':'#333', color: 'white', border:'none', borderRadius:'4px'}}
        >添加流动性</button>
        <button 
          onClick={() => setMode('remove')}
          style={{padding: '5px 15px', background: mode==='remove'?'#646cff':'#333', color: 'white', border:'none', borderRadius:'4px'}}
        >移除流动性</button>
        <button 
          onClick={() => setMode('collect')}
          style={{padding: '5px 15px', background: mode==='collect'?'#646cff':'#333', color: 'white', border:'none', borderRadius:'4px'}}
        >收集费用</button>
      </div>

      <div className="input-group">
        <label>Pool 地址 {selectedPool && <span style={{color: '#888'}}>(自动填充)</span>}</label>
        <input 
          value={poolAddr} 
          onChange={e=>setPoolAddr(e.target.value)} 
          placeholder="0x..." 
          disabled={!!selectedPool}
          style={{backgroundColor: selectedPool ? '#f5f5f5' : 'white'}}
        />
      </div>
      <div className="input-group">
        <label>Tick 下界 (tickLower)</label>
        <input value={tickLower} onChange={e=>setTickLower(e.target.value)} placeholder="-60" />
      </div>
      <div className="input-group">
        <label>Tick 上界 (tickUpper)</label>
        <input value={tickUpper} onChange={e=>setTickUpper(e.target.value)} placeholder="60" />
      </div>

      {mode === 'add' && (
        <>
          <div className="input-group">
            <label>流动性数量 (uint128 amount)</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="1000" />
            <small style={{color:'#888', display:'block', marginTop:6}}>
              这里填的是"liquidity amount"，不是直接填 token 数量。我们会先用 staticCall 报价需要的 amount0/amount1。
            </small>
          </div>
          <div style={{display:'flex', gap: 10}}>
            <button onClick={handleQuote} disabled={busy} style={{padding:'10px 14px'}}>
              {busy ? '处理中...' : '报价（计算所需 token0/token1）'}
            </button>
            <button className="action-btn" onClick={handleAddLiquidity} disabled={busy}>
              {busy ? '处理中...' : '添加流动性（自动 approve + mint）'}
            </button>
          </div>
          {quote && (
            <div className="data-card" style={{marginTop: 14}}>
              <div><b>需要 amount0:</b> {quote.amount0.toString()}</div>
              <div><b>需要 amount1:</b> {quote.amount1.toString()}</div>
              <div style={{color:'#888', marginTop: 6, fontSize: 12}}>
                token0: {quote.token0} / token1: {quote.token1}
              </div>
            </div>
          )}
          <div className="data-card">
            <p>💡 您将收到流动性代币作为流动性凭证。</p>
          </div>
        </>
      )}

      {mode === 'remove' && (
        <>
          <div className="input-group">
            <label>移除流动性数量 (uint128 amount)</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="1000" />
            <small style={{color:'#888', display:'block', marginTop:6}}>
              填入要移除的流动性数量。可以先查询持仓信息了解当前流动性。
            </small>
          </div>
          
          <div style={{display:'flex', gap: 10, marginBottom: 10}}>
            <button onClick={handleGetPosition} disabled={busy} style={{padding:'10px 14px'}}>
              {busy ? '查询中...' : '查询持仓信息'}
            </button>
            <button onClick={handleQuoteBurn} disabled={busy} style={{padding:'10px 14px'}}>
              {busy ? '报价中...' : '报价（预估获得代币数量）'}
            </button>
          </div>
          
          {position && (
            <div className="data-card" style={{marginTop: 14, backgroundColor: '#1a2332'}}>
              <h4 style={{margin: '0 0 10px 0'}}>当前持仓</h4>
              <div><b>流动性:</b> {position.liquidity.toString()}</div>
              <div><b>待收集 token0:</b> {position.tokensOwed0.toString()}</div>
              <div><b>待收集 token1:</b> {position.tokensOwed1.toString()}</div>
            </div>
          )}
          
          {burnQuote && (
            <div className="data-card" style={{marginTop: 14}}>
              <div><b>将获得 amount0:</b> {burnQuote.amount0.toString()}</div>
              <div><b>将获得 amount1:</b> {burnQuote.amount1.toString()}</div>
              <div style={{color:'#888', marginTop: 6, fontSize: 12}}>
                token0: {burnQuote.token0} / token1: {burnQuote.token1}
              </div>
            </div>
          )}
          
          <button 
            className="action-btn" 
            style={{backgroundColor: '#e63946'}} 
            onClick={handleRemoveLiquidity} 
            disabled={busy}
          >
            {busy ? '移除中...' : '移除流动性（burn）'}
          </button>
          
          <div className="data-card" style={{marginTop: 14}}>
            <p style={{margin: 0}}>⚠️ 移除流动性后，代币会释放到池中，需要调用"收集费用"来提取到钱包。</p>
          </div>
        </>
      )}

      {mode === 'collect' && (
        <>
          <div className="data-card" style={{marginBottom: 14}}>
            <p style={{margin: 0}}>
              💰 收集指定持仓的手续费和已释放的代币到您的钱包。
              <br />
              这个操作会收集所有可用的 token0 和 token1。
            </p>
          </div>
          
          <div style={{display:'flex', gap: 10, marginBottom: 10}}>
            <button onClick={handleGetPosition} disabled={busy} style={{padding:'10px 14px'}}>
              {busy ? '查询中...' : '查询可收集数量'}
            </button>
            <button className="action-btn" onClick={handleCollectFees} disabled={busy}>
              {busy ? '收集中...' : '收集费用和代币'}
            </button>
          </div>
          
          {position && (
            <div className="data-card" style={{backgroundColor: '#1a3a1a'}}>
              <h4 style={{margin: '0 0 10px 0', color: '#4ade80'}}>可收集数量</h4>
              <div><b>Token0:</b> {position.tokensOwed0.toString()}</div>
              <div><b>Token1:</b> {position.tokensOwed1.toString()}</div>
              {(position.tokensOwed0 > 0n || position.tokensOwed1 > 0n) ? (
                <p style={{margin: '10px 0 0 0', color: '#4ade80'}}>✅ 有可收集的代币或费用</p>
              ) : (
                <p style={{margin: '10px 0 0 0', color: '#888'}}>暂无可收集的代币或费用</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LiquidityPage;