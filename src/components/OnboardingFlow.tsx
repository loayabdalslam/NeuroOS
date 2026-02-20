import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, User, Shield, Bot, Check, Sparkles, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { useSettingsStore } from '../stores/settingsStore';

// Steps
const STEPS = [
    { id: 'welcome', title: 'Welcome', icon: Sparkles },
    { id: 'profile', title: 'Profile', icon: User },
    { id: 'security', title: 'Security', icon: Shield },
    { id: 'ai', title: 'Intelligence', icon: Bot },
];

export const OnboardingFlow: React.FC = () => {
    const { addUser, users, cancelAddUser } = useAuthStore();
    const { updateAiConfig } = useSettingsStore();

    const [currentStep, setCurrentStep] = useState(users.length > 0 ? 1 : 0);
    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        avatar: '',
        pin: '',
        apiKey: ''
    });

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        // Save User
        addUser({
            name: formData.name || 'User',
            bio: formData.bio || 'NeuroOS Pilot',
            avatar: formData.avatar,
            pin: formData.pin || null
        });

        // Save AI Config if provided
        if (formData.apiKey) {
            // Logic to update the correct provider. Assuming OpenAI for simplicity or default active.
            // For now, let's just leave AI config for the specific settings page to avoid complexity here
            // or maybe set it for the first provider.
        }
    };

    const stepData = STEPS[currentStep];
    const isFirstUser = users.length === 0;

    return (
        <div className="fixed inset-0 z-[9000] bg-white flex items-center justify-center font-sans">
            {/* Minimalist Background Decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-100 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-100 to-transparent" />
            </div>

            {/* Cancel Button (Only if not first user) */}
            {!isFirstUser && (
                <button
                    onClick={cancelAddUser}
                    className="absolute top-8 right-8 p-3 rounded-full bg-zinc-50 hover:bg-zinc-100 transition-all border border-zinc-100"
                >
                    <X size={20} className="text-zinc-400" />
                </button>
            )}

            <div className="w-full max-w-lg relative z-10 px-6">
                {/* Branding */}
                <div className="text-center mb-16">
                    <motion.h1
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-light tracking-tighter text-zinc-900"
                    >
                        Neuro OS<span className="align-top text-[12px] ml-1 font-bold">TM</span>
                    </motion.h1>
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="h-[1px] w-12 bg-zinc-900 mx-auto mt-4 origin-center"
                    />
                </div>

                {/* Progress */}
                <div className="flex justify-center gap-2 mb-12">
                    {STEPS.map((_, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "h-[2px] transition-all duration-700 ease-out",
                                idx === currentStep ? "w-8 bg-zinc-900" : "w-2 bg-zinc-100"
                            )}
                        />
                    ))}
                </div>

                {/* Card */}
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-12"
                >
                    {/* Header */}
                    <div className="text-center space-y-4">
                        <h2 className="text-xl font-medium tracking-tight text-zinc-900">
                            {isFirstUser && currentStep === 0 ? "Installation" : stepData.title}
                        </h2>
                        <p className="text-zinc-400 text-sm max-w-[280px] mx-auto leading-relaxed">
                            {currentStep === 0 && "Your intelligent workspace is ready for initial configuration."}
                            {currentStep === 1 && "Create your personal profile within the Neuro environment."}
                            {currentStep === 2 && "Configure access control and security protocols."}
                            {currentStep === 3 && "Finalize intelligence core integration."}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="min-h-[180px] flex flex-col justify-center px-4">
                        {currentStep === 0 && (
                            <div className="text-center">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-full border border-zinc-100 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400"
                                >
                                    <Sparkles size={12} className="text-zinc-900" />
                                    Version 2030.1
                                </motion.div>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Identity</label>
                                    <input
                                        autoFocus
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all font-medium text-zinc-900 placeholder:text-zinc-200"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Role</label>
                                    <input
                                        value={formData.bio}
                                        onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                        className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all text-zinc-600 placeholder:text-zinc-200"
                                        placeholder="Designer, Engineer, Researcher..."
                                    />
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-8 text-center">
                                <div className="space-y-4 relative">
                                    <div
                                        className="flex justify-center gap-3 cursor-text"
                                        onClick={() => document.getElementById('pin-input')?.focus()}
                                    >
                                        {[0, 1, 2, 3].map(i => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-300",
                                                    formData.pin.length > i ? "bg-zinc-900 border-zinc-900 text-white" : "bg-zinc-50 border-zinc-100"
                                                )}
                                            >
                                                {formData.pin.length > i && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        ))}
                                    </div>
                                    <input
                                        id="pin-input"
                                        type="tel"
                                        autoFocus
                                        maxLength={4}
                                        value={formData.pin}
                                        onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/[^0-9]/g, '') })}
                                        className="absolute inset-0 opacity-0 cursor-text"
                                    />
                                    <p className="text-[11px] text-zinc-300 uppercase tracking-widest">Secure PIN Access</p>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-2">
                                    <div className="flex items-center gap-2 text-zinc-900">
                                        <Bot size={14} />
                                        <span className="text-[11px] font-bold uppercase tracking-wider">AI Integration</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                        NeuroOS utilizes neural engines for automation. You can provide an API key now or connect to local Ollama later.
                                    </p>
                                </div>
                                <input
                                    type="password"
                                    value={formData.apiKey}
                                    onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                    className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all font-mono text-xs text-zinc-600 placeholder:text-zinc-200"
                                    placeholder="sk-..."
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col items-center gap-6">
                        <button
                            onClick={handleNext}
                            className="group flex items-center gap-3 bg-zinc-900 text-white px-10 py-4 rounded-full font-medium hover:bg-zinc-800 active:scale-95 transition-all shadow-xl shadow-zinc-200"
                        >
                            <span className="text-sm tracking-tight">
                                {currentStep === STEPS.length - 1 ? "Complete Configuration" : "Continue"}
                            </span>
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.3em]">
                            0{currentStep + 1} / 0{STEPS.length}
                        </span>
                    </div>

                </motion.div>
            </div>
        </div>
    );
};
