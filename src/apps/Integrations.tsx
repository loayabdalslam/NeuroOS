import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
    Mail, Hash, Code, Table, BookOpen, Users, Calendar,
    RefreshCw, Check, X, Eye, EyeOff, Trash2, Loader2,
    ExternalLink, Plug,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useComposioStore } from '../stores/composioStore';
import { OSAppWindow } from '../hooks/useOS';

interface IntegrationsAppProps {
    windowData?: OSAppWindow;
}

const SERVICES = [
    { id: 'gmail', name: 'Gmail', icon: Mail, description: 'Send & read emails', color: 'text-red-400', bg: 'bg-red-400/10' },
    { id: 'slack', name: 'Slack', icon: Hash, description: 'Team messaging', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'github', name: 'GitHub', icon: Code, description: 'Code & issues', color: 'text-zinc-300', bg: 'bg-zinc-400/10' },
    { id: 'googlesheets', name: 'Google Sheets', icon: Table, description: 'Spreadsheets', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: 'notion', name: 'Notion', icon: BookOpen, description: 'Docs & databases', color: 'text-zinc-300', bg: 'bg-zinc-400/10' },
    { id: 'hubspot', name: 'HubSpot', icon: Users, description: 'CRM & contacts', color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { id: 'googlecalendar', name: 'Google Calendar', icon: Calendar, description: 'Events & scheduling', color: 'text-sky-400', bg: 'bg-sky-400/10' },
];

export const IntegrationsApp: React.FC<IntegrationsAppProps> = ({ windowData }) => {
    const store = useComposioStore();
    const [keyInput, setKeyInput] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [editingKey, setEditingKey] = useState(false);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [connectError, setConnectError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (store.isAuthenticated) {
            store.loadConnections();
        }
    }, [store.isAuthenticated]);

    useEffect(() => {
        if (!windowData?.lastAction) return;
        const { type, payload } = windowData.lastAction;
        if (type === 'connect_app' && payload?.appId) {
            handleConnect(payload.appId);
        }
        if (type === 'set_api_key' && payload?.key) {
            store.setApiKey(payload.key);
        }
    }, [windowData?.lastAction?.timestamp]);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const handleSaveKey = async () => {
        if (!keyInput.trim()) return;
        const ok = await store.setApiKey(keyInput.trim());
        if (ok) {
            setKeyInput('');
            setEditingKey(false);
        }
    };

    const handleRemoveKey = () => {
        store.logout();
        setEditingKey(false);
    };

    const handleConnect = async (appId: string) => {
        setConnecting(appId);
        setConnectError(null);

        const url = await store.authorizeApp(appId);

        if (!url) {
            setConnectError(`Could not start ${appId} connection. Check your API key and try again.`);
            setConnecting(null);
            return;
        }

        if (pollRef.current) clearInterval(pollRef.current);
        let attempts = 0;
        pollRef.current = setInterval(async () => {
            attempts++;
            await store.loadConnections();
            const conn = store.connections.find(c => c.appId === appId);
            if (conn?.status === 'connected' || attempts >= 60) {
                if (pollRef.current) clearInterval(pollRef.current);
                pollRef.current = null;
                setConnecting(null);
            }
        }, 3000);
    };

    const handleDisconnect = async (appId: string) => {
        const conn = store.connections.find(c => c.appId === appId);
        if (!conn) return;
        const { composioClient } = await import('../lib/composio/composioClient');
        const connId = (conn as any).id;
        if (connId) {
            await composioClient.disconnectApp(connId);
        }
        await store.loadConnections();
    };

    const getConnectionStatus = (appId: string) => {
        const conn = store.connections.find(c => c.appId === appId);
        return conn?.status === 'connected';
    };

    const maskedKey = store.apiKey
        ? store.apiKey.slice(0, 4) + '••••••••' + store.apiKey.slice(-4)
        : '';

    return (
        <div className="flex flex-col h-full bg-zinc-950/95 text-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <Plug size={16} className="text-violet-400" />
                    <span className="text-sm font-bold tracking-tight">Integrations</span>
                </div>
                <div className="flex items-center gap-2">
                    {store.isAuthenticated ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                            <Check size={10} /> API Connected
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
                            Not configured
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* API Key Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Composio API Key</label>
                        <a
                            href="https://composio.dev"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                        >
                            Get a key <ExternalLink size={10} />
                        </a>
                    </div>

                    {store.isAuthenticated && !editingKey ? (
                        <div className="flex items-center gap-2 p-3 bg-zinc-900/50 border border-white/[0.06] rounded-xl">
                            <div className="flex-1 font-mono text-xs text-zinc-400">
                                {showKey ? store.apiKey : maskedKey}
                            </div>
                            <button onClick={() => setShowKey(!showKey)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                {showKey ? <EyeOff size={14} className="text-zinc-500" /> : <Eye size={14} className="text-zinc-500" />}
                            </button>
                            <button onClick={() => setEditingKey(true)} className="text-[10px] font-bold text-zinc-500 hover:text-white px-2 py-1 transition-colors">
                                Edit
                            </button>
                            <button onClick={handleRemoveKey} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 size={14} className="text-zinc-500 hover:text-red-400" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                type="password"
                                value={keyInput}
                                onChange={e => setKeyInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                                className="flex-1 p-3 bg-zinc-900/50 border border-white/[0.06] rounded-xl outline-none focus:border-violet-500/50 transition-colors font-mono text-xs text-zinc-300 placeholder:text-zinc-600"
                                placeholder="Enter your Composio API key..."
                                autoFocus
                            />
                            <button
                                onClick={handleSaveKey}
                                disabled={!keyInput.trim() || store.isLoading}
                                className="px-4 py-3 bg-violet-500 hover:bg-violet-400 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl text-xs font-bold transition-colors"
                            >
                                {store.isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                            </button>
                            {editingKey && (
                                <button onClick={() => setEditingKey(false)} className="p-3 hover:bg-white/5 rounded-xl transition-colors">
                                    <X size={14} className="text-zinc-500" />
                                </button>
                            )}
                        </div>
                    )}

                    {store.error && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                            <X size={12} className="text-red-400 shrink-0" />
                            <span className="text-[11px] text-red-300">{store.error}</span>
                            <button onClick={store.clearError} className="ml-auto text-[10px] text-red-400 hover:text-red-300">Dismiss</button>
                        </div>
                    )}
                </div>

                {/* Services Grid */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Services</label>
                        {store.isAuthenticated && (
                            <button
                                onClick={() => store.loadConnections()}
                                disabled={store.isLoading}
                                className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={10} className={cn(store.isLoading && 'animate-spin')} /> Refresh
                            </button>
                        )}
                    </div>

                    {connectError && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                            <X size={12} className="text-red-400 shrink-0" />
                            <span className="text-[11px] text-red-300">{connectError}</span>
                            <button onClick={() => setConnectError(null)} className="ml-auto text-[10px] text-red-400 hover:text-red-300">Dismiss</button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        {SERVICES.map(service => {
                            const Icon = service.icon;
                            const connected = getConnectionStatus(service.id);
                            const isConnecting = connecting === service.id;

                            return (
                                <motion.div
                                    key={service.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        "p-3 rounded-xl border transition-all",
                                        connected
                                            ? "bg-zinc-900/50 border-emerald-500/20"
                                            : "bg-zinc-900/30 border-white/[0.04] hover:border-white/[0.08]"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", service.bg)}>
                                            <Icon size={16} className={service.color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-white">{service.name}</span>
                                                {connected && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                )}
                                            </div>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">{service.description}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2.5">
                                        {connected ? (
                                            <button
                                                onClick={() => handleDisconnect(service.id)}
                                                className="w-full text-[10px] font-bold text-zinc-500 hover:text-red-400 py-1.5 rounded-lg hover:bg-red-500/5 transition-all"
                                            >
                                                Disconnect
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(service.id)}
                                                disabled={!store.isAuthenticated || isConnecting}
                                                className="w-full text-[10px] font-bold text-violet-400 hover:text-violet-300 disabled:text-zinc-600 py-1.5 rounded-lg hover:bg-violet-500/5 disabled:hover:bg-transparent transition-all flex items-center justify-center gap-1"
                                            >
                                                {isConnecting ? (
                                                    <><Loader2 size={10} className="animate-spin" /> Waiting for auth...</>
                                                ) : (
                                                    'Connect'
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {connecting && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-center space-y-1"
                    >
                        <p className="text-[11px] text-violet-300 font-bold">Authorization in progress</p>
                        <p className="text-[10px] text-violet-400/70">Complete the sign-in in your browser, then come back here. Status will update automatically.</p>
                    </motion.div>
                )}

                {!store.isAuthenticated && (
                    <div className="text-center py-4">
                        <p className="text-[11px] text-zinc-600">Add your Composio API key above to connect services.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
