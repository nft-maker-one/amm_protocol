import React from 'react';
import { Link, useLocation } from 'react-router-dom';

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
        <Link to="/token"><button className={isActive('/token')}>代币</button></Link>
        <Link to="/deploy"><button className={isActive('/deploy')}>部署</button></Link>
      </div>
      <button className="connect-btn" onClick={connectWallet}>
        {account ? `${account.substring(0,6)}...${account.substring(38)}` : "连接钱包"}
      </button>
    </nav>
  );
};

export default NavBar;