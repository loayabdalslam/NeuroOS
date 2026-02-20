import React, { useState, useEffect } from 'react';
import { Cloud, Wifi, Battery, TrendingUp, Newspaper, ArrowUpRight, ArrowDownRight, Cpu, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { useSystemData } from '../hooks/useSystemData';

// --- Widget Components ---

const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getWeatherData = async () => {
      try {
        const res = await globalThis.fetch('https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current_weather=true');
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        if (data && data.current_weather) {
          setWeather(data.current_weather);
        }
      } catch (e) {
        console.error('Weather error:', e);
      } finally {
        setLoading(false);
      }
    };
    getWeatherData();
  }, []);

  if (loading) return <div className="w-full h-24 bg-white/5 rounded-2xl animate-pulse" />;

  return (
    <div className="w-full p-4 bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col justify-between hover:bg-black/30 transition-colors group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">San Francisco</span>
        <Cloud size={16} className="text-white/40 group-hover:text-blue-400 transition-colors" />
      </div>
      <div className="flex flex-col mt-2">
        <span className="text-3xl font-light text-white tracking-tighter">{weather?.temperature ?? '--'}°</span>
        <span className="text-[10px] text-white/60 font-medium">Clear Sky</span>
      </div>
    </div>
  );
};

const StockWidget: React.FC = () => {
  const [stock, setStock] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getStockData = async () => {
      try {
        const symbol = 'AAPL'; // Hardcoded for now, could be dynamic
        // Yahoo Finance API via Proxy
        // If window.electron exists, use proxy. Otherwise, fallback or fail.
        let data;

        if (window.electron?.proxyRequest) {
          const result = await window.electron.proxyRequest(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
          const quote = result.chart.result[0];
          data = {
            regularMarketPrice: quote.meta.regularMarketPrice,
            regularMarketChangePercent: ((quote.meta.regularMarketPrice - quote.meta.previousClose) / quote.meta.previousClose) * 100
          };
        } else {
          // Browser Dev Mode Fallback
          await new Promise(r => setTimeout(r, 1000));
          data = { regularMarketPrice: 175.43, regularMarketChangePercent: 2.3 };
        }

        setStock(data);
      } catch (e) {
        console.error('Stock error:', e);
        // Fallback on error
        setStock({ regularMarketPrice: 0.00, regularMarketChangePercent: 0.0 });
      } finally {
        setLoading(false);
      }
    };
    getStockData();
  }, []);

  if (loading) return <div className="w-full h-24 bg-white/5 rounded-2xl animate-pulse" />;

  const price = stock?.regularMarketPrice ?? 0;
  const percent = stock?.regularMarketChangePercent ?? 0;
  const isPositive = percent >= 0;

  return (
    <div className="w-full p-4 bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col justify-between hover:bg-black/30 transition-colors group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">AAPL</span>
        <TrendingUp size={16} className="text-white/40 group-hover:text-emerald-400 transition-colors" />
      </div>
      <div className="flex flex-col mt-2">
        <span className="text-2xl font-light text-white tracking-tighter">${price.toFixed(2)}</span>
        <div className={cn("flex items-center gap-1 text-[10px] font-bold", isPositive ? "text-emerald-400" : "text-rose-400")}>
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(percent).toFixed(2)}%
        </div>
      </div>
    </div>
  );
};

const NewsWidget: React.FC = () => {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getNewsData = async () => {
      try {
        let items = [];
        if (window.electron?.proxyRequest) {
          // Using rss2json to parse TechCrunch feed
          const feedUrl = 'https://feeds.feedburner.com/TechCrunch/';
          const res = await window.electron.proxyRequest(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
          if (res && res.items) {
            items = res.items.slice(0, 3).map((item: any) => ({
              title: item.title,
              publisher: 'TechCrunch',
              link: item.link
            }));
          }
        } else {
          // Browser Dev Mode Fallback
          await new Promise(r => setTimeout(r, 100));
          items = [
            { title: "NeuroOS Web Launched", publisher: "System", link: "#" },
            { title: "React 19 Hooks Update", publisher: "DevLog", link: "#" }
          ];
        }
        setNews(items);
      } catch (e) {
        console.error('News error:', e);
      } finally {
        setLoading(false);
      }
    };
    getNewsData();
  }, []);

  return (
    <div className="w-full p-4 bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col gap-3 hover:bg-black/30 transition-colors group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Tech News</span>
        <Newspaper size={16} className="text-white/40 group-hover:text-amber-400 transition-colors" />
      </div>
      <div className="space-y-3">
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />)
        ) : (
          news.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block group/link cursor-pointer">
              <p className="text-[11px] font-medium leading-tight text-white/80 group-hover/link:text-white group-hover/link:underline line-clamp-2 transition-colors">{item.title}</p>
              <span className="text-[9px] text-white/40">{item.publisher}</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

// --- Main Desktop Widgets Component ---

export const DesktopWidgets: React.FC = () => {
  const systemData = useSystemData();

  return (
    <div className="absolute top-12 right-12 w-64 flex flex-col gap-6 pointer-events-auto z-0 select-none">

      {/* Date & Time */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-right space-y-0.5"
      >
        <div className="text-6xl font-thin tracking-tighter text-white drop-shadow-sm">
          {format(systemData.time, 'HH:mm')}
        </div>
        <div className="text-lg font-light text-white/60 tracking-tight">
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
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex flex-col justify-between aspect-square hover:bg-black/30 transition-colors group">
          <Cpu size={18} className="text-white/40 group-hover:text-blue-400 transition-colors" />
          <div>
            <div className="text-xl font-bold text-white">{systemData.performance.cpuUsage}%</div>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider mt-0.5">CPU Load</div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex flex-col justify-between aspect-square hover:bg-black/30 transition-colors group">
          <Activity size={18} className="text-white/40 group-hover:text-purple-400 transition-colors" />
          <div>
            <div className="text-xl font-bold text-white">{systemData.performance.memoryUsage}%</div>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider mt-0.5">RAM Usage</div>
          </div>
        </div>

        {/* Network */}
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex flex-col justify-between aspect-square hover:bg-black/30 transition-colors group">
          <Wifi size={18} className={cn("text-white/40 transition-colors", systemData.network.online ? "group-hover:text-emerald-400" : "text-red-400")} />
          <div>
            <div className="text-xl font-bold text-white">{systemData.network.speed}</div>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider mt-0.5">Mbps</div>
          </div>
        </div>

        {/* Battery */}
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex flex-col justify-between aspect-square hover:bg-black/30 transition-colors group">
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
        className="flex flex-col gap-3"
      >
        <WeatherWidget />
        <StockWidget />
        <NewsWidget />
      </motion.div>

    </div>
  );
};
