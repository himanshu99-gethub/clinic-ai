import React from 'react';

const Navbar = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard' },
    { id: 'discovery', label: 'Discovery', icon: 'search' },
    { id: 'campaigns', label: 'Campaigns', icon: 'send' },
  ];

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low/60 backdrop-blur-2xl border-r border-outline-variant/10 shadow-lg py-8 z-50">
        {/* Brand Header */}
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-container/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(46,119,174,0.2)]">
            <span className="material-symbols-outlined font-bold">clinical_notes</span>
          </div>
          <div>
            <h1 className="font-headline-md text-[18px] font-bold text-primary leading-none">ClinicFlow AI</h1>
            <p className="text-[10px] text-on-surface-variant opacity-75 font-medium uppercase tracking-widest mt-1">Healthcare Auto</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-label-md text-sm text-left ${
                  isActive
                    ? 'bg-primary-container/20 text-primary border-r-4 border-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-bright/30 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
          
          {/* Static Tabs for Preview */}
          <div className="pt-4 border-t border-outline-variant/5 mt-4 space-y-1">
            <p className="px-4 text-[10px] uppercase font-bold tracking-widest text-outline-variant/60 mb-2">Workspace</p>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-on-surface-variant/40 cursor-not-allowed text-xs text-left">
              <span className="material-symbols-outlined text-sm">inbox</span>
              <span>Inbox (coming soon)</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-on-surface-variant/40 cursor-not-allowed text-xs text-left">
              <span className="material-symbols-outlined text-sm">account_tree</span>
              <span>Builder (coming soon)</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="px-4 mt-auto space-y-1 pt-4 border-t border-outline-variant/10">
          <div className="flex items-center gap-3 px-4 py-2 bg-secondary/5 border border-secondary/10 rounded-xl mb-4">
            <div className="w-2 h-2 rounded-full bg-secondary pulse-orange" />
            <span className="text-[10px] font-bold text-secondary tracking-wider uppercase">AI Agent Active</span>
          </div>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-bright/30 hover:text-on-surface transition-all text-xs"
            onClick={(e) => e.preventDefault()}
          >
            <span className="material-symbols-outlined text-sm">help</span>
            <span>Help Center</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-error/10 hover:text-error transition-all text-xs"
            onClick={(e) => {
              e.preventDefault();
              alert('Profile settings and Logout actions can be configured via security credentials.');
            }}
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>Logout</span>
          </a>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-low/90 backdrop-blur-xl border-t border-outline-variant/20 flex justify-around items-center py-3 z-50">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 transition-all ${
                isActive ? 'text-primary font-boldScale' : 'text-on-surface-variant/70'
              }`}
            >
              <span className={`material-symbols-outlined ${isActive ? 'filled-icon' : ''}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default Navbar;
