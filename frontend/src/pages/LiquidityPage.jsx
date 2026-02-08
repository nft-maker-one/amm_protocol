import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { X, AlertTriangle } from 'lucide-react';

import { findTokenByAddress } from '../api/tokens';
import { getPoolList, getFilteredPoolList } from '../api/pools'; // 确保这里引用正确
import PoolInfoCard from '../components/ui/PoolInfoCard'; // 引入统一组件
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
  approveIfNeeded,
} from '../api/amm';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
      <div className="modal-content" style={{background:'#1a1a1a', padding:20, borderRadius:12, width:'90%', maxWidth:500, border:'1px solid #333'}}>
        <div className="modal-header" style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
          <h3 style={{margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', color:'#aaa', cursor:'pointer'}}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{maxHeight:'60vh', overflowY:'auto'}}>
          {children}
        </div>
      </div>
    </div>
  );
};

const LiquidityPage = () => {
  const [mode, setMode] = useState('add');
  
  const [poolList, setPoolList] = useState([]);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);

  const [poolAddr, setPoolAddr] = useState(AMMPOOL_ADDRESS);
  const [tickLower, setTickLower] = useState('-60');
  const [tickUpper, setTickUpper] = useState('60');
  const [liqAmount, setLiqAmount] = useState('1000');
  
  const [quote, setQuote] = useState(null);
  const [burnQuote, setBurnQuote] = useState(null); 
  const [position, setPosition] = useState(null); 
  const [busy, setBusy] = useState(false);
  const [poolInfo, setPoolInfo] = useState(null);

  const [isAddConfirmOpen, setIsAddConfirmOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  useEffect(() => {
    const list = getFilteredPoolList();
    setPoolList(list);
    if (list.length > 0 && !selectedPool) {
      handlePoolSelect(list[0]);
    }
  }, []);

  const handlePoolSelect = async (pool) => {
    setSelectedPool(pool);
    setIsPoolModalOpen(false);
    if (pool && window.ethereum) {
      setPoolAddr(pool.address);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = getPoolContract(provider, pool.address);
        const [slot0, tickSpacing] = await Promise.all([
          poolContract.slot0(),
          poolContract.tickSpacing(),
        ]);
        setPoolInfo({
          currentTick: Number(slot0.tick),
          tickSpacing: Number(tickSpacing),
          initialized: slot0.sqrtPriceX96 !== 0n,
        });
      } catch (err) {
        console.error('Failed to fetch pool info:', err);
      }
      setQuote(null);
      setBurnQuote(null);
      setPosition(null);
    }
  };

  const handleSuggestTickRange = () => {
    if (!poolInfo) return toast.error('Please select a pool first');
    const { currentTick, tickSpacing } = poolInfo;
    const range = tickSpacing * 10;
    const suggestedLower = Math.floor((currentTick - range) / tickSpacing) * tickSpacing;
    const suggestedUpper = Math.ceil((currentTick + range) / tickSpacing) * tickSpacing;
    setTickLower(suggestedLower.toString());
    setTickUpper(suggestedUpper.toString());
    toast.success(`Suggested Tick Range: [${suggestedLower}, ${suggestedUpper}]`);
  };

  const handleQuote = async () => {
    if (!window.ethereum) return toast.error('Please connect wallet first');
    if (!selectedPool) return toast.error('Please select a valid pool');
    if (!tickLower || !tickUpper) return toast.error('Please enter Tick range');
    
    const toastId = toast.loading('Quoting...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const recipient = await signer.getAddress();
      const pool = getPoolContract(provider, selectedPool.address);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);

      const maxApprove = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      await Promise.allSettled([
        approveIfNeeded(provider, signer, t0, selectedPool.address, maxApprove),
        approveIfNeeded(provider, signer, t1, selectedPool.address, maxApprove)
      ]);

      const q = await quoteMint(provider, selectedPool.address, recipient, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      
      const t0Meta = findTokenByAddress(t0);
      const t1Meta = findTokenByAddress(t1);

      setQuote({ 
        ...q, token0: t0, token1: t1,
        token0Symbol: t0Meta?.symbol || 'Token0',
        token1Symbol: t1Meta?.symbol || 'Token1'
      });
      toast.success('Quote successful', { id: toastId });
    } catch (err) {
      toast.error('Quote failed: ' + err.message, { id: toastId });
    } finally { setBusy(false); }
  };

  const handleAddLiquidityCheck = () => {
     if (!quote) return toast.error("Please click 'Quote' first");
     setIsAddConfirmOpen(true);
  };

  const executeAddLiquidity = async () => {
    setIsAddConfirmOpen(false);
    const addPromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const res = await addLiquidity(provider, signer, selectedPool.address, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      return res.tx.hash;
    })();
    toast.promise(addPromise, { loading: 'Adding...', success: 'Liquidity added!', error: (e) => e.message });
  };

  const handleGetPosition = async () => {
    if (!window.ethereum) return toast.error('Please connect wallet');
    const toastId = toast.loading('Fetching position...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      const pos = await getPosition(provider, selectedPool.address, owner, Number(tickLower), Number(tickUpper));
      setPosition(pos);
      if (pos.liquidity === 0n) toast('No position in this range', { id: toastId });
      else toast.success(`Position: ${pos.liquidity}`, { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally { setBusy(false); }
  };

  const handleQuoteBurn = async () => {
    if (!position || position.liquidity === 0n) return toast.error('No position, cannot calculate burn');
    const toastId = toast.loading('Calculating burn...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const q = await quoteBurn(provider, selectedPool.address, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      const t0Meta = findTokenByAddress(position.token0);
      const t1Meta = findTokenByAddress(position.token1);
      setBurnQuote({ 
          ...q, token0: position.token0, token1: position.token1,
          token0Symbol: t0Meta?.symbol || 'Token0', token1Symbol: t1Meta?.symbol || 'Token1'
      });
      toast.success('Calculation successful', { id: toastId });
    } catch (err) { toast.error(err.message, { id: toastId }); } finally { setBusy(false); }
  };

  const executeRemoveLiquidity = async () => {
    setIsRemoveConfirmOpen(false);
    const removePromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const res = await removeLiquidity(provider, signer, selectedPool.address, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      return res.tx.hash;
    })();
    toast.promise(removePromise, { loading: 'Removing...', success: 'Removed successfully! Please collect fees', error: (e) => e.message });
  };

  const handleCollectFees = async () => {
    const collectPromise = (async () => {
       setBusy(true);
       const provider = new ethers.BrowserProvider(window.ethereum);
       const signer = await provider.getSigner();
       const MaxUint128 = 2n ** 128n - 1n;
       const tx = await collectFees(provider, signer, selectedPool.address, Number(tickLower), Number(tickUpper), MaxUint128, MaxUint128);
       return tx.hash;
    })();
    toast.promise(collectPromise, { loading: 'Collecting fees...', success: () => { setBusy(false); return 'Collected successfully!'; }, error: (e) => { setBusy(false); return e.message; } });
  };

  return (
    <div className="container">
      <h2>Liquidity Management</h2>

      <div style={{ marginBottom: '20px' }}>
        <h4 style={{margin: '0 0 10px 0', color: '#888', fontSize:'0.9rem'}}>Select Trading Pair</h4>
        {selectedPool ? (
          <PoolInfoCard 
            pool={selectedPool} 
            isActive={true} 
            onClick={() => setIsPoolModalOpen(true)}
            showDetails={true}
          />
        ) : (
          <div 
            onClick={() => setIsPoolModalOpen(true)} 
            style={{padding:20, border:'2px dashed #444', borderRadius:12, textAlign:'center', cursor:'pointer', color:'#aaa'}}
          >
            + Click to select pair
          </div>
        )}
      </div>

      <div style={{display: 'flex', gap: '10px', marginBottom: '20px', background:'#1a1a1a', padding:5, borderRadius:10}}>
        {['add', 'remove', 'collect'].map(m => (
            <button 
              key={m} onClick={() => setMode(m)}
              style={{
                  flex: 1, padding: '10px', background: mode===m ? '#646cff' : 'transparent', 
                  color: mode===m?'white':'#888', border:'none', borderRadius:'8px', cursor: 'pointer', transition: 'all 0.2s', fontWeight:'bold'
              }}
            >
              {m === 'add' && 'Add'}
              {m === 'remove' && 'Remove'}
              {m === 'collect' && 'Collect'}
            </button>
        ))}
      </div>

      <div className="data-card" style={{marginBottom:20}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
           <span>Tick Range Settings</span>
           {poolInfo && <span onClick={handleSuggestTickRange} style={{color:'#4ade80', cursor:'pointer', fontSize:'0.85rem'}}>Use Suggested Range</span>}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15}}>
          <div className="input-group" style={{margin:0}}>
            <label>Tick Lower</label>
            <input value={tickLower} onChange={e=>setTickLower(e.target.value)} placeholder="-60" style={{textAlign:'center'}}/>
          </div>
          <div className="input-group" style={{margin:0}}>
            <label>Tick Upper</label>
            <input value={tickUpper} onChange={e=>setTickUpper(e.target.value)} placeholder="60" style={{textAlign:'center'}}/>
          </div>
        </div>
        {poolInfo && (
           <div style={{marginTop:10, fontSize:'0.8rem', color:'#666', textAlign:'center'}}>
             Current Tick: <span style={{color:'#fff'}}>{poolInfo.currentTick}</span> | Spacing: {poolInfo.tickSpacing}
           </div>
        )}
      </div>

      {mode === 'add' && (
        <div className="fade-in">
          <div className="input-group">
            <label>Liquidity Amount</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="1000" />
          </div>
          {quote && (
            <div className="data-card" style={{borderLeft: '4px solid #4ade80'}}>
               <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span>Deposit {quote.token0Symbol}</span>
                  <b>{quote.amount0.toString()}</b>
               </div>
               <div style={{display:'flex', justifyContent:'space-between', marginTop:5}}>
                  <span>Deposit {quote.token1Symbol}</span>
                  <b>{quote.amount1.toString()}</b>
               </div>
            </div>
          )}
          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginTop:15}}>
            <button onClick={handleQuote} disabled={busy} className="action-btn" style={{background:'#333'}}>1. Quote</button>
            <button className="action-btn" onClick={handleAddLiquidityCheck} disabled={busy || !quote}>2. Confirm Add</button>
          </div>
        </div>
      )}

      {mode === 'remove' && (
        <div className="fade-in">
          <div className="input-group">
            <label>Remove Amount</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="Enter LP Amount" />
          </div>
          {position && <div style={{fontSize:'0.8rem', color:'#aaa', marginBottom:10}}>Current Position: {position.liquidity.toString()} LP</div>}
          
          <div style={{display:'flex', gap:10, marginBottom:10}}>
             <button onClick={handleGetPosition} className="action-btn" style={{background:'#333', fontSize:'0.9rem'}}>Query My Position</button>
          </div>

          {burnQuote && (
             <div className="data-card" style={{borderLeft: '4px solid #e63946'}}>
               <div style={{color:'#aaa', fontSize:'0.9rem'}}>Est. Receive</div>
               <div>{burnQuote.amount0.toString()} {burnQuote.token0Symbol}</div>
               <div>{burnQuote.amount1.toString()} {burnQuote.token1Symbol}</div>
             </div>
          )}

          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginTop:15}}>
             <button onClick={handleQuoteBurn} disabled={busy || !position} className="action-btn" style={{background:'#333'}}>1. Calculate Burn</button>
             <button onClick={() => setIsRemoveConfirmOpen(true)} disabled={busy || !burnQuote} className="action-btn" style={{background:'#e63946'}}>2. Confirm Remove</button>
          </div>
        </div>
      )}

      {mode === 'collect' && (
        <div className="fade-in">
           <div className="data-card" style={{borderLeft:'4px solid orange'}}>
              <h4 style={{marginTop:0, color:'orange'}}>Claim Earnings</h4>
              <p style={{fontSize:'0.9rem', color:'#aaa'}}>After removing liquidity, tokens are held in the contract and must be collected manually.</p>
              {position && (
                 <div style={{marginTop:10}}>
                    <div>Pending Token0: <b style={{color:'#fff'}}>{position.tokensOwed0.toString()}</b></div>
                    <div>Pending Token1: <b style={{color:'#fff'}}>{position.tokensOwed1.toString()}</b></div>
                 </div>
              )}
           </div>
           <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:10}}>
              <button onClick={handleGetPosition} className="action-btn" style={{background:'#333'}}>Check Balance</button>
              <button onClick={handleCollectFees} className="action-btn" disabled={busy}>Collect to Wallet</button>
           </div>
        </div>
      )}

      <Modal isOpen={isPoolModalOpen} onClose={() => setIsPoolModalOpen(false)} title="Select Pair">
        {poolList.map(p => (
           <PoolInfoCard key={p.address} pool={p} isActive={selectedPool?.address === p.address} onClick={() => handlePoolSelect(p)} />
        ))}
      </Modal>

      <Modal isOpen={isAddConfirmOpen} onClose={() => setIsAddConfirmOpen(false)} title="Confirm Add">
         {quote && (
            <div style={{textAlign:'center'}}>
               <p>Deposit {quote.amount0.toString()} {quote.token0Symbol}</p>
               <p>Deposit {quote.amount1.toString()} {quote.token1Symbol}</p>
               <p style={{fontSize:'0.8rem', color:'#888'}}>Tick: {tickLower} ~ {tickUpper}</p>
               <button className="action-btn" onClick={executeAddLiquidity}>Confirm Transaction</button>
            </div>
         )}
      </Modal>

      <Modal isOpen={isRemoveConfirmOpen} onClose={() => setIsRemoveConfirmOpen(false)} title="Confirm Burn">
         <div style={{textAlign:'center', color:'#e63946'}}>
            <AlertTriangle size={48} style={{margin:'0 auto 10px'}}/>
            <p>Are you sure you want to remove {liqAmount} LP liquidity?</p>
            <button className="action-btn" style={{background:'#e63946'}} onClick={executeRemoveLiquidity}>Confirm Burn</button>
         </div>
      </Modal>
    </div>
  );
};

export default LiquidityPage;