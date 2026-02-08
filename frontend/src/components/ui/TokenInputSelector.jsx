import React from 'react';

const TokenInputSelector = ({ 
  label, 
  choice, 
  setChoice, 
  customValue, 
  setCustomValue, 
  tokenList,
  disabled = false 
}) => {
  return (
    <div className="input-group" style={{ marginBottom: '15px' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <select 
          value={choice} 
          onChange={(e) => setChoice(e.target.value)} 
          disabled={disabled}
          style={{ width: '100%' }}
        >
          <option value="">-- Select Token --</option>
          {tokenList.map((t) => (
            <option key={t.address} value={t.address}>
              {t.symbol} ({t.address.slice(0, 6)}...)
            </option>
          ))}
          <option value="custom">Custom Address...</option>
        </select>
        
        {choice === 'custom' && (
          <input 
            placeholder="Enter contract address starting with 0x" 
            value={customValue} 
            onChange={(e) => setCustomValue(e.target.value)}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};

export default TokenInputSelector;