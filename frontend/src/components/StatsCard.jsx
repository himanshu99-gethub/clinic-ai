import React from 'react';
import { motion } from 'framer-motion';

const colorMap = {
  primary: { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)', val: '#818cf8', icon: 'rgba(99,102,241,0.3)' },
  success: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.15)',  val: '#22c55e', icon: 'rgba(34,197,94,0.25)' },
  danger:  { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.15)',  val: '#ef4444', icon: 'rgba(239,68,68,0.25)' },
  warning: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.15)', val: '#f59e0b', icon: 'rgba(245,158,11,0.25)' },
  accent:  { bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.15)',  val: '#06b6d4', icon: 'rgba(6,182,212,0.25)' },
  muted:   { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.06)',val: '#a1a1aa', icon: 'rgba(255,255,255,0.08)' },
};

export default function StatsCard({ icon: Icon, label, value, sub, color = 'primary', delay = 0 }) {
  const c = colorMap[color] || colorMap.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow blob */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: c.val,
        opacity: 0.06,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="label" style={{ marginBottom: 10, color: '#52525b' }}>{label}</p>
          <p className="stat-num" style={{ fontSize: 28, fontWeight: 800, color: c.val, lineHeight: 1, letterSpacing: '-1px' }}>
            {value ?? '—'}
          </p>
          {sub && <p style={{ fontSize: 11, color: '#52525b', marginTop: 5 }}>{sub}</p>}
        </div>
        {Icon && (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: c.icon,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={16} style={{ color: c.val }} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
