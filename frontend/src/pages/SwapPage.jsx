import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { X, ArrowDown } from 'lucide-react';
import { getTokenList, TOKENS, findTokenByAddress } from '../api/tokens';
import { getPoolList, getFilteredPoolList, updatePoolInList } from '../api/pools';
import TokenInputSelector from '../components/ui/TokenInputSelector';
import PoolInfoCard from '../components/ui/PoolInfoCard';
import {
  AMMPOOL_ADDRESS,
  ensureSepolia,
  getPool,
  getTokenInfo,
  getPoolContract,
  swapExactIn,
  estimateSwapOut,
  checkPoolStatus,
  // ⚠️ 注意：如果你的 amm.js 里没有 createPool，这两行可能还会报错。
  // 如果再次报错，请把下面这两行也注释掉
  createPool, 
  simulateCreatePool,
} from '../api/amm';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
      <div style={{background:'#1a1a1a', padding:20, borderRadius:12, width:'90%', maxWidth:500, border:'1px solid #333'}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
          <h3 style={{margin:0}}>{title}</h3>
          <X onClick={onClose} style={{cursor:'pointer'}} />
        </div>
        {children}
      </div>
    </div>
  );
};

const SwapPage = () => {
  const [tokenList, setTokenList] = useState(getTokenList());
  const [poolList, setPoolList] = useState(getFilteredPoolList());
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  
  const [selectedPool, setSelectedPool] = useState(null);
  const [tokenAChoice, setTokenAChoice] = useState(TOKENS.USDT.address);
  const [tokenACustom, setTokenACustom] = useState('');
  const [feeInput, setFeeInput] = useState('3000');
  const [payAmount, setPayAmount] = useState('');
  const [slippagePct, setSlippagePct] = useState('1.0');
  const [estOutInfo, setEstOutInfo] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingTx, setPendingTx] = useState(null);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    const latestPools = getFilteredPoolList();
    setPoolList(latestPools);
    setTokenList(getTokenList());
    if (latestPools.length > 0 && !selectedPool) {
      setSelectedPool(latestPools[0]);
    }
  }, []);

  // --- Swap 检查 ---
  const handleSwapCheck = async () => {
    if (!selectedPool) return toast.error('请先选择一个池子');
    if (!payAmount || payAmount <= 0) return toast.error('请输入数量');
    
    setSwapping(true);
    const toastId = toast.loading('报价中...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const pool = getPoolContract(provider, selectedPool.address);
      const t0 = await pool.token0();
      
      const tokenAAddr = tokenAChoice === 'custom' ? tokenACustom : tokenAChoice;
      const zeroForOne = tokenAAddr.toLowerCase() === t0.toLowerCase();
      
      const metaIn = findTokenByAddress(tokenAAddr);
      const amountIn = ethers.parseUnits(payAmount, metaIn?.decimalsHint || 18);
      
      const est = await estimateSwapOut(provider, selectedPool.address, zeroForOne, amountIn);
      const metaOut = findTokenByAddress(est.tokenOut);
      const estHuman = ethers.formatUnits(est.amountOut, metaOut?.decimalsHint || 18);
      
      setEstOutInfo({ 
        estHuman, 
        symbolOut: metaOut?.symbol || 'Token',
        symbolIn: metaIn?.symbol || 'Token'
      });
      setPendingTx({ poolAddr: selectedPool.address, zeroForOne, amountIn });
      setIsConfirmOpen(true);
    } catch (err) {
      toast.error('报价失败: ' + err.message);
    } finally {
      toast.dismiss(toastId);
      setSwapping(false);
    }
  };

  const executeSwap = async () => {
    setIsConfirmOpen(false);
    const tid = toast.loading('请在钱包确认...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const res = await swapExactIn(provider, signer, pendingTx.poolAddr, pendingTx.zeroForOne, pendingTx.amountIn);
      toast.success('兑换成功！', { id: tid });
    } catch (err) {
      toast.error('失败: ' + err.message, { id: tid });
    }
  };

  return (
    // 修改点 1: 移除了 style={{maxWidth:480}}，现在它会继承全局 container 的宽度
    <div className="container">
      {/* 修改点 2: 移除了 textAlign:'center'，改为左对齐，与其他页面保持一致 */}
      <h2>💱 代币兑换 (Swap)</h2>
      
      {/* 顶部：池子选择 */}
      <div style={{marginBottom:20}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
           <label style={{fontSize:'0.9rem', color:'#888'}}>当前交易对</label>
        </div>
        
        {selectedPool ? (
          <PoolInfoCard pool={selectedPool} isActive={true} onClick={() => setIsPoolModalOpen(true)} showDetails={false} />
        ) : (
          <div onClick={() => setIsPoolModalOpen(true)} style={{padding:20, border:'2px dashed #444', borderRadius:12, textAlign:'center', cursor:'pointer', color:'#aaa'}}>
            + 点击选择可用交易对
          </div>
        )}
      </div>

      {/* 主卡片区域 */}
      <div className="data-card" style={{padding:20, borderRadius:16, background:'#111', borderLeft: '4px solid #646cff'}}>
        <TokenInputSelector label="支付 (Pay)" choice={tokenAChoice} setChoice={setTokenAChoice} customValue={tokenACustom} setCustomValue={setTokenACustom} tokenList={tokenList} />
        
        {/* 输入框样式调整，使其在宽屏下也好看 */}
        <div style={{position:'relative'}}>
           <input 
             type="number" 
             placeholder="0.0" 
             value={payAmount} 
             onChange={e=>setPayAmount(e.target.value)} 
             className="big-input" 
             style={{
               fontSize: 28, 
               width:'100%', 
               background:'transparent', 
               border:'none', 
               color:'#fff', 
               padding:'10px 0',
               fontWeight: 'bold',
               outline: 'none'
             }} 
           />
           <span style={{position:'absolute', right:0, top: '50%', transform:'translateY(-50%)', color:'#666', fontSize:'0.9rem'}}>
             {findTokenByAddress(tokenAChoice === 'custom' ? tokenACustom : tokenAChoice)?.symbol || ''}
           </span>
        </div>
        
        <div style={{display:'flex', justifyContent:'center', margin:'15px 0'}}>
          <div style={{background:'#333', borderRadius:'50%', padding:8, display:'flex'}}>
            <ArrowDown size={20} color="#646cff" />
          </div>
        </div>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', background:'#1a1a1a', borderRadius:8}}>
           <span style={{fontSize:'0.9rem', color:'#888'}}>预估获得 (Est. Receive)</span>
           <span style={{fontSize:'1.2rem', color: estOutInfo ? '#4ade80' : '#666', fontWeight:'bold'}}>
             {estOutInfo ? `${estOutInfo.estHuman} ${estOutInfo.symbolOut}` : '--'}
           </span>
        </div>
      </div>

      <button className="action-btn" style={{marginTop:20, height:55, borderRadius:16, fontSize:18}} onClick={handleSwapCheck} disabled={swapping}>
        {swapping ? '正在计算最佳报价...' : '🚀 立即兑换'}
      </button>

      {/* Modals */}
      <Modal isOpen={isPoolModalOpen} onClose={() => setIsPoolModalOpen(false)} title="选择交易对">
        <div style={{maxHeight:300, overflowY:'auto'}}>
          {poolList.length > 0 ? poolList.map(p => (
            <PoolInfoCard key={p.address} pool={p} isActive={selectedPool?.address === p.address} onClick={() => { setSelectedPool(p); setIsPoolModalOpen(false); }} />
          )) : <p style={{textAlign:'center', color:'#555'}}>暂无可用池子，请先去部署页面创建。</p>}
        </div>
      </Modal>

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="确认交易">
        {estOutInfo && (
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:20}}>支付 {payAmount} {estOutInfo.symbolIn}</p>
            <ArrowDown size={24} style={{margin:'10px 0', color:'#666'}}/>
            <p style={{fontSize:24, color:'#4ade80', fontWeight:'bold'}}>{estOutInfo.estHuman} {estOutInfo.symbolOut}</p>
            <div style={{fontSize: '0.85rem', color: '#888', marginTop: 15, padding: 10, background: '#222', borderRadius: 6}}>
               请在钱包中确认交易详情
            </div>
            <button className="action-btn" style={{marginTop:20}} onClick={executeSwap}>确认并签名</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SwapPage;