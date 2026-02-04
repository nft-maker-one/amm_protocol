import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; 
import { 
  BarChart2, 
  TrendingUp, 
  Activity, 
  Search, 
  Calculator, 
  PieChart, 
  Layers, 
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Info,
  Clock
} from 'lucide-react';

import { findTokenByAddress } from '../api/tokens';
import { getPoolList, getSelectedPool, setSelectedPool } from '../api/pools';
import PoolSelector from '../components/ui/PoolSelector';
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
  getTokenInfo,
  AMMPOOL_ADDRESS,
  getPoolPriceObservations,
  calculatePriceImpact,
  getActiveLiquidityRange,
} from '../api/amm';

import { 
  PriceChart, 
  LiquidityChart, 
  TVLPieChart, 
} from '../components';

const AnalyticsPage = () => {
  const [selectedPool, setSelectedPool] = useState(null);
  const [poolAddr, setPoolAddr] = useState(AMMPOOL_ADDRESS);
  const [tickQuery, setTickQuery] = useState('0');
  const [poolData, setPoolData] = useState(null);
  const [tickData, setTickData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 分析数据状态
  const [marketData, setMarketData] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [tvlData, setTvlData] = useState(null);
  const [impermanentLossData, setImpermanentLossData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [liquidityDistribution, setLiquidityDistribution] = useState([]);
  
  // 高级分析数据
  const [oracleData, setOracleData] = useState(null);
  const [priceImpactData, setPriceImpactData] = useState(null);
  const [activeLiquidityData, setActiveLiquidityData] = useState(null);

  // 计算器输入状态
  const [initialPrice, setInitialPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapDirection, setSwapDirection] = useState(true); // true: 0->1

  // 保留给队友的 Mock 函数 (虽然这里没用上，但根据指示保留)
  const generateMockPriceData = (currentPrice, hours = 24) => { return []; };
  const generateMockLiquidityData = (currentTick) => { return []; };
  const generateMockVolumeData = (days = 7) => { return []; };
  const generatePriceImpactData = () => { return []; };

  const calculatePriceDisplay = (sqrtPriceX96) => {
    if (!sqrtPriceX96) return 0;
    return calculatePrice(sqrtPriceX96);
  };

  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    if (pool) setPoolAddr(pool.address);
  };

  // --- 核心逻辑 ---
  const handleQueryPool = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return toast.error('Pool 地址无效');
    
    const toastId = toast.loading('正在加载链上数据...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const pool = getPoolContract(provider, poolAddr);
      
      const [slot0Data, liquidity, token0, token1, fee] = await Promise.all([
        readSlot0(provider, poolAddr),
        getPoolLiquidity(provider, poolAddr),
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
        observationCardinality: slot0Data[3],
        observationCardinalityNext: slot0Data[4],
        feeProtocol: slot0Data[5],
        unlocked: slot0Data[6],
        liquidity,
        token0, token1, fee,
        token0Meta: t0Meta,
        token1Meta: t1Meta
      });
      
      await loadMarketAnalytics(provider, poolAddr);
      
      toast.success((t) => (
        <div style={{fontSize: '0.9rem'}}>
          <b>数据加载完成!</b>
          <div style={{marginTop: 4, color: '#555'}}>
            Tick: {slot0Data[1].toString()}<br/>
            Liq: {liquidity.toString().slice(0, 6)}...
          </div>
        </div>
      ), { id: toastId, duration: 4000 });

    } catch (err) {
      toast.error('查询失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const loadMarketAnalytics = async (provider, poolAddr) => {
    try {
      const [volume, tvl, trend, distribution, swapHistory] = await Promise.all([
        get24hVolume(provider, poolAddr).catch(() => ({ volume0: 0n, volume1: 0n, swapCount: 0 })),
        calculateTVL(provider, poolAddr).catch(() => ({ totalTVL: 0, token0TVL: 0, token1TVL: 0 })),
        getPriceTrend(provider, poolAddr).catch(() => ({ trend: 'neutral', change: 0 })),
        getLiquidityDistribution(provider, poolAddr, 50).catch(() => []),
        getSwapHistory(provider, poolAddr, 'latest', 'latest', 20).catch(() => [])
      ]);

      setVolumeData(volume);
      setTvlData(tvl);
      setMarketData(trend);
      setLiquidityDistribution(distribution);
      setPriceHistory(swapHistory);

      await loadAdvancedAnalytics(provider, poolAddr);
    } catch (err) {
      console.error('分析数据加载失败:', err);
    }
  };
  
  const loadAdvancedAnalytics = async (provider, poolAddr) => {
    try {
      const oracleResult = await getPoolPriceObservations(provider, poolAddr, [3600, 1800, 0]).catch(() => null);
      setOracleData(oracleResult);
      const activeLiquidity = await getActiveLiquidityRange(provider, poolAddr).catch(() => null);
      setActiveLiquidityData(activeLiquidity);
    } catch (err) {
      console.error('高级分析失败:', err);
    }
  };

  // --- 工具函数 ---
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
    toast.success(`预估损失: -${loss.toFixed(2)}%`);
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
      
      {/* 1. 顶部数据源选择 */}
      <div className="data-card" style={{ marginBottom: '20px', borderLeft: '4px solid #646cff' }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
           <h3 style={{margin:0}}>🔍 数据源配置</h3>
           {selectedPool && <span className="badge" style={{background:'#4ade80', color:'#000'}}>已连接</span>}
        </div>
        
        <PoolSelector selectedPool={selectedPool} onPoolSelect={handlePoolSelect} />
        
        <div className="input-group" style={{marginTop: 15}}>
           <div style={{display:'flex', gap:10}}>
             <input 
               placeholder="Pool Contract Address (0x...)" 
               value={poolAddr} 
               onChange={e => setPoolAddr(e.target.value)}
               disabled={!!selectedPool}
               style={{flex:1}}
             />
             <button onClick={handleQueryPool} disabled={loading} style={{display:'flex', alignItems:'center', gap:5, padding:'0 20px'}}>
               {loading ? <RefreshCw className="spin" size={16}/> : <Search size={16}/>}
               {loading ? '分析中...' : '加载数据'}
             </button>
           </div>
        </div>
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
          {volumeData && <div style={{fontSize:'0.8rem', color:'#666', marginTop:5}}>V0: {ethers.formatEther(volumeData.volume0||0n).slice(0,6)} / V1: {ethers.formatEther(volumeData.volume1||0n).slice(0,6)}</div>}
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
                <div style={{fontSize:'0.8rem', color:'#666', marginTop:5}}>Price: {marketData.lastPrice?.toExponential(4)}</div>
             </div>
           ) : (<div style={{color:'#666', marginTop:10}}>暂无数据</div>)}
        </div>
      </div>

      {/* 3. 详情与图表区域 (Grid Layout) */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:20, marginBottom: 20}}>
          {poolData && (
            <div className="data-card">
               <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><Layers size={18}/> 核心合约数据</h4>
               <div style={{fontSize:'0.9rem', lineHeight: '1.8'}}>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Token0:</span> <b>{poolData.token0Meta?.symbol}</b></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Token1:</span> <b>{poolData.token1Meta?.symbol}</b></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Fee Tier:</span> <b>{(Number(poolData.fee)/10000).toFixed(2)}%</b></div>
                  <hr style={{borderColor:'#333', margin:'10px 0'}}/>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Current Tick:</span> <b style={{fontFamily:'monospace'}}>{poolData.tick.toString()}</b></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Liquidity:</span> <b style={{fontFamily:'monospace'}}>{poolData.liquidity.toString()}</b></div>
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

      {/* 4. 工具栏区域 (三列布局，解决“窄窄的”问题) */}
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
                    <option value="true">Token0 &rarr; Token1</option>
                    <option value="false">Token1 &rarr; Token0</option>
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
      
      {/* 5. 交易历史记录 (宽屏列表) */}
      {priceHistory.length > 0 && (
        <div className="data-card" style={{marginTop: 20}}>
           <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><Clock size={18}/> 最新成交记录</h4>
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
    </div>
  );
};

export default AnalyticsPage;