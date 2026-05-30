import React, { useState, useEffect, useRef } from 'react';

const LogItem = ({ log }) => {
  const [showContent, setShowContent] = useState(false);
  const text = log.text || log.message || "";
  const hasContent = !!log.content;

  const color = text.includes('✅') ? '#4ade80'
    : text.includes('🎯') ? '#fbbf24'
    : text.includes('🚀') ? '#96ccff'
    : text.includes('🔍') ? '#a78bfa'
    : text.includes('✨') ? '#38bdf8'
    : text.includes('📊') ? '#6ee7b7'
    : text.includes('❌') ? '#ffb4ab'
    : text.includes('🗑️') ? '#fb923c'
    : 'rgba(255,255,255,0.6)';

  return (
    <div style={{ animation: 'fadeSlideIn 0.3s ease-out', marginBottom: '8px' }}>
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontFamily: 'monospace' }}>
        <span style={{ color: '#2E77AE', fontWeight: 700, opacity: 0.6, whiteSpace: 'nowrap' }}>[{log.timestamp}]</span>
        <span style={{ color, letterSpacing: '0.5px', wordBreak: 'break-word' }}>
          {text}
          {hasContent && (
            <button 
              onClick={() => setShowContent(!showContent)}
              style={{ 
                marginLeft: '12px', padding: '2px 8px', background: 'rgba(46,119,174,0.1)', 
                border: '1px solid rgba(46,119,174,0.2)', borderRadius: '4px', 
                color: '#2E77AE', fontSize: '10px', cursor: 'pointer', fontWeight: 800,
                textTransform: 'uppercase', transition: 'all 0.3s'
              }}
            >
              {showContent ? 'CLOSE SYNTHESIS' : 'OPEN SYNTHESIS'}
            </button>
          )}
        </span>
      </div>
      {showContent && (
        <div style={{ 
          marginTop: '12px', padding: '20px', background: 'rgba(0,0,0,0.3)', 
          border: '1px solid rgba(46,119,174,0.2)', borderRadius: '12px', 
          color: 'rgba(255,255,255,0.5)', fontSize: '13px', whiteSpace: 'pre-wrap',
          lineHeight: '1.6', fontFamily: 'Inter, sans-serif'
        }}>
          {log.content}
        </div>
      )}
    </div>
  );
};

const AgentActivityLog = ({ logs, clinicCount, verifiedCount }) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length]);

  const isRunning = logs.some(l => {
    const t = l.text || l.message || '';
    return t.includes('🚀') || t.includes('🔍') || t.includes('✨');
  }) && !logs.some(l => (l.text || l.message || '').includes('✅ DISCOVERY COMPLETE'));

  const progress = Math.min(100, Math.round((verifiedCount / 200) * 100));

  return (
    <div className="glass-panel" style={{
      marginTop: '40px',
      padding: '32px',
      maxHeight: '600px',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(10,14,20,0.8)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="status-pulse" style={{ backgroundColor: isRunning ? '#4ade80' : '#2E77AE', boxShadow: isRunning ? '0 0 10px #4ade80' : '0 0 10px #2E77AE' }} />
          Command Center Log
        </h3>
        <div style={{ fontSize: '10px', color: '#2E77AE', fontWeight: 800, letterSpacing: '1px' }}>
          {isRunning ? '🟢 SCANNING...' : 'LIVE FEED // SECURE_CHANNEL_01'}
        </div>
      </div>

      {/* Progress bar */}
      {(clinicCount > 0 || isRunning) && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
              📡 Found: <span style={{ color: '#38bdf8' }}>{clinicCount}</span> | ✅ Verified: <span style={{ color: '#4ade80' }}>{verifiedCount}</span>
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
              Target: 200
            </span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '10px',
              width: `${progress}%`,
              background: progress >= 100 ? '#4ade80' : 'linear-gradient(90deg, #2E77AE, #38bdf8)',
              transition: 'width 0.5s ease',
              boxShadow: progress >= 100 ? '0 0 10px #4ade80' : '0 0 10px #2E77AE'
            }} />
          </div>
        </div>
      )}

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '24px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column'
      }} className="custom-scrollbar">
        {logs.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(255,255,255,0.1)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Awaiting Protocol Initialization...
          </div>
        ) : (
          logs.map((log) => <LogItem key={log.id} log={log} />)
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(46,119,174,0.15); borderRadius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(46,119,174,0.3); }
      `}</style>
    </div>
  );
};

export default AgentActivityLog;

