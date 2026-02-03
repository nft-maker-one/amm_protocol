import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
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
  readPoolTokens,
  getTokenInfo,
  AMMPOOL_ADDRESS,
  getPoolPriceObservations,
  calculatePriceImpact,
  getActiveLiquidityRange,
  calculateTickPriceRange
} from '../api/amm';
import { 
  PriceChart, 
  LiquidityChart, 
  VolumeChart, 
  TVLPieChart, 
  PriceImpactChart 
} from '../components';

const AnalyticsPage = () => {
  const [selectedPool, setSelectedPool] = useState(null);
  const [poolAddr, setPoolAddr] = useState(AMMPOOL_ADDRESS);
  const [tickQuery, setTickQuery] = useState('0');
  const [poolData, setPoolData] = useState(null);
  const [tickData, setTickData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 新增的分析数据状态
  const [marketData, setMarketData] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [tvlData, setTvlData] = useState(null);
  const [impermanentLossData, setImpermanentLossData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [liquidityDistribution, setLiquidityDistribution] = useState([]);
  
  // Uniswap V3 SDK相关的高级分析数据
  const [oracleData, setOracleData] = useState(null);
  const [priceImpactData, setPriceImpactData] = useState(null);

  // 当选择池子时更新池子地址
  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    if (pool) {
      setPoolAddr(pool.address);
    }
  };
  const [activeLiquidityData, setActiveLiquidityData] = useState(null);
  
  // 无常损失计算器
  const [initialPrice, setInitialPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  
  // 价格影响计算器
  const [swapAmount, setSwapAmount] = useState('');
  const [swapDirection, setSwapDirection] = useState(true); // true for token0->token1

  const handleQueryPool = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    
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
        token0,
        token1,
        fee,
        token0Meta: t0Meta,
        token1Meta: t1Meta
      });
      
      // 获取市场分析数据
      await loadMarketAnalytics(provider, poolAddr);
      
      alert('池子数据和市场分析完成！');
    } catch (err) {
      alert('查询池子数据失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // 加载市场分析数据
  const loadMarketAnalytics = async (provider, poolAddr) => {
    try {
      // 获取基本代币信息
      const tokens = await readPoolTokens(provider, poolAddr);
      const [token0Info, token1Info] = await Promise.all([
        getTokenInfo(provider, tokens.token0),
        getTokenInfo(provider, tokens.token1)
      ]);

      // 并行获取所有市场数据
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

      // 加载高级分析数据
      await loadAdvancedAnalytics(provider, poolAddr);

    } catch (err) {
      console.error('加载市场分析数据失败:', err);
    }
  };
  
  // 加载高级分析数据
  const loadAdvancedAnalytics = async (provider, poolAddr) => {
    try {
      // 获取价格预言机数据 (TWAP)
      const oracleResult = await getPoolPriceObservations(provider, poolAddr, [3600, 1800, 0])
        .catch(err => {
          console.warn('价格预言机数据获取失败:', err.message);
          return null;
        });
      setOracleData(oracleResult);
      
      // 获取活跃流动性范围
      const activeLiquidity = await getActiveLiquidityRange(provider, poolAddr)
        .catch(err => {
          console.warn('活跃流动性数据获取失败:', err.message);
          return null;
        });
      setActiveLiquidityData(activeLiquidity);
      
    } catch (err) {
      console.error('加载高级分析数据失败:', err);
    }
  };

  // 计算价格影响
  const handleCalculatePriceImpact = async () => {
    if (!window.ethereum || !poolAddr || !swapAmount) return alert('请先连接钱包并输入交易量');
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const amountWei = ethers.parseEther(swapAmount);
      
      const impact = await calculatePriceImpact(provider, poolAddr, amountWei, swapDirection);
      setPriceImpactData(impact);
      
      alert(
        `价格影响计算完成\n` +
        `影响: ${impact.priceImpact.toFixed(4)}%\n` +
        `当前价格: ${impact.currentPrice.toExponential(4)}\n` +
        `预计新价格: ${impact.estimatedNewPrice.toExponential(4)}`
      );
    } catch (err) {
      alert('计算价格影响失败: ' + (err.message || err));
    }
  };
  
  // 计算无常损失
  const handleCalculateIL = () => {
    if (!initialPrice || !currentPrice) return alert('请输入初始价格和当前价格');
    
    const initial = parseFloat(initialPrice);
    const current = parseFloat(currentPrice);
    
    if (initial <= 0 || current <= 0) return alert('价格必须大于0');
    
    const loss = calculateImpermanentLoss(initial, current);
    setImpermanentLossData({ loss, initial, current });
  };
  
  // 生成模拟价格历史数据
  const generateMockPriceData = (currentPrice, hours = 24) => {
    const data = [];
    const now = Math.floor(Date.now() / 1000);
    const interval = 3600; // 1小时间隔
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = now - (i * interval);
      // 模拟价格波动
      const randomChange = (Math.random() - 0.5) * 0.02; // ±1%波动
      const price = currentPrice * (1 + randomChange + Math.sin(i / 6) * 0.01);
      data.push({
        timestamp,
        price: Math.max(price, currentPrice * 0.95) // 防止价格过低
      });
    }
    return data;
  };

  // 生成模拟流动性分布数据
  const generateMockLiquidityData = (currentTick) => {
    const data = [];
    const range = 100; // tick范围
    
    for (let i = -range; i <= range; i += 10) {
      const tick = currentTick + i;
      // 流动性在当前tick附近较高
      const distance = Math.abs(i);
      const liquidity = Math.max(
        1000000 * Math.exp(-distance / 50) + Math.random() * 500000,
        10000
      );
      data.push({
        tick,
        liquidity: Math.floor(liquidity),
        isActive: Math.abs(i) <= 20
      });
    }
    return data;
  };

  // 生成模拟交易量数据
  const generateMockVolumeData = (days = 7) => {
    const data = [];
    const now = Math.floor(Date.now() / 1000);
    const interval = 86400; // 1天间隔
    
    for (let i = days; i >= 0; i--) {
      const timestamp = now - (i * interval);
      data.push({
        timestamp,
        volume0: Math.random() * 10000,
        volume1: Math.random() * 5000
      });
    }
    return data;
  };

  // 生成价格影响数据
  const generatePriceImpactData = () => {
    const amounts = [100, 500, 1000, 5000, 10000, 50000, 100000];
    return amounts.map(amount => ({
      amount,
      priceImpact: Math.min(amount / 10000, 5) // 模拟价格影响，最高5%
    }));
  };

  const handleQueryTick = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return alert('Pool 地址无效');
    if (!tickQuery || Number.isNaN(Number(tickQuery))) return alert('Tick 必须是整数');
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const tickInfo = await getTickInfo(provider, poolAddr, Number(tickQuery));
      setTickData(tickInfo);
      
      alert(
        `Tick ${tickQuery} 信息查询完成！\n` +
        `已初始化: ${tickInfo.initialized}\n` +
        `总流动性: ${tickInfo.liquidityGross.toString()}\n` +
        `净流动性: ${tickInfo.liquidityNet.toString()}`
      );
    } catch (err) {
      alert('查询 Tick 信息失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const calculatePriceDisplay = (sqrtPriceX96) => {
    if (!sqrtPriceX96) return 0;
    return calculatePrice(sqrtPriceX96);
  };

  return (
    <div className="container">
      <h2>📈 市场分析</h2>
      
      {/* 池子选择器 */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>选择池子</h3>
        <PoolSelector 
          selectedPool={selectedPool} 
          onPoolSelect={handlePoolSelect}
        />
        {selectedPool && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e8f5e8', borderRadius: '5px' }}>
            <strong>分析池子:</strong> {selectedPool.address}<br/>
            <strong>代币对:</strong> {selectedPool.token0Meta?.symbol || 'TOKEN0'}/{selectedPool.token1Meta?.symbol || 'TOKEN1'}<br/>
            <strong>手续费:</strong> {selectedPool.fee/10000}%<br/>
            <strong>状态:</strong> {selectedPool.isInitialized ? '已初始化' : '未初始化'}
          </div>
        )}
      </div>
      
      <div className="input-group">
        <label>Pool 地址 {selectedPool && <span style={{color: '#888'}}>(自动填充)</span>}</label>
        <input 
          placeholder="0x..." 
          value={poolAddr} 
          onChange={e => setPoolAddr(e.target.value)}
          disabled={!!selectedPool}
          style={{backgroundColor: selectedPool ? '#f5f5f5' : 'white'}}
        />
        <button onClick={handleQueryPool} disabled={loading} style={{marginTop: '10px'}}>
          {loading ? '查询中...' : '查询池子详情'}
        </button>
      </div>

      {poolData && (
        <div className="data-card" style={{marginTop: '20px'}}>
          <h3>🏊‍♂️ 池子信息</h3>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px'}}>
            <div>
              <h4>基本信息</h4>
              <p><b>Token0:</b> {poolData.token0Meta?.symbol || 'Unknown'}</p>
              <p><b>Token1:</b> {poolData.token1Meta?.symbol || 'Unknown'}</p>
              <p><b>Fee:</b> {(Number(poolData.fee) / 10000).toFixed(2)}%</p>
              <p><b>当前流动性:</b> {poolData.liquidity.toString()}</p>
            </div>
            <div>
              <h4>价格信息</h4>
              <p><b>当前 Tick:</b> {poolData.tick.toString()}</p>
              <p><b>sqrtPriceX96:</b> {poolData.sqrtPriceX96.toString()}</p>
              <p><b>价格 (估算):</b> {calculatePriceDisplay(poolData.sqrtPriceX96).toExponential(4)}</p>
              <p><b>是否解锁:</b> {poolData.unlocked ? '是' : '否'}</p>
            </div>
          </div>
          <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px'}}>
            <h4 style={{margin: 0}}>观察数据</h4>
            <p style={{fontSize: '12px', color: '#888', margin: '5px 0'}}>
              观察索引: {poolData.observationIndex.toString()} | 
              观察基数: {poolData.observationCardinality.toString()} | 
              下次观察基数: {poolData.observationCardinalityNext.toString()}
            </p>
          </div>
        </div>
      )}

      <div className="input-group" style={{marginTop: '30px'}}>
        <label>查询 Tick 信息</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input 
            type="number" 
            placeholder="0" 
            value={tickQuery} 
            onChange={e => setTickQuery(e.target.value)}
          />
          <button onClick={handleQueryTick} disabled={loading || !poolAddr}>
            {loading ? '查询中...' : '查询 Tick'}
          </button>
        </div>
      </div>

      {tickData && (
        <div className="data-card" style={{marginTop: '15px'}}>
          <h4>📍 Tick {tickQuery} 信息</h4>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px'}}>
            <div>
              <p><b>已初始化:</b> {tickData.initialized ? '是' : '否'}</p>
              <p><b>总流动性:</b> {tickData.liquidityGross.toString()}</p>
              <p><b>净流动性:</b> {tickData.liquidityNet.toString()}</p>
            </div>
            <div>
              <p><b>外部累积:</b> {tickData.tickCumulativeOutside.toString()}</p>
              <p><b>外部秒数:</b> {tickData.secondsOutside}</p>
            </div>
          </div>
          <div style={{marginTop: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px'}}>
            <p style={{margin: 0, color: '#888'}}>
              <b>费用增长 (外部):</b><br/>
              Token0: {tickData.feeGrowthOutside0X128.toString()}<br/>
              Token1: {tickData.feeGrowthOutside1X128.toString()}
            </p>
          </div>
        </div>
      )}

      {/* 只有真实价格历史数据时才显示图表 */}
      {priceHistory.length > 0 && (
        <div className="data-card" style={{marginTop: '30px'}}>
          <h4>📊 实时价格图表 <span style={{fontSize: '12px', color: '#4CAF50'}}>[真实数据]</span></h4>
          <PriceChart 
            data={priceHistory.map(swap => ({
              timestamp: Number(swap.blockTimestamp || Date.now() / 1000),
              price: calculatePrice(swap.sqrtPriceX96)
            }))}
            token0Symbol={poolData?.token0Meta?.symbol || 'Token0'}
            token1Symbol={poolData?.token1Meta?.symbol || 'Token1'}
          />
        </div>
      )}

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '20px'}}>
        <div className="data-card">
          <label>总锁定价值 (TVL)</label>
          <h3>${tvlData?.totalTVL ? tvlData.totalTVL.toFixed(2) : '0.00'}</h3>
          {tvlData && (
            <small style={{color: '#888'}}>
              Token0: ${tvlData.token0TVL.toFixed(2)} | Token1: ${tvlData.token1TVL.toFixed(2)}
            </small>
          )}
        </div>
        <div className="data-card">
          <label>24h 交易量</label>
          <h3>{volumeData?.swapCount || 0} 笔交易</h3>
          {volumeData && (
            <small style={{color: '#888'}}>
              Vol0: {ethers.formatEther(volumeData.volume0 || 0n).slice(0,8)} | 
              Vol1: {ethers.formatEther(volumeData.volume1 || 0n).slice(0,8)}
            </small>
          )}
        </div>
      </div>

      {/* 价格趋势 */}
      {marketData && (
        <div className="data-card" style={{marginTop: '20px'}}>
          <h4>
            📈 价格趋势 
            <span style={{
              color: marketData.trend === 'up' ? '#4CAF50' : marketData.trend === 'down' ? '#F44336' : '#FFA726',
              marginLeft: '10px'
            }}>
              {marketData.trend === 'up' ? '📈 上涨' : marketData.trend === 'down' ? '📉 下跌' : '➡️ 平稳'}
              {marketData.change !== 0 && ` ${marketData.change.toFixed(2)}%`}
            </span>
          </h4>
          {marketData.firstPrice && marketData.lastPrice && (
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', fontSize: '14px'}}>
              <p><b>起始价格:</b> {marketData.firstPrice.toExponential(4)}</p>
              <p><b>最新价格:</b> {marketData.lastPrice.toExponential(4)}</p>
            </div>
          )}
        </div>
      )}

      {/* 最近交易历史 */}
      {priceHistory.length > 0 && (
        <div className="data-card" style={{marginTop: '20px'}}>
          <h4>📋 最近交易历史</h4>
          <div style={{maxHeight: '200px', overflow: 'auto', marginTop: '10px'}}>
            {priceHistory.slice(0, 10).map((swap, idx) => (
              <div key={idx} style={{
                padding: '8px',
                borderBottom: '1px solid #333',
                fontSize: '12px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '5px'
              }}>
                <div>块号: {swap.blockNumber}</div>
                <div>价格: {calculatePriceDisplay(swap.sqrtPriceX96).toExponential(2)}</div>
                <div>Tick: {swap.tick.toString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 流动性分布 */}
      {liquidityDistribution.length > 0 && (
        <div className="data-card" style={{marginTop: '20px'}}>
          <h4>🏊‍♂️ 流动性分布热力图 (活跃 Tick)</h4>
          <div style={{maxHeight: '300px', overflow: 'auto', marginTop: '10px'}}>
            <div style={{display: 'grid', gridTemplateColumns: '80px 120px 120px 100px 80px', gap: '8px', padding: '8px 0', borderBottom: '2px solid #333', fontSize: '12px', fontWeight: 'bold'}}>
              <div>Tick</div>
              <div>总流动性</div>
              <div>净流动性</div>
              <div>价格范围</div>
              <div>距离</div>
            </div>
            {liquidityDistribution.map((tick, idx) => (
              <div key={idx} style={{
                display: 'grid', 
                gridTemplateColumns: '80px 120px 120px 100px 80px', 
                gap: '8px', 
                padding: '6px 0',
                borderBottom: '1px solid #333',
                fontSize: '11px',
                backgroundColor: tick.distanceFromCurrent < 100 ? '#1a2f1a' : 'transparent'
              }}>
                <div style={{fontFamily: 'monospace'}}>{tick.tick}</div>
                <div style={{fontFamily: 'monospace'}}>{tick.liquidityGross.toString().slice(0,12)}...</div>
                <div style={{fontFamily: 'monospace', color: Number(tick.liquidityNet) > 0 ? '#4CAF50' : '#f44336'}}>
                  {tick.liquidityNet.toString().slice(0,12)}...
                </div>
                <div style={{fontSize: '10px'}}>
                  {tick.priceRange ? `${tick.priceRange.priceLower.toExponential(2)} - ${tick.priceRange.priceUpper.toExponential(2)}` : 'N/A'}
                </div>
                <div style={{
                  color: tick.distanceFromCurrent < 50 ? '#4CAF50' : 
                         tick.distanceFromCurrent < 200 ? '#FFA726' : '#888'
                }}>
                  {tick.distanceFromCurrent}
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px'}}>
            <p style={{margin: 0, color: '#888'}}>
              💡 绿色背景表示距离当前价格较近的活跃流动性区域。
              正净流动性(绿色)表示在该价格上方增加流动性，负净流动性(红色)表示移除流动性。
            </p>
          </div>
        </div>
      )}

      <div className="data-card" style={{marginTop: '20px'}}>
        <h4>🧮 无常损失计算器</h4>
        <div style={{display: 'flex', gap: '10px', marginTop:'10px'}}>
           <input 
             placeholder="初始价格" 
             value={initialPrice} 
             onChange={e => setInitialPrice(e.target.value)}
           />
           <input 
             placeholder="当前价格" 
             value={currentPrice} 
             onChange={e => setCurrentPrice(e.target.value)}
           />
           <button 
             onClick={handleCalculateIL}
             style={{padding: '8px 16px', background: '#333', color: 'white', border: 'none', borderRadius: '4px'}}>
             计算
           </button>
        </div>
        {impermanentLossData && (
          <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px'}}>
            <p style={{
              color: impermanentLossData.loss > 0 ? '#e63946' : '#4CAF50',
              fontWeight: 'bold',
              margin: '0'
            }}>
              无常损失: {impermanentLossData.loss.toFixed(2)}%
            </p>
            <p style={{fontSize: '12px', color: '#888', margin: '5px 0 0 0'}}>
              价格变化: {impermanentLossData.initial} → {impermanentLossData.current} 
              ({((impermanentLossData.current / impermanentLossData.initial - 1) * 100).toFixed(2)}%)
            </p>
          </div>
        )}
      </div>

      {/* 价格预言机数据 (TWAP) */}
      {oracleData && (
        <div className="data-card" style={{marginTop: '20px'}}>
          <h4>
            🔮 价格预言机 (TWAP)
            {oracleData.fallback && (
              <span style={{fontSize: '12px', color: '#FFA726', marginLeft: '10px'}}>
                (使用当前价格代替)
              </span>
            )}
          </h4>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px'}}>
            <div>
              <p><b>时间加权平均价格:</b> {oracleData.twapPrice.toExponential(4)}</p>
              <p><b>时间加权平均Tick:</b> {oracleData.timeWeightedTick.toFixed(2)}</p>
            </div>
            <div>
              <p><b>观测周期:</b> {oracleData.period}秒</p>
              <p><b>观测点数量:</b> {oracleData.tickCumulatives.length}</p>
            </div>
          </div>
          <div style={{marginTop: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px'}}>
            {oracleData.fallback ? (
              <p style={{margin: 0, color: '#FFA726'}}>
                <b>注意:</b> 该池子不支持价格预言机功能，显示的是当前价格数据。
              </p>
            ) : (
              <p style={{margin: 0, color: '#888'}}>
                <b>累积Tick:</b> {oracleData.tickCumulatives.join(' → ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 活跃流动性范围 */}
      {activeLiquidityData && (
        <div className="data-card" style={{marginTop: '20px'}}>
          <h4>🌊 活跃流动性范围</h4>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px'}}>
            <div>
              <p><b>当前Tick:</b> {activeLiquidityData.currentTick}</p>
              <p><b>当前价格:</b> {activeLiquidityData.currentPrice.toExponential(4)}</p>
            </div>
            <div>
              {activeLiquidityData.lowerBound && (
                <>
                  <p><b>下界Tick:</b> {activeLiquidityData.lowerBound.tick}</p>
                  <p><b>下界价格:</b> {activeLiquidityData.lowerBound.price.toExponential(4)}</p>
                </>
              )}
            </div>
            <div>
              {activeLiquidityData.upperBound && (
                <>
                  <p><b>上界Tick:</b> {activeLiquidityData.upperBound.tick}</p>
                  <p><b>上界价格:</b> {activeLiquidityData.upperBound.price.toExponential(4)}</p>
                </>
              )}
            </div>
          </div>
          <div style={{marginTop: '10px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px'}}>
            <p style={{margin: 0, fontSize: '14px'}}>
              <b>总活跃流动性:</b> {activeLiquidityData.totalActiveLiquidity.toLocaleString()}
            </p>
            <p style={{margin: '5px 0 0 0', fontSize: '12px', color: '#888'}}>
              活跃Tick数量: {activeLiquidityData.activeTicks.length}
            </p>
          </div>
        </div>
      )}

      {/* 价格影响计算器 */}
      <div className="data-card" style={{marginTop: '20px'}}>
        <h4>📊 价格影响计算器</h4>
        <div style={{display: 'flex', gap: '10px', marginTop:'10px', alignItems: 'center', flexWrap: 'wrap'}}>
           <input 
             placeholder="交易数量 (ETH)" 
             value={swapAmount} 
             onChange={e => setSwapAmount(e.target.value)}
             style={{flex: '1', minWidth: '120px'}}
           />
           <select 
             value={swapDirection}
             onChange={e => setSwapDirection(e.target.value === 'true')}
             style={{padding: '8px', background: '#333', color: 'white', border: 'none', borderRadius: '4px'}}
           >
             <option value="true">Token0 → Token1</option>
             <option value="false">Token1 → Token0</option>
           </select>
           <button 
             onClick={handleCalculatePriceImpact}
             disabled={!poolAddr || loading}
             style={{padding: '8px 16px', background: '#333', color: 'white', border: 'none', borderRadius: '4px'}}>
             计算影响
           </button>
        </div>
        {priceImpactData && (
          <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px'}}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px'}}>
              <div>
                <p style={{margin: 0, fontSize: '14px'}}>
                  <b>价格影响:</b>
                  <span style={{
                    color: priceImpactData.priceImpact > 5 ? '#e63946' : 
                           priceImpactData.priceImpact > 1 ? '#FFA726' : '#4CAF50',
                    marginLeft: '5px'
                  }}>
                    {priceImpactData.priceImpact.toFixed(4)}%
                  </span>
                </p>
              </div>
              <div>
                <p style={{margin: 0, fontSize: '14px'}}>
                  <b>当前价格:</b> {priceImpactData.currentPrice.toExponential(4)}
                </p>
              </div>
              <div>
                <p style={{margin: 0, fontSize: '14px'}}>
                  <b>预估新价格:</b> {priceImpactData.estimatedNewPrice.toExponential(4)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 只显示有真实数据的图表 */}
      {tvlData && (
        <div className="data-card" style={{marginTop: '30px'}}>
          <h4>🥧 TVL组成 <span style={{fontSize: '12px', color: '#4CAF50'}}>[真实数据]</span></h4>
          <TVLPieChart 
            data={{
              ...tvlData,
              token0Symbol: poolData?.token0Meta?.symbol || 'Token0',
              token1Symbol: poolData?.token1Meta?.symbol || 'Token1'
            }}
          />
        </div>
      )}

      {/* 只有真实流动性分布数据时才显示 */}
      {liquidityDistribution.length > 0 && (
        <div className="data-card" style={{marginTop: '20px'}}>
          <h4>💧 流动性分布 <span style={{fontSize: '12px', color: '#4CAF50'}}>[真实数据]</span></h4>
          <LiquidityChart 
            data={liquidityDistribution}
            currentTick={poolData ? Number(poolData.tick) : null}
          />
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;