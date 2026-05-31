import React from 'react';
import { Mail, Phone, MapPin, Globe, Check, Eye, Download, Trash2, SlidersHorizontal } from 'lucide-react';

const statusBadge = (status) => {
  const isVerified = status === 'Verified';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${
      isVerified 
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    }`}>
      {isVerified ? <Check size={10} /> : <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
      {isVerified ? 'Verified' : 'Processing'}
    </span>
  );
};

const outreachBadge = (status) => {
  const isContacted = status === 'Contacted';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${
      isContacted 
        ? 'bg-[#2E77AE]/15 text-[#4a9fd4] border-[#2E77AE]/30' 
        : 'bg-white/4 text-white/40 border-white/8'
    }`}>
      {isContacted ? '✉️' : '⚪'} {isContacted ? 'Contacted' : 'Pending'}
    </span>
  );
};

const ClinicTable = ({ clinics, onExport, onAnalyze, onOutreach, isSending, onClearAll }) => {
  const [filter, setFilter] = React.useState('All');

  const filteredClinics = clinics.filter(c => {
    if (filter === 'All') return true;
    if (filter === 'Verified') return c.status === 'Verified';
    if (filter === 'Pending') return c.status !== 'Verified';
    return true;
  });

  const emailCount = clinics.filter(c => c.email && c.email.trim() !== '').length;

  return (
    <div className="mt-10">
      {/* Header Panel with Controls */}
      <div className="flex flex-col gap-5 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
            <span>📡</span> Intelligence Feed
          </h2>
          <p className="text-xs text-white/30 font-semibold mt-1 uppercase tracking-wider">
            {filteredClinics.length} clinical nodes identified in current grid
          </p>
        </div>

        {/* Filters and Actions Group */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Tab Selector */}
          <div className="flex bg-white/4 rounded-xl border border-white/8 p-1">
            {['All', 'Verified', 'Pending'].map((f) => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer ${
                  filter === f 
                    ? 'bg-[#2E77AE]/20 text-[#4a9fd4] border border-[#2E77AE]/30' 
                    : 'text-white/30 hover:text-white/50 border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Action Buttons Group */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={onOutreach} 
              disabled={isSending}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 border border-white/5 ${
                isSending 
                  ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-[#2E77AE] to-[#1a4b6e] text-white hover:shadow-[0_4px_15px_rgba(46,119,174,0.35)]'
              }`}
            >
              {isSending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Mail size={13} />
                  <span>Send Emails ({emailCount})</span>
                </>
              )}
            </button>

            <button 
              onClick={onExport}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/15 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            {onClearAll && clinics.length > 0 && (
              <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete all clinical leads? This will clear the entire database!")) {
                    onClearAll();
                  }
                }}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/30 rounded-xl text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Container: Standard Table (Desktop) & Cards (Mobile) */}
      <div className="bg-[#0f1f38]/60 border border-[#2E77AE]/15 rounded-3xl overflow-hidden backdrop-blur-3xl">
        {filteredClinics.length === 0 ? (
          <div className="py-20 text-center text-white/20 flex flex-col items-center justify-center gap-3">
            <div className="text-5xl">🌐</div>
            <p className="text-sm font-extrabold uppercase tracking-widest">No clinical nodes match the current filter.</p>
            <p className="text-xs text-white/10 font-medium">Try changing the filter or running a new scan.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-white/2 border-b border-white/5">
                    <th className="px-6 py-4.5 text-left text-[10px] font-black text-white/40 tracking-widest uppercase">Clinic</th>
                    <th className="px-6 py-4.5 text-left text-[10px] font-black text-white/40 tracking-widest uppercase">Specialization</th>
                    <th className="px-6 py-4.5 text-left text-[10px] font-black text-white/40 tracking-widest uppercase">Contact</th>
                    <th className="px-6 py-4.5 text-left text-[10px] font-black text-white/40 tracking-widest uppercase">Location</th>
                    <th className="px-6 py-4.5 text-left text-[10px] font-black text-white/40 tracking-widest uppercase">Status</th>
                    <th className="px-6 py-4.5 text-left text-[10px] font-black text-white/40 tracking-widest uppercase">Outreach</th>
                    <th className="px-6 py-4.5 text-right text-[10px] font-black text-white/40 tracking-widest uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClinics.map((clinic, i) => (
                    <tr key={i} className="border-b border-white/4 hover:bg-[#2E77AE]/5 transition-colors duration-150">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E77AE]/30 to-[#2E77AE]/10 border border-[#2E77AE]/30 flex items-center justify-center text-sm font-black text-[#4a9fd4]">
                            {clinic.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-extrabold text-[#E0EAF5] text-sm">{clinic.name}</div>
                            {clinic.website && (
                              <a href={clinic.website} target="_blank" rel="noreferrer" className="text-[11px] text-[#2E77AE] flex items-center gap-1 mt-0.5 hover:underline">
                                🔗 {clinic.website.replace(/https?:\/\//, '').split('/')[0]}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-3.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-[#2E77AE]/12 text-[#4a9fd4] border border-[#2E77AE]/25">
                          {clinic.specialization || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1 text-[11px] text-white/50 font-medium">
                          {clinic.email && <span className="flex items-center gap-1.5">📧 {clinic.email}</span>}
                          {clinic.phone && <span className="flex items-center gap-1.5">📞 {clinic.phone}</span>}
                          {!clinic.email && !clinic.phone && <span className="text-white/20">N/A</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-xs text-white/50 font-medium">
                        📍 {clinic.city}, {clinic.country}
                      </td>
                      <td className="px-6 py-5">{statusBadge(clinic.status)}</td>
                      <td className="px-6 py-5">{outreachBadge(clinic.outreach_status)}</td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => onAnalyze(clinic)}
                          className="px-4 py-2 bg-[#2E77AE]/15 hover:bg-[#2E77AE] border border-[#2E77AE]/30 rounded-xl text-[#4a9fd4] hover:text-white text-xs font-black transition-all duration-200 cursor-pointer"
                        >
                          Analyze →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card Grid View */}
            <div className="block md:hidden p-4 space-y-4">
              {filteredClinics.map((clinic, i) => (
                <div key={i} className="p-5 bg-black/30 border border-white/5 rounded-2xl flex flex-col gap-4">
                  {/* Title & Type */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E77AE]/20 to-[#2E77AE]/5 border border-[#2E77AE]/20 flex items-center justify-center text-lg font-black text-[#4a9fd4] shrink-0">
                      {clinic.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-[#E0EAF5] text-sm break-words leading-tight">{clinic.name}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-[#2E77AE]/10 text-[#4a9fd4] border border-[#2E77AE]/20">
                          {clinic.specialization || 'General'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details block */}
                  <div className="space-y-2 border-t border-white/5 pt-3 text-[11px] text-white/50 font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-[#2E77AE]" />
                      <span>{clinic.city}, {clinic.country}</span>
                    </div>
                    {clinic.email && (
                      <div className="flex items-center gap-2 break-all">
                        <Mail size={12} className="text-[#2E77AE]" />
                        <span>{clinic.email}</span>
                      </div>
                    )}
                    {clinic.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-[#2E77AE]" />
                        <span>{clinic.phone}</span>
                      </div>
                    )}
                    {clinic.website && (
                      <div className="flex items-center gap-2 break-all">
                        <Globe size={12} className="text-[#2E77AE]" />
                        <a href={clinic.website} target="_blank" rel="noreferrer" className="text-[#2E77AE] hover:underline">
                          {clinic.website.replace(/https?:\/\//, '').split('/')[0]}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Badges and Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-2">
                      {statusBadge(clinic.status)}
                      {outreachBadge(clinic.outreach_status)}
                    </div>
                    <button 
                      onClick={() => onAnalyze(clinic)}
                      className="px-4 py-2 bg-[#2E77AE]/20 border border-[#2E77AE]/35 rounded-xl text-[#4a9fd4] text-[11px] font-extrabold uppercase tracking-wide cursor-pointer transition-all hover:bg-[#2E77AE] hover:text-white"
                    >
                      Analyze →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClinicTable;
