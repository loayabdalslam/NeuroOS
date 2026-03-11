import React, { useState, useEffect, useRef } from 'react';
import {
    X, ZoomIn, ZoomOut, RotateCw, ArrowLeft, ArrowRight, Play, Pause,
    Volume2, VolumeX, Maximize, Image, Video, Music, FileText, Download, Upload
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useOS, OSAppWindow } from '../hooks/useOS';
import { useSettingsStore } from '../stores/settingsStore';

interface MediaViewerProps {
    windowData?: OSAppWindow;
}

const MEDIA_EXTENSIONS = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'],
    video: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
};

export const MediaViewer: React.FC<MediaViewerProps> = ({ windowData }) => {
    const { closeWindow, sendAppAction } = useOS();
    const { setWallpaper, addCustomWallpaper } = useSettingsStore();
    
    const [filePath, setFilePath] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [fileType, setFileType] = useState<'image' | 'video' | 'audio' | 'unknown'>('unknown');
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (windowData?.lastAction?.type === 'open_file') {
            const path = windowData.lastAction.payload?.path;
            const name = windowData.lastAction.payload?.name;
            if (path) {
                loadFile(path, name);
            }
        }
    }, [windowData]);

    const loadFile = async (path: string, name?: string) => {
        setFilePath(path);
        setFileName(name || path.split(/[/\\]/).pop() || 'Unknown');
        setError(null);
        setZoom(1);
        setRotation(0);
        
        const ext = path.split('.').pop()?.toLowerCase() || '';
        
        if (MEDIA_EXTENSIONS.image.includes(ext)) {
            setFileType('image');
        } else if (MEDIA_EXTENSIONS.video.includes(ext)) {
            setFileType('video');
        } else if (MEDIA_EXTENSIONS.audio.includes(ext)) {
            setFileType('audio');
        } else {
            setFileType('unknown');
        }
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

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);
    
    const togglePlay = () => {
        if (fileType === 'video' && videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        } else if (fileType === 'audio' && audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (videoRef.current) videoRef.current.volume = vol;
        if (audioRef.current) audioRef.current.volume = vol;
        setIsMuted(vol === 0);
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (videoRef.current) videoRef.current.muted = !isMuted;
        if (audioRef.current) audioRef.current.muted = !isMuted;
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getFileUrl = () => {
        if (!filePath) return '';
        if (filePath.startsWith('blob:') || filePath.startsWith('http')) return filePath;
        return `file://${filePath}`;
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white font-mono">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                        {fileType === 'image' && <Image size={16} />}
                        {fileType === 'video' && <Video size={16} />}
                        {fileType === 'audio' && <Music size={16} />}
                        {fileType === 'unknown' && <FileText size={16} />}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-medium truncate">{fileName}</h1>
                        <p className="text-[10px] text-zinc-400 capitalize">{fileType} file</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {fileType === 'image' && (
                        <button
                            onClick={handleSetAsWallpaper}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs transition-colors"
                        >
                            <Upload size={14} />
                            Set as Wallpaper
                        </button>
                    )}
                    <button
                        onClick={() => windowData?.id && closeWindow(windowData.id)}
                        className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    {fileType === 'image' && (
                        <>
                            <button onClick={handleZoomOut} className="p-2 hover:bg-zinc-700 rounded">
                                <ZoomOut size={16} />
                            </button>
                            <span className="text-xs text-zinc-400 w-16 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={handleZoomIn} className="p-2 hover:bg-zinc-700 rounded">
                                <ZoomIn size={16} />
                            </button>
                            <button onClick={handleRotate} className="p-2 hover:bg-zinc-700 rounded ml-2">
                                <RotateCw size={16} />
                            </button>
                        </>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    {(fileType === 'video' || fileType === 'audio') && (
                        <>
                            <button onClick={togglePlay} className="p-2 hover:bg-zinc-700 rounded">
                                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <div className="flex items-center gap-2">
                                <button onClick={toggleMute} className="p-2 hover:bg-zinc-700 rounded">
                                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                </button>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-20 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer"
                                />
                            </div>
                            <span className="text-xs text-zinc-400 ml-2">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-4">
                {error && (
                    <div className="text-center text-red-400">
                        <p className="text-lg mb-2">Failed to load file</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {!filePath && !error && (
                    <div className="text-center text-zinc-500">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No file selected</p>
                    </div>
                )}

                {fileType === 'image' && filePath && !error && (
                    <div 
                        className="transition-transform duration-200"
                        style={{ 
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }}
                    >
                        <img 
                            src={getFileUrl()} 
                            alt={fileName}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onError={() => setError('Failed to load image')}
                        />
                    </div>
                )}

                {fileType === 'video' && filePath && !error && (
                    <video
                        ref={videoRef}
                        src={getFileUrl()}
                        className="max-w-full max-h-full rounded-lg"
                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onClick={togglePlay}
                    />
                )}

                {fileType === 'audio' && filePath && !error && (
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-48 h-48 bg-zinc-800 rounded-full flex items-center justify-center animate-pulse">
                            <Music size={48} />
                        </div>
                        <audio
                            ref={audioRef}
                            src={getFileUrl()}
                            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            className="w-96"
                        />
                        <div className="flex items-center gap-4">
                            <button onClick={togglePlay} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center">
                                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                            </button>
                        </div>
                    </div>
                )}

                {fileType === 'unknown' && filePath && !error && (
                    <div className="text-center text-zinc-500">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Preview not available for this file type</p>
                        <p className="text-sm mt-2">{fileName}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
