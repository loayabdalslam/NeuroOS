import React, { useState, useEffect } from 'react';
import { Cloud, Wifi, Battery, TrendingUp, Newspaper, ArrowUpRight, ArrowDownRight, Cpu, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { useSystemData } from '../hooks/useSystemData';

// --- Widget Components ---

import { WeatherWidget, StockWidget, NewsCarousel, CalendarWidget } from './Widgets';

// --- Main Desktop Widgets Component ---

export const DesktopWidgets: React.FC = () => {
  const systemData = useSystemData();

  return (
    <div className="absolute top-10 right-10 w-[300px] flex flex-col gap-5 pointer-events-auto z-0 select-none">

      {/* Date & Time */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-right space-y-1"
      >
        <div className="text-6xl font-thin tracking-tighter text-white drop-shadow-sm">
          {format(systemData.time, 'HH:mm')}
        </div>
        <div className="text-lg font-light text-white/75 tracking-tight">
          {format(systemData.time, 'EEEE, MMMM do')}
        </div>
      </motion.div>

      {/* System Stats Grid */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* CPU */}
        <div className="bg-white/15 backdrop-blur-[var(--shell-blur)] border border-white/20 rounded-[26px] p-3 flex flex-col justify-between aspect-square hover:bg-white/20 transition-colors group shadow-[var(--shell-shadow)]">
          <Cpu size={18} className="text-white/40 group-hover:text-blue-400 transition-colors" />
          <div>
            <div className="text-xl font-bold text-white">{systemData.performance.cpuUsage}%</div>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider mt-0.5">CPU Load</div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-white/15 backdrop-blur-[var(--shell-blur)] border border-white/20 rounded-[26px] p-3 flex flex-col justify-between aspect-square hover:bg-white/20 transition-colors group shadow-[var(--shell-shadow)]">
          <Activity size={18} className="text-white/40 group-hover:text-purple-400 transition-colors" />
          <div>
            <div className="text-xl font-bold text-white">{systemData.performance.memoryUsage}%</div>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider mt-0.5">RAM Usage</div>
          </div>
        </div>

        {/* Network */}
        <div className="bg-white/15 backdrop-blur-[var(--shell-blur)] border border-white/20 rounded-[26px] p-3 flex flex-col justify-between aspect-square hover:bg-white/20 transition-colors group shadow-[var(--shell-shadow)]">
          <Wifi size={18} className={cn("text-white/40 transition-colors", systemData.network.online ? "group-hover:text-emerald-400" : "text-red-400")} />
          <div>
            <div className="text-xl font-bold text-white">{systemData.network.speed}</div>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider mt-0.5">Mbps</div>
          </div>
        </div>

        {/* Battery */}
        <div className="bg-white/15 backdrop-blur-[var(--shell-blur)] border border-white/20 rounded-[26px] p-3 flex flex-col justify-between aspect-square hover:bg-white/20 transition-colors group shadow-[var(--shell-shadow)]">
          <Battery size={18} className={cn("text-white/40 transition-colors", systemData.battery.charging && "group-hover:text-amber-400 animate-pulse")} />
          <div>
            <div className="text-xl font-bold text-white">{systemData.battery.level}%</div>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider mt-0.5">{systemData.battery.charging ? 'Charging' : 'Battery'}</div>
          </div>
        </div>
      </motion.div>

      {/* Widgets Column */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-4"
      >
        <div className="h-32">
          <WeatherWidget />
        </div>
        <div className="h-32">
          <StockWidget symbol="AAPL" />
        </div>
        <div className="h-40">
          <CalendarWidget />
        </div>
        <div className="h-44">
          <NewsCarousel />
        </div>
      </motion.div>

    </div>
  );
};
