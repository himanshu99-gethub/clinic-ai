import React, { useState } from 'react';

const SearchForm = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState({ city: '', country: '', specialization: '', auto_outreach: false });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.specialization || !query.city) {
      alert('Please specify specialization and target city to scan.');
      return;
    }
    onSearch(query);
  };

  const fields = [
    { key: 'specialization', label: 'Clinical Specialty', placeholder: 'e.g. Pediatric Cardiology', icon: 'clinical_notes' },
    { key: 'city', label: 'Target City', placeholder: 'e.g. Boston', icon: 'distance' },
    { key: 'country', label: 'Country / Region', placeholder: 'e.g. USA', icon: 'public' },
  ];

  return (
    <div className="glass-card rounded-2xl p-8 relative overflow-hidden transition-all duration-300">
      {/* Background soft glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Discovery Scanner</h2>
        <p className="font-caption text-xs text-on-surface-variant/80 mt-1">
          Configure Google Maps crawler parameters to identify healthcare nodes
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {fields.map(({ key, label, placeholder, icon }) => (
            <div key={key} className="space-y-2">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-primary-container">
                {label}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-lg">
                  {icon}
                </span>
                <input
                  type="text"
                  placeholder={placeholder}
                  className="w-full bg-surface-container-highest/30 border border-outline-variant/30 rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-sans"
                  value={query[key]}
                  onChange={e => setQuery({ ...query, [key]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        {/* AI Auto outreach toggle panel */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-surface-container-low/40 rounded-2xl border border-outline-variant/10 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary pulse-orange">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">Auto-Pilot Outreach</p>
              <p className="text-xs text-on-surface-variant/70 mt-0.5">Automatically trigger email sequence upon verified search results</p>
            </div>
          </div>
          
          {/* Toggle Switch */}
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={query.auto_outreach}
              onChange={e => setQuery({ ...query, auto_outreach: e.target.checked })}
            />
            <div className="w-14 h-7 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container peer-checked:shadow-[0_0_12px_rgba(46,119,174,0.4)]"></div>
          </label>
        </div>

        {/* Submit launch button */}
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 px-6 rounded-xl font-bold uppercase tracking-wider text-sm transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer ${
              isLoading
                ? 'bg-primary/20 text-primary-container cursor-not-allowed border border-primary/10'
                : 'bg-primary-container text-on-primary-container hover:opacity-90 active:scale-[0.99] shadow-[0_4px_20px_rgba(46,119,174,0.25)] hover:shadow-[0_4px_25px_rgba(46,119,174,0.4)]'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <span>Running Scan Protocol...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">bolt</span>
                <span>Launch Grid Discovery</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;
