import React from 'react';

const StatsCard = ({ title, value, icon, color, trend, trendColor, sparklinePath, isProgress, progressVal, index }) => {
  const isPrimary = color === 'primary';
  const isSecondary = color === 'secondary';
  
  const iconColorClass = isPrimary 
    ? 'text-primary' 
    : isSecondary 
      ? 'text-secondary' 
      : 'text-secondary-container';
      
  const iconBgClass = isPrimary 
    ? 'bg-primary/10' 
    : isSecondary 
      ? 'bg-secondary/10' 
      : 'bg-secondary-container/10';

  const trendColorClass = isPrimary 
    ? 'text-primary' 
    : isSecondary 
      ? 'text-secondary' 
      : 'text-secondary-container';

  return (
    <div 
      className="glass-card glass-card-hover rounded-2xl p-6 transition-all relative overflow-hidden flex flex-col justify-between"
      style={{
        animation: `fadeSlideIn 0.5s ease ${index * 0.1}s both`,
      }}
    >
      {/* Absolute Badge for AI score */}
      {isProgress && (
        <div className="absolute top-0 right-0 px-2 py-0.5 bg-primary/20 rounded-bl-xl text-[8px] font-bold text-primary uppercase tracking-wider">
          AI Optimized
        </div>
      )}

      {/* Card Header Row */}
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 ${iconBgClass} rounded-xl flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColorClass} ${color === 'secondary-container' ? 'pulse-orange' : ''}`}>
            {icon}
          </span>
        </div>
        <div className={`${trendColorClassClass(trendColor || color)} text-xs font-bold uppercase tracking-wide mt-1`}>
          {trend}
        </div>
      </div>

      {/* Title & Value */}
      <div>
        <h3 className="text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold mb-1">
          {title}
        </h3>
        <p className="text-[28px] font-bold text-on-surface font-headline-md tracking-tight leading-none">
          {value}
        </p>
      </div>

      {/* Progress or Sparkline graph */}
      <div className="mt-4 w-full">
        {isProgress ? (
          <div className="flex gap-1 h-8 items-center">
            <div className="flex-1 bg-primary/25 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressVal || 94.2}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="h-8 w-full opacity-80">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 30">
              <path 
                d={sparklinePath || "M0 15 Q 50 5, 100 15"} 
                fill="none" 
                stroke={isPrimary ? "#96ccff" : "#ffb783"} 
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper for mapping trend colors
const trendColorClassClass = (color) => {
  if (color === 'primary') return 'text-primary';
  if (color === 'secondary') return 'text-secondary';
  return 'text-secondary-container';
};

export default StatsCard;
