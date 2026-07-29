import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, ChevronLeft, ChevronRight, Copy, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link001 } from './ui/skiper40';

const PAGE = 15;

const copyText = t => { navigator.clipboard.writeText(t); toast.success('Copied'); };

const exportCSV = emails => {
  const rows = ['Email,Domain,Status,Source', ...emails.map(e => `${e.email},${e.domain||''},${e.status},${e.source||''}`)].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([rows], { type: 'text/csv' })), download: 'emails.csv' });
  a.click(); URL.revokeObjectURL(a.href);
  toast.success('CSV exported');
};

function Badge({ s }) {
  return <span className={`badge badge-${s}`}>{s}</span>;
}

export default function EmailTable({ emailData, onSelectionChange }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(new Set());

  const valid = emailData?.valid || [];
  const invalid = emailData?.invalid || [];
  const dupes = emailData?.duplicates || [];
  const stats = emailData?.stats || {};

  const all = useMemo(() => [...valid, ...invalid, ...dupes], [valid, invalid, dupes]);

  const filtered = useMemo(() => {
    let list = filter === 'valid' ? valid : filter === 'invalid' ? invalid : filter === 'duplicate' ? dupes : all;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.email?.toLowerCase().includes(q) || e.source?.toLowerCase().includes(q) || e.domain?.toLowerCase().includes(q));
    }
    return list;
  }, [all, filter, search, valid, invalid, dupes]);

  const totalPages = Math.ceil(filtered.length / PAGE);
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const toggleSel = email => {
    const n = new Set(sel);
    n.has(email) ? n.delete(email) : n.add(email);
    setSel(n); if (onSelectionChange) onSelectionChange([...n]);
  };
  const toggleAll = () => {
    if (rows.every(r => sel.has(r.email))) {
      setSel(new Set()); if (onSelectionChange) onSelectionChange([]);
    } else {
      const n = new Set([...sel, ...rows.map(r => r.email)]);
      setSel(n); if (onSelectionChange) onSelectionChange([...n]);
    }
  };
  const selectAllValid = () => {
    const n = new Set(valid.map(e => e.email));
    setSel(n); setFilter('valid'); setPage(1);
    if (onSelectionChange) onSelectionChange([...n]);
    toast.success(`${n.size} valid recipients selected`);
  };

  if (!emailData || !all.length) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <AlertCircle size={36} color="#3f3f46" style={{ margin: '0 auto 12px' }} />
      <p style={{ color: '#52525b', fontSize: 14 }}>No emails extracted yet.</p>
    </div>
  );

  const FILTERS = [
    { k: 'all', label: 'All', val: stats.total_extracted },
    { k: 'valid', label: 'Valid', val: stats.valid_count },
    { k: 'invalid', label: 'Invalid', val: stats.invalid_count },
    { k: 'duplicate', label: 'Duplicate', val: stats.duplicate_count },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.k} onClick={() => { setFilter(f.k); setPage(1); }}
            style={{
              padding: '5px 13px',
              borderRadius: 8,
              background: filter === f.k ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f.k ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: filter === f.k ? '#818cf8' : '#71717a',
              fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >{f.label} <span style={{ opacity: 0.6 }}>({f.val ?? 0})</span></button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
          <input className="input" style={{ paddingLeft: 32, height: 36 }} placeholder="Search emails, domains…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary" onClick={selectAllValid} style={{ padding: '0 14px', height: 36, fontSize: 12 }}>
          Select all valid ({stats.valid_count})
        </button>
        <button className="btn btn-ghost" onClick={() => exportCSV(all)} style={{ padding: '0 12px', height: 36, gap: 6, fontSize: 12 }}>
          <Download size={13} /> Export
        </button>
      </div>

      {/* Selection banner */}
      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: '8px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 10, fontSize: 13, color: '#818cf8', fontWeight: 600 }}>
            ✓ {sel.size} recipient{sel.size !== 1 ? 's' : ''} selected
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="sk-table">
            <thead>
              <tr>
                <th style={{ width: 36, paddingLeft: 14 }}>
                  <input type="checkbox" style={{ accentColor: '#6366f1' }}
                    checked={rows.length > 0 && rows.every(r => sel.has(r.email))}
                    onChange={toggleAll} />
                </th>
                <th>#</th>
                <th>Email</th>
                <th>Domain</th>
                <th>Source</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {rows.map((r, i) => (
                  <motion.tr key={r.email + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}>
                    <td><input type="checkbox" style={{ accentColor: '#6366f1' }} checked={sel.has(r.email)} onChange={() => toggleSel(r.email)} /></td>
                    <td style={{ color: '#3f3f46', fontVariantNumeric: 'tabular-nums' }}>{(page - 1) * PAGE + i + 1}</td>
                    <td className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>
                      {r.email}
                      {r.is_disposable && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b' }}>⚠ disposable</span>}
                    </td>
                    <td style={{ color: '#71717a', fontSize: 12 }}>{r.domain || '—'}</td>
                    <td style={{ color: '#52525b', fontSize: 11.5, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.source || '—'}</td>
                    <td><Badge s={r.status} /></td>
                    <td>
                      <button onClick={() => copyText(r.email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 4, borderRadius: 4, display: 'flex', transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
                        onMouseLeave={e => e.currentTarget.style.color = '#52525b'}>
                        <Copy size={13} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 11.5, color: '#52525b' }}>
              {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '4px 9px', fontSize: 12 }}><ChevronLeft size={13} /></button>
              <span style={{ fontSize: 12, color: '#71717a', padding: '4px 8px' }}>{page}/{totalPages}</span>
              <button className="btn btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '4px 9px', fontSize: 12 }}><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
