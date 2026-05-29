import React from 'react';

const Navbar = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'MISSION DASHBOARD' },
    { id: 'discovery', label: 'DISCOVERY UNIT' },
    { id: 'archive', label: 'CONTACT ARCHIVE' }
  ];

  return (
    <nav style={{
      padding: '24px 32px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,14,20,0.85)', backdropFilter: 'blur(30px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '36px', height: '36px', background: 'linear-gradient(135deg, #2E77AE, #1d5c8a)', 
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontWeight: 900, color: '#fff', boxShadow: '0 0 15px rgba(46, 119, 174, 0.3)' 
          }}>C</div>
          <span style={{ fontSize: '15px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>
            CLINICFLOW <span style={{ color: '#2E77AE' }}>AI</span>
          </span>
        </div>

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '5px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                padding: '10px 28px', border: 'none', borderRadius: '10px',
                fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                letterSpacing: '1.5px', transition: 'all 0.3s',
                background: activeTab === item.id ? 'rgba(46,119,174,0.2)' : 'transparent',
                color: activeTab === item.id ? '#fff' : 'rgba(255,255,255,0.3)',
                border: activeTab === item.id ? '1px solid rgba(46,119,174,0.3)' : '1px solid transparent',
                textTransform: 'uppercase'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ 
          padding: '8px 20px', borderRadius: '30px', background: 'rgba(255,142,43,0.05)',
          border: '1px solid rgba(255,142,43,0.15)', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div className="status-pulse" />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#FF8E2B', letterSpacing: '1px' }}>AI NODE ACTIVE</span>
        </div>
        
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          cursor: 'pointer'
        }}>👤</div>
      </div>
    </nav>
  );
};

export default Navbar;
