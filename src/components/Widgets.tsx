import React, { useState, useEffect } from 'react';
import {
    Cloud,
    TrendingUp,
    Newspaper,
    ArrowUpRight,
    ArrowDownRight,
    ChevronLeft,
    ChevronRight,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// --- Shared Types ---
export type WidgetType = 'weather' | 'stocks' | 'news';

// --- Minimalist Weather Widget ---
export const WeatherWidget: React.FC<{ minimalist?: boolean }> = ({ minimalist }) => {
    const [weather, setWeather] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current_weather=true');
                const data = await res.json();
                setWeather(data.current_weather);
            } catch (e) {
                console.error('Weather widget error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchWeather();
    }, []);

    if (loading) return <div className="h-full w-full bg-zinc-100/50 rounded-2xl animate-pulse" />;

    return (
        <div className={cn(
            "h-full w-full flex flex-col p-4 font-sans select-none",
            minimalist ? "bg-white" : "bg-black/10 backdrop-blur-xl"
        )}>
            <div className="flex items-center justify-between opacity-40">
                <span className="text-[9px] font-bold uppercase tracking-widest">San Francisco</span>
                <Cloud size={14} />
            </div>
            <div className="flex-1 flex flex-col justify-center">
                <div className="text-4xl font-light tracking-tighter text-zinc-800">
                    {weather?.temperature || '--'}°
                </div>
                <div className="text-[10px] font-medium text-zinc-400 mt-1 uppercase tracking-wider">
                    Clear Skies
                </div>
            </div>
        </div>
    );
};

// --- Minimalist Stock Widget (Yahoo Finance) ---
export const StockWidget: React.FC<{ symbol?: string; minimalist?: boolean }> = ({ symbol = 'AAPL', minimalist }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStock = async () => {
            try {
                let quote;
                const electron = (window as any).electron;
                if (electron?.proxyRequest) {
                    const result = await electron.proxyRequest(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
                    const res = result.chart.result[0];
                    quote = {
                        price: res.meta.regularMarketPrice,
                        change: ((res.meta.regularMarketPrice - res.meta.previousClose) / res.meta.previousClose) * 100
                    };
                } else {
                    // Fallback
                    quote = { price: 175.43, change: 2.3 };
                }
                setData(quote);
            } catch (e) {
                console.error('Stock widget error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchStock();
    }, [symbol]);

    if (loading) return <div className="h-full w-full bg-zinc-100/50 rounded-2xl animate-pulse" />;

    const isPositive = data?.change >= 0;

    return (
        <div className={cn(
            "h-full w-full flex flex-col p-4 font-sans select-none",
            minimalist ? "bg-white" : "bg-black/10 backdrop-blur-xl"
        )}>
            <div className="flex items-center justify-between opacity-40">
                <span className="text-[9px] font-bold uppercase tracking-widest">{symbol}</span>
                <TrendingUp size={14} className={isPositive ? "text-emerald-500" : "text-rose-500"} />
            </div>
            <div className="flex-1 flex flex-col justify-center">
                <div className="text-3xl font-light tracking-tighter text-zinc-800">
                    ${data?.price.toFixed(2)}
                </div>
                <div className={cn(
                    "flex items-center gap-1 text-[10px] font-bold mt-1",
                    isPositive ? "text-emerald-500" : "text-rose-500"
                )}>
                    {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {Math.abs(data?.change).toFixed(2)}%
                </div>
            </div>
        </div>
    );
};

// --- News Carousel Widget ---
export const NewsCarousel: React.FC<{ minimalist?: boolean }> = ({ minimalist }) => {
    const [news, setNews] = useState<any[]>([]);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const electron = (window as any).electron;
                const feed = 'https://feeds.feedburner.com/TechCrunch/';
                let items = [];

                if (electron?.proxyRequest) {
                    const res = await electron.proxyRequest(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`);
                    items = res.items.slice(0, 5).map((item: any) => ({
                        title: item.title,
                        source: 'TechCrunch',
                        image: item.thumbnail || item.enclosure?.link || 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=200&fit=crop',
                        link: item.link
                    }));
                } else {
                    items = [
                        { title: "NeuroOS Update: Premium Widgets", source: "System", image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=200&fit=crop", link: "#" },
                        { title: "The Future of Minimalist UI", source: "Design Daily", image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=200&fit=crop", link: "#" }
                    ];
                }
                setNews(items);
            } catch (e) {
                console.error('News widget error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    useEffect(() => {
        if (news.length > 0) {
            const timer = setInterval(() => {
                setIndex(prev => (prev + 1) % news.length);
            }, 8000);
            return () => clearInterval(timer);
        }
    }, [news]);

    if (loading || news.length === 0) return <div className="h-full w-full bg-zinc-100/50 rounded-2xl animate-pulse" />;

    const current = news[index];

    return (
        <div className={cn(
            "h-full w-full flex flex-col overflow-hidden relative group font-sans select-none rounded-2xl",
            minimalist ? "bg-white border border-zinc-100" : "bg-black/10 backdrop-blur-xl"
        )}>
            {/* Image Layer */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 z-0"
                >
                    <img src={current.image} className="w-full h-full object-cover opacity-40 grayscale hover:grayscale-0 transition-all duration-700" alt="news" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent" />
                </motion.div>
            </AnimatePresence>

            {/* Content Layer */}
            <div className="relative z-10 p-5 flex flex-col h-full justify-end">
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-white text-[8px] font-bold uppercase tracking-wider rounded">Hot</span>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{current.source}</span>
                </div>

                <AnimatePresence mode="wait">
                    <motion.h3
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-sm font-bold text-zinc-800 leading-tight line-clamp-2"
                    >
                        {current.title}
                    </motion.h3>
                </AnimatePresence>

                <div className="flex items-center gap-1 mt-4">
                    {news.map((_, i) => (
                        <div key={i} className={cn(
                            "h-0.5 rounded-full transition-all duration-500",
                            i === index ? "w-4 bg-zinc-800" : "w-1 bg-zinc-200"
                        )} />
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIndex((index - 1 + news.length) % news.length)} className="p-1.5 bg-white shadow-sm border border-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-800 transition-colors">
                    <ChevronLeft size={14} />
                </button>
                <button onClick={() => setIndex((index + 1) % news.length)} className="p-1.5 bg-white shadow-sm border border-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-800 transition-colors">
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};
