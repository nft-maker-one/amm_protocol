// src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ethers } from 'ethers';

// --- 页面组件区域 ---

// 1. 核心交易页面 (对应文档: AMM实现 )
const SwapPage = () => {
  return (
    <div className="container">
      <h2>💱 代币兑换 (AMM)</h2>
      <p style={{color: '#888', marginBottom: '20px'}}>
        基于创新曲线设计的自动做市商兑换。
      </p>
      
      <div className="input-group">
        <label>支付 (Token A)</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input type="number" placeholder="0.0" />
          <select style={{width: '120px'}}><option>ETH</option><option>USDC</option></select>
        </div>
      </div>

      <div className="input-group">
        <label>接收 (Token B)</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input type="number" placeholder="0.0" disabled />
          <select style={{width: '120px'}}><option>USDC</option><option>ETH</option></select>
        </div>
      </div>

      <div className="data-card">
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <span>预估价格</span>
          <span>1 ETH = 3,200 USDC</span>
        </div>
      </div>

      <button className="action-btn">立即兑换</button>
    </div>
  );
};

// 2. 流动性管理页面 (对应文档: 流动性管理 )
const LiquidityPage = () => {
  const [mode, setMode] = useState('add'); // 'add' or 'remove'

  return (
    <div className="container">
      <h2>💧 流动性管理</h2>
      <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
        <button 
          onClick={() => setMode('add')}
          style={{padding: '5px 15px', background: mode==='add'?'#646cff':'#333', color: 'white', border:'none', borderRadius:'4px'}}
        >添加流动性</button>
        <button 
          onClick={() => setMode('remove')}
          style={{padding: '5px 15px', background: mode==='remove'?'#646cff':'#333', color: 'white', border:'none', borderRadius:'4px'}}
        >移除流动性</button>
      </div>

      {mode === 'add' ? (
        <>
          <div className="input-group">
            <label>存入 ETH</label>
            <input type="number" placeholder="0.0" />
          </div>
          <div className="input-group">
            <label>存入 USDC</label>
            <input type="number" placeholder="0.0" />
          </div>
          <div className="data-card">
            <p>💡 您将收到 LP 代币作为流动性凭证。</p>
          </div>
          <button className="action-btn">添加流动性 & 铸造 LP</button>
        </>
      ) : (
        <>
          <div className="input-group">
            <label>移除百分比</label>
            <input type="range" min="0" max="100" style={{width: '100%'}} />
          </div>
          <button className="action-btn" style={{backgroundColor: '#e63946'}}>移除流动性 & 销毁 LP</button>
        </>
      )}
    </div>
  );
};

// 3. 高级交易功能 (对应文档: 交易功能/跨链/路由 )
const AdvancedTradePage = () => {
  return (
    <div className="container">
      <h2>🚀 高级路由与设置</h2>
      
      <div className="input-group">
        <label>跨链兑换 (目标链)</label>
        <select>
          <option>Ethereum (Local)</option>
          <option>Optimism</option>
          <option>Arbitrum</option>
        </select>
      </div>

      <div className="input-group">
        <label>最大滑点保护 (%)</label>
        <input type="number" defaultValue="0.5" />
      </div>

      <div className="input-group">
        <label>交易截止时间 (分钟)</label>
        <input type="number" defaultValue="20" />
      </div>

      <div className="data-card">
        <h4>最优路径分析</h4>
        <p style={{fontSize: '0.9rem', color: '#888'}}>
          ETH &rarr; Pool A &rarr; Pool B &rarr; USDC <br/>
          (预计节省 Gas: 12%)
        </p>
      </div>
      
      <button className="action-btn">保存设置</button>
    </div>
  );
};

// 4. 分析与监控 (对应文档: 分析与监控 )
const AnalyticsPage = () => {
  return (
    <div className="container">
      <h2>📈 市场分析</h2>
      
      <div className="data-card" style={{height: '200px', display:'flex', alignItems:'center', justifyContent:'center', background:'#111'}}>
        {/* 这里通常对接 Recharts 或 Chart.js */}
        <span style={{color: '#555'}}>📊 实时价格图表区域 (Chart Placeholder)</span>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
        <div className="data-card">
          <label>总锁定价值 (TVL)</label>
          <h3>$1,234,567</h3>
        </div>
        <div className="data-card">
          <label>24h 交易量</label>
          <h3>$45,320</h3>
        </div>
      </div>

      <div className="data-card">
        <h4>无常损失计算器</h4>
        <div style={{display: 'flex', gap: '10px', marginTop:'10px'}}>
           <input placeholder="初始价格" />
           <input placeholder="当前价格" />
        </div>
        <p style={{color: '#e63946', marginTop: '10px'}}>预计无常损失: -2.3%</p>
      </div>
    </div>
  );
};

// --- 导航栏组件 ---
const NavBar = ({ account, connectWallet }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <h1 style={{fontSize: '1.5rem', margin:0}}>🧪 InnovativeAMM</h1>
      <div className="nav-links">
        <Link to="/"><button className={isActive('/')}>兑换</button></Link>
        <Link to="/liquidity"><button className={isActive('/liquidity')}>流动性</button></Link>
        <Link to="/trade"><button className={isActive('/trade')}>高级</button></Link>
        <Link to="/analytics"><button className={isActive('/analytics')}>分析</button></Link>
      </div>
      <button className="connect-btn" onClick={connectWallet}>
        {account ? `${account.substring(0,6)}...${account.substring(38)}` : "连接钱包"}
      </button>
    </nav>
  );
};

// --- 主 APP 入口 ---
function App() {
  const [account, setAccount] = useState(null);

  // 连接 MetaMask 的逻辑
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setAccount(await signer.getAddress());
      } catch (error) {
        console.error("User rejected connection", error);
      }
    } else {
      alert("请安装 MetaMask!");
    }
  };

  return (
    <Router>
      <NavBar account={account} connectWallet={connectWallet} />
      <Routes>
        <Route path="/" element={<SwapPage />} />
        <Route path="/liquidity" element={<LiquidityPage />} />
        <Route path="/trade" element={<AdvancedTradePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </Router>
  );
}

export default App;