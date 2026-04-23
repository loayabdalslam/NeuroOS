import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, CheckCircle, AlertTriangle, Info, Timer } from 'lucide-react';
import { useNotificationStore, AppNotification } from '../stores/notificationStore';
import { useTasksStore } from '../stores/tasksStore';
import { useOS } from '../hooks/useOS';

const ICON_MAP: Record<AppNotification['type'], React.FC<{ size?: number; className?: string }>> = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    reminder: Bell,
    pomodoro: Timer,
};

const COLOR_MAP: Record<AppNotification['type'], string> = {
    info: 'text-sky-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    reminder: 'text-violet-400',
    pomodoro: 'text-rose-400',
};

const ACCENT_MAP: Record<AppNotification['type'], string> = {
    info: 'border-l-sky-400/60',
    success: 'border-l-emerald-400/60',
    warning: 'border-l-amber-400/60',
    reminder: 'border-l-violet-400/60',
    pomodoro: 'border-l-rose-400/60',
};

const Toast: React.FC<{ notification: AppNotification }> = ({ notification }) => {
    const dismiss = useNotificationStore((s) => s.dismissNotification);
    const { openApp, sendAppAction, appWindows } = useOS();
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const hovering = useRef(false);

    useEffect(() => {
        if (notification.autoDismissMs > 0) {
            timerRef.current = setTimeout(() => {
                if (!hovering.current) dismiss(notification.id);
            }, notification.autoDismissMs);
        }
        return () => clearTimeout(timerRef.current);
    }, [notification.id, notification.autoDismissMs, dismiss]);

    const Icon = ICON_MAP[notification.type];

    const handleAction = () => {
        if (!notification.action) return;
        const { appId, actionType, payload } = notification.action;
        const existing = appWindows.find((w) => w.component === appId);
        if (existing) {
            sendAppAction(existing.id, actionType, payload);
        } else {
            openApp(appId);
            setTimeout(() => {
                const win = useOS.getState().appWindows.find((w) => w.component === appId);
                if (win) sendAppAction(win.id, actionType, payload);
            }, 200);
        }
        dismiss(notification.id);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            onMouseEnter={() => { hovering.current = true; }}
            onMouseLeave={() => {
                hovering.current = false;
                if (notification.autoDismissMs > 0) {
                    timerRef.current = setTimeout(() => dismiss(notification.id), 1500);
                }
            }}
            className={`
                relative w-80 bg-zinc-900/90 backdrop-blur-xl border border-white/[0.08]
                rounded-xl shadow-2xl shadow-black/40 overflow-hidden
                border-l-[3px] ${ACCENT_MAP[notification.type]}
            `}
        >
            <div className="flex items-start gap-3 p-3.5">
                <div className={`mt-0.5 ${COLOR_MAP[notification.type]}`}>
                    <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{notification.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{notification.message}</p>
                    {notification.action && (
                        <button
                            onClick={handleAction}
                            className="mt-2 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                        >
                            {notification.action.label}
                        </button>
                    )}
                </div>
                <button
                    onClick={() => dismiss(notification.id)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
                >
                    <X size={14} />
                </button>
            </div>
        </motion.div>
    );
};

export const NotificationCenter: React.FC = () => {
    const notifications = useNotificationStore((s) => s.notifications);
    const checkReminders = useTasksStore((s) => s.checkReminders);
    const checkScheduledRules = useTasksStore((s) => s.checkScheduledRules);
    const visible = notifications.filter((n) => !n.read).slice(0, 4);

    useEffect(() => {
        const interval = setInterval(() => {
            checkReminders();
            checkScheduledRules();
        }, 30000);
        checkReminders();
        checkScheduledRules();
        return () => clearInterval(interval);
    }, [checkReminders, checkScheduledRules]);

    return (
        <div className="fixed top-4 right-4 z-[9998] flex flex-col gap-2 pointer-events-auto">
            <AnimatePresence mode="popLayout">
                {visible.map((n) => (
                    <Toast key={n.id} notification={n} />
                ))}
            </AnimatePresence>
        </div>
    );
};
