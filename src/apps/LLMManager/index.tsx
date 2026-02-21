import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Bot, Save, AlertCircle, CheckCircle } from 'lucide-react';

export const LLMManager: React.FC = () => {
    const { aiConfig, updateAiConfig } = useSettingsStore();
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // For LLM Manager, we'll focus on the first provider or the active one
    const activeProvider = aiConfig.providers.find(p => p.id === aiConfig.activeProviderId) || aiConfig.providers[0];

    const handleSave = () => {
        setStatus('saving');
        setTimeout(() => setStatus('saved'), 800);
        setTimeout(() => setStatus('idle'), 2500);
    };

    const handleUpdateProvider = (type: string) => {
        // Find existing or update
        const providers = [...aiConfig.providers];
        const idx = providers.findIndex(p => p.type === type);
        if (idx !== -1) {
            updateAiConfig({ activeProviderId: providers[idx].id });
        }
    };

    const updateCurrentProvider = (updates: Partial<any>) => {
        if (!activeProvider) return;
        const providers = aiConfig.providers.map(p =>
            p.id === activeProvider.id ? { ...p, ...updates } : p
        );
        updateAiConfig({ providers });
    };

    // if Ollama or LMStudio provider and baseUrl changes, attempt to refresh model list
    useEffect(() => {
        const fetchModels = async (url: string) => {
            try {
                const cleanUrl = url.replace(/\/+$/g, '');
                const res = await fetch(`${cleanUrl}/api/tags`);
                if (res.ok) {
                    const data = await res.json();
                    let list: string[] = [];
                    if (Array.isArray(data)) {
                        list = data;
                    } else if (data.tags) {
                        list = data.tags;
                    } else if (data.models) {
                        list = data.models.map((m: any) => m.name || m.model || m);
                    }
                    if (list.length && activeProvider) {
                        updateCurrentProvider({ models: list });
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch models in manager from', url, e);
            }
        };

        if (activeProvider && (activeProvider.type === 'ollama' || activeProvider.type === 'lmstudio')) {
            if (activeProvider.baseUrl) {
                fetchModels(activeProvider.baseUrl);
            }
        }
    }, [activeProvider?.baseUrl]);

    return (
        <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-zinc-100 rounded-xl">
                    <Bot size={24} className="text-zinc-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Large Language Models</h1>
                    <p className="text-sm text-zinc-500">Configure your local and cloud AI providers</p>
                </div>
            </div>

            <div className="space-y-6 max-w-2xl">
                {/* Provider Selection */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-700">AI Provider</label>
                    <div className="grid grid-cols-3 gap-3">
                        {aiConfig.providers.map(p => {
                            const isSelected = activeProvider?.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handleUpdateProvider(p.type)}
                                    className={`
                                        p-4 rounded-xl border text-left transition-all
                                        ${isSelected
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                                            : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                                        }
                                    `}
                                >
                                    <div className="font-semibold capitalize mb-1">{p.name}</div>
                                    <div className="text-[10px] opacity-70">
                                        {p.type === 'ollama' && 'Local Llama 3/Mistral'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Configuration Fields */}
                <div className="p-5 border border-zinc-200 rounded-2xl bg-zinc-50 space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {activeProvider?.type === 'ollama' ? 'Ollama Configuration' : 'Provider Settings'}
                    </h3>

                    <div className="grid gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-500">Base URL</label>
                            <input
                                type="text"
                                value={activeProvider?.baseUrl || ''}
                                onChange={(e) => updateCurrentProvider({ baseUrl: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="http://localhost:11434"
                            />
                        </div>

                        {activeProvider?.type !== 'ollama' && activeProvider?.type !== 'lmstudio' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">API Key</label>
                                <input
                                    type="password"
                                    value={activeProvider?.apiKey || ''}
                                    onChange={(e) => updateCurrentProvider({ apiKey: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="sk-..."
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-500">Model Name</label>
                            <input
                                type="text"
                                value={activeProvider?.selectedModel || ''}
                                onChange={(e) => updateCurrentProvider({ selectedModel: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="llama3"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={status === 'saving'}
                        className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                        {status === 'saving' ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : status === 'saved' ? (
                            <CheckCircle size={16} />
                        ) : (
                            <Save size={16} />
                        )}
                        {status === 'saved' ? 'Saved Changes' : 'Save Configuration'}
                    </button>

                    {status === 'error' && (
                        <div className="flex items-center gap-2 text-red-500 text-sm">
                            <AlertCircle size={16} />
                            <span>Connection failed</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
