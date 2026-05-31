import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, Globe, MapPin, Calendar, Send, Copy, Check } from 'lucide-react';
import axios from 'axios';

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

const ClinicDrawer = ({ clinic, onClose, onOutreachSuccess }) => {
  const [copiedField, setCopiedField] = useState(null);
  const [sending, setSending] = useState(false);
  const [outreachResult, setOutreachResult] = useState('');

  if (!clinic) return null;

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSingleOutreach = async () => {
    setSending(true);
    setOutreachResult('⏳ Launching direct SMTP relay...');
    try {
      const res = await axios.post(`${API_BASE_URL}/outreach`, {
        clinic_names: [clinic.name],
        template: localStorage.getItem('outreach_template') || ''
      });
      if (res.data.contacted > 0) {
        setOutreachResult('🚀 OUTREACH SENT SUCCESSFULLY!');
        if (onOutreachSuccess) onOutreachSuccess(clinic.name);
      } else {
        setOutreachResult('❌ OUTREACH FAILED: ' + (res.data.message || 'Check connection'));
      }
    } catch (e) {
      console.error(e);
      setOutreachResult('❌ ERROR: ' + (e.response?.data?.error || e.message));
    } finally {
      setSending(false);
      setTimeout(() => setOutreachResult(''), 5000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(5, 8, 12, 0.85)',
        backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end'
      }}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '500px', height: '100%',
          background: 'linear-gradient(180deg, #121620 0%, #0A0D14 100%)',
          borderLeft: '1px solid rgba(46, 119, 174, 0.25)',
          padding: '40px 32px', display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.6)', overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '10px', fontWeight: 900, color: '#2E77AE', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Node Analysis
          </span>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '50%', width: '36px', height: '36px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Title Node info */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(46,119,174,0.25), rgba(46,119,174,0.05))',
            border: '1px solid rgba(46,119,174,0.35)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '24px',
            fontWeight: 900, color: '#4a9fd4', marginBottom: '20px'
          }}>
            {clinic.name?.charAt(0) || '?'}
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1.2 }}>
            {clinic.name}
          </h2>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: 800,
              background: 'rgba(46,119,174,0.15)', color: '#4a9fd4',
              border: '1px solid rgba(46,119,174,0.25)', textTransform: 'uppercase', letterSpacing: '1px'
            }}>
              {clinic.specialization || 'General'}
            </span>
            <span style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: 800,
              background: clinic.status === 'Verified' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
              color: clinic.status === 'Verified' ? '#4ade80' : '#facc15',
              border: `1px solid ${clinic.status === 'Verified' ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
              textTransform: 'uppercase', letterSpacing: '1px'
            }}>
              {clinic.status === 'Verified' ? 'Verified' : 'Processing'}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
          
          {/* Email Row */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Mail size={12} /> Email Address
              </div>
              {clinic.email && (
                <button 
                  onClick={() => copyToClipboard(clinic.email, 'email')}
                  style={{ background: 'transparent', border: 'none', color: '#2E77AE', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 800 }}
                >
                  {copiedField === 'email' ? <Check size={10} color="#4ade80" /> : <Copy size={10} />}
                  {copiedField === 'email' ? 'COPIED' : 'COPY'}
                </button>
              )}
            </div>
            <p style={{ color: clinic.email ? '#fff' : 'rgba(255,255,255,0.2)', fontSize: '14px', fontWeight: 600, wordBreak: 'break-all' }}>
              {clinic.email || 'No email detected'}
            </p>
          </div>

          {/* Phone Row */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Phone size={12} /> Phone Number
              </div>
              {clinic.phone && (
                <button 
                  onClick={() => copyToClipboard(clinic.phone, 'phone')}
                  style={{ background: 'transparent', border: 'none', color: '#2E77AE', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 800 }}
                >
                  {copiedField === 'phone' ? <Check size={10} color="#4ade80" /> : <Copy size={10} />}
                  {copiedField === 'phone' ? 'COPIED' : 'COPY'}
                </button>
              )}
            </div>
            <p style={{ color: clinic.phone ? '#fff' : 'rgba(255,255,255,0.2)', fontSize: '14px', fontWeight: 600 }}>
              {clinic.phone || 'No phone number detected'}
            </p>
          </div>

          {/* Website Row */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              <Globe size={12} /> Website Link
            </div>
            {clinic.website ? (
              <a 
                href={clinic.website} 
                target="_blank" 
                rel="noreferrer"
                style={{ color: '#2E77AE', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', wordBreak: 'break-all' }}
              >
                {clinic.website} <Send size={10} />
              </a>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px', fontWeight: 600 }}>
                No website link found
              </p>
            )}
          </div>

          {/* Address Row */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              <MapPin size={12} /> Physical Location
            </div>
            <p style={{ color: '#fff', fontSize: '13px', lineHeight: 1.5, fontWeight: 500 }}>
              {clinic.address ? `${clinic.address}, ${clinic.city}` : `${clinic.city}, ${clinic.country}`}
            </p>
          </div>

          {/* Metadata */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '12px 16px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outreach Status</span>
              <p style={{ color: clinic.outreach_status === 'Contacted' ? '#4a9fd4' : 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>
                {clinic.outreach_status || 'Pending'}
              </p>
            </div>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '12px 16px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discovery Date</span>
              <p style={{ color: '#fff', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                {clinic.discovery_date ? clinic.discovery_date.split(' ')[0] : 'Today'}
              </p>
            </div>
          </div>

        </div>

        {/* Action Panel */}
        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {outreachResult && (
            <div style={{
              padding: '12px 16px', borderRadius: '10px',
              background: outreachResult.includes('SUCCESS') ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${outreachResult.includes('SUCCESS') ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)'}`,
              color: outreachResult.includes('SUCCESS') ? '#4ade80' : outreachResult.includes('❌') ? '#ffb4ab' : '#96ccff',
              fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px',
              textAlign: 'center'
            }}>
              {outreachResult}
            </div>
          )}

          <button
            onClick={handleSingleOutreach}
            disabled={!clinic.email || sending}
            className="glow-btn"
            style={{
              width: '100%', padding: '16px',
              background: !clinic.email ? 'rgba(255,255,255,0.03)' : sending ? 'rgba(46,119,174,0.5)' : '#2E77AE',
              border: 'none', borderRadius: '12px', color: !clinic.email ? 'rgba(255,255,255,0.2)' : '#fff',
              fontSize: '12px', fontWeight: 900, cursor: !clinic.email || sending ? 'not-allowed' : 'pointer',
              letterSpacing: '2px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              boxShadow: !clinic.email || sending ? 'none' : '0 4px 15px rgba(46,119,174,0.3)',
              transition: 'all 0.3s'
            }}
          >
            <Send size={14} />
            {sending ? 'Sending Outreach...' : 'Send Direct Outreach'}
          </button>
          
          {!clinic.email && (
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textAlign: 'center', marginTop: '10px' }}>
              💡 Direct outreach requires a verified email address.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ClinicDrawer;
