import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import {
  Upload, Mail, FileText, Send, CheckCircle2,
  ArrowRight, ArrowLeft, Zap, Users, Copy, BarChart3
} from 'lucide-react';

import Navbar from './components/Navbar';
import StatsCard from './components/StatsCard';
import FileUploader from './components/FileUploader';
import EmailTable from './components/EmailTable';
import EmailComposer from './components/EmailComposer';
import SendProgress from './components/SendProgress';
import CampaignHistory from './components/CampaignHistory';

/* ── Step config ─────────────────────────────────── */
const STEPS = [
  { id: 'upload',  label: 'Upload',  icon: Upload },
  { id: 'review',  label: 'Review',  icon: Mail },
  { id: 'compose', label: 'Compose', icon: FileText },
  { id: 'send',    label: 'Send',    icon: Send },
];

/* ── Step indicator ──────────────────────────────── */
function StepBar({ current }) {
  const ci = STEPS.findIndex(s => s.id === current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 20px', overflowX: 'auto' }}>
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < ci, active = i === ci;
        return (
          <React.Fragment key={s.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: done ? '#22c55e' : active ? '#6366f1' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${done ? '#22c55e' : active ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.3s',
              }}>
                {done ? <CheckCircle2 size={14} color="white" /> : <Icon size={13} color={active ? 'white' : '#3f3f46'} />}
              </div>
              <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: done ? '#22c55e' : active ? '#818cf8' : '#52525b', whiteSpace: 'nowrap', letterSpacing: '-0.1px' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="step-line" style={{ background: done ? '#22c55e40' : 'rgba(255,255,255,0.05)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Section header ─────────────────────────────── */
function SectionHead({ icon: Icon, title, sub, color = '#6366f1' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 20 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fafafa', letterSpacing: '-0.3px', lineHeight: 1 }}>{title}</h2>
        <p style={{ fontSize: 12, color: '#52525b', marginTop: 3 }}>{sub}</p>
      </div>
    </div>
  );
}

/* ── Page transition ─────────────────────────────── */
const PV = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

/* ── Main App ─────────────────────────────────────── */
export default function App() {
  const [page, setPage] = useState('upload');           // upload | history
  const [step, setStep] = useState('upload');           // upload | review | compose | send
  const [emailData, setEmailData] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [sendPayload, setSendPayload] = useState(null);

  const stats = {
    valid:   emailData?.stats?.valid_count     ?? 0,
    dupes:   emailData?.stats?.duplicate_count ?? 0,
    invalid: emailData?.stats?.invalid_count   ?? 0,
    sel:     selectedEmails.length,
  };

  /* handlers */
  const onExtracted = (emails, sid) => {
    setEmailData(emails);
    setSessionId(sid);
    setSelectedEmails(emails?.valid?.map(e => e.email) || []);
    setStep('review');
  };
  const onSelChange = emails => setSelectedEmails(emails);
  const onSendStart = payload => { setSendPayload(payload); setStep('send'); };
  const onComplete  = () => {};
  const onReset     = () => {
    setEmailData(null); setSessionId(null);
    setSelectedEmails([]); setSendPayload(null);
    setStep('upload');
  };

  const canNext = step === 'upload' ? !!emailData : step === 'review' ? selectedEmails.length > 0 : false;
  const goNext  = () => { if (step === 'upload') setStep('review'); else if (step === 'review') setStep('compose'); };
  const goBack  = () => { if (step === 'review') setStep('upload'); else if (step === 'compose') setStep('review'); else if (step === 'send') setStep('compose'); };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#111', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Inter, sans-serif', fontSize: 13, borderRadius: 10 },
        success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }} />

      <Navbar currentPage={page} onNavigate={p => { setPage(p); }} />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>
        <AnimatePresence mode="wait">

          {/* ── History page ─────────────────────────── */}
          {page === 'history' && (
            <motion.div key="history" {...PV}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', color: '#fafafa', lineHeight: 1.1 }}>
                  Campaign <span className="grad">History</span>
                </h1>
                <p style={{ color: '#52525b', fontSize: 13.5, marginTop: 7 }}>All past campaigns — click any row to expand recipients.</p>
              </div>
              <CampaignHistory />
            </motion.div>
          )}

          {/* ── Upload workflow ───────────────────────── */}
          {page === 'upload' && (
            <motion.div key="workflow" {...PV}>

              {/* Page title */}
              <div style={{ marginBottom: 4 }}>
                <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-1px', color: '#fafafa', lineHeight: 1.1 }}>
                  AI <span className="grad">Bulk Email</span>
                </h1>
                <p style={{ color: '#52525b', fontSize: 13, marginTop: 6 }}>
                  Upload docs → AI extracts emails → Compose & send
                </p>
              </div>

              {/* Step bar */}
              <StepBar current={step} />

              {/* Stats (shown after extraction, not on send) */}
              <AnimatePresence>
                {emailData && step !== 'send' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
                    <StatsCard icon={Users} label="Valid Emails"  value={stats.valid}   color="success" delay={0} />
                    <StatsCard icon={Copy}  label="Duplicates"    value={stats.dupes}   color="warning" delay={0.04} />
                    <StatsCard icon={Mail}  label="Invalid"       value={stats.invalid} color="danger"  delay={0.08} />
                    <StatsCard icon={CheckCircle2} label="Selected" value={stats.sel}  color="primary" delay={0.12} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Content area */}
              <AnimatePresence mode="wait">

                {/* Step 1 — Upload */}
                {step === 'upload' && (
                  <motion.div key="upload" {...PV}>
                    <div className="glass" style={{ padding: 26 }}>
                      <SectionHead icon={Zap} title="Upload Documents" sub="The AI RAG pipeline will extract all email addresses automatically" color="#6366f1" />
                      <FileUploader onEmailsExtracted={onExtracted} onSessionCreated={setSessionId} />
                    </div>

                    {/* How it works strip */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                      style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1 }}>
                      {[
                        { n: '01', t: 'Upload Files', d: 'PDF, DOCX, TXT, CSV, XLSX', c: '#6366f1' },
                        { n: '02', t: 'RAG Pipeline', d: 'Chunk → Embed → Index', c: '#06b6d4' },
                        { n: '03', t: 'Email Extract', d: 'Validate & deduplicate', c: '#22c55e' },
                        { n: '04', t: 'Bulk Send', d: 'Sequential with live SSE', c: '#f59e0b' },
                      ].map((s, i) => (
                        <div key={s.n} style={{
                          padding: '14px 16px',
                          background: i === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.015)',
                          borderTop: '1px solid rgba(255,255,255,0.04)',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          borderLeft: i === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          borderRight: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: i === 0 ? '10px 0 0 10px' : i === 3 ? '0 10px 10px 0' : 0,
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 900, color: s.c, display: 'block', marginBottom: 5, fontFamily: 'JetBrains Mono, monospace' }}>{s.n}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#d4d4d8', display: 'block', marginBottom: 2 }}>{s.t}</span>
                          <span style={{ fontSize: 11.5, color: '#52525b' }}>{s.d}</span>
                        </div>
                      ))}
                    </motion.div>

                    {/* Continue button */}
                    {emailData && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                        <button className="btn btn-primary" onClick={goNext} style={{ padding: '10px 22px', fontSize: 14 }}>
                          Review {stats.valid} Emails <ArrowRight size={15} />
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Step 2 — Review */}
                {step === 'review' && (
                  <motion.div key="review" {...PV}>
                    <div className="glass" style={{ padding: 26 }}>
                      <SectionHead icon={Mail} title="Review Extracted Emails" sub={`Select recipients for your campaign — ${stats.sel} selected`} color="#06b6d4" />
                      <EmailTable emailData={emailData} onSelectionChange={onSelChange} />
                    </div>
                  </motion.div>
                )}

                {/* Step 3 — Compose */}
                {step === 'compose' && (
                  <motion.div key="compose" {...PV}>
                    <div className="glass" style={{ padding: 26 }}>
                      <SectionHead icon={FileText} title="Compose Email" sub={`Sending to ${selectedEmails.length} recipient${selectedEmails.length !== 1 ? 's' : ''}`} color="#818cf8" />
                      <EmailComposer recipients={selectedEmails} onSendStart={onSendStart} />
                    </div>
                  </motion.div>
                )}

                {/* Step 4 — Send */}
                {step === 'send' && sendPayload && (
                  <motion.div key="send" {...PV}>
                    <div className="glass" style={{ padding: 26 }}>
                      <SectionHead icon={BarChart3} title="Live Campaign Progress" sub="Emails are sent sequentially with real-time updates" color="#22c55e" />
                      <SendProgress sendPayload={sendPayload} onComplete={onComplete} onReset={onReset} />
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>

              {/* Navigation */}
              {step !== 'send' && step !== 'upload' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
                  <button className="btn btn-ghost" onClick={goBack} style={{ fontSize: 13 }}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  {step === 'review' && canNext && (
                    <button className="btn btn-primary" onClick={goNext} style={{ fontSize: 13 }}>
                      Continue to Compose <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
