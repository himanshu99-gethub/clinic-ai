import React, { useState } from 'react';

const statusDot = (status) => {
  const isVerified = status === 'Verified';
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${isVerified ? 'bg-green-500' : 'bg-secondary'}`} />
      <span className="font-medium text-sm text-on-surface">{isVerified ? 'Active' : 'Pending'}</span>
    </div>
  );
};

const verificationBadge = (status) => {
  const isVerified = status === 'Verified';
  if (isVerified) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 w-fit">
        <span className="material-symbols-outlined text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">Verified</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary-container/10 border border-secondary-container/30 text-secondary w-fit">
      <span className="material-symbols-outlined text-sm">warning</span>
      <span className="text-[10px] font-bold uppercase tracking-wider">Review Req.</span>
    </div>
  );
};

const outreachBadge = (status) => {
  const isContacted = status === 'Contacted';
  if (isContacted) {
    return (
      <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold rounded-md uppercase tracking-wider">
        Contacted
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 bg-surface-container-highest/50 border border-outline-variant/20 text-on-surface-variant/80 text-[10px] font-bold rounded-md uppercase tracking-wider">
      Pending
    </span>
  );
};

const ClinicTable = ({ clinics, onExport, onAnalyze, onOutreach, isSending }) => {
  const [filter, setFilter] = useState('All');

  const filteredClinics = clinics.filter(c => {
    if (filter === 'All') return true;
    if (filter === 'Verified') return c.status === 'Verified';
    if (filter === 'Pending') return c.status !== 'Verified';
    return true;
  });

  const emailCount = clinics.filter(c => c.email && c.email.trim() !== '').length;

  return (
    <div className="glass-card rounded-2xl overflow-hidden mt-8 shadow-md">
      {/* Table Header Section */}
      <div className="px-6 py-5 border-b border-outline-variant/15 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface-container-low/40 gap-4">
        <div>
          <h3 className="font-bold text-lg text-on-surface font-headline-md">Active Leads & Contacts</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {filteredClinics.length} clinics matching active scanner criteria
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          {/* Tabs Filter */}
          <div className="flex bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-1">
            {['All', 'Verified', 'Pending'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  filter === f
                    ? 'bg-primary-container/20 text-primary border border-primary-container/30'
                    : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Export Action */}
          <button
            onClick={onExport}
            className="px-4 py-2 bg-surface-container-highest/40 hover:bg-surface-bright/50 border border-outline-variant/30 rounded-xl text-xs font-bold text-on-surface transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Export Leads</span>
          </button>

          {/* Outreach Action */}
          <button
            onClick={onOutreach}
            disabled={isSending}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              isSending
                ? 'bg-surface-container-highest/20 text-on-surface-variant/40 border border-outline-variant/20 cursor-not-allowed'
                : 'bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] shadow-[0_2px_10px_rgba(150,204,255,0.2)]'
            }`}
          >
            {isSending ? (
              <>
                <div className="w-3 h-3 rounded-full border border-primary/20 border-t-primary animate-spin" />
                <span>Sending ({emailCount})...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">mail</span>
                <span>Send Emails ({emailCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Leads Table body */}
      <div className="overflow-x-auto">
        {filteredClinics.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant/40 flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-4xl mb-3 text-outline-variant">folder_open</span>
            <p className="text-sm font-semibold">No clinics identified in this segment.</p>
            <p className="text-xs mt-1 text-on-surface-variant/60">Launch a scanner search to populate nodes.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/20 text-xs font-semibold text-outline uppercase tracking-wider border-b border-outline-variant/10">
                <th className="px-6 py-4">Clinic / Provider</th>
                <th className="px-6 py-4">Specialty</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Verification</th>
                <th className="px-6 py-4">Outreach</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredClinics.map((clinic, index) => (
                <tr key={index} className="glass-row transition-all hover:bg-surface-bright/10 cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary font-bold text-sm">
                        {clinic.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-on-surface text-sm">{clinic.name}</p>
                        {clinic.website && (
                          <a 
                            href={clinic.website} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined text-[10px]">link</span>
                            <span>{clinic.website.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-surface-variant/40 border border-outline-variant/20 px-2.5 py-1 rounded text-xs text-on-surface-variant font-medium">
                      {clinic.specialization || 'General Practice'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5 text-xs text-on-surface-variant/80">
                      {clinic.email && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">mail</span>
                          <span>{clinic.email}</span>
                        </span>
                      )}
                      {clinic.phone && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">phone</span>
                          <span>{clinic.phone}</span>
                        </span>
                      )}
                      {!clinic.email && !clinic.phone && <span className="text-outline-variant/50">No details</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-on-surface">
                    <span className="block font-semibold">{clinic.city}</span>
                    <span className="text-[10px] text-on-surface-variant opacity-80">{clinic.country}</span>
                  </td>
                  <td className="px-6 py-4">{statusDot(clinic.status)}</td>
                  <td className="px-6 py-4">{verificationBadge(clinic.status)}</td>
                  <td className="px-6 py-4">{outreachBadge(clinic.outreach_status)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyze(clinic);
                      }}
                      className="px-3 py-1.5 bg-primary-container/10 hover:bg-primary-container/30 border border-primary-container/20 text-primary text-xs font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Analyze
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ClinicTable;
