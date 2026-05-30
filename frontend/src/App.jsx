import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import StatsCard from './components/StatsCard';
import SearchForm from './components/SearchForm';
import ClinicTable from './components/ClinicTable';
import AgentActivityLog from './components/AgentActivityLog';

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

// Configure axios error interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    console.error('[API Error]', error);
    return Promise.reject(error);
  }
);

// Helper to parse subject and body from template
const parseTemplate = (text) => {
  const match = text.match(/^Subject:\s*(.*)\n\n([\s\S]*)$/i);
  if (match) {
    return { subject: match[1], body: match[2] };
  }
  return { subject: 'Strategic Partnership Inquiry', body: text };
};

// ── Overhauled Template Editor ─────────────────────────────
const TemplateEditor = ({ template, onSave }) => {
  const parsed = parseTemplate(template);
  const [subject, setSubject] = useState(parsed.subject);
  const [body, setBody] = useState(parsed.body);
  
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  // Sync state if saved protocol changes
  useEffect(() => {
    const updated = parseTemplate(template);
    setSubject(updated.subject);
    setBody(updated.body);
  }, [template]);

  const handleSave = () => {
    const fullTemplate = `Subject: ${subject}\n\n${body}`;
    onSave(fullTemplate);
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      alert('Please enter a recipient email address');
      return;
    }
    setTestingEmail(true);
    try {
      const fullTemplate = `Subject: ${subject}\n\n${body}`;
      const res = await axios.post(`${API_BASE_URL}/send-test-email`, {
        email: testEmail,
        template: fullTemplate
      });
      alert(res.data.message || 'Test email sent successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to send test email: ' + (e.response?.data?.error || e.message));
    } finally {
      setTestingEmail(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!prompt) return;
    setGenerating(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/generate-protocol`, { prompt });
      const updated = parseTemplate(res.data.template);
      setSubject(updated.subject);
      setBody(updated.body);
    } catch (e) {
      alert('AI Generation Failed - Check Backend');
    } finally {
      setGenerating(false);
    }
  };

  // Mock template optimization buttons
  const applyPreset = (type) => {
    if (type === 'professional') {
      setBody(prev => "Respected Administrative Officer,\n\n" + prev.replace(/^(Hello|Dear|Hi).*\n\n/i, ''));
    } else if (type === 'appointment') {
      setBody(prev => prev + "\n\nYou can schedule directly into our calendar here: https://clinicflow.ai/booking");
    }
  };

  return (
    <div className="glass-panel-heavy rounded-2xl overflow-hidden flex flex-col flex-1">
      {/* Header */}
      <div className="bg-surface-container-high px-6 py-4 flex items-center justify-between border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center ai-pulse">
            <span className="material-symbols-outlined text-sm text-on-primary font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <h4 className="font-headline-md text-sm font-bold text-primary">AI Template Director</h4>
        </div>
        <button 
          onClick={handleSave}
          className="px-4 py-1.5 bg-primary-container text-on-primary-container rounded-lg text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-xs">save</span>
          <span>Save Protocol</span>
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1 bg-surface-container-low/40">
        {/* Subject line input */}
        <div className="space-y-2">
          <label className="text-[10px] text-outline-variant uppercase tracking-widest font-bold block">Subject Line</label>
          <input
            type="text"
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl py-3 px-4 text-xs text-primary font-medium focus:outline-none focus:border-primary/50 transition-all font-sans"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* AI Writer Prompt */}
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-primary font-bold uppercase tracking-wider">🤖 AI Protocol Writer</p>
            {generating && <span className="text-[9px] text-secondary font-bold animate-pulse">GENERATING...</span>}
          </div>
          <div className="flex gap-2">
            <input 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. 'Short polite outreach template for dental clinics'..."
              className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-2 px-3 text-xs text-on-surface placeholder:text-outline-variant/50 focus:outline-none focus:border-primary/50 transition-all font-sans"
            />
            <button 
              onClick={handleAIGenerate}
              disabled={generating}
              className="px-3.5 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg text-xs font-bold text-primary transition-all cursor-pointer"
            >
              Generate
            </button>
          </div>
        </div>

        {/* SMTP Tester */}
        <div className="bg-secondary/5 border border-secondary/20 p-4 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">🧪 Send Test Email</p>
            {testingEmail && <span className="text-[9px] text-green-400 font-bold animate-pulse">TRANSMITTING...</span>}
          </div>
          <div className="flex gap-2">
            <input 
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter test recipient email address..."
              className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-2 px-3 text-xs text-on-surface placeholder:text-outline-variant/50 focus:outline-none focus:border-primary/50 transition-all font-sans"
            />
            <button 
              onClick={handleSendTest}
              disabled={testingEmail}
              className="px-3.5 py-2 bg-secondary/20 hover:bg-secondary/30 border border-secondary/30 rounded-lg text-xs font-bold text-secondary transition-all cursor-pointer"
            >
              Send Test
            </button>
          </div>
        </div>

        {/* Text editor body */}
        <div className="space-y-2">
          <label className="text-[10px] text-outline-variant uppercase tracking-widest font-bold block">
            Email Body 
            <span className="text-[9px] text-primary lowercase tracking-normal font-medium ml-2">
              (Use <code className="text-secondary">[Clinic Name]</code> for names placeholder)
            </span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full min-h-[220px] bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-xs text-on-surface leading-relaxed focus:outline-none focus:border-primary/50 transition-all font-sans"
            style={{ opacity: generating ? 0.5 : 1 }}
          />
        </div>

        {/* Help Actions */}
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={() => applyPreset('professional')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-secondary text-secondary text-[10px] font-bold hover:bg-secondary/10 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[12px]">edit</span>
            <span>Make Professional</span>
          </button>
          <button 
            onClick={() => applyPreset('appointment')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary text-primary text-[10px] font-bold hover:bg-primary/10 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[12px]">add</span>
            <span>Add Booking Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Shell ─────────────────────────────────────────────
export default function App() {
  const [clinics, setClinics] = useState([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, unverified: 0, contacted: 0, pending: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [sending, setSending] = useState(false);

  const [selectedClinic, setSelectedClinic] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalTemplate, setGlobalTemplate] = useState(`Subject: Strategic Partnership Inquiry | [Clinic Name]

Dear Administrative Team,

I hope this message finds you well. I am reaching out from ClinicFlow AI.

We've been closely analyzing clinical excellence in your region, and [Clinic Name] stands out as a leader in healthcare.

We would love to explore how ClinicFlow AI can help streamline your patient acquisition and operational efficiency. 

Would you be available for a brief 15-minute call this week?

Best regards,
ClinicFlow AI Team`);

  // Safetynet: loading timeout
  useEffect(() => {
    if (!loading) return;
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      console.warn('[Safety] Scanner loading reset');
    }, 15000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  const fetchData = async (filter) => {
    try {
      const params = filter || {};
      const [clinicsRes, statsRes, logsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/clinics`, { params }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/stats`, { params }).catch(() => ({ data: { total: 0, verified: 0, unverified: 0, contacted: 0, pending: 0 } })),
        axios.get(`${API_BASE_URL}/logs`).catch(() => ({ data: [] }))
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
    setMessage('');
    try {
      await axios.post(`${API_BASE_URL}/search`, query, { timeout: 10000 });
      setActiveFilter({ 
        city: query.city, 
        country: query.country, 
        specialization: query.specialization 
      });
      setMessage(`✅ DISCOVERY INITIATED: Scanning ${query.specialization.toUpperCase()} in ${query.city.toUpperCase()} via Google Maps API...`);
      setTimeout(() => setMessage(''), 10000);
    } catch (e) {
      console.error('[Search Error]', e);
      setMessage(`❌ ERROR: ${e.response?.data?.error || 'Discovery crawler launch failed.'}`);
      setTimeout(() => setMessage(''), 7000);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = (clinic) => {
    setSelectedClinic(clinic);
  };

  const handleOutreach = async () => {
    const clinicsWithEmail = clinics.filter(c => c.email && c.email.trim() !== '');
    if (!clinicsWithEmail.length) {
      setMessage('⚠️ WARNING: No clinics with verified email addresses found.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }
    
    setSending(true);
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < clinicsWithEmail.length; i++) {
      const clinic = clinicsWithEmail[i];
      setMessage(`⏳ Outreach progress: ${i + 1}/${clinicsWithEmail.length} transmitting to ${clinic.name}...`);
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
        failCount++;
      }
      
      // Update ui immediately
      setClinics(prev => prev.map(c => {
        if (c.name === clinic.name) {
          return { ...c, outreach_status: 'Contacted' };
        }
        return c;
      }));
    }
    
    setMessage(`✅ OUTREACH BATCH COMPLETE: Sent successfully: ${successCount}, Failed: ${failCount}`);
    setSending(false);
    setTimeout(() => fetchData(activeFilter), 1500);
    setTimeout(() => setMessage(''), 8000);
  };

  const handleExport = () => {
    if (!clinics.length) return;
    const headers = ['Name', 'Specialization', 'City', 'Country', 'Email', 'Phone', 'Website', 'Address'];
    const csvRows = clinics.map(c =>
      [c.name, c.specialization, c.city, c.country, c.email, c.phone, c.website, c.address]
        .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = "\uFEFF" + headers.join(',') + '\n' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clinicflow_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const dashboardStats = [
    { 
      title: 'Clinics Found', 
      value: stats.total, 
      icon: 'local_hospital', 
      color: 'primary', 
      trend: '+12% ↑', 
      sparklinePath: 'M0 25 Q 10 5, 20 20 T 40 10 T 60 25 T 80 5 T 100 15' 
    },
    { 
      title: 'Verified Emails', 
      value: stats.verified, 
      icon: 'alternate_email', 
      color: 'secondary', 
      trend: '+5.2% ↑', 
      sparklinePath: 'M0 15 Q 20 25, 40 5 T 70 20 T 100 10' 
    },
    { 
      title: 'Outreach Success', 
      value: stats.contacted || 0, 
      icon: 'forum', 
      color: 'primary', 
      trend: '+18% ↑', 
      sparklinePath: 'M0 28 L 20 18 L 40 22 L 60 5 L 80 15 L 100 2' 
    },
    { 
      title: 'AI Automation Score', 
      value: stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}%` : '94.2%', 
      icon: 'bolt', 
      color: 'secondary-container', 
      trend: '98/100', 
      isProgress: true, 
      progressVal: stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 94.2 
    },
  ];

  // Campaigns specific stats metrics
  const campaignStats = [
    { title: 'Open Rate', value: '68.2%', icon: 'mail', color: 'primary', trend: '+12.5%' },
    { title: 'Reply Rate', value: '24.7%', icon: 'chat_bubble', color: 'secondary', trend: '+4.2%' },
    { title: 'Total Outreach', value: stats.contacted || 0, icon: 'group', color: 'primary', trend: '+8.1%' },
    { title: 'Bounce Rate', value: '1.4%', icon: 'block', color: 'secondary-container', trend: '-2.0%' },
  ];

  const contactedClinicsOnly = clinics.filter(c => c.outreach_status === 'Contacted');

  return (
    <div className="min-h-screen relative bg-background text-on-surface">
      {/* Particle background grid overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: 'radial-gradient(rgba(46, 119, 174, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      {/* Loading scanner screen overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/90 backdrop-blur-2xl">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full border-2 border-primary/10 border-t-primary animate-spin mx-auto shadow-[0_0_30px_rgba(46,119,174,0.3)]" />
            <h3 className="text-xs uppercase font-extrabold tracking-[0.3em] text-primary">Initializing Scraper Grid...</h3>
          </div>
        </div>
      )}

      {/* Main Grid structure shifted right on desktop for Sidebar */}
      <div className="relative z-10 flex">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 md:ml-64 min-h-screen flex flex-col pb-20 md:pb-10">
          {/* Top Header */}
          <header className="bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 sticky top-0 z-30 shadow-sm flex justify-between items-center w-full px-6 md:px-10 py-4">
            <div className="flex items-center gap-8 w-full max-w-xl">
              <h2 className="font-headline-lg text-lg font-bold text-primary uppercase hidden md:block">
                {activeTab === 'dashboard' ? 'Overview Studio' : activeTab === 'discovery' ? 'Discovery Unit' : 'Campaign Control'}
              </h2>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant/80 text-sm">search</span>
                <input 
                  type="text" 
                  placeholder="Query clinics, specialties, NPI numbers..." 
                  className="w-full bg-surface-container-highest/20 border border-outline-variant/30 rounded-full pl-9 pr-4 py-2 text-xs text-on-surface placeholder:text-outline-variant/50 focus:outline-none focus:border-primary/50 transition-all font-sans"
                  value={activeFilter?.city || ''}
                  onChange={(e) => setActiveFilter({ ...activeFilter, city: e.target.value })}
                />
              </div>
            </div>

            {/* Profile alerts controls */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-lg">notifications</span>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full border border-background" />
                </button>
                <button 
                  onClick={() => {
                    setMessage('🔍 Triggering instant backend health checks...');
                    axios.get(`${API_BASE_URL}/health`)
                      .then(res => {
                        setMessage(`✅ System checks passed: Database ${res.data.database}, ${res.data.clinics_count} active entries loaded.`);
                        setTimeout(() => setMessage(''), 6000);
                      })
                      .catch(e => {
                        setMessage(`❌ Backend node error: ${e.message}`);
                        setTimeout(() => setMessage(''), 6000);
                      });
                  }}
                  className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                </button>
              </div>

              {/* Vertical line divider */}
              <div className="w-[1px] h-6 bg-outline-variant/15 hidden sm:block" />

              {/* Doctor Sarah Profile block */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-on-surface leading-none">Dr. Sarah Chen</p>
                  <p className="text-[9px] text-on-surface-variant uppercase tracking-wider font-semibold mt-0.5">Admin</p>
                </div>
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQsbP1RplTxSgz_GNj_aOqGMn_hxYpWDc7PtguJ927xU-fGbs8lY13QP7flQSUTQXBznN8_Stvpsj0k-f0k_c4ROyUWNvjv1wPtxH3QKpcCxA49RTYjGXHynIqwEZUaauB0MPOqwswMYuVQ6BWIF_1O7Q90z2OUPG3ilnV0jvc7oii8uJmqEoSIxTcRlyrI1S-jcGa3jv2kcvg-l5ya-nUxdc-rGyJn25SoguVl4BOL2-nUtP2EhP_rTiUajjEiZqm_BZmr5q-pEA"
                  alt="Administrator profile picture" 
                  className="w-9 h-9 rounded-full border-2 border-primary/20 object-cover" 
                />
              </div>
            </div>
          </header>

          {/* Main workspace container canvas */}
          <div className="px-6 md:px-10 py-8 flex-1 flex flex-col gap-6 max-w-[1440px] mx-auto w-full">
            {/* Outreach progressive banner alert */}
            {message && (
              <div className="glass-panel px-6 py-4 animate-fade-slide-in flex items-center gap-3 bg-surface-container-highest/20 border-primary/20">
                <span className="material-symbols-outlined text-primary font-bold animate-pulse">info</span>
                <p className="text-xs font-bold tracking-wide text-primary-container uppercase">{message}</p>
              </div>
            )}

            {/* Selected clinic analysis modal display panel */}
            {selectedClinic && (
              <div className="glass-panel-heavy p-6 rounded-2xl animate-fade-slide-in relative border-primary/30 shadow-lg space-y-4">
                <button 
                  onClick={() => setSelectedClinic(null)}
                  className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface text-lg cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-xl border border-primary/20">
                    {selectedClinic.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-headline-md font-bold text-on-surface">{selectedClinic.name}</h3>
                    <p className="text-xs text-on-surface-variant">📍 {selectedClinic.address || `${selectedClinic.city}, ${selectedClinic.country}`}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-surface-container-low/40 rounded-xl border border-outline-variant/10 text-xs">
                  <div>
                    <p className="text-outline font-semibold uppercase text-[9px]">Specialization</p>
                    <p className="font-bold text-on-surface mt-1 uppercase">{selectedClinic.specialization || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-outline font-semibold uppercase text-[9px]">Verification Status</p>
                    <p className="font-bold text-green-400 mt-1 uppercase">{selectedClinic.status || 'Verified'}</p>
                  </div>
                  <div>
                    <p className="text-outline font-semibold uppercase text-[9px]">Phone Node</p>
                    <p className="font-bold text-on-surface mt-1">{selectedClinic.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-outline font-semibold uppercase text-[9px]">Email Node</p>
                    <p className="font-bold text-primary hover:underline mt-1">{selectedClinic.email || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB VIEW 1: Overview */}
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-12 gap-6">
                {/* Stats cards list container */}
                <div className="col-span-12 lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                  {dashboardStats.map((card, i) => (
                    <StatsCard key={i} index={i} {...card} />
                  ))}
                </div>

                {/* Agent Activity Live Timeline (FlowAI sidebar right) */}
                <div className="col-span-12 lg:col-span-3 lg:row-span-2">
                  <AgentActivityLog logs={logs} clinicCount={stats.total} verifiedCount={stats.verified} />
                </div>

                {/* Central content row: Campaign charts and active timeline */}
                <div className="col-span-12 lg:col-span-9 grid grid-cols-12 gap-6">
                  {/* Performance Chart Mockup */}
                  <div className="col-span-12 xl:col-span-8 glass-card rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-sm text-on-surface uppercase tracking-wider font-headline-md">Campaign Velocity</h3>
                        <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Aggregated outreach conversion ratios over 30 days</p>
                      </div>
                      <select className="bg-surface-container-high border-none rounded-lg text-[10px] font-bold text-on-surface focus:ring-1 focus:ring-primary py-1.5 px-3">
                        <option>Last 30 Days</option>
                        <option>Last 7 Days</option>
                      </select>
                    </div>

                    {/* Chart columns display mockup */}
                    <div className="h-64 flex items-end justify-between gap-3 relative pb-2 px-2">
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2">
                        <div className="border-t border-outline-variant/10 w-full h-0" />
                        <div className="border-t border-outline-variant/10 w-full h-0" />
                        <div className="border-t border-outline-variant/10 w-full h-0" />
                        <div className="border-t border-outline-variant/10 w-full h-0" />
                      </div>
                      {/* Bars */}
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[40%] transition-all relative group cursor-pointer" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[55%] transition-all cursor-pointer" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[35%] transition-all cursor-pointer" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[70%] transition-all cursor-pointer" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[85%] transition-all cursor-pointer" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[60%] transition-all cursor-pointer" />
                      <div className="flex-1 bg-secondary/35 hover:bg-secondary/55 rounded-t-lg h-[95%] transition-all cursor-pointer border-t border-secondary" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[75%] transition-all cursor-pointer" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[65%] transition-all cursor-pointer" />
                      <div className="flex-1 bg-primary/20 hover:bg-primary/45 rounded-t-lg h-[50%] transition-all cursor-pointer" />
                    </div>
                  </div>

                  {/* Workflow Activity status timeline list */}
                  <div className="col-span-12 xl:col-span-4 glass-card rounded-2xl p-6 flex flex-col justify-between">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-primary text-sm">dynamic_feed</span>
                      <span>Workflow Events</span>
                    </h3>
                    
                    <div className="space-y-4 relative flex-1 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/10">
                      <div className="relative pl-8">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center border border-primary/30 z-10">
                          <span className="material-symbols-outlined text-[10px] text-primary">mail</span>
                        </div>
                        <p className="text-xs font-bold">Email Blast transmitted</p>
                        <p className="text-[10px] text-on-surface-variant opacity-80 mt-0.5">Cardio leads • 2 mins ago</p>
                      </div>
                      <div className="relative pl-8">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center border border-secondary/30 z-10">
                          <span className="material-symbols-outlined text-[10px] text-secondary">verified</span>
                        </div>
                        <p className="text-xs font-bold">AI leads enrichment complete</p>
                        <p className="text-[10px] text-on-surface-variant opacity-80 mt-0.5">84 verified • 15 mins ago</p>
                      </div>
                      <div className="relative pl-8 opacity-65">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/30 z-10">
                          <span className="material-symbols-outlined text-[10px] text-outline">sync</span>
                        </div>
                        <p className="text-xs font-bold">Database system sync</p>
                        <p className="text-[10px] text-on-surface-variant opacity-80 mt-0.5">Scheduled for 04:00 AM PST</p>
                      </div>
                    </div>
                  </div>

                  {/* Leads Data Table (All Clinics) */}
                  <div className="col-span-12">
                    <ClinicTable 
                      clinics={clinics} 
                      onExport={handleExport} 
                      onAnalyze={handleAnalyze} 
                      onOutreach={handleOutreach}
                      isSending={sending}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB VIEW 2: Discovery scanner controls */}
            {activeTab === 'discovery' && (
              <div className="space-y-6">
                {/* AI Recommendations Bento Header Section */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left priority card */}
                  <div className="lg:col-span-2 glass-card rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                      <div>
                        <h2 className="font-headline-lg text-md font-bold text-on-surface flex items-center gap-2">
                          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                          <span>High-Value Lead Recommendations</span>
                        </h2>
                        <p className="text-xs text-on-surface-variant/80 mt-0.5">AI generated top matching clinics in scanner grids</p>
                      </div>
                      <span className="bg-secondary-container/20 text-secondary border border-secondary/30 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider">AI Insight Active</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                      <div className="glass-card bg-surface-container-highest/20 p-4 rounded-xl border-l-4 border-secondary transition-all hover:scale-[1.01] cursor-pointer">
                        <div className="flex justify-between mb-1 text-xs">
                          <span className="font-bold text-primary">Priority Target Alpha</span>
                          <span className="text-secondary font-bold">98% match</span>
                        </div>
                        <p className="font-bold text-on-surface text-sm">Summit Medical Group</p>
                        <p className="text-[10px] text-on-surface-variant mt-1">12 providers • High conversion potential</p>
                      </div>
                      <div className="glass-card bg-surface-container-highest/20 p-4 rounded-xl border-l-4 border-secondary transition-all hover:scale-[1.01] cursor-pointer">
                        <div className="flex justify-between mb-1 text-xs">
                          <span className="font-bold text-primary">Priority Target Beta</span>
                          <span className="text-secondary font-bold">94% match</span>
                        </div>
                        <p className="font-bold text-on-surface text-sm">Oak Ridge Pediatric Center</p>
                        <p className="text-[10px] text-on-surface-variant mt-1">8 providers • Active expansion phase</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Discovery Stats box */}
                  <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60 mb-4">Discovery Metrics</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-end border-b border-outline-variant/10 pb-2">
                          <span className="text-xs text-on-surface-variant/80">Identified Leads</span>
                          <span className="text-3xl font-bold font-headline-md leading-none text-on-surface">{stats.total}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-outline-variant/10 pb-2">
                          <span className="text-xs text-on-surface-variant/80">Email Extraction</span>
                          <span className="text-2xl font-bold font-headline-md leading-none text-primary">
                            {stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}%` : '92%'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => alert('Search filters can be fine-tuned via the scanner input fields.')}
                      className="w-full py-2.5 bg-surface-container-highest border border-outline-variant/30 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-bright/50 transition-all mt-4 cursor-pointer"
                    >
                      Advanced Configuration
                    </button>
                  </div>
                </section>

                {/* Discovery Scanner controls form */}
                <SearchForm onSearch={handleSearch} isLoading={loading} />

                {/* Discovered clinics data table */}
                <ClinicTable 
                  clinics={clinics} 
                  onExport={handleExport} 
                  onAnalyze={handleAnalyze} 
                  onOutreach={handleOutreach}
                  isSending={sending}
                />
              </div>
            )}

            {/* TAB VIEW 3: Campaigns Outreach studio */}
            {activeTab === 'campaigns' && (
              <div className="space-y-6">
                {/* Campaign stats row at top */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {campaignStats.map((stat, i) => (
                    <div key={i} className="glass-panel p-6 rounded-2xl group hover:border-primary/30 transition-all flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg ${stat.color === 'primary' ? 'bg-primary/10 text-primary' : stat.color === 'secondary' ? 'bg-secondary/10 text-secondary' : 'bg-secondary-container/10 text-secondary-container'}`}>
                          <span className="material-symbols-outlined text-sm">{stat.icon}</span>
                        </div>
                        <span className={`text-[10px] font-bold ${stat.color === 'primary' ? 'text-primary' : 'text-secondary'}`}>{stat.trend}</span>
                      </div>
                      <div>
                        <p className="text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold">{stat.title}</p>
                        <h3 className="text-2xl font-bold font-headline-md text-on-surface mt-1">{stat.value}</h3>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Workspace grid: template editor left, stats chart right */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left column template editor + list */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    <TemplateEditor 
                      template={globalTemplate} 
                      onSave={(val) => {
                        setGlobalTemplate(val);
                        setMessage('✅ Outreach communication protocol template updated successfully.');
                        setTimeout(() => setMessage(''), 6000);
                      }} 
                    />

                    {/* Contact segmentation table (Contacted vault) */}
                    <div>
                      <div className="px-1.5 mb-2.5">
                        <h4 className="font-bold text-sm text-on-surface uppercase tracking-wider">Active Segment: Discovered Leads Outreach Queue</h4>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">Showing contacted clinics active in outreach sequences</p>
                      </div>
                      <ClinicTable 
                        clinics={contactedClinicsOnly} 
                        onExport={handleExport} 
                        onAnalyze={handleAnalyze} 
                        onOutreach={handleOutreach}
                        isSending={sending}
                      />
                    </div>
                  </div>

                  {/* Right column chart + AI strategy insights */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Performance chart card */}
                    <div className="glass-panel p-6 rounded-2xl flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="font-bold text-sm uppercase tracking-wider text-on-surface font-headline-md">Conversion Rate</h4>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">Transmission success metrics per hour</p>
                        </div>
                        <div className="bg-surface-container-high rounded-lg p-0.5 flex">
                          <button className="px-2.5 py-1 bg-surface-bright rounded text-[9px] text-primary font-bold">24H</button>
                          <button className="px-2.5 py-1 text-[9px] text-outline font-bold">7D</button>
                        </div>
                      </div>

                      {/* Mock Chart element */}
                      <div className="h-64 relative flex items-end gap-2.5 pb-2">
                        <div className="w-full h-full flex items-end justify-between gap-1.5 px-2">
                          <div className="flex-1 bg-primary/20 rounded-t-sm h-[30%]" />
                          <div className="flex-1 bg-primary/30 rounded-t-sm h-[45%]" />
                          <div className="flex-1 bg-primary/45 rounded-t-sm h-[35%]" />
                          <div className="flex-1 bg-secondary rounded-t-sm h-[85%] ai-glow" />
                          <div className="flex-1 bg-primary/50 rounded-t-sm h-[60%]" />
                          <div className="flex-1 bg-primary/65 rounded-t-sm h-[75%]" />
                          <div className="flex-1 bg-primary/40 rounded-t-sm h-[50%]" />
                        </div>
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2">
                          <div className="border-t border-outline-variant/10 w-full" />
                          <div className="border-t border-outline-variant/10 w-full" />
                          <div className="border-t border-outline-variant/10 w-full" />
                        </div>
                      </div>

                      {/* Metadata descriptions */}
                      <div className="space-y-3.5 pt-5 border-t border-outline-variant/10 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2 text-on-surface-variant">
                            <span className="w-2 h-2 rounded-full bg-secondary" /> 
                            <span>Peak Response</span>
                          </span>
                          <span className="font-bold text-on-surface">14:00 - 16:00</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2 text-on-surface-variant">
                            <span className="w-2 h-2 rounded-full bg-primary" /> 
                            <span>Average Conversion</span>
                          </span>
                          <span className="font-bold text-on-surface">28.4%</span>
                        </div>
                      </div>
                    </div>

                    {/* AI strategy card */}
                    <div className="glass-panel p-6 rounded-2xl space-y-4 overflow-hidden relative border-primary/20">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                      <h4 className="font-bold text-sm uppercase text-on-surface flex items-center gap-2 font-headline-md">
                        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
                        <span>Outreach Strategy Insight</span>
                      </h4>
                      <p className="text-xs text-on-surface-variant/90 leading-relaxed">
                        Data metrics analysis indicates your segment responds 2.5x faster to emails transmitted on Tuesday mornings before 10:00 AM local time.
                      </p>
                      <button 
                        onClick={() => alert('Strategy settings synchronized. Outbox scheduled queue updated.')}
                        className="w-full py-2.5 bg-surface-bright hover:bg-surface-variant border border-outline-variant/30 rounded-xl text-primary text-xs font-bold transition-all cursor-pointer"
                      >
                        Apply Campaign Strategy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer controls */}
          <footer className="bg-surface-container-lowest border-t border-outline-variant/10 py-6 mt-12">
            <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-10 w-full max-w-[1440px] mx-auto gap-4">
              <div className="flex items-center gap-4 text-xs">
                <span className="font-bold text-primary font-headline-md uppercase tracking-wider">ClinicFlow AI</span>
                <span className="text-on-surface-variant opacity-60">© 2026 Precise Healthcare Automation. All rights reserved.</span>
              </div>
              <div className="flex gap-6 text-[10px] font-bold text-outline uppercase tracking-wider">
                <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-primary transition-colors">Security Vault</a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
