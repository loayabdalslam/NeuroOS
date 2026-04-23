import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ZoomIn, ZoomOut, RotateCw, Play, Pause, SkipBack, SkipForward,
    Volume2, VolumeX, Volume1, Maximize2, Image, Video, Music,
    FileText, Upload, Minimize2, RefreshCw, Move
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useOS, OSAppWindow } from '../hooks/useOS';
import { useSettingsStore } from '../stores/settingsStore';

interface MediaViewerProps {
    windowData?: OSAppWindow;
}

const MEDIA_EXTENSIONS = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
    video: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'ogv'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma']
};

const TRANSPARENT_EXTS = ['png', 'svg', 'webp', 'gif', 'ico', 'avif'];

export const MediaViewer: React.FC<MediaViewerProps> = ({ windowData }) => {
    const { closeWindow, maximizeWindow, updateWindow } = useOS();
    const { setWallpaper, addCustomWallpaper } = useSettingsStore();

    const [filePath, setFilePath] = useState<string | null>(null);
    const [fileName, setFileName] = useState('');
    const [fileExt, setFileExt] = useState('');
    const [fileType, setFileType] = useState<'image' | 'video' | 'audio' | 'unknown'>('unknown');
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });
    const [showControls, setShowControls] = useState(true);
    const [isSeeking, setIsSeeking] = useState(false);
    const [buffered, setBuffered] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const lastLoadedRef = useRef<number>(0);

    useEffect(() => {
        if (windowData?.lastAction?.type === 'open_file') {
            const ts = windowData.lastAction.timestamp || 0;
            if (ts > lastLoadedRef.current) {
                lastLoadedRef.current = ts;
                const path = windowData.lastAction.payload?.path;
                const name = windowData.lastAction.payload?.name;
                if (path) loadFile(path, name);
            }
        }
    }, [windowData?.lastAction]);

    const loadFile = async (path: string, name?: string) => {
        const n = name || path.split(/[/\\]/).pop() || 'Unknown';
        setFilePath(path);
        setFileName(n);
        setError(null);
        setZoom(1);
        setRotation(0);
        setPanOffset({ x: 0, y: 0 });
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);

        const ext = path.split('.').pop()?.toLowerCase() || '';
        setFileExt(ext);

        if (MEDIA_EXTENSIONS.image.includes(ext)) setFileType('image');
        else if (MEDIA_EXTENSIONS.video.includes(ext)) setFileType('video');
        else if (MEDIA_EXTENSIONS.audio.includes(ext)) setFileType('audio');
        else setFileType('unknown');

        if (windowData) {
            updateWindow(windowData.id, { title: n });
        }
    };

    const getFileUrl = () => {
        if (!filePath) return '';
        if (filePath.startsWith('blob:') || filePath.startsWith('http')) return filePath;
        return filePath.startsWith('/') ? `file://${filePath}` : `file:///${filePath.replace(/\\/g, '/')}`;
    };

    // --- Image controls ---
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (fileType !== 'image') return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(z => Math.max(0.1, Math.min(5, z + delta)));
    }, [fileType]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (fileType !== 'image' || zoom <= 1) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }, [fileType, zoom, panOffset]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }, [isPanning, panStart]);

    const handleMouseUp = useCallback(() => setIsPanning(false), []);

    const resetView = () => {
        setZoom(1);
        setRotation(0);
        setPanOffset({ x: 0, y: 0 });
    };

    const handleSetAsWallpaper = async () => {
        if (!filePath || fileType !== 'image') return;
        try {
            const electron = (window as any).electron;
            if (electron?.fileSystem?.read) {
                const data = await electron.fileSystem.read(filePath);
                const blob = new Blob([data]);
                const url = URL.createObjectURL(blob);
                setWallpaper(url);
                addCustomWallpaper(url);
            }
        } catch (err) {
            console.error('Failed to set wallpaper:', err);
        }
    };

    // --- Media controls ---
    const mediaRef = () => fileType === 'video' ? videoRef.current : audioRef.current;

    const togglePlay = useCallback(() => {
        const el = mediaRef();
        if (!el) return;
        if (isPlaying) el.pause();
        else el.play();
    }, [isPlaying, fileType]);

    const seek = useCallback((time: number) => {
        const el = mediaRef();
        if (el) el.currentTime = time;
    }, [fileType]);

    const skipTime = useCallback((delta: number) => {
        const el = mediaRef();
        if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
    }, [fileType]);

    const handleVolumeChange = (val: number) => {
        setVolume(val);
        const el = mediaRef();
        if (el) el.volume = val;
        setIsMuted(val === 0);
    };

    const toggleMute = () => {
        const el = mediaRef();
        if (!el) return;
        const next = !isMuted;
        setIsMuted(next);
        el.muted = next;
    };

    const formatTime = (s: number) => {
        if (!isFinite(s)) return '0:00';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
        if (!isSeeking) setCurrentTime(e.currentTarget.currentTime);
        const buf = e.currentTarget.buffered;
        if (buf.length > 0) setBuffered(buf.end(buf.length - 1));
    };

    // Auto-hide controls for video
    const resetControlsTimer = useCallback(() => {
        if (fileType !== 'video') return;
        setShowControls(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        if (isPlaying) {
            controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [fileType, isPlaying]);

    useEffect(() => { resetControlsTimer(); }, [isPlaying]);

    // Keyboard controls
    useEffect(() => {
        if (!windowData?.isFocused) return;
        const handler = (e: KeyboardEvent) => {
            if (fileType === 'video' || fileType === 'audio') {
                if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
                if (e.code === 'ArrowLeft') { e.preventDefault(); skipTime(-5); }
                if (e.code === 'ArrowRight') { e.preventDefault(); skipTime(5); }
                if (e.code === 'KeyM') { e.preventDefault(); toggleMute(); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [windowData?.isFocused, fileType, togglePlay, skipTime, toggleMute]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;
    const showCheckerboard = fileType === 'image' && TRANSPARENT_EXTS.includes(fileExt);

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-white select-none">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        fileType === 'image' && "bg-pink-500/15",
                        fileType === 'video' && "bg-red-500/15",
                        fileType === 'audio' && "bg-violet-500/15",
                        fileType === 'unknown' && "bg-zinc-500/15"
                    )}>
                        {fileType === 'image' && <Image size={14} className="text-pink-400" />}
                        {fileType === 'video' && <Video size={14} className="text-red-400" />}
                        {fileType === 'audio' && <Music size={14} className="text-violet-400" />}
                        {fileType === 'unknown' && <FileText size={14} className="text-zinc-400" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">{fileName || 'Media Viewer'}</p>
                        {fileType === 'image' && imgDimensions.w > 0 && (
                            <p className="text-[10px] text-zinc-500">{imgDimensions.w} x {imgDimensions.h} &middot; {fileExt.toUpperCase()}</p>
                        )}
                        {(fileType === 'video' || fileType === 'audio') && duration > 0 && (
                            <p className="text-[10px] text-zinc-500">{formatTime(duration)} &middot; {fileExt.toUpperCase()}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {fileType === 'image' && (
                        <button
                            onClick={handleSetAsWallpaper}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-[11px] font-medium transition-colors"
                        >
                            <Upload size={12} />
                            Wallpaper
                        </button>
                    )}
                </div>
            </div>

            {/* Image toolbar */}
            {fileType === 'image' && filePath && (
                <div className="flex items-center justify-center gap-1 px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.04] shrink-0">
                    <button onClick={() => setZoom(z => Math.max(0.1, z - 0.25))} className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-zinc-400 hover:text-white">
                        <ZoomOut size={15} />
                    </button>
                    <span className="text-[11px] text-zinc-500 w-14 text-center font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-zinc-400 hover:text-white">
                        <ZoomIn size={15} />
                    </button>
                    <div className="w-px h-4 bg-white/[0.08] mx-1" />
                    <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-zinc-400 hover:text-white">
                        <RotateCw size={15} />
                    </button>
                    <button onClick={resetView} className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-zinc-400 hover:text-white" title="Reset view">
                        <Minimize2 size={15} />
                    </button>
                </div>
            )}

            {/* Content */}
            <div
                ref={containerRef}
                className="flex-1 overflow-hidden relative"
            >
                {/* Empty state */}
                {!filePath && !error && (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                            <Image size={28} className="text-zinc-600" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm text-zinc-500 font-medium">No media file open</p>
                            <p className="text-xs text-zinc-600 mt-1">Open a file from the file explorer</p>
                        </div>
                    </div>
                )}

                {/* Error state */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center h-full gap-4"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                <FileText size={28} className="text-red-400" />
                            </div>
                            <p className="text-sm text-zinc-400">{error}</p>
                            <button
                                onClick={() => filePath && loadFile(filePath, fileName)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-xs text-zinc-300 transition-colors"
                            >
                                <RefreshCw size={12} />
                                Retry
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Image view */}
                {fileType === 'image' && filePath && !error && (
                    <div
                        className={cn(
                            "h-full w-full flex items-center justify-center overflow-hidden",
                            showCheckerboard && "bg-[length:20px_20px] bg-[position:0_0,10px_10px]"
                        )}
                        style={showCheckerboard ? {
                            backgroundColor: '#18181b',
                            backgroundImage: 'linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)',
                            backgroundSize: '20px 20px',
                            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                        } : { backgroundColor: '#09090b' }}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <motion.img
                            key={filePath}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            src={getFileUrl()}
                            alt={fileName}
                            className="max-w-full max-h-full object-contain select-none"
                            style={{
                                transform: `scale(${zoom}) rotate(${rotation}deg) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                                transition: isPanning ? 'none' : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                                cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                            }}
                            draggable={false}
                            onLoad={(e) => {
                                const img = e.currentTarget;
                                setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                            }}
                            onError={() => setError('Failed to load image')}
                        />
                    </div>
                )}

                {/* Video view */}
                {fileType === 'video' && filePath && !error && (
                    <div className="h-full w-full bg-black flex items-center justify-center relative group"
                         onMouseMove={resetControlsTimer}>
                        <video
                            key={filePath}
                            ref={videoRef}
                            src={getFileUrl()}
                            className="max-w-full max-h-full object-contain"
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => setIsPlaying(false)}
                            onClick={togglePlay}
                            onError={() => setError('Failed to load video')}
                        />

                        {/* Center play overlay */}
                        <AnimatePresence>
                            {!isPlaying && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.2 }}
                                    onClick={togglePlay}
                                    className="absolute inset-0 flex items-center justify-center"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-white/30 transition-colors">
                                        <Play size={28} className="text-white ml-1" />
                                    </div>
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Bottom controls overlay */}
                        <motion.div
                            initial={false}
                            animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 8 }}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-0 left-0 right-0 pointer-events-none"
                            style={{ pointerEvents: showControls ? 'auto' : 'none' }}
                        >
                            <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3 px-4">
                                {/* Progress bar */}
                                <div
                                    className="group/progress w-full h-1.5 bg-white/10 rounded-full mb-3 cursor-pointer relative hover:h-2.5 transition-all"
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const pct = (e.clientX - rect.left) / rect.width;
                                        seek(pct * duration);
                                    }}
                                >
                                    <div
                                        className="absolute top-0 left-0 h-full bg-white/20 rounded-full"
                                        style={{ width: `${bufferedProgress}%` }}
                                    />
                                    <div
                                        className="absolute top-0 left-0 h-full bg-white rounded-full transition-all"
                                        style={{ width: `${progress}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
                                        style={{ left: `calc(${progress}% - 6px)` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => skipTime(-10)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                            <SkipBack size={16} />
                                        </button>
                                        <button onClick={togglePlay} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                                            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                                        </button>
                                        <button onClick={() => skipTime(10)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                            <SkipForward size={16} />
                                        </button>

                                        <span className="text-[11px] text-white/70 font-mono tabular-nums ml-2">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                            {isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
                                        </button>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={isMuted ? 0 : volume}
                                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                            className="w-20 h-1 appearance-none bg-white/20 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                        />
                                        <button
                                            onClick={() => windowData && maximizeWindow(windowData.id)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors ml-1"
                                        >
                                            <Maximize2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Audio view */}
                {fileType === 'audio' && filePath && !error && (
                    <motion.div
                        key={filePath}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-violet-950/20 to-zinc-950 p-8"
                    >
                        {/* Album art placeholder with equalizer */}
                        <div className="relative mb-8">
                            <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/[0.06] flex items-center justify-center overflow-hidden">
                                {isPlaying ? (
                                    <div className="flex items-end gap-[3px] h-12">
                                        {[0, 1, 2, 3, 4].map(i => (
                                            <motion.div
                                                key={i}
                                                className="w-[5px] bg-gradient-to-t from-violet-400 to-fuchsia-400 rounded-full"
                                                animate={{ height: ['12px', `${20 + Math.random() * 28}px`, '8px', `${16 + Math.random() * 32}px`, '12px'] }}
                                                transition={{ duration: 0.8 + i * 0.1, repeat: Infinity, ease: 'easeInOut' }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Music size={48} className="text-white/30" />
                                )}
                            </div>
                            {/* Progress ring */}
                            <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" viewBox="0 0 176 176">
                                <circle cx="88" cy="88" r="84" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
                                <circle
                                    cx="88" cy="88" r="84" fill="none"
                                    stroke="url(#audioGrad)" strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 84}`}
                                    strokeDashoffset={`${2 * Math.PI * 84 * (1 - progress / 100)}`}
                                    transform="rotate(-90 88 88)"
                                    className="transition-all duration-200"
                                />
                                <defs>
                                    <linearGradient id="audioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#8b5cf6" />
                                        <stop offset="100%" stopColor="#d946ef" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        <p className="text-sm font-medium text-white/80 mb-1 truncate max-w-xs">{fileName}</p>
                        <p className="text-[11px] text-zinc-500 font-mono tabular-nums mb-6">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </p>

                        {/* Seek bar */}
                        <div
                            className="w-72 h-1 bg-white/[0.08] rounded-full mb-6 cursor-pointer relative group/seek hover:h-1.5 transition-all"
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const pct = (e.clientX - rect.left) / rect.width;
                                seek(pct * duration);
                            }}
                        >
                            <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity"
                                style={{ left: `calc(${progress}% - 5px)` }}
                            />
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => skipTime(-10)} className="p-2 text-zinc-400 hover:text-white transition-colors">
                                <SkipBack size={20} />
                            </button>
                            <button
                                onClick={togglePlay}
                                className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                            >
                                {isPlaying ? <Pause size={24} className="text-zinc-900" /> : <Play size={24} className="text-zinc-900 ml-1" />}
                            </button>
                            <button onClick={() => skipTime(10)} className="p-2 text-zinc-400 hover:text-white transition-colors">
                                <SkipForward size={20} />
                            </button>
                        </div>

                        {/* Volume */}
                        <div className="flex items-center gap-2 mt-6">
                            <button onClick={toggleMute} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                                {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={isMuted ? 0 : volume}
                                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                className="w-24 h-1 appearance-none bg-white/10 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>

                        <audio
                            ref={audioRef}
                            src={getFileUrl()}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => setIsPlaying(false)}
                            onError={() => setError('Failed to load audio')}
                            className="hidden"
                        />
                    </motion.div>
                )}

                {/* Unknown type */}
                {fileType === 'unknown' && filePath && !error && (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                            <FileText size={28} className="text-zinc-600" />
                        </div>
                        <p className="text-sm text-zinc-500">Unsupported file format</p>
                        <p className="text-xs text-zinc-600">{fileName}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
