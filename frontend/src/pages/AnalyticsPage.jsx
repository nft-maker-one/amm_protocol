import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; 
import { 
  BarChart2, TrendingUp, Activity, Search, Calculator, 
  PieChart, Layers, AlertTriangle, ArrowRight, RefreshCw,
  X, Info
} from 'lucide-react';

import { findTokenByAddress } from '../api/tokens';
import { getPoolList } from '../api/pools';
// 1. 引入统一组件
import PoolInfoCard from '../components/ui/PoolInfoCard';
import {
  ensureSepolia,
  getPoolLiquidity,
  getTickInfo,
  readSlot0,
  getPoolContract,
  get24hVolume,
  calculateTVL,
  calculatePrice,
  calculateImpermanentLoss,
  getPriceTrend,
  getLiquidityDistribution,
  getSwapHistory,
  AMMPOOL_ADDRESS,
  getPoolPriceObservations,
  calculatePriceImpact,
  getActiveLiquidityRange,
} from '../api/amm';

import { 
  PriceChart, 
  LiquidityChart, 
} from '../components';

// --- 通用 Modal (保持一致性) ---
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

const AnalyticsPage = () => {
  // --- 2. 状态管理升级 ---
  const [selectedPool, setSelectedPool] = useState(null);
  const [poolList, setPoolList] = useState([]);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);

  const [poolAddr, setPoolAddr] = useState(AMMPOOL_ADDRESS);
  const [tickQuery, setTickQuery] = useState('0');
  
  // 数据状态
  const [poolData, setPoolData] = useState(null);
  const [tickData, setTickData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [tvlData, setTvlData] = useState(null);
  const [impermanentLossData, setImpermanentLossData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [liquidityDistribution, setLiquidityDistribution] = useState([]);
  
  // 高级数据
  const [oracleData, setOracleData] = useState(null);
  const [priceImpactData, setPriceImpactData] = useState(null);
  
  // 计算器状态
  const [initialPrice, setInitialPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapDirection, setSwapDirection] = useState(true);

  // 初始化加载
  useEffect(() => {
    const list = getPoolList();
    setPoolList(list);
    // 默认选中第一个池子并自动加载数据
    if (list.length > 0 && !selectedPool) {
      handlePoolSelect(list[0]);
    }
  }, []);

  const calculatePriceDisplay = (sqrtPriceX96) => {
    if (!sqrtPriceX96) return 0;
    return calculatePrice(sqrtPriceX96);
  };

  // --- 3. 选择池子逻辑优化 ---
  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    setPoolAddr(pool.address);
    setIsPoolModalOpen(false);
    // 选中后自动触发查询，用户体验更好
    handleQueryPool(pool.address); 
  };

  const handleQueryPool = async (addressOverride) => {
    const targetAddr = addressOverride || poolAddr;
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!ethers.isAddress(targetAddr)) return toast.error('Pool 地址无效');
    
    const toastId = toast.loading('正在加载链上数据...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const pool = getPoolContract(provider, targetAddr);
      
      const [slot0Data, liquidity, token0, token1, fee] = await Promise.all([
        readSlot0(provider, targetAddr),
        getPoolLiquidity(provider, targetAddr),
        pool.token0(),
        pool.token1(),
        pool.fee()
      ]);
      
      const t0Meta = findTokenByAddress(token0);
      const t1Meta = findTokenByAddress(token1);
      
      setPoolData({
        sqrtPriceX96: slot0Data[0],
        tick: slot0Data[1],
        observationIndex: slot0Data[2],
        liquidity,
        token0, token1, fee,
        token0Meta: t0Meta,
        token1Meta: t1Meta
      });
      
      await loadMarketAnalytics(provider, targetAddr);
      
      toast.success('数据加载完成', { id: toastId });
    } catch (err) {
      toast.error('查询失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const loadMarketAnalytics = async (provider, targetAddr) => {
    try {
      const [volume, tvl, trend, distribution, swapHistory] = await Promise.all([
        get24hVolume(provider, targetAddr).catch(() => ({ volume0: 0n, volume1: 0n, swapCount: 0 })),
        calculateTVL(provider, targetAddr).catch(() => ({ totalTVL: 0, token0TVL: 0, token1TVL: 0 })),
        getPriceTrend(provider, targetAddr).catch(() => ({ trend: 'neutral', change: 0 })),
        getLiquidityDistribution(provider, targetAddr, 50).catch(() => []),
        getSwapHistory(provider, targetAddr, 'latest', 'latest', 20).catch(() => [])
      ]);

      setVolumeData(volume);
      setTvlData(tvl);
      setMarketData(trend);
      setLiquidityDistribution(distribution);
      setPriceHistory(swapHistory);

      await loadAdvancedAnalytics(provider, targetAddr);
    } catch (err) {
      console.error('分析数据加载失败:', err);
    }
  };
  
  const loadAdvancedAnalytics = async (provider, targetAddr) => {
    try {
      const oracleResult = await getPoolPriceObservations(provider, targetAddr, [3600, 1800, 0]).catch(() => null);
      setOracleData(oracleResult);
    } catch (err) {
      console.error('高级分析失败:', err);
    }
  };

  const handleCalculatePriceImpact = async () => {
    if (!window.ethereum || !poolAddr || !swapAmount) return toast.error('请输入数量并连接钱包');
    const toastId = toast.loading('计算滑点...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const amountWei = ethers.parseEther(swapAmount);
      const impact = await calculatePriceImpact(provider, poolAddr, amountWei, swapDirection);
      setPriceImpactData(impact);
      toast.success('计算完成', { id: toastId });
    } catch (err) {
      toast.error('计算失败: ' + err.message, { id: toastId });
    }
  };
  
  const handleCalculateIL = () => {
    if (!initialPrice || !currentPrice) return toast.error('请输入价格');
    const initial = parseFloat(initialPrice);
    const current = parseFloat(currentPrice);
    if (initial <= 0 || current <= 0) return toast.error('价格必须大于0');
    const loss = calculateImpermanentLoss(initial, current);
    setImpermanentLossData({ loss, initial, current });
  };

  const handleQueryTick = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!tickQuery) return toast.error('请输入 Tick Index');
    const toastId = toast.loading(`查询 Tick ${tickQuery}...`);
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const tickInfo = await getTickInfo(provider, poolAddr, Number(tickQuery));
      setTickData(tickInfo);
      toast.success('Tick 数据已获取', { id: toastId });
    } catch (err) {
      toast.error('查询 Tick 失败', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2 style={{display:'flex', alignItems:'center', gap:10}}><Activity size={24}/> 市场分析大屏</h2>
      
      {/* 1. 顶部数据源选择 - 已重构为统一风格 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
           <h4 style={{margin:0, color:'#888', fontSize:'0.9rem'}}>当前分析交易对</h4>
           <button onClick={() => handleQueryPool()} disabled={loading} style={{background:'none', border:'none', color:'#646cff', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:'0.85rem'}}>
              <RefreshCw size={14} className={loading ? 'spin' : ''}/> 刷新数据
           </button>
        </div>

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
             + 点击选择要分析的交易对
          </div>
        )}
      </div>

      {/* 2. 第一排：核心指标卡片 */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '20px'}}>
        <div className="data-card">
          <div style={{display:'flex', justifyContent:'space-between', color:'#aaa', marginBottom:5}}>
              <span>总锁定价值 (TVL)</span><PieChart size={18}/>
          </div>
          <div style={{fontSize:'1.8rem', fontWeight:'bold'}}>
              ${tvlData?.totalTVL ? tvlData.totalTVL.toLocaleString(undefined, {minimumFractionDigits:2}) : '0.00'}
          </div>
          {tvlData && <div style={{fontSize:'0.8rem', color:'#666', marginTop:5}}>T0: ${tvlData.token0TVL.toFixed(0)} / T1: ${tvlData.token1TVL.toFixed(0)}</div>}
        </div>

        <div className="data-card">
          <div style={{display:'flex', justifyContent:'space-between', color:'#aaa', marginBottom:5}}>
              <span>24h 交易量</span><BarChart2 size={18}/>
          </div>
          <div style={{fontSize:'1.8rem', fontWeight:'bold'}}>
              {volumeData?.swapCount || 0} <span style={{fontSize:'1rem', fontWeight:'normal', color:'#666'}}>txs</span>
          </div>
          {volumeData && <div style={{fontSize:'0.8rem', color:'#666', marginTop:5}}>Vol0: {ethers.formatEther(volumeData.volume0||0n).slice(0,6)}</div>}
        </div>

        <div className="data-card">
           <div style={{display:'flex', justifyContent:'space-between', color:'#aaa', marginBottom:5}}>
              <span>价格趋势</span><TrendingUp size={18}/>
          </div>
           {marketData ? (
             <div>
                <div style={{fontSize:'1.5rem', fontWeight:'bold', color: marketData.trend === 'up' ? '#4ade80' : marketData.trend === 'down' ? '#ef4444' : '#fbbf24'}}>
                   {marketData.trend === 'up' ? '↗ 上涨' : marketData.trend === 'down' ? '↘ 下跌' : '→ 平稳'}
                </div>
                <div style={{fontSize:'0.8rem', color:'#666', marginTop:5}}>Current Price</div>
             </div>
           ) : (<div style={{color:'#666', marginTop:10}}>暂无数据</div>)}
        </div>
      </div>

      {/* 3. 详情与图表区域 */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:20, marginBottom: 20}}>
          {poolData && (
            <div className="data-card">
               <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><Layers size={18}/> 核心合约数据</h4>
               <div style={{fontSize:'0.9rem', lineHeight: '1.8'}}>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Token0:</span> <b>{poolData.token0Meta?.symbol}</b></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Token1:</span> <b>{poolData.token1Meta?.symbol}</b></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Fee Tier:</span> <b>{(Number(poolData.fee)/10000).toFixed(2)}%</b></div>
                  <hr style={{borderColor:'#333', margin:'10px 0'}}/>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Tick:</span> <b style={{fontFamily:'monospace'}}>{poolData.tick.toString()}</b></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Liquidity:</span> <b style={{fontFamily:'monospace'}}>{poolData.liquidity.toString().slice(0,10)}...</b></div>
               </div>
            </div>
           )}

           {priceHistory.length > 0 && (
            <div className="data-card">
               <h4 style={{marginTop:0}}>📊 实时价格走势</h4>
               <PriceChart 
                 data={priceHistory.map(swap => ({
                   timestamp: Number(swap.blockTimestamp || Date.now() / 1000),
                   price: calculatePrice(swap.sqrtPriceX96)
                 }))}
                 token0Symbol={poolData?.token0Meta?.symbol || 'T0'}
                 token1Symbol={poolData?.token1Meta?.symbol || 'T1'}
               />
            </div>
           )}

           {liquidityDistribution.length > 0 && (
             <div className="data-card">
               <h4 style={{marginTop:0}}>💧 流动性深度分布</h4>
               <LiquidityChart data={liquidityDistribution} currentTick={poolData ? Number(poolData.tick) : null} />
             </div>
           )}
      </div>

      {/* 4. 工具栏区域 */}
      <h3 style={{margin: '30px 0 15px 0', borderBottom: '1px solid #333', paddingBottom: 10}}>🛠️ 高级分析工具</h3>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:20}}>
           
           {/* 工具 1: 价格影响计算器 */}
           <div className="data-card" style={{borderTop: '3px solid #646cff'}}>
              <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><Calculator size={18}/> 价格影响计算</h4>
              <div className="input-group">
                 <label>输入数量</label>
                 <input value={swapAmount} onChange={e => setSwapAmount(e.target.value)} placeholder="0.0"/>
              </div>
              <div className="input-group">
                 <select value={swapDirection} onChange={e => setSwapDirection(e.target.value === 'true')} style={{width:'100%'}}>
                    <option value="true">{poolData?.token0Meta?.symbol || 'T0'} &rarr; {poolData?.token1Meta?.symbol || 'T1'}</option>
                    <option value="false">{poolData?.token1Meta?.symbol || 'T1'} &rarr; {poolData?.token0Meta?.symbol || 'T0'}</option>
                 </select>
              </div>
              <button className="action-btn" onClick={handleCalculatePriceImpact} disabled={loading} style={{marginTop:10}}>
                 计算滑点
              </button>
              {priceImpactData && (
                <div style={{marginTop:15, padding:10, background:'#111', borderRadius:6, fontSize:'0.9rem'}}>
                   <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span>Impact:</span>
                      <b style={{color: priceImpactData.priceImpact > 1 ? '#ef4444' : '#4ade80'}}>
                          {priceImpactData.priceImpact.toFixed(4)}%
                      </b>
                   </div>
                   <div style={{fontSize:'0.8rem', color:'#666', marginTop:5}}>Est. Price: {priceImpactData.estimatedNewPrice.toExponential(4)}</div>
                </div>
              )}
           </div>

           {/* 工具 2: 无常损失计算器 */}
           <div className="data-card" style={{borderTop: '3px solid #e63946'}}>
              <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><AlertTriangle size={18}/> 无常损失预估</h4>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                 <div className="input-group">
                    <label>初始价</label>
                    <input value={initialPrice} onChange={e => setInitialPrice(e.target.value)} placeholder="1000"/>
                 </div>
                 <div className="input-group">
                    <label>当前价</label>
                    <input value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="1100"/>
                 </div>
              </div>
              <button className="action-btn" onClick={handleCalculateIL} style={{marginTop:10, background:'#333'}}>
                 计算损失
              </button>
              {impermanentLossData && (
                 <div style={{marginTop:15, textAlign:'center'}}>
                    <div style={{fontSize:'1.5rem', fontWeight:'bold', color:'#ef4444'}}>
                       -{impermanentLossData.loss.toFixed(2)}%
                    </div>
                    <div style={{fontSize:'0.8rem', color:'#666'}}>vs HODL</div>
                 </div>
              )}
           </div>

           {/* 工具 3: Tick 查询 */}
           <div className="data-card" style={{borderTop: '3px solid #fbbf24'}}>
              <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><Search size={18}/> Tick 放大镜</h4>
              <div className="input-group" style={{display:'flex', gap:5}}>
                 <input value={tickQuery} onChange={e => setTickQuery(e.target.value)} placeholder="Tick Index" style={{flex:1}}/>
                 <button onClick={handleQueryTick} style={{padding:'0 10px'}}><ArrowRight size={16}/></button>
              </div>
              {tickData && (
                 <div style={{marginTop:15, fontSize:'0.85rem'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:5}}>
                       <span>Liquidity Gross:</span>
                       <span style={{fontFamily:'monospace'}}>{tickData.liquidityGross.toString()}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                       <span>Liquidity Net:</span>
                       <span style={{color: Number(tickData.liquidityNet) >= 0 ? '#4ade80' : '#ef4444', fontFamily:'monospace'}}>
                          {tickData.liquidityNet.toString()}
                       </span>
                    </div>
                 </div>
              )}
           </div>
      </div>
      
      {/* 5. 交易历史记录 */}
      {priceHistory.length > 0 && (
        <div className="data-card" style={{marginTop: 20}}>
           <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><Info size={18}/> 最新成交记录</h4>
           <div style={{overflowX:'auto'}}>
             <table style={{width:'100%', fontSize:'0.9rem', borderCollapse:'collapse'}}>
               <thead>
                 <tr style={{borderBottom:'1px solid #333', color:'#888', textAlign:'left'}}>
                    <th style={{padding:10}}>Block</th>
                    <th style={{padding:10}}>Timestamp</th>
                    <th style={{padding:10}}>Price</th>
                    <th style={{padding:10}}>Tick</th>
                 </tr>
               </thead>
               <tbody>
                 {priceHistory.slice(0, 5).map((swap, idx) => (
                   <tr key={idx} style={{borderBottom:'1px solid #222'}}>
                      <td style={{padding:10}}>{swap.blockNumber}</td>
                      <td style={{padding:10}}>{new Date(Number(swap.blockTimestamp)*1000).toLocaleTimeString()}</td>
                      <td style={{padding:10, fontFamily:'monospace', color:'#4ade80'}}>{calculatePriceDisplay(swap.sqrtPriceX96).toExponential(4)}</td>
                      <td style={{padding:10}}>{swap.tick.toString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* 弹窗 */}
      <Modal isOpen={isPoolModalOpen} onClose={() => setIsPoolModalOpen(false)} title="选择要分析的交易对">
         {poolList.map(p => (
            <PoolInfoCard key={p.address} pool={p} isActive={selectedPool?.address === p.address} onClick={() => handlePoolSelect(p)} />
         ))}
      </Modal>
    </div>
  );
};

export default AnalyticsPage;