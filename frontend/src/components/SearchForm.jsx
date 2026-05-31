import React, { useState } from 'react';
import { Search, MapPin, Globe, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

const SearchForm = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState({ city: '', country: '', specialization: '', auto_outreach: false });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.specialization || !query.city) {
      alert("Please fill out both Specialization and Target City fields!");
      return;
    }
    onSearch(query);
  };

  const fields = [
    { key: 'specialization', label: 'Clinical Specialization', placeholder: 'e.g. Dental Clinic', icon: <Sparkles size={18} className="text-[#2E77AE]/60" /> },
    { key: 'city', label: 'Target City', placeholder: 'e.g. New York', icon: <MapPin size={18} className="text-[#2E77AE]/60" /> },
    { key: 'country', label: 'Country / Region', placeholder: 'e.g. USA', icon: <Globe size={18} className="text-[#2E77AE]/60" /> },
  ];

  return (
    <div className="glass-panel p-8 md:p-10 mb-10 relative overflow-hidden border border-[#2E77AE]/15">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
          Discovery Unit
        </h2>
        <p className="text-xs text-white/30 font-semibold mt-1 tracking-wider uppercase">
          Initialize healthcare node scanning protocol
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {fields.map(({ key, label, placeholder, icon }) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-[#2E77AE] tracking-widest uppercase">
                {label}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                  {icon}
                </span>
                <input
                  type="text"
                  placeholder={placeholder}
                  className="w-full pl-12 pr-4 py-4 bg-black/30 border border-white/8 rounded-xl text-white text-sm font-medium outline-none transition-all duration-300 focus:border-[#2E77AE] focus:shadow-[0_0_15px_rgba(46,119,174,0.2)] placeholder-white/10"
                  value={query[key]}
                  onChange={e => setQuery({ ...query, [key]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Automated Toggle Panel (Fully Responsive) */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-5 bg-black/20 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4">
            <div className="text-2xl bg-[#2E77AE]/10 p-2.5 rounded-xl border border-[#2E77AE]/20">🤖</div>
            <div>
              <p className="text-xs font-black text-white tracking-wider uppercase">Automated Agent Protocol</p>
              <p className="text-[10px] text-white/30 font-semibold mt-0.5 leading-normal">Agent will execute outreach sequence upon node verification</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setQuery({ ...query, auto_outreach: !query.auto_outreach })}
            className="flex items-center gap-2 cursor-pointer focus:outline-none w-full sm:w-auto justify-end sm:justify-start"
          >
            {query.auto_outreach ? (
              <ToggleRight size={44} className="text-[#2E77AE] transition-all duration-300 drop-shadow-[0_0_8px_rgba(46,119,174,0.5)]" />
            ) : (
              <ToggleLeft size={44} className="text-white/20 hover:text-white/30 transition-all duration-300" />
            )}
          </button>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4.5 rounded-xl text-white text-xs font-black tracking-widest uppercase flex items-center justify-center gap-3 transition-all duration-300 glow-btn border border-white/5 cursor-pointer ${
              isLoading 
                ? 'bg-[#2E77AE]/50 cursor-not-allowed radar-sweep' 
                : 'bg-gradient-to-r from-[#2E77AE] to-[#1d5c8a] hover:shadow-[0_0_20px_rgba(46,119,174,0.4)]'
            }`}
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Scanning Grid...</span>
              </>
            ) : (
              <>
                <Search size={14} />
                <span>Launch Discovery</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;
