import React from 'react';

const Navbar = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'MISSION CONTROL' },
    { id: 'email_manage', label: 'EMAIL MANAGE' }
  ];

  return (
    <nav className="sticky top-0 z-50 flex flex-col gap-4 px-6 py-4 border-b md:flex-row md:items-center md:justify-between md:gap-0 md:px-12 md:py-5 bg-[#0A0E14]/85 backdrop-blur-3xl border-white/5">
      {/* Brand & Tabs (Responsive layout) */}
      <div className="flex flex-col items-center w-full gap-4 sm:flex-row sm:gap-8 md:w-auto">
        {/* Brand Logo & Compact Mobile Controls */}
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E77AE] to-[#1d5c8a] flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(46,119,174,0.3)]">
              C
            </div>
            <span className="text-[15px] font-black text-white tracking-widest">
              CLINICFLOW <span className="text-[#2E77AE]">AI</span>
            </span>
          </div>

          {/* Mobile status pulse (hidden on desktop/tablet since it's in the right bar) */}
          <div className="flex items-center gap-3 sm:hidden">
            <div className="px-3 py-1.5 rounded-full bg-[#FF8E2B]/5 border border-[#FF8E2B]/15 flex items-center gap-2">
              <div className="status-pulse" />
              <span className="text-[9px] font-extrabold text-[#FF8E2B] tracking-wider">ACTIVE</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm cursor-pointer">
              👤
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex w-full p-1 border bg-black/40 rounded-2xl border-white/5 sm:w-auto justify-evenly">
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-[10px] font-extrabold tracking-wider transition-all duration-300 uppercase cursor-pointer ${
                activeTab === item.id 
                  ? 'bg-[#2E77AE]/20 text-white border border-[#2E77AE]/30 shadow-[0_0_10px_rgba(46,119,174,0.15)]' 
                  : 'text-white/30 border border-transparent hover:text-white/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop/Tablet Status Panel */}
      <div className="hidden sm:flex items-center gap-6">
        <div className="px-5 py-2 rounded-full bg-[#FF8E2B]/5 border border-[#FF8E2B]/15 flex items-center gap-2.5">
          <div className="status-pulse" />
          <span className="text-[10px] font-extrabold text-[#FF8E2B] tracking-widest">AI NODE ACTIVE</span>
        </div>
        
        <div className="w-10 h-10 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-colors flex items-center justify-center text-base cursor-pointer">
          👤
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
