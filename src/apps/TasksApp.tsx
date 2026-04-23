import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ListTodo, Timer, Zap, Plus, Trash2, Edit3, Check,
    ChevronDown, ChevronUp, Calendar, Tag, Circle,
    Play, Pause, RotateCcw, SkipForward, Bell,
    Power, Clock, X, Square, CheckSquare,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasksStore, Task, Reminder, AutomationRule } from '../stores/tasksStore';
import { useNotificationStore } from '../stores/notificationStore';
import { OSAppWindow } from '../hooks/useOS';

interface TasksAppProps {
    windowData?: OSAppWindow;
}

type TabId = 'tasks' | 'pomodoro' | 'automation';

const TABS: { id: TabId; label: string; icon: React.FC<any> }[] = [
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'pomodoro', label: 'Pomodoro', icon: Timer },
    { id: 'automation', label: 'Automation', icon: Zap },
];

const PRIORITY_COLORS = {
    low: 'text-sky-400 bg-sky-400/10',
    medium: 'text-amber-400 bg-amber-400/10',
    high: 'text-rose-400 bg-rose-400/10',
};

const STATUS_FILTERS = ['all', 'todo', 'in_progress', 'done'] as const;

// ─── Tasks Tab ────────────────────────────────────────────────────
const TasksTab: React.FC = () => {
    const { tasks, createTask, updateTask, deleteTask, completeTask } = useTasksStore();
    const [newTitle, setNewTitle] = useState('');
    const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDesc, setEditDesc] = useState('');

    const filtered = tasks.filter((t) => filter === 'all' || t.status === filter);

    const handleAdd = () => {
        if (!newTitle.trim()) return;
        createTask({ title: newTitle.trim() });
        setNewTitle('');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Quick add */}
            <div className="flex items-center gap-2 p-3 border-b border-white/[0.06]">
                <Plus size={16} className="text-zinc-500" />
                <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Add a task..."
                    className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newTitle.trim()}
                    className="px-2.5 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-30"
                >
                    Add
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.04]">
                {STATUS_FILTERS.map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            'px-2.5 py-1 text-xs rounded-md transition-colors capitalize',
                            filter === f
                                ? 'bg-white/[0.08] text-zinc-200'
                                : 'text-zinc-500 hover:text-zinc-300'
                        )}
                    >
                        {f === 'in_progress' ? 'In Progress' : f}
                    </button>
                ))}
                <span className="ml-auto text-xs text-zinc-600">{filtered.length} tasks</span>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                        <ListTodo size={40} className="opacity-30" />
                        <p className="text-sm">No tasks yet</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filtered.map((task) => (
                            <motion.div
                                key={task.id}
                                layout
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="border-b border-white/[0.04]"
                            >
                                <div className="flex items-center gap-3 px-3 py-2.5 group">
                                    <button
                                        onClick={() => task.status === 'done' ? updateTask(task.id, { status: 'todo', completedAt: null }) : completeTask(task.id)}
                                        className="text-zinc-500 hover:text-emerald-400 transition-colors"
                                    >
                                        {task.status === 'done' ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn('text-sm truncate', task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200')}>
                                            {task.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[task.priority])}>
                                                {task.priority}
                                            </span>
                                            {task.dueDate && (
                                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                    <Calendar size={10} />
                                                    {new Date(task.dueDate).toLocaleDateString()}
                                                </span>
                                            )}
                                            {task.pomodorosEstimated > 0 && (
                                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                    <Timer size={10} />
                                                    {task.pomodorosCompleted}/{task.pomodorosEstimated}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setExpandedId(expandedId === task.id ? null : task.id)} className="p-1 text-zinc-500 hover:text-zinc-300">
                                            {expandedId === task.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        <button onClick={() => deleteTask(task.id)} className="p-1 text-zinc-500 hover:text-rose-400">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                <AnimatePresence>
                                    {expandedId === task.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-3 pb-3 space-y-2 ml-8">
                                                {editingId === task.id ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={editDesc}
                                                            onChange={(e) => setEditDesc(e.target.value)}
                                                            className="flex-1 bg-white/[0.04] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 outline-none border border-white/[0.06]"
                                                            placeholder="Description..."
                                                        />
                                                        <button
                                                            onClick={() => { updateTask(task.id, { description: editDesc }); setEditingId(null); }}
                                                            className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p
                                                        onClick={() => { setEditingId(task.id); setEditDesc(task.description); }}
                                                        className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300"
                                                    >
                                                        {task.description || 'Click to add description...'}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-zinc-600">Priority:</span>
                                                    {(['low', 'medium', 'high'] as const).map((p) => (
                                                        <button
                                                            key={p}
                                                            onClick={() => updateTask(task.id, { priority: p })}
                                                            className={cn(
                                                                'text-[10px] px-1.5 py-0.5 rounded capitalize',
                                                                task.priority === p ? PRIORITY_COLORS[p] : 'text-zinc-600 hover:text-zinc-400'
                                                            )}
                                                        >
                                                            {p}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-zinc-600">Status:</span>
                                                    {(['todo', 'in_progress', 'done'] as const).map((s) => (
                                                        <button
                                                            key={s}
                                                            onClick={() => updateTask(task.id, { status: s, completedAt: s === 'done' ? Date.now() : null })}
                                                            className={cn(
                                                                'text-[10px] px-1.5 py-0.5 rounded capitalize',
                                                                task.status === s ? 'bg-white/[0.08] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                                                            )}
                                                        >
                                                            {s === 'in_progress' ? 'In Progress' : s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

// ─── Pomodoro Tab ─────────────────────────────────────────────────
const PomodoroTab: React.FC = () => {
    const { pomodoro, tasks, startPomodoro, pausePomodoro, resumePomodoro, resetPomodoro, skipToNext, tick, setPomodoroSettings } = useTasksStore();
    const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

    useEffect(() => {
        if (pomodoro.isRunning) {
            intervalRef.current = setInterval(tick, 1000);
        }
        return () => clearInterval(intervalRef.current);
    }, [pomodoro.isRunning, tick]);

    const minutes = Math.floor(pomodoro.timeRemaining / 60);
    const seconds = pomodoro.timeRemaining % 60;
    const totalSeconds = (pomodoro.mode === 'work' ? pomodoro.workDuration : pomodoro.mode === 'short_break' ? pomodoro.shortBreakDuration : pomodoro.longBreakDuration) * 60;
    const progress = 1 - pomodoro.timeRemaining / totalSeconds;
    const circumference = 2 * Math.PI * 90;
    const currentTask = pomodoro.currentTaskId ? tasks.find((t) => t.id === pomodoro.currentTaskId) : null;

    const modeColor = pomodoro.mode === 'work' ? 'text-emerald-400' : pomodoro.mode === 'short_break' ? 'text-sky-400' : 'text-violet-400';
    const strokeColor = pomodoro.mode === 'work' ? '#34d399' : pomodoro.mode === 'short_break' ? '#38bdf8' : '#a78bfa';
    const modeLabel = pomodoro.mode === 'work' ? 'Focus Time' : pomodoro.mode === 'short_break' ? 'Short Break' : 'Long Break';

    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
            {/* Mode label */}
            <p className={cn('text-sm font-medium uppercase tracking-widest', modeColor)}>{modeLabel}</p>

            {/* Timer ring */}
            <div className="relative w-52 h-52">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="6" />
                    <motion.circle
                        cx="100" cy="100" r="90"
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset: circumference * (1 - progress) }}
                        transition={{ duration: 0.5 }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-light text-zinc-100 tabular-nums">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </span>
                </div>
            </div>

            {/* Current task */}
            {currentTask && (
                <p className="text-xs text-zinc-500 truncate max-w-[200px]">
                    Working on: <span className="text-zinc-300">{currentTask.title}</span>
                </p>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
                <button onClick={resetPomodoro} className="p-2.5 rounded-xl bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors">
                    <RotateCcw size={18} />
                </button>
                {!pomodoro.isRunning ? (
                    <button
                        onClick={() => pomodoro.timeRemaining === totalSeconds && !pomodoro.currentTaskId ? startPomodoro() : resumePomodoro()}
                        className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    >
                        <Play size={24} />
                    </button>
                ) : (
                    <button onClick={pausePomodoro} className="p-4 rounded-2xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                        <Pause size={24} />
                    </button>
                )}
                <button onClick={skipToNext} className="p-2.5 rounded-xl bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors">
                    <SkipForward size={18} />
                </button>
            </div>

            {/* Session counter */}
            <p className="text-xs text-zinc-600">
                Session {pomodoro.sessionsCompleted % pomodoro.longBreakInterval + (pomodoro.mode === 'work' ? 1 : 0)} of {pomodoro.longBreakInterval}
                {' · '}{pomodoro.sessionsCompleted} completed
            </p>

            {/* Settings */}
            <div className="flex items-center gap-4 text-xs text-zinc-500">
                <label className="flex items-center gap-1.5">
                    Work
                    <input
                        type="number"
                        value={pomodoro.workDuration}
                        onChange={(e) => setPomodoroSettings({ workDuration: Math.max(1, +e.target.value) })}
                        className="w-10 bg-white/[0.04] rounded px-1.5 py-0.5 text-zinc-300 text-center outline-none border border-white/[0.06]"
                    />
                    min
                </label>
                <label className="flex items-center gap-1.5">
                    Break
                    <input
                        type="number"
                        value={pomodoro.shortBreakDuration}
                        onChange={(e) => setPomodoroSettings({ shortBreakDuration: Math.max(1, +e.target.value) })}
                        className="w-10 bg-white/[0.04] rounded px-1.5 py-0.5 text-zinc-300 text-center outline-none border border-white/[0.06]"
                    />
                    min
                </label>
                <label className="flex items-center gap-1.5">
                    Long
                    <input
                        type="number"
                        value={pomodoro.longBreakDuration}
                        onChange={(e) => setPomodoroSettings({ longBreakDuration: Math.max(1, +e.target.value) })}
                        className="w-10 bg-white/[0.04] rounded px-1.5 py-0.5 text-zinc-300 text-center outline-none border border-white/[0.06]"
                    />
                    min
                </label>
            </div>
        </div>
    );
};

// ─── Automation Tab ───────────────────────────────────────────────
const AutomationTab: React.FC = () => {
    const { automationRules, addRule, removeRule, toggleRule, updateRule } = useTasksStore();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        name: '',
        triggerType: 'event' as 'schedule' | 'event',
        intervalMinutes: 60,
        event: 'task_completed',
        actionType: 'send_notification' as AutomationRule['action']['type'],
        actionParams: '{}',
    });

    const handleSubmit = () => {
        if (!form.name.trim()) return;
        let params: Record<string, any> = {};
        try { params = JSON.parse(form.actionParams); } catch {}
        addRule({
            name: form.name,
            enabled: true,
            trigger: {
                type: form.triggerType,
                ...(form.triggerType === 'schedule' ? { intervalMinutes: form.intervalMinutes } : { event: form.event }),
            },
            action: { type: form.actionType, params },
        });
        setShowForm(false);
        setForm({ name: '', triggerType: 'event', intervalMinutes: 60, event: 'task_completed', actionType: 'send_notification', actionParams: '{}' });
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
                <span className="text-xs text-zinc-400">{automationRules.length} rules</span>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors"
                >
                    <Plus size={12} /> Add Rule
                </button>
            </div>

            {/* New rule form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-b border-white/[0.06]"
                    >
                        <div className="p-3 space-y-2.5">
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Rule name"
                                className="w-full bg-white/[0.04] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 outline-none border border-white/[0.06]"
                            />
                            <div className="flex gap-2">
                                <select
                                    value={form.triggerType}
                                    onChange={(e) => setForm({ ...form, triggerType: e.target.value as any })}
                                    className="flex-1 bg-white/[0.04] rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none border border-white/[0.06]"
                                >
                                    <option value="event">On Event</option>
                                    <option value="schedule">On Schedule</option>
                                </select>
                                {form.triggerType === 'event' ? (
                                    <select
                                        value={form.event}
                                        onChange={(e) => setForm({ ...form, event: e.target.value })}
                                        className="flex-1 bg-white/[0.04] rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none border border-white/[0.06]"
                                    >
                                        <option value="task_completed">Task Completed</option>
                                        <option value="pomodoro_done">Pomodoro Done</option>
                                        <option value="app_opened">App Opened</option>
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-zinc-500">Every</span>
                                        <input
                                            type="number"
                                            value={form.intervalMinutes}
                                            onChange={(e) => setForm({ ...form, intervalMinutes: +e.target.value })}
                                            className="w-14 bg-white/[0.04] rounded px-2 py-1.5 text-xs text-zinc-300 text-center outline-none border border-white/[0.06]"
                                        />
                                        <span className="text-xs text-zinc-500">min</span>
                                    </div>
                                )}
                            </div>
                            <select
                                value={form.actionType}
                                onChange={(e) => setForm({ ...form, actionType: e.target.value as any })}
                                className="w-full bg-white/[0.04] rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none border border-white/[0.06]"
                            >
                                <option value="send_notification">Send Notification</option>
                                <option value="open_app">Open App</option>
                                <option value="create_task">Create Task</option>
                                <option value="run_command">Run Command</option>
                            </select>
                            <div className="flex gap-2">
                                <button onClick={() => setShowForm(false)} className="flex-1 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg bg-white/[0.04]">
                                    Cancel
                                </button>
                                <button onClick={handleSubmit} className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30">
                                    Create
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Rules list */}
            <div className="flex-1 overflow-y-auto">
                {automationRules.length === 0 && !showForm ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                        <Zap size={40} className="opacity-30" />
                        <p className="text-sm">No automation rules</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {automationRules.map((rule) => (
                            <motion.div
                                key={rule.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.04] group"
                            >
                                <button onClick={() => toggleRule(rule.id)} className={cn('transition-colors', rule.enabled ? 'text-emerald-400' : 'text-zinc-600')}>
                                    <Power size={14} />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-sm truncate', rule.enabled ? 'text-zinc-200' : 'text-zinc-500')}>
                                        {rule.name}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 mt-0.5">
                                        {rule.trigger.type === 'event' ? `On: ${rule.trigger.event}` : `Every ${rule.trigger.intervalMinutes} min`}
                                        {' → '}{rule.action.type.replace('_', ' ')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => removeRule(rule.id)}
                                    className="p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

// ─── Main App ─────────────────────────────────────────────────────
export const TasksApp: React.FC<TasksAppProps> = ({ windowData }) => {
    const [activeTab, setActiveTab] = useState<TabId>('tasks');
    const store = useTasksStore();

    useEffect(() => {
        if (!windowData?.lastAction) return;
        const { type, payload } = windowData.lastAction;
        switch (type) {
            case 'create_task':
                store.createTask(payload);
                setActiveTab('tasks');
                break;
            case 'complete_task':
                if (payload?.id) store.completeTask(payload.id);
                break;
            case 'start_pomodoro':
                store.startPomodoro(payload?.taskId);
                setActiveTab('pomodoro');
                break;
            case 'set_reminder':
                store.createReminder(payload);
                break;
            case 'focus_task':
                setActiveTab('tasks');
                break;
        }
    }, [windowData?.lastAction]);

    return (
        <div className="flex flex-col h-full bg-zinc-950/95 text-zinc-100">
            {/* Tab bar */}
            <div className="flex items-center gap-0.5 px-2 pt-2 pb-0 border-b border-white/[0.06]">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors',
                                isActive
                                    ? 'text-zinc-100 bg-white/[0.06]'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                            )}
                        >
                            <Icon size={14} />
                            {tab.label}
                            {isActive && (
                                <motion.div
                                    layoutId="tab-indicator"
                                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-400 rounded-full"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0">
                {activeTab === 'tasks' && <TasksTab />}
                {activeTab === 'pomodoro' && <PomodoroTab />}
                {activeTab === 'automation' && <AutomationTab />}
            </div>
        </div>
    );
};
