import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, FileSpreadsheet, File as FileIcon,
  X, Loader2, CheckCircle2, Sparkles
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link005 } from './ui/skiper40';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

const EXT_STYLE = {
  pdf:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: FileText },
  docx: { color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  icon: FileText },
  doc:  { color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  icon: FileText },
  txt:  { color: '#a1a1aa', bg: 'rgba(255,255,255,0.05)', icon: FileIcon },
  csv:  { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: FileSpreadsheet },
  xlsx: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: FileSpreadsheet },
  xls:  { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: FileSpreadsheet },
};

const fmtBytes = b => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;
const ext = name => name.split('.').pop().toLowerCase();

export default function FileUploader({ onEmailsExtracted, onSessionCreated }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length) toast.error(`${rejected.length} file(s) rejected`);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...accepted
        .filter(f => !names.has(f.name))
        .map(f => ({ file: f, name: f.name, size: f.size, ext: ext(f.name), id: crypto.randomUUID() }))
      ];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, maxSize: 25 * 1024 * 1024,
  });

  const remove = id => setFiles(p => p.filter(f => f.id !== id));

  const handleUpload = async () => {
    if (!files.length) return toast.error('Add at least one file');
    setUploading(true); setResult(null);
    const fd = new FormData();
    files.forEach(f => fd.append('files', f.file, f.name));
    try {
      const res = await axios.post(`${API_BASE}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      setResult(res.data);
      if (onSessionCreated) onSessionCreated(res.data.session_id);
      if (onEmailsExtracted) onEmailsExtracted(res.data.emails, res.data.session_id);
      const n = res.data.emails?.stats?.valid_count || 0;
      toast.success(`${n} valid email${n !== 1 ? 's' : ''} extracted`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed — is the backend running?');
    } finally { setUploading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`dropzone${isDragActive ? ' active' : ''}`}
        style={{ padding: '52px 24px', textAlign: 'center' }}
      >
        <input {...getInputProps()} />
        <motion.div animate={{ scale: isDragActive ? 1.04 : 1 }} transition={{ type: 'spring', stiffness: 260 }}>
          {/* Icon ring */}
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '1px solid rgba(99,102,241,0.2)',
            background: 'rgba(99,102,241,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
          }}>
            <Upload size={24} color="#6366f1" strokeWidth={1.5} />
          </div>

          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fafafa', marginBottom: 6, letterSpacing: '-0.3px' }}>
            {isDragActive ? 'Drop it 🎯' : 'Drop documents here'}
          </h3>
          <p style={{ fontSize: 13, color: '#52525b', marginBottom: 16 }}>
            or{' '}
            <Link005 color="#6366f1" style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
              browse files
            </Link005>
          </p>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['PDF', 'DOCX', 'TXT', 'CSV', 'XLSX'].map(e => (
              <span key={e} style={{
                padding: '2px 9px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 10.5,
                fontWeight: 700,
                color: '#52525b',
                letterSpacing: '0.5px',
              }}>{e}</span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#3f3f46', marginTop: 10 }}>Max 25 MB per file</p>
        </motion.div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.map(f => {
          const s = EXT_STYLE[f.ext] || EXT_STYLE.txt;
          const Icon = s.icon;
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 16 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}
            >
              <div style={{ background: s.bg, borderRadius: 8, padding: 7, flexShrink: 0 }}>
                <Icon size={15} style={{ color: s.color, display: 'block' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                <p style={{ fontSize: 11, color: '#52525b', marginTop: 1 }}>{fmtBytes(f.size)}</p>
              </div>
              <button onClick={() => remove(f.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#52525b',
                padding: 4, borderRadius: 6, display: 'flex', transition: 'color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Upload button */}
      {files.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleUpload}
          disabled={uploading}
          className="btn btn-primary"
          style={{ justifyContent: 'center', padding: '11px 24px', fontSize: 14 }}
        >
          {uploading
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Extracting with AI…</>
            : <><Sparkles size={15} /> Extract Emails — {files.length} file{files.length !== 1 ? 's' : ''}</>
          }
        </motion.button>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: 16,
            background: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <CheckCircle2 size={15} color="#22c55e" />
            <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 13 }}>Extraction complete</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {[
              { label: 'Valid', val: result.emails?.stats?.valid_count, color: '#22c55e' },
              { label: 'Duplicates', val: result.emails?.stats?.duplicate_count, color: '#f59e0b' },
              { label: 'Invalid', val: result.emails?.stats?.invalid_count, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.val ?? 0}</p>
                <p style={{ fontSize: 11, color: '#52525b', fontWeight: 600, marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
