import React, { useState } from 'react';
import { Key, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useComposioStore } from '../stores/composioStore';

interface ComposioOnboardingProps {
    onComplete: () => void;
}

export const ComposioOnboarding: React.FC<ComposioOnboardingProps> = ({ onComplete }) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);

    const { setApiKey: setComposioKey, completeOnboarding } = useComposioStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const success = await setComposioKey(apiKey);
            if (success) {
                completeOnboarding();
                onComplete();
            } else {
                setError('Invalid API key. Please check and try again.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to authenticate with Composio');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
                <div className="flex items-center justify-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Key className="w-6 h-6 text-blue-600" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-center mb-2">
                    Connect Composio
                </h2>
                <p className="text-center text-gray-600 mb-6">
                    Enable advanced tool integrations and automation
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Composio API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Composio API key"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                disabled={isLoading}
                            >
                                {showKey ? '🙈' : '👁'}
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Get your API key from{' '}
                            <a
                                href="https://composio.dev"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                composio.dev
                            </a>
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={!apiKey.trim() || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? 'Verifying...' : 'Continue'}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-xs text-gray-600 text-center">
                        Composio integrates 500+ tools and services. Your API key is stored securely.
                    </p>
                </div>
            </div>
        </div>
    );
};
