import React, { useState, useEffect } from 'react';
import { Cloud, TrendingUp, Newspaper, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export const WeatherWidget: React.FC = () => {
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

  if (loading) return <div className="w-48 h-32 bg-white/40 backdrop-blur-md rounded-2xl animate-pulse" />;

  return (
    <div className="w-48 p-4 bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">San Francisco</span>
        <Cloud size={16} className="text-zinc-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-light">{weather?.temperature ?? '--'}°</span>
        <span className="text-[10px] text-zinc-500 font-medium">Clear Sky</span>
      </div>
    </div>
  );
};

export const StockWidget: React.FC = () => {
  const [stock, setStock] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getStockData = async () => {
      try {
        setError(null);
        const res = await globalThis.fetch('/api/stocks/AAPL');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.details || data.error || 'Stock fetch failed');
        }
        setStock(data);
      } catch (e: any) {
        console.error('Stock error:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    getStockData();
  }, []);

  if (loading) return <div className="w-48 h-32 bg-white/40 backdrop-blur-md rounded-2xl animate-pulse" />;
  if (error) return (
    <div className="w-48 p-4 bg-white/40 backdrop-blur-md border border-rose-200 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Stock Error</span>
      <span className="text-[9px] text-rose-400 line-clamp-2">{error}</span>
    </div>
  );

  const isPositive = stock?.regularMarketChangePercent >= 0;

  return (
    <div className="w-48 p-4 bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">AAPL</span>
        <TrendingUp size={16} className="text-zinc-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-light">${stock?.regularMarketPrice?.toFixed(2) ?? '--'}</span>
        <div className={cn("flex items-center gap-1 text-[10px] font-bold", isPositive ? "text-emerald-600" : "text-rose-600")}>
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {stock?.regularMarketChangePercent?.toFixed(2) ?? '0.00'}%
        </div>
      </div>
    </div>
  );
};

export const NewsWidget: React.FC = () => {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getNewsData = async () => {
      try {
        const res = await globalThis.fetch('/api/news');
        if (!res.ok) throw new Error('News fetch failed');
        const data = await res.json();
        if (Array.isArray(data)) {
          setNews(data.slice(0, 3));
        } else {
          setNews([]);
        }
      } catch (e) {
        console.error('News error:', e);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };
    getNewsData();
  }, []);

  return (
    <div className="w-64 p-4 bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Financial News</span>
        <Newspaper size={16} className="text-zinc-400" />
      </div>
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-8 bg-black/5 rounded-lg animate-pulse" />)
        ) : (
          news.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noreferrer" className="block group">
              <p className="text-[11px] font-medium leading-tight group-hover:underline line-clamp-2">{item.title}</p>
              <span className="text-[9px] text-zinc-400">{item.publisher}</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

export const DesktopWidgets: React.FC = () => {
  return (
    <div className="absolute top-12 right-12 flex flex-col gap-4 pointer-events-auto z-0">
      <WeatherWidget />
      <StockWidget />
      <NewsWidget />
    </div>
  );
};
