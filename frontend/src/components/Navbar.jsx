import React from 'react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { Link001, Link003 } from './ui/skiper40';

export default function Navbar({ currentPage, onNavigate }) {
  const links = [
    { id: 'upload', label: 'Campaigns' },
    { id: 'history', label: 'History' },
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(10,10,10,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        maxWidth: 1160,
        margin: '0 auto',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <motion.button
          onClick={() => onNavigate('upload')}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Mail size={15} color="white" strokeWidth={2.5} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#fafafa',
              letterSpacing: '-0.4px',
              display: 'block',
              lineHeight: 1.1,
            }}>
              Mail<span style={{ color: '#6366f1' }}>Blast</span>
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              color: '#52525b',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              display: 'block',
            }}>AI Powered</span>
          </div>
        </motion.button>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {links.map((l, i) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <button
                onClick={() => onNavigate(l.id)}
                style={{
                  background: currentPage === l.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: currentPage === l.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                  borderRadius: 8,
                  padding: '5px 13px',
                  color: currentPage === l.id ? '#818cf8' : '#71717a',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (currentPage !== l.id) e.currentTarget.style.color = '#a1a1aa'; }}
                onMouseLeave={e => { if (currentPage !== l.id) e.currentTarget.style.color = '#71717a'; }}
              >
                {l.label}
              </button>
            </motion.div>
          ))}
        </nav>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div className="dot dot-primary" />
          <span style={{ fontSize: 12, color: '#52525b', fontWeight: 500 }}>AI Ready</span>
        </div>
      </div>
    </header>
  );
}
