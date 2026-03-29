import React from 'react';
import { Lock, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { useComposioStore } from '../stores/composioStore';

interface ToolPermissionDialogProps {
    toolId: string;
    toolName: string;
    appId: string;
    onClose: () => void;
    onAuthorize: () => void;
}

export const ToolPermissionDialog: React.FC<ToolPermissionDialogProps> = ({
    toolId,
    toolName,
    appId,
    onClose,
    onAuthorize
}) => {
    const [isAuthorizing, setIsAuthorizing] = React.useState(false);
    const { authorizeApp, grantToolPermission } = useComposioStore();

    const handleAuthorize = async () => {
        setIsAuthorizing(true);
        try {
            const authUrl = await authorizeApp(appId);
            if (authUrl) {
                // Grant permission after authorization
                grantToolPermission(toolId);
                onAuthorize();
                onClose();
            }
        } finally {
            setIsAuthorizing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
                <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                        <Lock className="w-6 h-6 text-amber-600" />
                    </div>
                </div>

                <h2 className="text-xl font-bold text-center mb-2">
                    Authorize Tool
                </h2>

                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                        <p className="font-medium">"{toolName}" requires authorization</p>
                        <p className="mt-1">The AI is requesting permission to use this tool. This will open Composio's authorization page.</p>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-600">
                        <span className="text-blue-600 font-medium">Tool:</span>
                        <span className="ml-2">{toolName}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                        <span className="text-blue-600 font-medium">App:</span>
                        <span className="ml-2">{appId}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleAuthorize}
                        disabled={isAuthorizing}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                    >
                        {isAuthorizing && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isAuthorizing ? 'Authorizing...' : 'Authorize'}
                        {!isAuthorizing && <ExternalLink className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={onClose}
                        disabled={isAuthorizing}
                        className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg transition"
                    >
                        Cancel
                    </button>
                </div>

                <p className="mt-4 text-xs text-gray-500 text-center">
                    You can manage permissions in Settings → Security
                </p>
            </div>
        </div>
    );
};
