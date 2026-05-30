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
  const [val, setVal] = useState(template);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  const handleSendTest = async () => {
    if (!testEmail) {
      alert('Please enter a recipient email address');
      return;
    }
    setTestingEmail(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/send-test-email`, {
        email: testEmail,
        template: val
      });
      alert(res.data.message || 'Test email sent successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to send test email: ' + (e.response?.data?.error || e.message));
    } finally {
      setTestingEmail(false);
    }
  };

  // Keep local state in sync with saved protocol
  useEffect(() => {
    setVal(template);
  }, [template]);

  const handleAIGenerate = async () => {
    if (!prompt) return;
    setGenerating(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/generate-protocol`, { prompt });
      setVal(res.data.template);
      console.log("AI Generation Successful");
    } catch (e) {
      alert('AI Generation Failed - Check Backend');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '40px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Global Protocol Editor</h2>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Configure your AI Agent's Default Message
          </p>
        </div>
        <button onClick={() => onSave(val)} className="glow-btn" style={{
          padding: '12px 32px', background: '#2E77AE', border: 'none', borderRadius: '12px',
          color: '#fff', fontWeight: 800, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '2px'
        }}>💾 Save Protocol</button>
      </div>

      {/* AI Writer Tool */}
      <div style={{ 
        background: 'rgba(46,119,174,0.05)', border: '1px solid rgba(46,119,174,0.15)',
        padding: '20px', borderRadius: '16px', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', color: '#4a9fd4', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
            🤖 AI Protocol Writer
          </p>
          {generating && <span style={{ fontSize: '10px', color: '#FF8E2B', fontWeight: 800, animation: 'pulse 1s infinite' }}>SYNTHESIZING NEW PROTOCOL...</span>}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your goal (e.g. 'friendly dental email')..."
            style={{
              flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '13px', outline: 'none'
            }}
          />
          <button 
            onClick={handleAIGenerate}
            disabled={generating}
            style={{
              padding: '10px 20px', background: generating ? 'rgba(255,255,255,0.1)' : 'rgba(46,119,174,0.2)', 
              border: '1px solid rgba(46,119,174,0.3)',
              borderRadius: '10px', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              transition: 'all 0.2s', textTransform: 'uppercase'
            }}
          >
            {generating ? '⌛ Thinking...' : 'Email Generate'}
          </button>
        </div>
      </div>

      {/* Test Email Tool */}
      <div style={{ 
        background: 'rgba(255,142,43,0.05)', border: '1px solid rgba(255,142,43,0.15)',
        padding: '20px', borderRadius: '16px', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', color: '#FF8E2B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
            🧪 Send Test Email
          </p>
          {testingEmail && <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 800, animation: 'pulse 1s infinite' }}>SENDING TEST...</span>}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter recipient email (e.g. your_email@gmail.com)..."
            style={{
              flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '13px', outline: 'none'
            }}
          />
          <button 
            onClick={handleSendTest}
            disabled={testingEmail}
            style={{
              padding: '10px 20px', background: testingEmail ? 'rgba(255,255,255,0.1)' : 'rgba(255,142,43,0.2)', 
              border: '1px solid rgba(255,142,43,0.3)',
              borderRadius: '10px', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              transition: 'all 0.2s', textTransform: 'uppercase'
            }}
          >
            {testingEmail ? '⌛ Sending...' : 'Send Test'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: '#2E77AE', fontWeight: 700, marginBottom: '12px' }}>
        💡 TIP: Use <code style={{ color: '#FF8E2B' }}>[Clinic Name]</code> as a placeholder for the clinic's name.
      </p>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        style={{
          width: '100%', minHeight: '300px', background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
          padding: '24px', color: '#fff', fontSize: '14px', lineHeight: '1.8', outline: 'none',
          opacity: generating ? 0.5 : 1, transition: 'opacity 0.3s'
        }}
      />
    </div>
  );
};

