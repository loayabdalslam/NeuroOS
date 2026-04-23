import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, User, Shield, Bot, Check, Sparkles, X, ChevronDown, FolderOpen } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { useSettingsStore } from '../stores/settingsStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { ProviderLogos } from './icons/ProviderIcons';

const STEPS = [
    { id: 'welcome', title: 'Welcome', icon: Sparkles },
    { id: 'profile', title: 'Profile', icon: User },
    { id: 'security', title: 'Security', icon: Shield },
    { id: 'workspace', title: 'Workspace', icon: FolderOpen },
    { id: 'ai', title: 'Intelligence', icon: Bot },
];

export const OnboardingFlow: React.FC = () => {
    const { addUser, users, cancelAddUser } = useAuthStore();
    const { aiConfig, updateAiConfig, updateProvider, refreshProviderModels } = useSettingsStore();
    const { setWorkspace } = useWorkspaceStore();

    const [currentStep, setCurrentStep] = useState(users.length > 0 ? 1 : 0);
    const [formData, setFormData] = useState({ name: '', bio: '', avatar: '', pin: '' });
    const [workspacePath, setWorkspacePath] = useState<string>('');

    const providers = aiConfig.providers;
    const [selectedProviderId, setSelectedProviderId] = useState<string>(aiConfig.activeProviderId || providers[0]?.id);
    const currentProvider = providers.find(p => p.id === selectedProviderId);

    const [baseUrl, setBaseUrl] = useState(currentProvider?.baseUrl || '');
    const [apiKey, setApiKey] = useState(currentProvider?.apiKey || '');
    const [selectedModel, setSelectedModel] = useState(currentProvider?.selectedModel || '');
    const [customModel, setCustomModel] = useState('');
    const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);

    React.useEffect(() => {
        const p = providers.find(p => p.id === selectedProviderId);
        if (p) {
            setBaseUrl(p.baseUrl);
            setApiKey(p.apiKey);
            setSelectedModel(p.selectedModel);
            setCustomModel('');
        }
    }, [selectedProviderId, providers]);

    const handleSelectWorkspace = async () => {
        const electron = (window as any).electron;
        if (electron?.fileSystem?.selectDirectory) {
            const path = await electron.fileSystem.selectDirectory();
            if (path) setWorkspacePath(path);
        } else {
            // Browser mode - use a virtual path
            const name = prompt('Enter workspace folder name:', 'my-workspace');
            if (name) setWorkspacePath(`/virtual/${name}`);
        }
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1);
        else handleComplete();
    };

    const handleComplete = () => {
        addUser({
            name: formData.name || 'User',
            bio: formData.bio || 'NeuroOS Pilot',
            avatar: formData.avatar,
            pin: formData.pin || null
        });

        if (workspacePath) {
            setWorkspace(workspacePath);
        }

        if (currentProvider) {
            updateProvider(currentProvider.id, {
                baseUrl,
                apiKey,
                selectedModel: customModel || selectedModel
            });
            updateAiConfig({ activeProviderId: currentProvider.id });
        }
    };

    const stepData = STEPS[currentStep];
    const isFirstUser = users.length === 0;

    return (
        <div className="fixed inset-0 z-[9000] bg-white flex items-center justify-center font-sans">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-100 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-100 to-transparent" />
            </div>

            {!isFirstUser && (
                <button onClick={cancelAddUser} className="absolute top-8 right-8 p-3 rounded-full bg-zinc-50 hover:bg-zinc-100 transition-all border border-zinc-100">
                    <X size={20} className="text-zinc-400" />
                </button>
            )}

            <div className="w-full max-w-lg relative z-10 px-6 pt-16 transition-all duration-700">
                <div className="text-center mb-16">
                    <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-light tracking-tighter text-zinc-900">
                        Neuro OS
                    </motion.h1>
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.8 }} className="h-[1px] w-12 bg-zinc-900 mx-auto mt-4 origin-center" />
                </div>

                <div className="flex justify-center gap-2 mb-12">
                    {STEPS.map((_, idx) => (
                        <div key={idx} className={cn("h-[2px] transition-all duration-700 ease-out", idx === currentStep ? "w-8 bg-zinc-900" : "w-2 bg-zinc-100")} />
                    ))}
                </div>

                <motion.div key={currentStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="space-y-12">
                    <div className="text-center space-y-4">
                        <h2 className="text-xl font-medium tracking-tight text-zinc-900">
                            {isFirstUser && currentStep === 0 ? "Installation" : stepData.title}
                        </h2>
                        <p className="text-zinc-400 text-sm max-w-[280px] mx-auto leading-relaxed">
                            {currentStep === 0 && "Your intelligent workspace is ready for initial configuration."}
                            {currentStep === 1 && "Create your personal profile within the Neuro environment."}
                            {currentStep === 2 && "Configure access control and security protocols."}
                            {currentStep === 3 && "Choose where to store your files and projects."}
                            {currentStep === 4 && "Finalize intelligence core integration."}
                        </p>
                    </div>

                    <div className="min-h-[180px] flex flex-col justify-center px-4">
                        {/* Welcome */}
                        {currentStep === 0 && (
                            <div className="text-center">
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-full border border-zinc-100 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                                    <Sparkles size={12} className="text-zinc-900" />
                                    Version 2.7.0 "Frontier"
                                </motion.div>
                            </div>
                        )}

                        {/* Profile */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Identity</label>
                                    <input autoFocus value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all font-medium text-zinc-900 placeholder:text-zinc-200" placeholder="Enter your name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Role</label>
                                    <input value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all text-zinc-600 placeholder:text-zinc-200" placeholder="Designer, Engineer, Researcher..." />
                                </div>
                            </div>
                        )}

                        {/* Security */}
                        {currentStep === 2 && (
                            <div className="space-y-8 text-center">
                                <div className="space-y-4 relative">
                                    <div className="flex justify-center gap-3 cursor-text" onClick={() => document.getElementById('pin-input')?.focus()}>
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} className={cn("w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-300", formData.pin.length > i ? "bg-zinc-900 border-zinc-900 text-white" : "bg-zinc-50 border-zinc-100")}>
                                                {formData.pin.length > i && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        ))}
                                    </div>
                                    <input id="pin-input" type="tel" autoFocus maxLength={4} value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/[^0-9]/g, '') })} className="absolute inset-0 opacity-0 cursor-text" />
                                    <p className="text-[11px] text-zinc-300 uppercase tracking-widest">Secure PIN Access</p>
                                </div>
                            </div>
                        )}

                        {/* Workspace */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <button
                                    onClick={handleSelectWorkspace}
                                    className="w-full p-6 bg-zinc-50 border border-zinc-100 rounded-2xl hover:bg-zinc-100 hover:border-zinc-200 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                            <FolderOpen size={24} className="text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-semibold text-zinc-900">Select Workspace Folder</h3>
                                            <p className="text-[11px] text-zinc-400 mt-0.5">Choose where to store your files and projects</p>
                                        </div>
                                        <ArrowRight size={16} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                                    </div>
                                </button>
                                {workspacePath && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2">
                                        <Check size={14} className="text-emerald-500" />
                                        <span className="text-xs text-emerald-700 font-mono truncate">{workspacePath}</span>
                                    </motion.div>
                                )}
                                <p className="text-[10px] text-zinc-400 text-center">You can change this later in the File Explorer</p>
                            </div>
                        )}

                        {/* AI Provider */}
                        {currentStep === 4 && (
                            <div className="space-y-8">
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-zinc-200 to-zinc-100 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                    <div className="relative p-5 bg-white rounded-2xl border border-zinc-100 flex items-start gap-4 shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                                            <Bot size={20} className="text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-zinc-900">Intelligence Core</h3>
                                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                                                Select your primary neural engine. <span className="font-semibold text-emerald-600">OpenCode</span> and local instances are zero-cost. Enterprise APIs require a key.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Core Provider</label>
                                        <div className="relative">
                                            <button
                                                onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
                                                className="w-full p-4 bg-zinc-50/50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all text-zinc-700 flex items-center justify-between text-left shadow-sm group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {currentProvider && (() => {
                                                        const Icon = ProviderLogos[currentProvider.type] || ProviderLogos.custom;
                                                        return (
                                                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-zinc-100 flex items-center justify-center">
                                                                <Icon size={18} className="text-zinc-900" />
                                                            </div>
                                                        );
                                                    })()}
                                                    <div>
                                                        <span className="text-sm font-semibold">{currentProvider?.name || 'Select Provider'}</span>
                                                        {['opencode', 'ollama', 'lmstudio'].includes(currentProvider?.type || '') && (
                                                            <span className="ml-2 text-[7px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">FREE</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronDown size={14} className={cn("text-zinc-300 transition-transform duration-500", providerDropdownOpen && "rotate-180")} />
                                            </button>

                                            {providerDropdownOpen && (
                                                <motion.div 
                                                    initial={{ opacity: 0, scale: 0.98, y: -4 }} 
                                                    animate={{ opacity: 1, scale: 1, y: 0 }} 
                                                    className="absolute top-full left-0 right-0 mt-3 bg-white/80 backdrop-blur-xl border border-zinc-200/50 rounded-2xl shadow-2xl z-[100] overflow-hidden max-h-[320px] overflow-y-auto p-1.5"
                                                >
                                                    {providers.map(p => {
                                                        const Icon = ProviderLogos[p.type] || ProviderLogos.custom;
                                                        const isFree = ['opencode', 'ollama', 'lmstudio'].includes(p.type);
                                                        const isSelected = selectedProviderId === p.id;
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => { 
                                                                    setSelectedProviderId(p.id); 
                                                                    setProviderDropdownOpen(false);
                                                                    if (p.type === 'ollama' || p.type === 'lmstudio') {
                                                                        refreshProviderModels(p.id);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "w-full px-3 py-2.5 flex items-center gap-3 rounded-xl transition-all text-left",
                                                                    isSelected ? "bg-zinc-900 text-white" : "hover:bg-zinc-50"
                                                                )}
                                                            >
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                                    isSelected ? "bg-white/10" : "bg-zinc-100"
                                                                )}>
                                                                    <Icon size={16} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold truncate">{p.name}</span>
                                                                        {isFree && <span className={cn("text-[6px] font-black px-1.5 py-0.5 rounded-full", isSelected ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-50 text-emerald-600")}>FREE</span>}
                                                                    </div>
                                                                </div>
                                                                {isSelected && <Check size={12} className="text-white" />}
                                                            </button>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>

                                    {/* API Key or Base URL Container */}
                                    <div className="space-y-4">
                                        {currentProvider && !['ollama', 'lmstudio', 'opencode'].includes(currentProvider.type) && (
                                            <div className="space-y-2">
                                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Access Key</label>
                                                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full p-4 bg-zinc-50/50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all font-mono text-[10px] text-zinc-900 placeholder:text-zinc-300" placeholder="••••••••••••••••" />
                                            </div>
                                        )}

                                        {currentProvider && ['ollama', 'lmstudio'].includes(currentProvider.type) && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between ml-1">
                                                     <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Instance URL</label>
                                                     {['ollama', 'lmstudio'].includes(currentProvider.type) && (
                                                         <button 
                                                             onClick={() => refreshProviderModels(currentProvider.id, baseUrl)}
                                                             className="text-[8px] font-bold text-zinc-400 hover:text-emerald-500 transition-colors uppercase tracking-[0.1em]"
                                                         >
                                                             Confirm URL & Sync
                                                         </button>
                                                     )}
                                                 </div>
                                                 <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="w-full p-4 bg-zinc-50/50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all text-sm font-medium text-zinc-900" placeholder="http://localhost:11434" />
                                             </div>
                                         )}

                                         {/* Model Selection */}
                                         {currentProvider && currentProvider.models && currentProvider.models.length > 0 && (
                                             <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
                                                 <div className="flex items-center justify-between ml-1">
                                                     <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Neural Architecture</label>
                                                     {['ollama', 'lmstudio'].includes(currentProvider.type) && (
                                                         <button 
                                                             onClick={() => refreshProviderModels(currentProvider.id, baseUrl)}
                                                             className="text-[9px] font-bold text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest flex items-center gap-1"
                                                         >
                                                             Sync Models
                                                         </button>
                                                     )}
                                                 </div>
                                                <div className="relative">
                                                    <select
                                                        value={customModel || selectedModel}
                                                        onChange={e => { setCustomModel(''); setSelectedModel(e.target.value); }}
                                                        className="w-full p-4 bg-zinc-50/50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-zinc-900 transition-all text-sm font-medium text-zinc-700 appearance-none cursor-pointer pr-10 shadow-sm"
                                                    >
                                                        {currentProvider.models.map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-300">
                                                        <ChevronDown size={14} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <button onClick={handleNext} className="group flex items-center gap-3 bg-zinc-900 text-white px-10 py-4 rounded-full font-medium hover:bg-zinc-800 active:scale-95 transition-all shadow-xl shadow-zinc-200">
                            <span className="text-sm tracking-tight">{currentStep === STEPS.length - 1 ? "Complete Configuration" : "Continue"}</span>
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.3em]">0{currentStep + 1} / 0{STEPS.length}</span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
