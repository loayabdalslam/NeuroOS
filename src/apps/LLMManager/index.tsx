import React, { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Bot, Save, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export const LLMManager: React.FC = () => {
    const { aiConfig, updateAiConfig, updateProvider } = useSettingsStore();
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    const activeProvider = aiConfig.providers.find(p => p.id === aiConfig.activeProviderId) || aiConfig.providers[0];

    const handleSave = useCallback(() => {
        setStatus('saving');
        setTimeout(() => setStatus('saved'), 800);
        setTimeout(() => setStatus('idle'), 2500);
    }, []);

    const handleSelectProvider = useCallback((providerId: string) => {
        updateAiConfig({ activeProviderId: providerId });
    }, [updateAiConfig]);

    const updateCurrentProvider = useCallback((updates: Partial<typeof activeProvider>) => {
        if (!activeProvider) return;
        updateProvider(activeProvider.id, updates);
    }, [activeProvider, updateProvider]);

    const fetchModels = useCallback(async (url: string, providerId: string) => {
        setIsLoadingModels(true);
        try {
            const cleanUrl = url.replace(/\/+$/g, '');
            let endpoint = `${cleanUrl}/api/tags`;
            
            // For OpenAI-compatible APIs, try /models endpoint
            if (url.includes('openai') || url.includes('v1')) {
                endpoint = `${cleanUrl}/models`;
            }
            
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                let list: string[] = [];
                
                if (Array.isArray(data)) {
                    list = data;
                } else if (data.tags) {
                    list = data.tags;
                } else if (data.models) {
                    list = data.models.map((m: any) => m.name || m.model || m);
                } else if (data.data) {
                    list = data.data.map((m: any) => m.id || m.name || m);
                }
                
                if (list.length) {
                    updateProvider(providerId, { models: list });
                }
            }
        } catch (e) {
            console.warn('Failed to fetch models from', url, e);
        } finally {
            setIsLoadingModels(false);
        }
    }, [updateProvider]);

    useEffect(() => {
        if (activeProvider && activeProvider.baseUrl) {
            const providerType = activeProvider.type;
            if (providerType === 'ollama' || providerType === 'lmstudio' || 
                providerType === 'openai' || providerType === 'custom') {
                fetchModels(activeProvider.baseUrl, activeProvider.id);
            }
        }
    }, [activeProvider?.baseUrl, activeProvider?.type, fetchModels]);

    if (!activeProvider) {
        return (
            <div className="flex items-center justify-center h-full bg-white">
                <p className="text-zinc-500">No AI provider configured</p>
            </div>
        );
    }

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
                            const isSelected = activeProvider.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handleSelectProvider(p.id)}
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
                                        {p.type === 'ollama' && 'Local Models'}
                                        {p.type === 'openai' && 'OpenAI API'}
                                        {p.type === 'anthropic' && 'Anthropic Claude'}
                                        {p.type === 'gemini' && 'Google Gemini'}
                                        {p.type === 'openrouter' && 'OpenRouter (Multi-Provider)'}
                                        {p.type === 'lmstudio' && 'LM Studio'}
                                        {p.type === 'custom' && 'Custom Endpoint'}
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
                        {activeProvider.type === 'ollama' ? 'Ollama Configuration' : 'Provider Settings'}
                    </h3>

                    <div className="grid gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-500">Base URL</label>
                            <input
                                type="text"
                                value={activeProvider.baseUrl || ''}
                                onChange={(e) => updateCurrentProvider({ baseUrl: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder={activeProvider.type === 'ollama' ? "http://localhost:11434" : "https://api.openai.com/v1"}
                            />
                        </div>

                        {activeProvider.type !== 'ollama' && activeProvider.type !== 'lmstudio' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">API Key</label>
                                <input
                                    type="password"
                                    value={activeProvider.apiKey || ''}
                                    onChange={(e) => updateCurrentProvider({ apiKey: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="sk-..."
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-zinc-500">Model Name</label>
                                {isLoadingModels && <RefreshCw size={12} className="animate-spin text-zinc-400" />}
                            </div>
                            {activeProvider.models && activeProvider.models.length > 0 ? (
                                <select
                                    value={activeProvider.selectedModel || ''}
                                    onChange={(e) => updateCurrentProvider({ selectedModel: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                >
                                    <option value="">Select a model</option>
                                    {activeProvider.models.map((model: string) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={activeProvider.selectedModel || ''}
                                    onChange={(e) => updateCurrentProvider({ selectedModel: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="llama3, gpt-4, claude-3, etc."
                                />
                            )}
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
