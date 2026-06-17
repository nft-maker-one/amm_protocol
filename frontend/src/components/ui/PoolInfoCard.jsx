import React from 'react';
import { Copy, CheckCircle, AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const PoolInfoCard = ({ pool, isActive, onClick, showDetails = true }) => {
  if (!pool) return null;

  const copyAddress = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pool.address);
    toast.success('Address copied');
  };

  return (
    <div 
      onClick={onClick}
      style={{
        padding: '15px',
        backgroundColor: isActive ? 'rgba(74, 222, 128, 0.05)' : '#1a1a1a',
        borderRadius: '8px',
        border: `1px solid ${isActive ? '#4ade80' : '#2d2d2d'}`,
        borderLeft: `4px solid ${isActive ? '#4ade80' : '#4f46e5'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        marginBottom: '10px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#f9fafb', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pool.token0Meta?.symbol || 'TKN0'}/{pool.token1Meta?.symbol || 'TKN1'} 
            <span style={{ 
              fontSize: '0.7rem', 
              color: '#9ca3af', 
              background: '#2d2d2d', 
              padding: '2px 8px', 
              borderRadius: '12px',
              fontWeight: '500',
              letterSpacing: '0.025em'
            }}>
              Fee: {pool.fee}
            </span>
          </div>
          
          <div style={{ fontSize: '0.75rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {pool.isInitialized ? (
              <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                <CheckCircle size={12} strokeWidth={2.5} /> Active
              </span>
            ) : (
              <span style={{ color: '#fb923c', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                <AlertTriangle size={12} strokeWidth={2.5} /> Uninitialized
              </span>
            )}
          </div>
        </div>
        {isActive && (
          <div style={{ 
            backgroundColor: '#4ade80', 
            borderRadius: '50%', 
            padding: '2px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Check size={14} color="#1a1a1a" strokeWidth={3} />
          </div>
        )}
      </div>

      {showDetails && (
        <div style={{ 
          marginTop: '12px', 
          paddingTop: '10px', 
          borderTop: '1px solid #2d2d2d', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <code style={{ 
            fontSize: '0.7rem', 
            color: '#6b7280', 
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' 
          }}>
            {pool.address.slice(0, 18)}...{pool.address.slice(-4)}
          </code>
          <button 
            onClick={copyAddress}
            style={{ 
              padding: '6px', 
              background: 'transparent', 
              border: '1px solid #374151', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#2d2d2d'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Copy size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PoolInfoCard;