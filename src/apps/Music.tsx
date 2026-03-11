import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat,
    Music, Disc, ListMusic, FolderOpen, Upload, Heart, MoreVertical, Search,
    X, Plus, Mic, MonitorSpeaker, Laptop
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Track {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration: number;
    src: string;
    cover?: string;
}

interface Playlist {
    id: string;
    name: string;
    tracks: Track[];
}

interface MusicAppProps {
    windowData?: any;
}

export const MusicApp: React.FC<MusicAppProps> = ({ windowData }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isShuffle, setIsShuffle] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
    const [searchQuery, setSearchQuery] = useState('');
    const [showLibrary, setShowLibrary] = useState(true);
    const [playlists, setPlaylists] = useState<Playlist[]>([
        { id: 'favorites', name: 'Favorites', tracks: [] },
        { id: 'recent', name: 'Recently Played', tracks: [] }
    ]);
    const [activeTab, setActiveTab] = useState<'library' | 'playlists' | 'search'>('library');
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const savedTracks = localStorage.getItem('neuro-music-tracks');
        if (savedTracks) {
            try {
                setTracks(JSON.parse(savedTracks));
            } catch (e) {
                console.error('Failed to parse saved tracks:', e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('neuro-music-tracks', JSON.stringify(tracks));
    }, [tracks]);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(console.error);
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentTrack]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newTracks: Track[] = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const url = URL.createObjectURL(file);
            
            const audio = new Audio(url);
            try {
                await new Promise<void>((resolve) => {
                    audio.onloadedmetadata = () => {
                        const track: Track = {
                            id: `track-${Date.now()}-${i}`,
                            title: file.name.replace(/\.[^/.]+$/, ''),
                            artist: 'Unknown Artist',
                            album: 'Unknown Album',
                            duration: audio.duration || 0,
                            src: url,
                            cover: undefined
                        };
                        newTracks.push(track);
                        resolve();
                    };
                    audio.onerror = () => resolve();
                });
            } catch (err) {
                console.error('Error loading audio file:', err);
            }
        }

        setTracks(prev => [...prev, ...newTracks]);
        if (newTracks.length > 0 && !currentTrack) {
            setCurrentTrack(newTracks[0]);
        }
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [currentTrack]);

    const playTrack = useCallback((track: Track) => {
        setCurrentTrack(track);
        setIsPlaying(true);
        setCurrentTime(0);
    }, []);

    const togglePlay = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    }, []);

    const handleLoadedMetadata = useCallback(() => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    }, []);

    const handleEnded = useCallback(() => {
        if (repeatMode === 'one') {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
            }
        } else {
            playNext();
        }
    }, [repeatMode]);

    const playNext = useCallback(() => {
        if (!currentTrack || tracks.length === 0) return;
        
        let nextIndex: number;
        if (isShuffle) {
            nextIndex = Math.floor(Math.random() * tracks.length);
        } else {
            const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
            nextIndex = (currentIndex + 1) % tracks.length;
        }
        
        playTrack(tracks[nextIndex]);
    }, [currentTrack, tracks, isShuffle, playTrack]);

    const playPrevious = useCallback(() => {
        if (!currentTrack || tracks.length === 0) return;
        
        if (currentTime > 3) {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
            }
            return;
        }
        
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const prevIndex = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1;
        playTrack(tracks[prevIndex]);
    }, [currentTrack, tracks, currentTime, playTrack]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
        setCurrentTime(time);
    }, []);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        setIsMuted(vol === 0);
    }, []);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const filteredTracks = tracks.filter(track =>
        track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const addToFavorites = useCallback((track: Track) => {
        setPlaylists(prev => prev.map(p => {
            if (p.id === 'favorites') {
                if (p.tracks.find(t => t.id === track.id)) return p;
                return { ...p, tracks: [...p.tracks, track] };
            }
            return p;
        }));
    }, []);

    const isFavorite = useCallback((trackId: string) => {
        return playlists.find(p => p.id === 'favorites')?.tracks.some(t => t.id === trackId) || false;
    }, [playlists]);

    return (
        <div className="flex flex-col h-full bg-white text-zinc-900 font-mono">
            <audio
                ref={audioRef}
                src={currentTrack?.src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-900 text-white flex items-center justify-center rounded-xl">
                        <Music size={20} />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold">Neuro Music</h1>
                        <p className="text-[10px] text-zinc-500">{tracks.length} tracks</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-900 text-white rounded-lg text-xs hover:bg-zinc-800"
                    >
                        <Upload size={14} />
                        Add Music
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-56 border-r border-zinc-200 flex flex-col">
                    <div className="flex border-b border-zinc-200">
                        <button
                            onClick={() => setActiveTab('library')}
                            className={cn(
                                "flex-1 px-3 py-2 text-xs font-medium",
                                activeTab === 'library' ? "text-zinc-900 border-b-2 border-zinc-900" : "text-zinc-500"
                            )}
                        >
                            Library
                        </button>
                        <button
                            onClick={() => setActiveTab('playlists')}
                            className={cn(
                                "flex-1 px-3 py-2 text-xs font-medium",
                                activeTab === 'playlists' ? "text-zinc-900 border-b-2 border-zinc-900" : "text-zinc-500"
                            )}
                        >
                            Playlists
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {activeTab === 'library' && (
                            <div className="space-y-1">
                                {tracks.map(track => (
                                    <button
                                        key={track.id}
                                        onClick={() => playTrack(track)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left hover:bg-zinc-50 transition-colors",
                                            currentTrack?.id === track.id && "bg-zinc-100"
                                        )}
                                    >
                                        <div className="w-8 h-8 bg-zinc-200 rounded flex items-center justify-center shrink-0">
                                            {currentTrack?.id === track.id && isPlaying ? (
                                                <div className="w-3 h-3 bg-zinc-900 rounded-full animate-pulse" />
                                            ) : (
                                                <Music size={12} className="text-zinc-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs truncate">{track.title}</div>
                                            <div className="text-[10px] text-zinc-400 truncate">{track.artist}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeTab === 'playlists' && (
                            <div className="space-y-2">
                                {playlists.map(playlist => (
                                    <button
                                        key={playlist.id}
                                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-50"
                                    >
                                        <div className="w-8 h-8 bg-zinc-900 text-white rounded flex items-center justify-center">
                                            <ListMusic size={12} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-xs">{playlist.name}</div>
                                            <div className="text-[10px] text-zinc-400">{playlist.tracks.length} tracks</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-zinc-200">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tracks..."
                                className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-zinc-400"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-2">
                            {filteredTracks.length === 0 ? (
                                <div className="text-center py-12">
                                    <Music size={48} className="mx-auto text-zinc-300 mb-4" />
                                    <p className="text-sm text-zinc-500">No tracks found</p>
                                    <p className="text-xs text-zinc-400">Add music to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredTracks.map((track, index) => (
                                        <div
                                            key={track.id}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 group cursor-pointer",
                                                currentTrack?.id === track.id && "bg-zinc-100"
                                            )}
                                            onClick={() => playTrack(track)}
                                        >
                                            <span className="w-6 text-[10px] text-zinc-400">{index + 1}</span>
                                            <div className="w-10 h-10 bg-zinc-200 rounded flex items-center justify-center shrink-0">
                                                {currentTrack?.id === track.id && isPlaying ? (
                                                    <div className="flex gap-0.5">
                                                        <div className="w-1 h-3 bg-zinc-900 animate-pulse" />
                                                        <div className="w-1 h-4 bg-zinc-900 animate-pulse" style={{ animationDelay: '0.1s' }} />
                                                        <div className="w-1 h-2 bg-zinc-900 animate-pulse" style={{ animationDelay: '0.2s' }} />
                                                    </div>
                                                ) : (
                                                    <Play size={14} className="text-zinc-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm truncate">{track.title}</div>
                                                <div className="text-[10px] text-zinc-400">{track.artist}</div>
                                            </div>
                                            <div className="text-[10px] text-zinc-400">
                                                {formatTime(track.duration)}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); addToFavorites(track); }}
                                                className={cn(
                                                    "opacity-0 group-hover:opacity-100 transition-opacity p-1",
                                                    isFavorite(track.id) ? "text-red-500" : "text-zinc-400 hover:text-red-500"
                                                )}
                                            >
                                                <Heart size={14} fill={isFavorite(track.id) ? "currentColor" : "none"} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Player Controls */}
            <div className="border-t border-zinc-200 p-4 bg-zinc-50">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] text-zinc-400 w-10">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-zinc-200 rounded-full appearance-none cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-400 w-10">{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 w-64">
                        {currentTrack ? (
                            <>
                                <div className="w-12 h-12 bg-zinc-900 rounded-lg flex items-center justify-center animate-pulse">
                                    <Disc size={24} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm truncate">{currentTrack.title}</div>
                                    <div className="text-[10px] text-zinc-400 truncate">{currentTrack.artist}</div>
                                </div>
                            </>
                        ) : (
                            <div className="text-xs text-zinc-400">No track selected</div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsShuffle(!isShuffle)}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                isShuffle ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                            )}
                        >
                            <Shuffle size={16} />
                        </button>
                        
                        <button
                            onClick={playPrevious}
                            className="p-2 text-zinc-600 hover:text-zinc-900"
                        >
                            <SkipBack size={20} />
                        </button>
                        
                        <button
                            onClick={togglePlay}
                            disabled={!currentTrack}
                            className="w-12 h-12 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                        </button>
                        
                        <button
                            onClick={playNext}
                            className="p-2 text-zinc-600 hover:text-zinc-900"
                        >
                            <SkipForward size={20} />
                        </button>
                        
                        <button
                            onClick={() => setRepeatMode(prev => {
                                if (prev === 'none') return 'all';
                                if (prev === 'all') return 'one';
                                return 'none';
                            })}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                repeatMode !== 'none' ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                            )}
                        >
                            <Repeat size={16} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-40 justify-end">
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="p-2 text-zinc-400 hover:text-zinc-600"
                        >
                            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-zinc-200 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
