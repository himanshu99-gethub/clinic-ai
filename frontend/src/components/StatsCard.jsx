import React from 'react';

const StatsCard = ({ title, value, icon, color, index }) => {
  const accentColor = color === 'orange' ? '#FF8E2B' : '#2E77AE';

  return (
    <div className="glass-panel" style={{
      padding: '32px',
      position: 'relative', overflow: 'hidden',
      cursor: 'default',
      animation: `fadeSlideIn 0.5s ease ${index * 0.1}s both`,
      display: 'flex', flexDirection: 'column', gap: '12px'
    }}>
      {/* Glow dot */}
      <div style={{ position: 'absolute', top: '12px', right: '12px', width: '6px', height: '6px', borderRadius: '50%', background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '24px', opacity: 0.8 }}>{icon}</div>
        <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '2px' }}>{title}</div>
      </div>
      
      <div style={{ fontSize: '36px', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1, marginTop: '8px' }}>
        {value}
      </div>
      
      {/* Decorative line */}
      <div style={{ width: '40px', height: '2px', background: accentColor, opacity: 0.5, borderRadius: '2px' }} />
    </div>
  );
};

export default StatsCard;
