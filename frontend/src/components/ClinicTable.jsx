import React from 'react';

const statusBadge = (status) => {
  const isVerified = status === 'Verified';
  return (
    <span style={{
      padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '1px',
      background: isVerified ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
      color: isVerified ? '#4ade80' : '#facc15',
      border: `1px solid ${isVerified ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
      display: 'inline-flex', alignItems: 'center', gap: '5px'
    }}>
      {isVerified ? '✓' : '⏳'} {isVerified ? 'Verified' : 'Processing'}
    </span>
  );
};

const outreachBadge = (status) => {
  const isContacted = status === 'Contacted';
  return (
    <span style={{
      padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '1px',
      background: isContacted ? 'rgba(46,119,174,0.12)' : 'rgba(255,255,255,0.05)',
      color: isContacted ? '#4a9fd4' : 'rgba(255,255,255,0.4)',
      border: `1px solid ${isContacted ? 'rgba(46,119,174,0.3)' : 'rgba(255,255,255,0.1)'}`,
      display: 'inline-flex', alignItems: 'center', gap: '5px'
    }}>
      {isContacted ? '✉️' : '⚪'} {isContacted ? 'Contacted' : 'Pending'}
    </span>
  );
};

const ClinicTable = ({ clinics, onExport, onAnalyze, onOutreach, isSending }) => {
  const [filter, setFilter] = React.useState('All');

  const filteredClinics = clinics.filter(c => {
    if (filter === 'All') return true;
    if (filter === 'Verified') return c.status === 'Verified';
    if (filter === 'Pending') return c.status !== 'Verified';
    return true;
  });

  const emailCount = clinics.filter(c => c.email && c.email.trim() !== '').length;

  const thStyle = {
    padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
    color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '2px',
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  };

  return (
    <div style={{ marginTop: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#fff' }}>📡 Intelligence Feed</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
            {filteredClinics.length} clinical nodes identified in current grid
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            {['All', 'Verified', 'Pending'].map((f) => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                  background: filter === f ? 'rgba(46,119,174,0.25)' : 'transparent',
                  color: filter === f ? '#4a9fd4' : 'rgba(255,255,255,0.35)', fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <button 
            onClick={onOutreach} 
            disabled={isSending}
            style={{
              padding: '10px 20px', 
              background: isSending ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #2E77AE, #1a4b6e)',
              border: isSending ? '1px solid rgba(255,255,255,0.1)' : 'none', 
              borderRadius: '12px',
              color: isSending ? 'rgba(255,255,255,0.4)' : '#fff', 
              fontSize: '13px', fontWeight: 700, 
              cursor: isSending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit',
              boxShadow: isSending ? 'none' : '0 4px 12px rgba(46,119,174,0.25)', 
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { if (!isSending) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { if (!isSending) e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {isSending ? '⌛ Sending...' : `📧 Send Emails (${emailCount})`}
          </button>
          <button onClick={onExport} style={{
            padding: '10px 20px', background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px',
            color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit',
            transition: 'all 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            📊 Export to Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(15,31,56,0.7)', border: '1px solid rgba(46,119,174,0.15)',
        borderRadius: '24px', overflow: 'hidden', backdropFilter: 'blur(20px)'
      }}>
        {filteredClinics.length === 0 ? (
          <div style={{ padding: '80px', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌐</div>
            <p style={{ fontSize: '15px', fontWeight: 600 }}>No clinical nodes match the current filter.</p>
            <p style={{ fontSize: '13px', marginTop: '8px', opacity: 0.6 }}>Try changing the filter or running a new scan.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={thStyle}>Clinic</th>
                  <th style={thStyle}>Specialization</th>
                  <th style={thStyle}>Contact</th>
                  <th style={thStyle}>Location</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Outreach</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClinics.map((clinic, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(46,119,174,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(46,119,174,0.3), rgba(46,119,174,0.1))',
                          border: '1px solid rgba(46,119,174,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '16px', fontWeight: 900, color: '#4a9fd4'
                        }}>
                          {clinic.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#E0EAF5', fontSize: '14px' }}>{clinic.name}</div>
                          {clinic.website && (
                            <a href={clinic.website} target="_blank" rel="noreferrer"
                              style={{ fontSize: '11px', color: '#2E77AE', textDecoration: 'none' }}>
                              🔗 {clinic.website.replace(/https?:\/\//, '').split('/')[0]}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '18px 20px' }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        background: 'rgba(46,119,174,0.12)', color: '#4a9fd4',
                        border: '1px solid rgba(46,119,174,0.25)', textTransform: 'uppercase', letterSpacing: '1px'
                      }}>{clinic.specialization || 'General'}</span>
                    </td>
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {clinic.email && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>📧 {clinic.email}</span>}
                        {clinic.phone && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>📞 {clinic.phone}</span>}
                        {!clinic.email && !clinic.phone && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>N/A</span>}
                      </div>
                    </td>
                    <td style={{ padding: '18px 20px' }}>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                        📍 {clinic.city}, {clinic.country}
                      </span>
                    </td>
                    <td style={{ padding: '18px 20px' }}>{statusBadge(clinic.status)}</td>
                    <td style={{ padding: '18px 20px' }}>{outreachBadge(clinic.outreach_status)}</td>
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={() => onAnalyze(clinic)}
                        style={{
                          padding: '7px 16px', background: 'rgba(46,119,174,0.15)',
                          border: '1px solid rgba(46,119,174,0.3)', borderRadius: '10px',
                          color: '#4a9fd4', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'inherit', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#2E77AE'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(46,119,174,0.15)'; e.currentTarget.style.color = '#4a9fd4'; }}
                      >Analyze →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicTable;
