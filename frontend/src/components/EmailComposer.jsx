import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Bold, Italic, Underline, List, Link, Paperclip,
  X, Send, FlaskConical, Settings, ChevronDown,
  CheckCircle2, AlertCircle, Loader2, Eye, EyeOff
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link005 } from './ui/skiper40';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const PRESETS = [
  { name: 'Gmail',   host: 'smtp.gmail.com',       port: 587, use_tls: true },
  { name: 'Outlook', host: 'smtp.office365.com',   port: 587, use_tls: true },
  { name: 'Yahoo',   host: 'smtp.mail.yahoo.com',  port: 587, use_tls: true },
  { name: 'Custom',  host: '',                     port: 587, use_tls: true },
];

/* ── Rich Text Editor ───────────────────────────── */
function RTE({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const exec = (cmd, val = null) => { document.execCommand(cmd, false, val); ref.current?.focus(); onChange?.(ref.current.innerHTML); };
  const insertVar = v => { const s = window.getSelection(); if (s.rangeCount) { const r = s.getRangeAt(0); r.deleteContents(); r.insertNode(document.createTextNode(`{{${v}}}`)); r.collapse(false); } onChange?.(ref.current.innerHTML); };

  const ToolBtn = ({ title, icon: Icon, cmd, val, label }) => (
    <button className="rte-btn" title={title} onMouseDown={e => { e.preventDefault(); exec(cmd, val); }}>
      {Icon ? <Icon size={12} /> : label}
    </button>
  );

  return (
    <div className="rte-wrap">
      <div className="rte-toolbar">
        <ToolBtn title="Bold" icon={Bold} cmd="bold" />
        <ToolBtn title="Italic" icon={Italic} cmd="italic" />
        <ToolBtn title="Underline" icon={Underline} cmd="underline" />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 3px' }} />
        <ToolBtn title="Bullet list" icon={List} cmd="insertUnorderedList" />
        <button className="rte-btn" title="Link" onMouseDown={e => { e.preventDefault(); const u = prompt('URL:'); if (u) exec('createLink', u); }}><Link size={12} /></button>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 3px' }} />
        {['email', 'name'].map(v => (
          <button key={v} className="rte-btn mono" style={{ fontSize: 10, padding: '2px 6px', minWidth: 'auto', width: 'auto' }}
            onMouseDown={e => { e.preventDefault(); insertVar(v); }}>
            {`{{${v}}}`}
          </button>
        ))}
      </div>
      <div ref={ref} className="rte-editor" contentEditable suppressContentEditableWarning
        onInput={() => onChange?.(ref.current.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
        style={{ '::before': { content: 'attr(data-placeholder)', color: '#52525b' } }}
      />
    </div>
  );
}

/* ── SMTP field ─────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div>
      <p className="label">{label}</p>
      {children}
    </div>
  );
}

/* ── Main component ─────────────────────────────── */
export default function EmailComposer({ recipients = [], onSendStart }) {
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [signature, setSignature] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [showSmtp, setShowSmtp] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);
  const [smtp, setSmtp] = useState({ host: 'smtp.gmail.com', port: 587, username: '', password: '', use_tls: true });
  const [showPass, setShowPass] = useState(false);
  const attachRef = useRef();

  const applyPreset = i => { setPresetIdx(i); const p = PRESETS[i]; setSmtp(s => ({ ...s, host: p.host, port: p.port, use_tls: p.use_tls })); };

  const addFiles = e => setAttachments(prev => {
    const names = new Set(prev.map(f => f.name));
    return [...prev, ...Array.from(e.target.files || []).filter(f => !names.has(f.name))];
  });

  const sendTest = async () => {
    if (!testEmail) return toast.error('Enter a test email');
    if (!subject) return toast.error('Subject required');
    if (!smtp.username || !smtp.password) return toast.error('SMTP credentials required');
    setTestingEmail(true);
    try {
      await axios.post(`${API_BASE}/send-test-email`, { to_email: testEmail, subject, body_html: bodyHtml, body_text: bodyHtml.replace(/<[^>]*>/g, ''), smtp_config: smtp });
      toast.success(`Test sent to ${testEmail}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Test failed'); }
    finally { setTestingEmail(false); }
  };

  const handleSend = () => {
    if (!subject.trim()) return toast.error('Subject required');
    if (!bodyHtml.trim()) return toast.error('Body required');
    if (!smtp.username || !smtp.password) return toast.error('SMTP credentials required');
    if (!recipients.length) return toast.error('No recipients selected');

    Promise.all(attachments.map(f => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res({ name: f.name, data: Array.from(new Uint8Array(r.result)), mime_type: f.type });
      r.onerror = rej;
      r.readAsArrayBuffer(f);
    }))).then(attData => onSendStart?.({
      campaign_name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
      subject, body_html: bodyHtml, body_text: bodyHtml.replace(/<[^>]*>/g, ''),
      signature, smtp_config: smtp,
      recipients: recipients.map(e => ({ email: e, name: e.split('@')[0] })),
      attachments: attData,
    }));
  };

  const ready = subject && bodyHtml && smtp.username && smtp.password && recipients.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Campaign name */}
      <Field label="Campaign Name">
        <input className="input" placeholder={`Campaign — ${new Date().toLocaleDateString()}`}
          value={campaignName} onChange={e => setCampaignName(e.target.value)} />
      </Field>

      {/* Subject */}
      <Field label="Subject *">
        <input className="input" placeholder="Your compelling subject line…"
          value={subject} onChange={e => setSubject(e.target.value)} />
      </Field>

      {/* Body */}
      <Field label="Email Body *">
        <RTE value={bodyHtml} onChange={setBodyHtml} placeholder="Write your message… Use {{email}} or {{name}} for personalization" />
      </Field>

      {/* Signature */}
      <Field label="Signature (optional)">
        <textarea className="input" placeholder={"Best regards,\nYour Name"} value={signature} onChange={e => setSignature(e.target.value)} />
      </Field>

      {/* Attachments */}
      <div>
        <p className="label">Attachments</p>
        <input ref={attachRef} type="file" multiple style={{ display: 'none' }} onChange={addFiles} />
        <button className="btn btn-ghost" onClick={() => attachRef.current?.click()} style={{ gap: 7, fontSize: 12, padding: '7px 13px' }}>
          <Paperclip size={13} /> Attach files
        </button>
        {attachments.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {attachments.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                <Paperclip size={12} color="#52525b" />
                <span style={{ flex: 1, fontSize: 12.5, color: '#d4d4d8' }}>{f.name}</span>
                <span style={{ fontSize: 11, color: '#52525b' }}>{(f.size / 1024).toFixed(1)}KB</span>
                <button onClick={() => setAttachments(p => p.filter(x => x.name !== f.name))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 2, display: 'flex' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#52525b'}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SMTP */}
      <div className="glass" style={{ padding: 16 }}>
        <button onClick={() => setShowSmtp(!showSmtp)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a1a1aa', fontWeight: 600, fontSize: 13 }}>
            <Settings size={14} />
            SMTP Configuration
            {smtp.username && <span className="badge badge-valid" style={{ marginLeft: 4 }}>✓ set</span>}
          </div>
          <ChevronDown size={14} color="#52525b" style={{ transform: showSmtp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {showSmtp && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Provider presets */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {PRESETS.map((p, i) => (
                <button key={p.name} onClick={() => applyPreset(i)} style={{
                  padding: '4px 11px', borderRadius: 7,
                  background: presetIdx === i ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${presetIdx === i ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  color: presetIdx === i ? '#818cf8' : '#71717a',
                  fontWeight: 600, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>{p.name}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
              <Field label="SMTP Host"><input className="input" value={smtp.host} onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))} placeholder="smtp.gmail.com" /></Field>
              <Field label="Port"><input className="input" type="number" value={smtp.port} onChange={e => setSmtp(p => ({ ...p, port: +e.target.value }))} /></Field>
            </div>

            <Field label="Email / Username">
              <input className="input" type="email" value={smtp.username} onChange={e => setSmtp(p => ({ ...p, username: e.target.value }))} placeholder="you@gmail.com" />
            </Field>

            <Field label={<>App Password {' '}
              <Link005 href="https://myaccount.google.com/apppasswords" style={{ color: '#6366f1', fontSize: 10.5, fontWeight: 600 }} target="_blank">
                Get Gmail App Password ↗
              </Link005>
            </>}>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPass ? 'text' : 'password'} value={smtp.password}
                  onChange={e => setSmtp(p => ({ ...p, password: e.target.value }))}
                  placeholder="16-character app password" style={{ paddingRight: 50 }} />
                <button onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#52525b',
                  display: 'flex', alignItems: 'center',
                }}>
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </Field>

            {/* Warning */}
            <div style={{ padding: '9px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 12, color: '#a16207', lineHeight: 1.5 }}>
              ⚠ For Gmail: enable 2-Step Verification and use an App Password. Credentials are never stored.
            </div>

            {/* Test send */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="email" placeholder="Test recipient: you@email.com"
                value={testEmail} onChange={e => setTestEmail(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={sendTest} disabled={testingEmail} style={{ whiteSpace: 'nowrap', padding: '0 13px', fontSize: 12 }}>
                {testingEmail ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FlaskConical size={13} />}
                Test
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Recipients status */}
      {recipients.length > 0 ? (
        <div style={{ padding: '9px 13px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
          <CheckCircle2 size={14} /> {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} ready
        </div>
      ) : (
        <div style={{ padding: '9px 13px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
          <AlertCircle size={14} /> No recipients — go to Upload tab and select emails
        </div>
      )}

      {/* Send */}
      <button className="btn btn-primary" onClick={handleSend} disabled={!ready}
        style={{ justifyContent: 'center', padding: '12px 0', fontSize: 14, fontWeight: 700, opacity: ready ? 1 : 0.4 }}>
        <Send size={15} /> Send to {recipients.length} Recipient{recipients.length !== 1 ? 's' : ''}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
