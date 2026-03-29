import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, Users, Hash, Send, UserPlus, Copy, Check, X,
    Wifi, WifiOff, Shield, Volume2, VolumeX, MoreVertical, Phone, Video
} from 'lucide-react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsStore } from '../stores/settingsStore';

interface Peer {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'away';
    lastSeen?: number;
}

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
    type: 'text' | 'system' | 'file';
    fileData?: string;
    fileName?: string;
}

interface ChatRoom {
    id: string;
    name: string;
    type: 'direct' | 'group';
    participants: string[];
    messages: Message[];
}

interface P2PChatAppProps {
    windowData?: any;
}

export const P2PChatApp: React.FC<P2PChatAppProps> = ({ windowData }) => {
    const { p2pServerUrl } = useSettingsStore();
    const [myId] = useState(() => localStorage.getItem('neuro-p2p-id') || uuidv4());
    const [myName, setMyName] = useState(() => localStorage.getItem('neuro-p2p-name') || 'User');
    const [peers, setPeers] = useState<Peer[]>([]);
    const [rooms, setRooms] = useState<ChatRoom[]>([
        { id: 'general', name: 'General', type: 'group', participants: [], messages: [] }
    ]);
    const [activeRoom, setActiveRoom] = useState<string>('general');
    const [message, setMessage] = useState('');
    const [showPeers, setShowPeers] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [newChatName, setNewChatName] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(myName);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        localStorage.setItem('neuro-p2p-id', myId);
    }, [myId]);

    useEffect(() => {
        const storedName = localStorage.getItem('neuro-p2p-name');
        if (storedName) {
            setMyName(storedName);
            setTempName(storedName);
        }
    }, []);

    const connectToNetwork = useCallback(() => {
        try {
            const serverUrl = p2pServerUrl || 'wss://neuro-p2p-signaling.fly.dev';
            const ws = new WebSocket(`${serverUrl}/?id=${myId}&name=${myName}`);
            
            ws.onopen = () => {
                setIsOnline(true);
                ws.send(JSON.stringify({ type: 'online', name: myName, id: myId }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'peers':
                            setPeers(data.peers.filter((p: Peer) => p.id !== myId));
                            break;
                        case 'peer-joined':
                            if (!peers.find(p => p.id === data.peer.id)) {
                                setPeers(prev => [...prev, { ...data.peer, status: 'online' }]);
                                addSystemMessage(`${data.peer.name} joined`);
                            }
                            break;
                        case 'peer-left':
                            setPeers(prev => prev.filter(p => p.id !== data.peerId));
                            addSystemMessage(`${data.peerName} left`);
                            break;
                        case 'message':
                            receiveMessage(data);
                            break;
                        case 'room-invite':
                            if (confirm(`${data.fromName} invited you to join ${data.roomName}`)) {
                                joinRoom(data.roomId, data.roomName);
                            }
                            break;
                    }
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };

            ws.onclose = () => {
                setIsOnline(false);
                setTimeout(connectToNetwork, 5000);
            };

            ws.onerror = () => {
                setIsOnline(false);
            };

            wsRef.current = ws;
        } catch (e) {
            console.error('Failed to connect:', e);
            setIsOnline(false);
        }
    }, [myId, myName, peers]);

    useEffect(() => {
        connectToNetwork();
        return () => {
            wsRef.current?.close();
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [rooms, activeRoom]);

    const receiveMessage = useCallback((data: any) => {
        const msg: Message = {
            id: uuidv4(),
            senderId: data.senderId,
            senderName: data.senderName,
            content: data.content,
            timestamp: data.timestamp || Date.now(),
            type: data.fileData ? 'file' : 'text'
        };

        setRooms(prev => prev.map(room => {
            if (room.id === data.roomId || (data.roomId === 'general' && room.type === 'group')) {
                return { ...room, messages: [...room.messages, msg] };
            }
            return room;
        }));
    }, []);

    const addSystemMessage = useCallback((content: string) => {
        const msg: Message = {
            id: uuidv4(),
            senderId: 'system',
            senderName: 'System',
            content,
            timestamp: Date.now(),
            type: 'system'
        };

        setRooms(prev => prev.map(room => {
            if (room.id === activeRoom) {
                return { ...room, messages: [...room.messages, msg] };
            }
            return room;
        }));
    }, [activeRoom]);

    const sendMessage = useCallback((content: string, roomId?: string) => {
        if (!content.trim()) return;

        const targetRoom = roomId || activeRoom;
        const msg: Message = {
            id: uuidv4(),
            senderId: myId,
            senderName: myName,
            content: content.trim(),
            timestamp: Date.now(),
            type: 'text'
        };

        setRooms(prev => prev.map(room => {
            if (room.id === targetRoom) {
                return { ...room, messages: [...room.messages, msg] };
            }
            return room;
        }));

        wsRef.current?.send(JSON.stringify({
            type: 'message',
            roomId: targetRoom,
            senderId: myId,
            senderName: myName,
            content: content.trim()
        }));
    }, [myId, myName, activeRoom]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        sendMessage(message);
        setMessage('');
    }, [message, sendMessage]);

    const createRoom = useCallback((name: string, type: 'direct' | 'group' = 'group') => {
        const newRoom: ChatRoom = {
            id: uuidv4(),
            name,
            type,
            participants: type === 'direct' ? [] : [myId],
            messages: []
        };
        setRooms(prev => [...prev, newRoom]);
        setActiveRoom(newRoom.id);
        setShowNewChat(false);
        setNewChatName('');
    }, [myId]);

    const joinRoom = useCallback((roomId: string, roomName: string) => {
        if (!rooms.find(r => r.id === roomId)) {
            setRooms(prev => [...prev, {
                id: roomId,
                name: roomName,
                type: 'group',
                participants: [],
                messages: []
            }]);
        }
        setActiveRoom(roomId);
    }, [rooms]);

    const startDirectChat = useCallback((peer: Peer) => {
        const existingRoom = rooms.find(r => 
            r.type === 'direct' && 
            r.participants.includes(peer.id)
        );
        
        if (existingRoom) {
            setActiveRoom(existingRoom.id);
        } else {
            createRoom(peer.name, 'direct');
            setRooms(prev => prev.map(room => {
                if (room.name === peer.name) {
                    return { ...room, participants: [...room.participants, peer.id] };
                }
                return room;
            }));
        }
        setShowNewChat(false);
    }, [rooms, createRoom]);

    const saveName = useCallback(() => {
        if (tempName.trim()) {
            setMyName(tempName.trim());
            localStorage.setItem('neuro-p2p-name', tempName.trim());
            wsRef.current?.send(JSON.stringify({
                type: 'update-name',
                name: tempName.trim(),
                id: myId
            }));
        }
        setEditingName(false);
    }, [tempName, myId]);

    const copyId = useCallback(() => {
        navigator.clipboard.writeText(myId);
        setCopiedId(myId);
        setTimeout(() => setCopiedId(null), 2000);
    }, [myId]);

    const activeRoomData = rooms.find(r => r.id === activeRoom);

    return (
        <div className="flex h-full bg-white text-zinc-900 font-mono">
            {/* Sidebar - Peers & Rooms */}
            <div className="w-64 border-r border-zinc-200 flex flex-col">
                {/* Connection Status */}
                <div className="p-3 border-b border-zinc-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                isOnline ? "bg-emerald-500" : "bg-zinc-300"
                            )} />
                            <span className="text-xs text-zinc-500">
                                {isOnline ? 'Connected' : 'Connecting...'}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowPeers(!showPeers)}
                            className="text-zinc-400 hover:text-zinc-600"
                        >
                            {showPeers ? <Users size={16} /> : <Users size={16} />}
                        </button>
                    </div>

                    {/* User Info */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs">
                            {myName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            {editingName ? (
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                                        className="w-full px-2 py-1 text-xs bg-zinc-100 border border-zinc-200 rounded"
                                        autoFocus
                                    />
                                    <button onClick={saveName} className="text-emerald-500">
                                        <Check size={12} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setEditingName(true)}
                                    className="text-sm font-medium truncate hover:text-zinc-600"
                                >
                                    {myName}
                                </button>
                            )}
                            <button
                                onClick={copyId}
                                className="text-[10px] text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
                            >
                                {copiedId === myId ? <Check size={10} /> : <Copy size={10} />}
                                {myId.slice(0, 8)}...
                            </button>
                        </div>
                    </div>
                </div>

                {/* Peers List */}
                {showPeers && (
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-2">
                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider px-2 mb-2">
                                Online ({peers.length})
                            </div>
                            {peers.length === 0 ? (
                                <div className="text-xs text-zinc-400 px-2 py-4 text-center">
                                    No peers found
                                </div>
                            ) : (
                                peers.map(peer => (
                                    <button
                                        key={peer.id}
                                        onClick={() => startDirectChat(peer)}
                                        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-zinc-50 rounded-lg transition-colors"
                                    >
                                        <div className="relative">
                                            <div className="w-8 h-8 bg-zinc-200 rounded-full flex items-center justify-center text-xs">
                                                {peer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm truncate">{peer.name}</div>
                                            <div className="text-[10px] text-zinc-400">Online</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Rooms */}
                <div className="border-t border-zinc-200 p-2">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                        <span>Chats</span>
                        <button
                            onClick={() => setShowNewChat(true)}
                            className="hover:text-zinc-600"
                        >
                            <UserPlus size={12} />
                        </button>
                    </div>
                    {rooms.map(room => (
                        <button
                            key={room.id}
                            onClick={() => setActiveRoom(room.id)}
                            className={cn(
                                "w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left",
                                activeRoom === room.id ? "bg-zinc-100" : "hover:bg-zinc-50"
                            )}
                        >
                            {room.type === 'direct' ? (
                                <div className="w-8 h-8 bg-zinc-200 rounded-full flex items-center justify-center">
                                    <MessageCircle size={14} />
                                </div>
                            ) : (
                                <div className="w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center">
                                    <Hash size={14} />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{room.name}</div>
                                <div className="text-[10px] text-zinc-400">
                                    {room.messages.length} messages
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {activeRoomData?.type === 'direct' ? (
                            <div className="w-10 h-10 bg-zinc-200 rounded-full flex items-center justify-center">
                                <MessageCircle size={20} />
                            </div>
                        ) : (
                            <div className="w-10 h-10 bg-zinc-900 text-white rounded-full flex items-center justify-center">
                                <Hash size={20} />
                            </div>
                        )}
                        <div>
                            <h2 className="text-sm font-semibold">{activeRoomData?.name}</h2>
                            <div className="text-[10px] text-zinc-500">
                                {activeRoomData?.type === 'group' 
                                    ? `${activeRoomData?.messages.length || 0} messages`
                                    : 'Direct message'
                                }
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg">
                            <Phone size={16} />
                        </button>
                        <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg">
                            <Video size={16} />
                        </button>
                        <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg">
                            <MoreVertical size={16} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {activeRoomData?.messages.map(msg => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-2",
                                msg.senderId === myId && "flex-row-reverse"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0",
                                msg.senderId === 'system' 
                                    ? "bg-zinc-200 text-zinc-500" 
                                    : msg.senderId === myId 
                                        ? "bg-zinc-900 text-white" 
                                        : "bg-zinc-200 text-zinc-600"
                            )}>
                                {msg.senderId === 'system' ? <Shield size={12} /> : msg.senderName.charAt(0).toUpperCase()}
                            </div>
                            <div className={cn(
                                "max-w-[70%]",
                                msg.senderId === myId && "text-right"
                            )}>
                                {msg.senderId !== myId && msg.senderId !== 'system' && (
                                    <div className="text-[10px] text-zinc-400 mb-1">{msg.senderName}</div>
                                )}
                                <div className={cn(
                                    "inline-block px-4 py-2 rounded-2xl text-sm",
                                    msg.senderId === 'system'
                                        ? "bg-zinc-100 text-zinc-500 italic"
                                        : msg.senderId === myId
                                            ? "bg-zinc-900 text-white"
                                            : "bg-zinc-100 text-zinc-900"
                                )}>
                                    {msg.content}
                                </div>
                                <div className="text-[10px] text-zinc-400 mt-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-zinc-200">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                            placeholder={`Message ${activeRoomData?.name}...`}
                            className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-400"
                        />
                        <button
                            type="submit"
                            disabled={!message.trim()}
                            className="px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>

            {/* New Chat Modal */}
            {showNewChat && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-80">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold">New Chat</h3>
                            <button onClick={() => setShowNewChat(false)} className="text-zinc-400 hover:text-zinc-600">
                                <X size={18} />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={newChatName}
                            onChange={(e) => setNewChatName(e.target.value)}
                            placeholder="Group name..."
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm mb-4"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => createRoom(newChatName || 'New Group', 'group')}
                                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm"
                            >
                                Create Group
                            </button>
                            <button
                                onClick={() => {
                                    if (peers.length > 0) {
                                        startDirectChat(peers[0]);
                                    }
                                }}
                                disabled={peers.length === 0}
                                className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-lg text-sm disabled:opacity-50"
                            >
                                Direct
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
