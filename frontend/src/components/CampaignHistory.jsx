import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Download, Trash2, Search, CheckCircle2, XCircle, Clock, Mail } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link001 } from './ui/skiper40';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';

const timeAgo = iso => {
  if (!iso) return '—';
  const d = Date.now() - new Date(iso + 'Z').getTime(), m = Math.floor(d / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
  return dy > 0 ? `${dy}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'just now';
};

function Row({ c, onDelete, onDownload }) {
  const [open, setOpen] = useState(false);
  const [recs, setRecs] = useState(null);
  const rate = c.total_recipients > 0 ? Math.round(c.sent_count / c.total_recipients * 100) : 0;

  const loadRecs = async () => {
    if (recs) { setOpen(!open); return; }
    try { const r = await axios.get(`${API_BASE}/campaigns/${c.id}`); setRecs(r.data.recipients || []); setOpen(true); }
    catch { toast.error('Failed to load'); }
  };

  const statusColor = { running: '#06b6d4', completed: '#22c55e', cancelled: '#ef4444', failed: '#ef4444', pending: '#818cf8' };
  const sc = statusColor[c.status] || '#71717a';

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={loadRecs}>
        <td style={{ width: 28 }}>
          {open ? <ChevronDown size={13} color="#52525b" /> : <ChevronRight size={13} color="#52525b" />}
        </td>
        <td style={{ fontWeight: 600, color: '#e4e4e7', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Untitled'}</td>
        <td className="mono" style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#71717a' }}>{c.subject}</td>
        <td>
          <div>
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>{new Date(c.created_at + 'Z').toLocaleDateString()}</span>
            <br /><span style={{ fontSize: 10.5, color: '#52525b' }}>{timeAgo(c.created_at)}</span>
          </div>
        </td>
        <td style={{ color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>{c.total_recipients}</td>
        <td style={{ color: '#22c55e', fontWeight: 700 }}>{c.sent_count}</td>
        <td style={{ color: '#ef4444', fontWeight: 700 }}>{c.failed_count ?? 0}</td>
        <td style={{ minWidth: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div className="progress-track" style={{ flex: 1, height: 3 }}>
              <div className="progress-fill" style={{ width: `${rate}%` }} />
            </div>
            <span className="mono" style={{ fontSize: 10.5, color: '#52525b', width: 28, textAlign: 'right' }}>{rate}%</span>
          </div>
        </td>
        <td>
          <span style={{ padding: '2px 9px', borderRadius: 100, fontSize: 10.5, fontWeight: 700, background: `${sc}12`, color: sc, border: `1px solid ${sc}25` }}>
            {c.status}
          </span>
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onDownload(c.id)} title="Download CSV"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 5, borderRadius: 5, display: 'flex', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'} onMouseLeave={e => e.currentTarget.style.color = '#52525b'}>
              <Download size={13} />
            </button>
            <button onClick={() => onDelete(c.id)} title="Delete"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 5, borderRadius: 5, display: 'flex', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#52525b'}>
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
      {open && recs && (
        <tr>
          <td colSpan={10} style={{ padding: 0 }}>
            <AnimatePresence>
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                style={{ padding: '10px 28px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                  Recipients ({recs.length})
                </p>
                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {recs.slice(0, 50).map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12 }}>
                      {r.status === 'sent' ? <CheckCircle2 size={11} color="#22c55e" /> : r.status === 'failed' ? <XCircle size={11} color="#ef4444" /> : <Clock size={11} color="#52525b" />}
                      <span className="mono" style={{ color: '#d4d4d8', flex: 1, fontSize: 12 }}>{r.email}</span>
                      {r.error && <span style={{ color: '#52525b', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error}</span>}
                      <span className="mono" style={{ color: '#3f3f46', fontSize: 10.5 }}>{r.sent_at ? new Date(r.sent_at + 'Z').toLocaleTimeString() : '—'}</span>
                    </div>
                  ))}
                  {recs.length > 50 && <p style={{ color: '#3f3f46', fontSize: 11, paddingTop: 4 }}>+{recs.length - 50} more — download CSV for full list</p>}
                </div>
              </motion.div>
            </AnimatePresence>
          </td>
        </tr>
      )}
    </>
  );
}

export default function CampaignHistory() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const load = async () => { setLoading(true); try { const r = await axios.get(`${API_BASE}/campaigns`); setCampaigns(r.data.campaigns || []); } catch { toast.error('Failed to load history'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const del = async id => { if (!confirm('Delete this campaign?')) return; try { await axios.delete(`${API_BASE}/campaigns/${id}`); setCampaigns(p => p.filter(c => c.id !== id)); toast.success('Deleted'); } catch { toast.error('Delete failed'); } };
  const dl = id => window.open(`${API_BASE}/campaigns/${id}/report/csv`, '_blank');

  const filtered = campaigns.filter(c => {
    const ms = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.subject?.toLowerCase().includes(search.toLowerCase());
    const mf = filterStatus === 'all' || c.status === filterStatus;
    return ms && mf;
  });

  const totalSent = campaigns.reduce((a, c) => a + (c.sent_count || 0), 0);
  const totalFailed = campaigns.reduce((a, c) => a + (c.failed_count || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Total Campaigns', val: campaigns.length, color: '#818cf8' },
          { label: 'Emails Sent', val: totalSent, color: '#22c55e' },
          { label: 'Emails Failed', val: totalFailed, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <p className="stat-num" style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.val}</p>
            <p style={{ fontSize: 11.5, color: '#52525b', fontWeight: 600, marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
          <input className="input" style={{ paddingLeft: 30, height: 34 }} placeholder="Search campaigns…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all', 'running', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: '5px 12px', borderRadius: 7, fontFamily: 'inherit',
            background: filterStatus === s ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${filterStatus === s ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`,
            color: filterStatus === s ? '#818cf8' : '#71717a',
            fontWeight: 600, fontSize: 11.5, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
          }}>{s}</button>
        ))}
        <button className="btn btn-ghost" onClick={load} style={{ padding: '5px 12px', fontSize: 11.5 }}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 13 }}>Loading campaigns…</div>
        ) : !filtered.length ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Mail size={36} color="#1c1c1e" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#52525b', fontSize: 14, fontWeight: 600 }}>No campaigns yet</p>
            <p style={{ color: '#3f3f46', fontSize: 12.5, marginTop: 4 }}>Start your first campaign from the Upload tab.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sk-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>Campaign</th>
                  <th>Subject</th>
                  <th>Date</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => <Row key={c.id} c={c} onDelete={del} onDownload={dl} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
