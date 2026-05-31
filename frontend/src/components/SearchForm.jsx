import React, { useState } from 'react';

const SearchForm = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState({ city: '', country: '', specialization: '', auto_outreach: false });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  const inputStyle = {
    width: '100%', padding: '16px 20px 16px 48px',
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 500,
    outline: 'none', transition: 'all 0.3s', fontFamily: 'inherit'
  };

  const labelStyle = {
    display: 'block', fontSize: '10px', fontWeight: 800,
    color: '#2E77AE', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px'
  };

  const fields = [
    { key: 'specialization', label: 'Clinical Specialization', placeholder: 'e.g. Dental Clinic', icon: '🩺' },
    { key: 'city', label: 'Target City', placeholder: 'e.g. New York', icon: '🏙️' },
    { key: 'country', label: 'Country / Region', placeholder: 'e.g. USA', icon: '🌍' },
  ];

  return (
    <div className="glass-panel" style={{
      padding: '40px', marginBottom: '40px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
            Discovery Unit
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, marginTop: '4px' }}>
            Initialize healthcare node scanning protocol
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '28px' }}>
        {fields.map(({ key, label, placeholder, icon }) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', opacity: 0.5 }}>{icon}</span>
              <input
                type="text"
                placeholder={placeholder}
                style={inputStyle}
                value={query[key]}
                onChange={e => setQuery({ ...query, [key]: e.target.value })}
                onFocus={e => { e.target.style.borderColor = '#2E77AE'; e.target.style.boxShadow = '0 0 15px rgba(46,119,174,0.2)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
        ))}

        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '28px' }}>🤖</div>
            <div>
              <p style={{ color: '#fff', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Automated Agent Protocol</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>Agent will execute outreach sequence upon node verification</p>
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '56px', height: '28px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              style={{ opacity: 0, width: 0, height: 0 }}
              checked={query.auto_outreach}
              onChange={e => setQuery({ ...query, auto_outreach: e.target.checked })}
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', inset: 0,
              backgroundColor: query.auto_outreach ? '#2E77AE' : 'rgba(255,255,255,0.1)',
              transition: '.4s', borderRadius: '34px',
              boxShadow: query.auto_outreach ? '0 0 15px rgba(46,119,174,0.4)' : 'none'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '20px', width: '20px',
                left: query.auto_outreach ? '32px' : '4px', bottom: '4px',
                backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
              }} />
            </span>
          </label>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <button
            type="submit"
            disabled={isLoading}
            className="glow-btn"
            style={{
              width: '100%', padding: '18px',
              background: isLoading ? 'rgba(46,119,174,0.5)' : '#2E77AE',
              border: 'none', borderRadius: '12px', color: '#fff',
              fontSize: '14px', fontWeight: 900, cursor: isLoading ? 'not-allowed' : 'pointer',
              letterSpacing: '3px', transition: 'all 0.3s',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px'
            }}
          >
            {isLoading ? '⏳ SCANNING GRID...' : '🚀 Launch Discovery'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;
