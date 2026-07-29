import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause, Play, XCircle, CheckCircle2, AlertCircle,
  RotateCcw, Download, Mail, Loader2
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';
const fmtDur = s => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

const STATUS_LABEL = { starting: 'Starting…', running: 'Sending', paused: 'Paused', done: 'Complete', cancelled: 'Cancelled', error: 'Error' };
const STATUS_COLOR = { starting: '#818cf8', running: '#06b6d4', paused: '#f59e0b', done: '#22c55e', cancelled: '#ef4444', error: '#ef4444' };

export default function SendProgress({ sendPayload, onComplete, onReset }) {
  const [sendId, setSendId] = useState(null);
  const [status, setStatus] = useState('starting');
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, remaining: 0, progress_pct: 0 });
  const [log, setLog] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const logRef = useRef(null);
  const timerRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  useEffect(() => {
    if (status === 'running') { timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000); }
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [status]);

  useEffect(() => {
    if (!sendPayload || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await axios.post(`${API_BASE}/send`, sendPayload);
        const sid = res.data.send_session_id;
        setSendId(sid); setStats(p => ({ ...p, total: res.data.total })); setStatus('running');

        const es = new EventSource(`${API_BASE}/send/${sid}/stream`);
        es.onmessage = e => {
          try {
            const d = JSON.parse(e.data);
            if (d.type === 'heartbeat') return;
            setStats({ total: d.total || 0, sent: d.sent || 0, failed: d.failed || 0, remaining: d.remaining || 0, progress_pct: d.progress_pct || 0 });
            if (d.type === 'sent') setLog(p => [...p, { id: Date.now(), email: d.email, status: 'sent', time: new Date().toLocaleTimeString() }]);
            else if (d.type === 'failed') { setLog(p => [...p, { id: Date.now(), email: d.email, status: 'failed', error: d.error, time: new Date().toLocaleTimeString() }]); }
            else if (d.type === 'completed') { setStatus('done'); es.close(); onComplete?.(d); toast.success(`Done — ${d.sent} sent, ${d.failed} failed`); }
            else if (d.type === 'cancelled') { setStatus('cancelled'); es.close(); }
            else if (d.type === 'paused') setStatus('paused');
            else if (d.type === 'resumed') setStatus('running');
            else if (d.type === 'error') { setStatus('error'); toast.error(d.message); es.close(); }
          } catch {}
        };
        es.onerror = () => { if (!['done', 'cancelled'].includes(status)) setStatus('error'); es.close(); };
      } catch (e) { setStatus('error'); toast.error(e.response?.data?.detail || 'Failed to start'); }
    })();
  }, [sendPayload]);

  const ctrl = async act => { if (sendId) await axios.post(`${API_BASE}/send/${sendId}/${act}`); };
  const retryFailed = async () => {
    setRetrying(true);
    try { const r = await axios.post(`${API_BASE}/send/${sendId}/retry-failed`); toast.success(`Retrying ${r.data.total} emails…`); }
    catch { toast.error('Retry failed'); } finally { setRetrying(false); }
  };
  const exportCSV = () => {
    const rows = ['Email,Status,Error,Time', ...log.map(l => `${l.email},${l.status},${l.error || ''},${l.time}`)].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([rows], { type: 'text/csv' })), download: 'send_report.csv' });
    a.click(); toast.success('Report exported');
  };

  const isDone = ['done', 'cancelled', 'error'].includes(status);
  const color = STATUS_COLOR[status];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--surface)', border: `1px solid ${color}25`, borderRadius: 16, padding: 20 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {status === 'running' && <div className="dot dot-accent" />}
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fafafa', letterSpacing: '-0.3px' }}>
              {STATUS_LABEL[status]}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 12, color: '#52525b' }}>{fmtDur(elapsed)}</span>
            <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11.5, fontWeight: 700, background: `${color}15`, color, border: `1px solid ${color}30` }}>
              {stats.progress_pct}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-track" style={{ height: 5, marginBottom: 14 }}>
          <motion.div className="progress-fill" animate={{ width: `${stats.progress_pct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { label: 'Total', val: stats.total, color: '#71717a' },
            { label: 'Sent', val: stats.sent, color: '#22c55e' },
            { label: 'Failed', val: stats.failed, color: '#ef4444' },
            { label: 'Remaining', val: stats.remaining, color: '#818cf8' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="stat-num" style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.val}</p>
              <p style={{ fontSize: 10.5, color: '#52525b', fontWeight: 600, marginTop: 3 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {status === 'running' && <button className="btn btn-ghost" onClick={() => ctrl('pause')} style={{ fontSize: 12, padding: '6px 13px' }}><Pause size={13} /> Pause</button>}
          {status === 'paused'  && <button className="btn btn-primary" onClick={() => ctrl('resume')} style={{ fontSize: 12, padding: '6px 13px' }}><Play size={13} /> Resume</button>}
          {!isDone && <button className="btn btn-danger" onClick={() => { if (confirm('Cancel sending?')) ctrl('cancel'); }} style={{ fontSize: 12, padding: '6px 13px' }}><XCircle size={13} /> Cancel</button>}
          {isDone && stats.failed > 0 && (
            <button className="btn btn-ghost" onClick={retryFailed} disabled={retrying} style={{ fontSize: 12, padding: '6px 13px' }}>
              {retrying ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={13} />}
              Retry {stats.failed} failed
            </button>
          )}
          {isDone && (
            <>
              <button className="btn btn-ghost" onClick={exportCSV} style={{ fontSize: 12, padding: '6px 13px' }}><Download size={13} /> Export CSV</button>
              <button className="btn btn-primary" onClick={onReset} style={{ fontSize: 12, padding: '6px 13px' }}><Mail size={13} /> New Campaign</button>
            </>
          )}
        </div>
      </motion.div>

      {/* Live feed */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'running' && <div className="dot dot-accent" />}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#52525b' }}>Live Feed</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#3f3f46' }}>{log.length} events</span>
        </div>
        <div ref={logRef} style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 14px' }}>
          {!log.length ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#3f3f46', fontSize: 13 }}>
              Waiting for first email…
            </div>
          ) : (
            <AnimatePresence>
              {log.map(e => (
                <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="log-entry">
                  {e.status === 'sent'
                    ? <CheckCircle2 size={13} color="#22c55e" style={{ flexShrink: 0 }} />
                    : <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                  }
                  <span className="mono" style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: e.status === 'sent' ? '#d4d4d8' : '#ef4444' }}>{e.email}</span>
                  {e.error && <span style={{ fontSize: 11, color: '#52525b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.error}</span>}
                  <span className="mono" style={{ fontSize: 10.5, color: '#3f3f46', flexShrink: 0 }}>{e.time}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
