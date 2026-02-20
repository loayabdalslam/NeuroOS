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
        <div className="fixed inset-0 z-[9000] bg-zinc-50 flex items-center justify-center font-sans">
            {/* Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-[100px] animate-pulse" />
                <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/20 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Cancel Button (Only if not first user) */}
            {!isFirstUser && (
                <button
                    onClick={cancelAddUser}
                    className="absolute top-8 right-8 p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                    <X size={24} className="text-zinc-500" />
                </button>
            )}

            <div className="w-full max-w-lg relative z-10">
                {/* Progress */}
                <div className="flex justify-between mb-8 px-4">
                    {STEPS.map((step, idx) => (
                        <div key={step.id} className="flex flex-col items-center gap-2">
                            <div className={cn(
                                "w-3 h-3 rounded-full transition-all duration-500",
                                idx <= currentStep ? "bg-blue-600 scale-110" : "bg-zinc-200"
                            )} />
                            <span className={cn(
                                "text-[10px] font-medium uppercase tracking-wider transition-colors duration-300",
                                idx <= currentStep ? "text-blue-600" : "text-zinc-300"
                            )}>{step.title}</span>
                        </div>
                    ))}
                </div>

                {/* Card */}
                {/* Card */}
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 p-8 border border-white"
                >
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-blue-500 to-violet-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30">
                            <stepData.icon size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900">{isFirstUser && currentStep === 0 ? "Welcome to NeuroOS" : stepData.title}</h2>
                        <p className="text-zinc-500 text-sm mt-2">
                            {currentStep === 0 && "Your intelligent, personalized workspace awaits."}
                            {currentStep === 1 && "Tell us a bit about yourself."}
                            {currentStep === 2 && "Secure your personal environment."}
                            {currentStep === 3 && "Enhance your experience with AI."}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="min-h-[200px] flex flex-col justify-center">
                        {currentStep === 0 && (
                            <div className="text-center space-y-4">
                                <p className="text-zinc-600 leading-relaxed">
                                    NeuroOS is designed to be minimal, fast, and AI-native.
                                    <br />Let's get you set up in less than a minute.
                                </p>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Display Name</label>
                                    <input
                                        autoFocus
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                        placeholder="e.g. Alex"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Bio / Role</label>
                                    <input
                                        value={formData.bio}
                                        onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        placeholder="e.g. Creative Developer"
                                    />
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-6 text-center">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 uppercase mb-3">Create a PIN</label>
                                    <input
                                        type="password"
                                        autoFocus
                                        maxLength={4}
                                        value={formData.pin}
                                        onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/[^0-9]/g, '') })}
                                        className="w-32 mx-auto p-4 text-center text-3xl tracking-[1em] bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                        placeholder="····"
                                    />
                                    <p className="text-xs text-zinc-400 mt-4">Leave empty for no security.</p>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3 items-start">
                                    <Sparkles className="text-blue-500 shrink-0 mt-0.5" size={18} />
                                    <div className="text-xs text-blue-800 leading-relaxed">
                                        NeuroOS works best with a local LLM (Ollama) or an API key. You can configure this fully in Settings later.
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">OpenAI API Key (Optional)</label>
                                    <input
                                        type="password"
                                        value={formData.apiKey}
                                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                                        placeholder="sk-..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-8 flex justify-between items-center">
                        <div className="text-xs text-zinc-400">
                            Step {currentStep + 1} of {STEPS.length}
                        </div>
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 active:scale-95 transition-all shadow-lg shadow-zinc-900/20"
                        >
                            {currentStep === STEPS.length - 1 ? "Finish Setup" : "Continue"}
                            {currentStep === STEPS.length - 1 ? <Check size={18} /> : <ArrowRight size={18} />}
                        </button>
                    </div>

                </motion.div>
            </div>
        </div>
    );
};
