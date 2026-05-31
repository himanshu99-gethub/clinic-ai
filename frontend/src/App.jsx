import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import StatsCard from './components/StatsCard';
import SearchForm from './components/SearchForm';
import ClinicTable from './components/ClinicTable';
import AgentActivityLog from './components/AgentActivityLog';
import ClinicDrawer from './components/ClinicDrawer';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (window.location.port === '5173') {
    return 'http://localhost:8081/api';
  }
  return '/api';
};
const API_BASE_URL = getApiUrl();

// Configure axios with better error handling
axios.interceptors.response.use(
  response => response,
  error => {
    console.error('[API Error]', error);
    return Promise.reject(error);
  }
);

// ── Template Editor ──────────────────────────────────────
const TemplateEditor = ({ template, onSave }) => {
  const getInitialState = (tpl) => {
    const str = tpl || "";
    if (str.trim().toLowerCase().startsWith("subject:")) {
      const idx = str.indexOf('\n');
      if (idx !== -1) {
        const firstLine = str.substring(0, idx);
        const subject = firstLine.replace(/Subject:/i, '').trim();
        const body = str.substring(idx + 1).trim();
        return { subject, body };
      }
    }
    return { subject: "Strategic Partnership Inquiry", body: str };
  };

  const initial = getInitialState(template);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  // Keep local state in sync with saved protocol
  useEffect(() => {
    const updated = getInitialState(template);
    setSubject(updated.subject);
    setBody(updated.body);
  }, [template]);

  const handleSave = () => {
    const combined = `Subject: ${subject}\n${body}`;
    onSave(combined);
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      alert('Please enter a recipient email address');
      return;
    }
    setTestingEmail(true);
    try {
      const combined = `Subject: ${subject}\n${body}`;
      const res = await axios.post(`${API_BASE_URL}/send-test-email`, {
        email: testEmail,
        template: combined
      });
      alert(res.data.message || 'Test email sent successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to send test email: ' + (e.response?.data?.error || e.message));
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="glass-panel p-8 md:p-10 relative">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
        <div>
          <h2 className="text-lg md:text-xl font-black text-white tracking-wider uppercase">Global Protocol Editor</h2>
          <p className="text-[10px] text-white/30 font-semibold tracking-widest mt-1 uppercase">
            Configure outreach subject and body
          </p>
        </div>
        <button 
          onClick={handleSave} 
          className="glow-btn px-6 py-3 bg-[#2E77AE] text-white text-[11px] font-black tracking-widest uppercase rounded-xl border border-white/5 cursor-pointer shadow-lg hover:shadow-[#2E77AE]/35"
        >
          💾 Save Protocol
        </button>
      </div>

      {/* Subject Line */}
      <div className="mb-6">
        <label className="block text-[10px] font-black text-[#2E77AE] tracking-widest uppercase mb-2">
          📧 Email Subject Line
        </label>
        <input 
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter outreach subject line..."
          className="w-full bg-black/30 border border-white/8 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-[#2E77AE] transition-all"
        />
      </div>

      {/* Email Body */}
      <div className="mb-6">
        <label className="block text-[10px] font-black text-[#2E77AE] tracking-widest uppercase mb-2">
          📝 Email Body Template
        </label>
        <p className="text-xs text-[#2E77AE] font-semibold mb-2">
          💡 TIP: Use <code className="text-[#FF8E2B] font-bold">[Clinic Name]</code> as a placeholder for the clinic's name.
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Dear Administrative Team, ..."
          className="w-full min-h-[220px] bg-black/40 border border-white/8 rounded-xl p-5 text-white text-sm leading-relaxed outline-none focus:border-[#2E77AE] transition-all"
        />
      </div>

      {/* Test Email Tool */}
      <div className="bg-[#FF8E2B]/5 border border-[#FF8E2B]/15 p-5 rounded-2xl">
        <div className="flex justify-between items-center mb-3">
          <p className="text-[10px] text-[#FF8E2B] font-black tracking-widest uppercase">
            🧪 Send Test Email
          </p>
          {testingEmail && <span className="text-[10px] text-emerald-400 font-extrabold animate-pulse">SENDING TEST...</span>}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter recipient email (e.g. your_email@gmail.com)..."
            className="flex-1 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-[#FF8E2B]/40"
          />
          <button 
            onClick={handleSendTest}
            disabled={testingEmail}
            className={`px-5 py-3 rounded-xl text-white text-[11px] font-extrabold tracking-widest uppercase transition-all cursor-pointer ${
              testingEmail ? 'bg-white/10 text-white/30' : 'bg-[#FF8E2B]/20 hover:bg-[#FF8E2B]/35 border border-[#FF8E2B]/30'
            }`}
          >
            {testingEmail ? 'Sending...' : 'Send Test'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main App ─────────────────────────────────────────────
export default function App() {
  const [clinics, setClinics] = useState([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, unverified: 0, contacted: 0, pending: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [sending, setSending] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const stopOutreachRef = useRef(false);

  // Safety net: loading can NEVER be stuck for more than 15 seconds
  useEffect(() => {
    if (!loading) return;
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      addToast('Safety Timeout: Scanning forced to complete', 'error');
    }, 15000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  // Toast Notification System
  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const getSavedTemplate = () => {
    const saved = localStorage.getItem('outreach_template');
    if (saved) return saved;
    return `Subject: Strategic Partnership Inquiry | [Clinic Name]

Dear Administrative Team,

I hope this message finds you well. I am reaching out from ClinicFlow AI on behalf of our healthcare outreach division.

We've been closely analyzing clinical excellence in your region, and [Clinic Name] stands out as a leader in patient care and medical innovation.

We would love to explore how ClinicFlow AI can help streamline your patient acquisition and operational efficiency. 

Would you be available for a brief 15-minute call this week?

Best regards,
Himanshu Shakya
ClinicFlow AI | Lead Developer`;
  };

  const [globalTemplate, setGlobalTemplate] = useState(getSavedTemplate());

  // Fetch template from backend on mount
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/template`);
        if (res.data && res.data.template) {
          setGlobalTemplate(res.data.template);
        }
      } catch (e) {
        console.error('Failed to fetch template from backend:', e);
      }
    };
    fetchTemplate();
  }, []);

  const fetchData = async (filter) => {
    try {
      const params = filter || {};
      const [clinicsRes, statsRes, logsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/clinics`, { params }).catch(e => {
          console.error('[Clinics API Error]', e);
          return { data: [] };
        }),
        axios.get(`${API_BASE_URL}/stats`, { params }).catch(e => {
          console.error('[Stats API Error]', e);
          return { data: { total: 0, verified: 0, unverified: 0, contacted: 0, pending: 0 } };
        }),
        axios.get(`${API_BASE_URL}/logs`).catch(e => {
          console.error('[Logs API Error]', e);
          return { data: [] };
        })
      ]);
      
      setClinics(Array.isArray(clinicsRes.data) ? clinicsRes.data : []);
      setStats(statsRes.data || { total: 0, verified: 0, unverified: 0, contacted: 0, pending: 0 });
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
    } catch (e) {
      console.error('[Fetch Error]', e);
    }
  };

  useEffect(() => {
    fetchData(activeFilter);
    const interval = setInterval(() => fetchData(activeFilter), 3000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  const handleSearch = async (query) => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/search`, {
        ...query,
        template: globalTemplate
      }, { timeout: 10000 });
      
      setActiveFilter({ 
        city: query.city, 
        country: query.country, 
        specialization: query.specialization 
      });
      
      addToast(`Discovery sequence launched for ${query.specialization} in ${query.city}!`, 'info');
      
      setTimeout(() => {
        fetchData({ 
          city: query.city, 
          specialization: query.specialization 
        });
      }, 3000);
      
    } catch (e) {
      console.error('[Search Error]', e);
      addToast(`Scan launch failed: ${e.response?.data?.error || 'Connection error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = (clinic) => {
    setSelectedClinic(clinic);
  };

  const handleSaveTemplate = async (val) => {
    try {
      setGlobalTemplate(val);
      localStorage.setItem('outreach_template', val);
      
      const res = await axios.post(`${API_BASE_URL}/template`, { template: val });
      addToast(res.data.message || 'Global outreach protocol saved', 'success');
    } catch (e) {
      console.error('Failed to save template:', e);
      addToast('Failed to save protocol to database', 'error');
    }
  };

  const handleStopOutreach = () => {
    stopOutreachRef.current = true;
    addToast('Stopping Outreach Agent... Please wait.', 'info');
  };

  const handleOutreach = async () => {
    const clinicsWithEmail = clinics.filter(c => c.email && c.email.trim() !== '');
    
    if (!clinicsWithEmail.length) {
      addToast('No clinics with verified email addresses found.', 'error');
      return;
    }
    
    setSending(true);
    stopOutreachRef.current = false;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < clinicsWithEmail.length; i++) {
      if (stopOutreachRef.current) {
        addToast(`Outreach stopped by user. Sent: ${successCount}, Failed: ${failCount}`, 'info');
        setSending(false);
        return;
      }
      
      const clinic = clinicsWithEmail[i];
      addToast(`Sending outreach to ${clinic.name} (${i + 1}/${clinicsWithEmail.length})...`, 'info');
      
      try {
        const res = await axios.post(`${API_BASE_URL}/outreach`, {
          clinic_names: [clinic.name],
          template: globalTemplate
        });
        
        if (res.data.contacted > 0) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        console.error(e);
        failCount++;
      }
      
      setClinics(prev => prev.map(c => c.name === clinic.name ? { ...c, outreach_status: 'Contacted' } : c));
    }
    
    addToast(`Outreach sequence complete! Sent: ${successCount}, Failed: ${failCount}`, 'success');
    setSending(false);
    
    setTimeout(() => {
      fetchData(activeFilter);
    }, 2000);
  };

  const handleExport = () => {
    if (!clinics.length) return;
    const headers = ['Name', 'Specialization', 'City', 'Country', 'Email', 'Phone', 'Website', 'Address'];
    const csvRows = clinics.map(c =>
      [c.name, c.specialization, c.city, c.country, c.email, c.phone, c.website, c.address]
        .map(v => {
          const val = v === null || v === undefined ? '' : v;
          return `"${val.toString().replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    
    const csvContent = "\uFEFF" + headers.join(',') + '\n' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clinic_grid_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Excel export downloaded successfully!', 'success');
  };

  const handleClearAll = async () => {
    try {
      const res = await axios.delete(`${API_BASE_URL}/clinics`);
      addToast(res.data.message || 'All leads cleared successfully', 'success');
      setClinics([]);
      setStats({ total: 0, verified: 0, unverified: 0, contacted: 0, pending: 0 });
    } catch (e) {
      console.error(e);
      addToast('Failed to clear database', 'error');
    }
  };

  const statsData = [
    { title: 'Global Nodes', value: stats.total, icon: '🏥', color: 'blue' },
    { title: 'Node Verified', value: stats.verified, icon: '✅', color: 'blue' },
    { title: 'Queueing', value: stats.unverified, icon: '⏳', color: 'orange' },
    { title: 'Success Rate', value: stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}%` : '0%', icon: '📊', color: 'blue' },
  ];

  const archivedClinics = clinics.filter(c => c.outreach_status === 'Contacted');

  return (
    <div className="min-h-screen relative text-white bg-[#0A0E14] overflow-x-hidden font-sans">
      
      {/* Grid Overlay background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[radial-gradient(rgba(46,119,174,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* Floating SaaS Toast Notification Panel */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full px-6 sm:px-0">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto p-4 rounded-xl border shadow-2xl flex items-center justify-between gap-3 text-[10px] font-black tracking-widest uppercase ${
                toast.type === 'success' 
                  ? 'bg-emerald-950/95 text-emerald-400 border-emerald-500/25' 
                  : toast.type === 'error'
                  ? 'bg-red-950/95 text-red-400 border-red-500/25'
                  : 'bg-slate-950/95 text-sky-400 border-sky-500/25'
              }`}
            >
              <span>{toast.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-white/40 hover:text-white cursor-pointer select-none text-xs focus:outline-none"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Slide-over Clinic Details Drawer */}
      <AnimatePresence>
        {selectedClinic && (
          <ClinicDrawer 
            clinic={selectedClinic} 
            onClose={() => setSelectedClinic(null)}
            onOutreachSuccess={(name) => {
              setClinics(prev => prev.map(c => c.name === name ? { ...c, outreach_status: 'Contacted' } : c));
              fetchData(activeFilter);
              addToast(`Outreach updated for ${name}`, 'success');
            }}
          />
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0E14]/95 backdrop-blur-md">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border-2 border-[#2E77AE]/10 border-t-[#2E77AE] animate-spin mx-auto mb-8 shadow-[0_0_30px_rgba(46,119,174,0.2)]" />
            <h3 className="text-xs font-black tracking-[8px] text-white uppercase animate-pulse">
              Initializing Grid
            </h3>
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="max-w-[1400px] w-full mx-auto px-6 py-10 md:px-12 md:py-16 flex-1">
          
          {/* Section Title */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-none text-white">
              Mission <span className="text-[#2E77AE]">{activeTab === 'archive' ? 'Archive' : activeTab === 'email_manage' ? 'Control' : 'Control'}.</span>
            </h1>
            <p className="text-[11px] text-white/30 font-black tracking-widest mt-4 uppercase">
              Orbital Intelligence & Outreach Grid
            </p>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Stats Card Grid (Fully Responsive) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {statsData.map((s, i) => <StatsCard key={i} {...s} index={i} />)}
              </div>

              {/* Two Column Layout: Stacks on mobile, splits on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10 items-start">
                <div className="min-w-0 flex flex-col gap-6">
                  <SearchForm onSearch={handleSearch} isLoading={loading} />

                  {/* Backend Status checker card */}
                  <div className="glass-panel p-8 border border-[#2E77AE]/15">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="text-3xl">🤖</div>
                      <div>
                        <h3 className="text-white text-xs font-black tracking-widest uppercase">AI Outreach Agent</h3>
                        <p className="text-white/30 text-[10px] font-semibold mt-0.5 uppercase tracking-wider">Protocol Uptime: 99.9% // Secure SMTP Active</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        addToast('Pinging API Server...', 'info');
                        axios.get(`${API_BASE_URL}/health`)
                          .then(res => {
                            addToast(`API Active. Database: ${res.data.database}.`, 'success');
                          })
                          .catch(e => {
                            addToast('Failed to ping API server', 'error');
                          });
                      }}
                      className="w-full py-3.5 bg-[#2E77AE]/10 hover:bg-[#2E77AE]/25 border border-[#2E77AE]/20 hover:border-[#2E77AE]/45 rounded-xl text-[#2E77AE] hover:text-white text-[11px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer"
                    >
                      Check Backend Health
                    </button>
                  </div>
                </div>

                {/* Activity Feed log panel */}
                <AgentActivityLog logs={logs} clinicCount={stats.total} verifiedCount={stats.verified} />
              </div>

              {/* Clinic Lead Grid Table */}
              <ClinicTable 
                clinics={clinics} 
                onExport={handleExport} 
                onAnalyze={handleAnalyze} 
                onOutreach={handleOutreach}
                isSending={sending}
                onClearAll={handleClearAll}
              />
            </>
          )}

          {activeTab === 'email_manage' && (
            <div className="flex flex-col gap-10">
              
              {/* Compact cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Total Emailed card */}
                <div className="glass-panel p-6 flex items-center gap-5">
                  <div className="text-3xl bg-[#2E77AE]/10 p-3 rounded-xl border border-[#2E77AE]/15">✉️</div>
                  <div>
                    <h4 className="text-white/40 text-[10px] font-black tracking-widest uppercase">Total Emailed</h4>
                    <p className="text-white text-2xl font-black mt-1 leading-none">{stats.contacted || 0}</p>
                  </div>
                </div>

                {/* Pending Outreach card */}
                <div className="glass-panel p-6 flex items-center gap-5">
                  <div className="text-3xl bg-[#FF8E2B]/10 p-3 rounded-xl border border-[#FF8E2B]/15">⏳</div>
                  <div>
                    <h4 className="text-white/40 text-[10px] font-black tracking-widest uppercase">Pending Outreach</h4>
                    <p className="text-[#FF8E2B] text-2xl font-black mt-1 leading-none">{stats.pending || 0}</p>
                  </div>
                </div>
              </div>

              {/* Grid: Editor + Sent Log List */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                
                {/* Template Editor */}
                <TemplateEditor template={globalTemplate} onSave={handleSaveTemplate} />
                
                {/* Sent List panel */}
                <div className="flex flex-col">
                  <div className="glass-panel p-8 mb-6 border border-[#2E77AE]/15">
                    <h3 className="text-white text-sm font-black tracking-widest uppercase mb-1">Outreach Logs</h3>
                    <p className="text-white/30 text-[10px] font-semibold tracking-wider uppercase">
                      Verified clinic nodes contacted successfully
                    </p>
                  </div>
                  <ClinicTable 
                    clinics={archivedClinics} 
                    onExport={handleExport} 
                    onAnalyze={handleAnalyze} 
                    onOutreach={handleOutreach}
                    isSending={sending}
                    onClearAll={handleClearAll}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer bar */}
          <footer className="mt-20 py-8 border-t border-white/5 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
            <span className="text-[10px] text-white/15 font-black tracking-widest uppercase">
              © 2026 CLINICFLOW // MISSION CONTROL UNIT
            </span>
            <div className="flex gap-6">
              {['PROTOCOL', 'ACCESS', 'SECURITY'].map(l => (
                <a key={l} href="#" className="text-[10px] text-white/15 hover:text-white/30 transition-colors text-decoration-none tracking-widest font-black">{l}</a>
              ))}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