// ── Main App ─────────────────────────────────────────────
export default function App() {
  const [clinics, setClinics] = useState([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, unverified: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [sending, setSending] = useState(false);

  // Safety net: loading can NEVER be stuck for more than 15 seconds
  useEffect(() => {
    if (!loading) return;
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      console.warn('[Safety] Loading timeout — forcing reset');
    }, 15000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalTemplate, setGlobalTemplate] = useState(`Subject: Strategic Partnership Inquiry | [Clinic Name]

Dear Administrative Team,

I hope this message finds you well. I am reaching out from ClinicFlow AI on behalf of our healthcare outreach division.

We've been closely analyzing clinical excellence in your region, and [Clinic Name] stands out as a leader in patient care and medical innovation.

We would love to explore how ClinicFlow AI can help streamline your patient acquisition and operational efficiency. 

Would you be available for a brief 15-minute call this week?

Best regards,
Himanshu Shakya
ClinicFlow AI | Lead Developer`);

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
      
      // Ensure data is arrays/objects
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
      const response = await axios.post(`${API_BASE_URL}/search`, {
        ...query,
        template: globalTemplate
      }, { timeout: 10000 });
      
      // Set the filter to show results from this search
      setActiveFilter({ 
        city: query.city, 
        country: query.country, 
        specialization: query.specialization 
      });
      
      setMessage(`✅ DISCOVERY INITIATED: ${query.specialization.toUpperCase()} in ${query.city.toUpperCase()}. Scanning Google Maps... Please wait.`);
      
      // Auto-refresh data after a short delay to show initial results
      setTimeout(() => {
        fetchData({ 
          city: query.city, 
          specialization: query.specialization 
        });
      }, 3000);
      
      // Clear message after delay
      setTimeout(() => setMessage(''), 12000);
    } catch (e) {
      console.error('[Search Error]', e);
      setMessage(`❌ ERROR: ${e.response?.data?.error || 'Failed to initiate discovery. Check backend connection.'}`);
      setTimeout(() => setMessage(''), 8000);
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
      setMessage('⚠️ WARNING: No clinics with email addresses found.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }
    
    setSending(true);
    let successCount = 0;
    let failCount = 0;
    
    // Loop through each clinic and send email individually
    for (let i = 0; i < clinicsWithEmail.length; i++) {
      const clinic = clinicsWithEmail[i];
      const progressMessage = `⏳ Sending email ${i + 1}/${clinicsWithEmail.length} to ${clinic.name}...`;
      setMessage(progressMessage);
      
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
        console.error(`Error sending to ${clinic.name}:`, e);
        failCount++;
      }
      
      // Update local state to show "Contacted" immediately in the UI grid
      setClinics(prev => prev.map(c => {
        if (c.name === clinic.name) {
          return { ...c, outreach_status: 'Contacted' };
        }
        return c;
      }));
    }
    
    setMessage(`✅ SUCCESS: Bulk email outreach completed. Sent: ${successCount}, Failed: ${failCount}`);
    setSending(false);
    
    // Refresh database sync after a short delay
    setTimeout(() => {
      fetchData(activeFilter);
    }, 2000);
    
    setTimeout(() => setMessage(''), 10000);
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
    
    // Add UTF-8 BOM for Excel compatibility
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
  };

  const statsData = [
    { title: 'Global Nodes', value: stats.total, icon: '🏥', color: 'blue' },
    { title: 'Node Verified', value: stats.verified, icon: '✅', color: 'blue' },
    { title: 'Queueing', value: stats.unverified, icon: '⏳', color: 'orange' },
    { title: 'Success Rate', value: stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}%` : '0%', icon: '📊', color: 'blue' },
  ];

  // Logic for Archive view (Contacted only)
  const archivedClinics = clinics.filter(c => c.outreach_status === 'Contacted');

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>

      {/* Grid Overlay */}
      <div style={{ 
        position: 'fixed', inset: 0, 
        backgroundImage: 'radial-gradient(rgba(46, 119, 174, 0.05) 1px, transparent 1px)', 
        backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 
      }} />

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,20,0.95)', backdropFilter: 'blur(30px)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '50%',
              border: '2px solid rgba(46,119,174,0.1)',
              borderTop: '2px solid #2E77AE',
              animation: 'spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              margin: '0 auto 32px',
              boxShadow: '0 0 30px rgba(46, 119, 174, 0.2)'
            }} />
            <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#fff', letterSpacing: '8px', textTransform: 'uppercase' }}>
              Initializing Grid
            </h3>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

        <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px' }}>

          <div style={{ marginBottom: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: '64px', fontWeight: 900, color: '#fff', letterSpacing: '-3px', lineHeight: 0.9 }}>
                Mission <span style={{ color: '#2E77AE' }}>{activeTab === 'archive' ? 'Archive' : activeTab === 'discovery' ? 'Discovery' : 'Control'}.</span>
              </h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, marginTop: '16px', textTransform: 'uppercase', letterSpacing: '4px' }}>
                Orbital Intelligence & Outreach Grid
              </p>
            </div>
          </div>

          {message && (
            <div className="glass-panel" style={{
              padding: '20px 32px', marginBottom: '32px',
              background: message.includes('✅') ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
              border: `1px solid ${message.includes('✅') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: message.includes('✅') ? '#4ade80' : '#ffb4ab',
              fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px'
            }}>
              {message}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                {statsData.map((s, i) => <StatsCard key={i} {...s} index={i} />)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px', alignItems: 'start' }}>
                <div style={{ minWidth: 0 }}>
                  <SearchForm onSearch={handleSearch} isLoading={loading} />

                  <div className="glass-panel" style={{
                    padding: '32px', border: '1px solid rgba(46,119,174,0.15)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ fontSize: '28px' }}>🤖</div>
                      <div>
                        <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>AI Outreach Agent</h3>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 600 }}>Protocol Uptime: 99.9% // Secure SMTP Active</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setMessage('🔍 Checking backend health...');
                        axios.get(`${API_BASE_URL}/health`)
                          .then(res => {
                            setMessage(`✅ BACKEND HEALTHY: Database ${res.data.database}, ${res.data.clinics_count} clinics loaded`);
                            setTimeout(() => setMessage(''), 5000);
                          })
                          .catch(e => {
                            setMessage(`❌ BACKEND ERROR: ${e.message}`);
                            setTimeout(() => setMessage(''), 5000);
                          });
                      }}
                      className="glow-btn"
                      style={{
                        width: '100%', padding: '14px', 
                        background: 'rgba(46,119,174,0.1)', border: '1px solid rgba(46,119,174,0.2)',
                        borderRadius: '10px', color: '#2E77AE', fontSize: '11px',
                        fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s',
                        textTransform: 'uppercase', letterSpacing: '2px'
                      }}
                    >
                      Check Backend Health
                    </button>
                  </div>
                </div>

                <AgentActivityLog logs={logs} clinicCount={stats.total} verifiedCount={stats.verified} />

              </div>

              <ClinicTable 
                clinics={clinics} 
                onExport={handleExport} 
                onAnalyze={handleAnalyze} 
                onOutreach={handleOutreach}
                isSending={sending}
              />
            </>
          )}

          {activeTab === 'discovery' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <SearchForm onSearch={handleSearch} isLoading={loading} />
                <TemplateEditor template={globalTemplate} onSave={(val) => {
                  setGlobalTemplate(val);
                  setMessage('✅ GLOBAL OUTREACH PROTOCOL UPDATED');
                  setTimeout(() => setMessage(''), 5000);
                }} />
              </div>
              <ClinicTable 
                clinics={clinics} 
                onExport={handleExport} 
                onAnalyze={handleAnalyze} 
                onOutreach={handleOutreach}
                isSending={sending}
              />
            </div>
          )}

          {activeTab === 'archive' && (
            <div>
              <div className="glass-panel" style={{ padding: '32px', marginBottom: '40px', border: '1px solid rgba(46,119,174,0.2)' }}>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>ARCHIVE VAULT</h3>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Showing all clinical nodes successfully contacted by the AI agent.</p>
              </div>
              <ClinicTable 
                clinics={archivedClinics} 
                onExport={handleExport} 
                onAnalyze={handleAnalyze} 
                onOutreach={handleOutreach}
                isSending={sending}
              />
            </div>
          )}


          <footer style={{
            marginTop: '100px', padding: '40px 0',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px' }}>
              © 2026 CLINICFLOW // MISSION CONTROL UNIT
            </span>
            <div style={{ display: 'flex', gap: '32px' }}>
              {['PROTOCOL', 'ACCESS', 'SECURITY'].map(l => (
                <a key={l} href="#" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800 }}>{l}</a>
              ))}
            </div>
          </footer>
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
