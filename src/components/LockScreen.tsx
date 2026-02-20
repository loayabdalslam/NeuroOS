import React, { useState, useEffect } from 'react';

import { motion, AnimatePresence } from 'framer-motion'; // Changed from 'motion/react' to 'framer-motion'
import { User, ArrowRight, Lock, Plus, X, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { NeuroIcon } from './icons/NeuroIcon';

export const LockScreen: React.FC = () => {
    const { users, login, startAddUser, activeUserId } = useAuthStore();

    // Default to active user (if exists) or first user
    const [selectedUserId, setSelectedUserId] = useState<string | null>(activeUserId || users[0]?.id || null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const selectedUser = users.find(u => u.id === selectedUserId);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Update selection if activeUserId changes (e.g. after adding user)
    useEffect(() => {
        if (activeUserId) setSelectedUserId(activeUserId);
    }, [activeUserId]);

    const handleUnlock = () => {
        if (!selectedUserId) return;

        if (login(selectedUserId, pin)) {
            // Success handled by store update (isAuthenticated -> true)
        } else {
            setError(true);
            setPin('');
            setTimeout(() => setError(false), 500);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleUnlock();
    };

    return (
        <motion.div
            initial={false}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[5000] bg-black/40 backdrop-blur-2xl flex flex-col items-center justify-center text-white"
        >
            {/* Background Image (Optional, could come from user settings) */}
            <div className="absolute inset-0 -z-10 bg-[url('/Background.png')] bg-center bg-cover opacity-50" />
            <div className="absolute inset-0 -z-10 bg-black/40" />

            {/* Time / Date */}
            <div className="absolute top-20 text-center">
                <div className="text-8xl font-thin tracking-tighter text-white/90">
                    {format(currentTime, 'HH:mm')}
                </div>
                <div className="text-xl text-white/60 font-medium">
                    {format(currentTime, 'EEEE, MMMM d')}
                </div>
            </div>

            {/* User Selection & Login */}
            <div className="mt-20 w-full max-w-sm flex flex-col items-center gap-8">

                {/* User List (Horizontal) */}
                <div className="flex items-center gap-6">
                    {users.map(user => (
                        <button
                            key={user.id}
                            onClick={() => { setSelectedUserId(user.id); setPin(''); setError(false); }}
                            className={cn(
                                "flex flex-col items-center gap-3 transition-all duration-300 group outline-none",
                                selectedUserId === user.id ? "scale-110 opacity-100" : "scale-100 opacity-50 hover:opacity-80 hover:scale-105"
                            )}
                        >
                            <div className={cn(
                                "w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all shadow-xl",
                                selectedUserId === user.id ? "border-white shadow-blue-500/20" : "border-white/20"
                            )}>
                                {user.avatar ? (
                                    <img src={user.avatar} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-white flex items-center justify-center text-zinc-900">
                                        <NeuroIcon size={32} showTM={false} />
                                    </div>
                                )}
                            </div>
                            <span className="text-sm font-medium tracking-wide shadow-black/50 drop-shadow-md">{user.name}</span>
                        </button>
                    ))}

                    {/* Add User Button */}
                    <button
                        onClick={startAddUser}
                        className="flex flex-col items-center gap-3 transition-all duration-300 opacity-50 hover:opacity-100 hover:scale-105 group"
                    >
                        <div className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-white/20 bg-white/10 group-hover:bg-white/20">
                            <Plus size={32} className="text-white/80" />
                        </div>
                        <span className="text-sm font-medium tracking-wide shadow-black/50 drop-shadow-md">Add User</span>
                    </button>
                </div>

                {/* Login Input for Selected User */}
                <AnimatePresence mode="wait">
                    {selectedUser && (
                        <motion.div
                            key={selectedUser?.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full flex flex-col items-center gap-4"
                        >
                            {/* Only show input if PIN is required, else just a button */}
                            {selectedUser.pin ? (
                                <div className={cn(
                                    "relative flex items-center transition-transform duration-100",
                                    error ? "translate-x-[-10px] animate-pulse text-red-500" : ""
                                )}>
                                    <input
                                        type="password"
                                        autoFocus={!!selectedUserId}
                                        value={pin}
                                        onChange={e => { setPin(e.target.value.replace(/[^0-9]/g, '')); setError(false); }}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter PIN"
                                        className={cn(
                                            "bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 text-center text-white placeholder:text-white/30 outline-none focus:bg-white/20 focus:border-white/30 transition-all w-48 tracking-widest",
                                            error && "border-red-500/50 bg-red-500/10"
                                        )}
                                    />
                                    <button
                                        onClick={handleUnlock}
                                        className="absolute right-2 p-2 rounded-full hover:bg-white/10 transition-colors"
                                    >
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleUnlock}
                                    className="px-8 py-3 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/10 rounded-full backdrop-blur-md transition-all font-medium text-sm tracking-wide"
                                >
                                    Login
                                </button>
                            )}

                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-2 text-red-400 text-sm font-medium bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20"
                                    >
                                        <AlertCircle size={14} />
                                        <span>Incorrect PIN</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Quick Actions Footer - Removed Sleep for now */}
            <div className="absolute bottom-8 flex gap-8 text-white/40">
                {/* Future: Shutdown / Restart controls */}
            </div>
        </motion.div>
    );
};
