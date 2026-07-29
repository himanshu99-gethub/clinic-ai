/**
 * Skiper40 — Animated Link Components (ported from skiper-ui.com for Vite/React)
 * Provides: Link000–Link005 with CSS-only hover underline/reveal animations.
 * Usage: <Link001 href="/page">Label</Link001>
 */
import React from 'react';

const base = {
  display: 'inline-flex',
  alignItems: 'center',
  position: 'relative',
  cursor: 'pointer',
  textDecoration: 'none',
  fontWeight: 500,
  fontSize: 14,
  color: 'inherit',
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
};

/* ── Link000: Underline left-to-right ─────────── */
export function Link000({ href, onClick, children, style = {} }) {
  return (
    <a href={href} onClick={onClick} style={{ ...base, ...style, overflow: 'hidden' }}>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {children}
        <span style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height: 1,
          background: 'currentColor',
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
          className="skiper-underline"
        />
      </span>
      <style>{`.group:hover .skiper-underline, a:hover .skiper-underline { transform: scaleX(1) !important; }`}</style>
    </a>
  );
}

/* ── Link001: Underline center-out ────────────── */
export function Link001({ href, onClick, children, style = {}, className = '' }) {
  return (
    <a href={href} onClick={onClick} className={`skiper-link001 ${className}`} style={{ ...base, ...style }}>
      <span className="skiper-link001-inner">{children}</span>
      <style>{`
        .skiper-link001 { position: relative; overflow: hidden; }
        .skiper-link001-inner { position: relative; }
        .skiper-link001-inner::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          right: 50%;
          height: 1.5px;
          background: currentColor;
          transition: left 0.3s cubic-bezier(0.4,0,0.2,1), right 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .skiper-link001:hover .skiper-link001-inner::after {
          left: 0;
          right: 0;
        }
      `}</style>
    </a>
  );
}

/* ── Link002: Underline right-to-left ─────────── */
export function Link002({ href, onClick, children, style = {}, className = '' }) {
  return (
    <a href={href} onClick={onClick} className={`skiper-link002 ${className}`} style={{ ...base, ...style }}>
      <span className="skiper-link002-inner">{children}</span>
      <style>{`
        .skiper-link002-inner { position: relative; }
        .skiper-link002-inner::after {
          content: '';
          position: absolute;
          bottom: 0;
          right: 0;
          width: 100%;
          height: 1.5px;
          background: currentColor;
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .skiper-link002:hover .skiper-link002-inner::after { transform: scaleX(1); transform-origin: left; }
      `}</style>
    </a>
  );
}

/* ── Link003: Fill background reveal ─────────── */
export function Link003({ href, onClick, children, style = {}, className = '' }) {
  return (
    <a href={href} onClick={onClick} className={`skiper-link003 ${className}`}
      style={{ ...base, padding: '5px 12px', borderRadius: 8, transition: 'all 0.25s', ...style }}>
      {children}
      <style>{`
        .skiper-link003 { position: relative; overflow: hidden; isolation: isolate; }
        .skiper-link003::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.06);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
          border-radius: 8px;
          z-index: -1;
        }
        .skiper-link003:hover::before { transform: scaleX(1); }
      `}</style>
    </a>
  );
}

/* ── Link004: Slide-up text reveal ────────────── */
export function Link004({ href, onClick, children, style = {}, className = '' }) {
  return (
    <a href={href} onClick={onClick} className={`skiper-link004 ${className}`}
      style={{ ...base, overflow: 'hidden', height: '1.4em', ...style }}>
      <span className="skiper-link004-top">{children}</span>
      <span className="skiper-link004-bot" aria-hidden>{children}</span>
      <style>{`
        .skiper-link004 { display: inline-flex; flex-direction: column; }
        .skiper-link004-top, .skiper-link004-bot {
          display: block;
          transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
          white-space: nowrap;
        }
        .skiper-link004-bot {
          position: absolute;
          top: 100%;
          opacity: 0.7;
        }
        .skiper-link004:hover .skiper-link004-top { transform: translateY(-100%); }
        .skiper-link004:hover .skiper-link004-bot { transform: translateY(-100%); opacity: 1; }
      `}</style>
    </a>
  );
}

/* ── Link005: Glow/highlight on hover ─────────── */
export function Link005({ href, onClick, children, style = {}, className = '', color = '#6366F1' }) {
  return (
    <a href={href} onClick={onClick} className={`skiper-link005 ${className}`}
      style={{ ...base, ...style }}
      data-color={color}>
      {children}
      <style>{`
        .skiper-link005 {
          position: relative;
          transition: color 0.2s;
        }
        .skiper-link005::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: ${color};
          box-shadow: 0 0 8px ${color};
          border-radius: 100px;
          transform: scaleX(0);
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .skiper-link005:hover { color: ${color}; }
        .skiper-link005:hover::after { transform: scaleX(1); }
      `}</style>
    </a>
  );
}
