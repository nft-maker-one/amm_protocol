import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavBar = ({ account, connectWallet }) => {
  const location = useLocation();

  const getLinkClass = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const btnStyle = { pointerEvents: 'none' };

  return (
    <nav className="navbar">
      <h1 style={{ 
        fontSize: '1.25rem', 
        margin: 0, 
        fontWeight: 'bold', 
        letterSpacing: '-0.025em',
        color: '#fff' 
      }}>
        Innovative AMM
      </h1>
      
      <div className="nav-links">
        <Link to="/" className={getLinkClass('/')}>
          <button type="button" style={btnStyle}>Swap</button>
        </Link>
        
        <Link to="/liquidity" className={getLinkClass('/liquidity')}>
          <button type="button" style={btnStyle}>Liquidity</button>
        </Link>
        
        <Link to="/trade" className={getLinkClass('/trade')}>
          <button type="button" style={btnStyle}>Advanced</button>
        </Link>
        
        <Link to="/analytics" className={getLinkClass('/analytics')}>
          <button type="button" style={btnStyle}>Analytics</button>
        </Link>
        
        <Link to="/token" className={getLinkClass('/token')}>
          <button type="button" style={btnStyle}>Tokens</button>
        </Link>
        
        <Link to="/deploy" className={getLinkClass('/deploy')}>
          <button type="button" style={btnStyle}>Deploy</button>
        </Link>
      </div>

      <button className="connect-btn" onClick={connectWallet}>
        {account 
          ? `${account.substring(0, 6)}...${account.substring(38)}` 
          : "Connect Wallet"
        }
      </button>
    </nav>
  );
};

export default NavBar;