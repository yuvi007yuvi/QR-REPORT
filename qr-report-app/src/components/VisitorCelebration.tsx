import React, { useState, useEffect } from 'react';
import { Users, Activity, Globe, Zap, Database } from 'lucide-react';
import { OdometerCount } from './OdometerCount';

export const VisitorCelebration = ({ visitorsCount }: { visitorsCount: number }) => {
  const [count, setCount] = useState<number>(visitorsCount || 0);
  const [displayCount, setDisplayCount] = useState<number>(0);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem('visitorsCount') || '12458', 10);
    setCount(saved);
  }, [visitorsCount]);

  // Animate the count up to the actual number
  useEffect(() => {
    if (count === 0) return;
    let start = Math.max(0, count - 500);
    const duration = 2000;
    const increment = 500 / (duration / 16); // 60fps

    const timer = setInterval(() => {
      start += increment;
      if (start >= count) {
        setDisplayCount(count);
        clearInterval(timer);
      } else {
        setDisplayCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [count]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-4xl w-full">
        
        {/* Header Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-200 bg-white/60 backdrop-blur-md shadow-sm">
          <Activity className="text-indigo-600" size={16} />
          <span className="text-indigo-700 text-xs font-bold tracking-widest uppercase">System Analytics Core</span>
        </div>

        {/* Main Celebration Metric */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 mb-6 drop-shadow-sm">
            Global Visit Count
          </h1>
          <div className="flex items-center justify-center gap-6">
            <Users size={64} className="text-indigo-200 hidden md:block" />
            <div className="text-7xl md:text-9xl font-black text-slate-800 tracking-tighter tabular-nums" style={{ textShadow: '0 10px 30px rgba(99, 102, 241, 0.15)' }}>
              <OdometerCount value={displayCount} />
            </div>
          </div>
          <p className="mt-8 text-slate-500 text-lg md:text-xl font-medium tracking-wide">
            Thank you for being a part of our growing ecosystem.
          </p>
        </div>

        {/* High-Tech Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <MetricCard 
            icon={<Globe className="text-emerald-500" size={24} />}
            title="Network Status"
            value="Optimal"
            glowColor="emerald"
          />
          <MetricCard 
            icon={<Zap className="text-amber-500" size={24} />}
            title="Response Time"
            value="12ms"
            glowColor="amber"
          />
          <MetricCard 
            icon={<Database className="text-blue-500" size={24} />}
            title="Data Synced"
            value="99.9%"
            glowColor="blue"
          />
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, title, value, glowColor }: { icon: React.ReactNode, title: string, value: string, glowColor: string }) => {
  const getGlowClass = (color: string) => {
    switch(color) {
      case 'emerald': return 'group-hover:shadow-[0_10px_30px_-5px_rgba(52,211,153,0.3)] border-emerald-100 hover:border-emerald-300';
      case 'amber': return 'group-hover:shadow-[0_10px_30px_-5px_rgba(251,191,36,0.3)] border-amber-100 hover:border-amber-300';
      case 'blue': return 'group-hover:shadow-[0_10px_30px_-5px_rgba(96,165,250,0.3)] border-blue-100 hover:border-blue-300';
      default: return 'group-hover:shadow-[0_10px_30px_-5px_rgba(99,102,241,0.3)] border-indigo-100 hover:border-indigo-300';
    }
  };

  return (
    <div className={`group relative p-6 rounded-2xl bg-white/80 backdrop-blur-sm border shadow-sm ${getGlowClass(glowColor)} transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-xl bg-slate-50 border ${getGlowClass(glowColor)}`}>
          {icon}
        </div>
        <div className="text-slate-500 font-semibold tracking-wider text-sm uppercase">{title}</div>
      </div>
      <div className="text-3xl font-bold text-slate-800 tracking-tight">{value}</div>
    </div>
  );
};
