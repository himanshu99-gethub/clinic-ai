import React, { useState, useEffect, useRef } from 'react';

const LogItem = ({ log }) => {
  const [showContent, setShowContent] = useState(false);
  const text = log.text || log.message || "";
  const hasContent = !!log.content;

  // Map icon and color to log categories
  const getIconAndColor = () => {
    if (text.includes('✅')) return { icon: 'verified', color: 'text-green-400', border: 'border-green-500/20' };
    if (text.includes('🎯')) return { icon: 'track_changes', color: 'text-secondary', border: 'border-secondary/20' };
    if (text.includes('🚀') || text.includes('DISCOVERY')) return { icon: 'rocket_launch', color: 'text-primary', border: 'border-primary/20' };
    if (text.includes('🔍') || text.includes('Scanning')) return { icon: 'search', color: 'text-tertiary', border: 'border-tertiary/20' };
    if (text.includes('❌') || text.includes('ERROR')) return { icon: 'error', color: 'text-error', border: 'border-error/20' };
    return { icon: 'sync', color: 'text-on-surface-variant', border: 'border-outline-variant/10' };
  };

  const { icon, color, border } = getIconAndColor();

  return (
    <div className="timeline-item animate-fade-slide-in">
      {/* Icon badge */}
      <div className={`timeline-badge bg-surface-container-highest border ${border}`}>
        <span className={`material-symbols-outlined text-[12px] ${color}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-xs font-bold text-on-surface">{text.replace(/^[^\w]*/, '')}</p>
        <p className="text-[10px] text-on-surface-variant opacity-80 mt-0.5">{log.timestamp || 'Just now'}</p>
        
        {hasContent && (
          <button 
            onClick={() => setShowContent(!showContent)}
            className="mt-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[9px] font-bold text-primary tracking-wider uppercase hover:bg-primary/20 transition-all cursor-pointer"
          >
            {showContent ? 'Close Analysis' : 'Expand Data Synthesis'}
          </button>
        )}
      </div>

      {showContent && (
        <div className="mt-3 p-4 bg-surface-container-lowest/50 border border-outline-variant/20 rounded-xl text-[11px] font-mono text-on-surface-variant/90 leading-relaxed whitespace-pre-wrap">
          {log.content}
        </div>
      )}
    </div>
  );
};

const AgentActivityLog = ({ logs, clinicCount, verifiedCount }) => {
  const bottomRef = useRef(null);
  const [askPrompt, setAskPrompt] = useState('');

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length]);

  const isRunning = logs.some(l => {
    const t = l.text || l.message || '';
    return t.includes('🚀') || t.includes('🔍') || t.includes('Scanning');
  }) && !logs.some(l => (l.text || l.message || '').includes('COMPLETE'));

  const progress = Math.min(100, Math.round((verifiedCount / 20) * 100)); // normalized scale

  const handleAsk = (e) => {
    e.preventDefault();
    if (!askPrompt.trim()) return;
    alert(`FlowAI Console: Custom query analysis is under construction. Search query "${askPrompt}" received.`);
    setAskPrompt('');
  };

  return (
    <div className="glass-card ai-glow rounded-2xl flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="bg-surface-container-high/50 p-6 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center pulse-orange shadow-[0_0_10px_rgba(150,204,255,0.5)]">
            <span className="material-symbols-outlined text-background text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
              smart_toy
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-on-surface font-headline-md">FlowAI Assistant</h3>
            <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-0.5">
              {isRunning ? 'Discovery Active' : 'System Idle'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress & Recommendations pane */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[480px]">
        {/* Recommended action box */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/80">Recommended Action</p>
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl relative overflow-hidden">
            <p className="text-xs italic text-on-surface/90 leading-relaxed">
              "Detected a high matches density for cardiatric practices in the Northeast corridor. Shall I scale the automated outreach?"
            </p>
            <button 
              onClick={() => alert('Executing outreach optimization. Campaign criteria synced.')}
              className="mt-3 w-full py-2 bg-primary/10 hover:bg-primary/25 border border-primary/25 text-primary rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Execute Optimization
            </button>
          </div>
        </div>

        {/* Scan progress loader */}
        {(clinicCount > 0 || isRunning) && (
          <div className="space-y-2.5 p-3.5 bg-surface-container-lowest/40 rounded-xl border border-outline-variant/10">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-on-surface">Discovery Index</span>
              <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold">{progress}%</span>
            </div>
            <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium">
              Identified: <span className="text-primary font-bold">{clinicCount}</span> | Verified: <span className="text-green-400 font-bold">{verifiedCount}</span>
            </p>
          </div>
        )}

        {/* Live Logs timeline */}
        <div className="space-y-5">
          <h4 className="text-[10px] uppercase font-bold tracking-widest text-outline border-b border-outline-variant/10 pb-2">
            Real-time Insights
          </h4>
          
          <div className="timeline-list relative before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/10">
            {logs.length === 0 ? (
              <div className="py-10 text-center text-on-surface-variant/40 text-xs font-semibold uppercase tracking-wider">
                Awaiting Scanner Initialization...
              </div>
            ) : (
              logs.map((log) => <LogItem key={log.id} log={log} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input bar */}
      <form onSubmit={handleAsk} className="p-4 border-t border-outline-variant/10 bg-surface-container-low/20">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Ask FlowAI..." 
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl py-3 pl-4 pr-12 text-xs text-on-surface placeholder:text-outline-variant/50 focus:outline-none focus:border-primary/50 transition-all font-sans"
            value={askPrompt}
            onChange={e => setAskPrompt(e.target.value)}
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary-dim transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentActivityLog;
