import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useNotificationStore } from './notificationStore';

export interface Task {
    id: string;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    dueDate: number | null;
    tags: string[];
    createdAt: number;
    updatedAt: number;
    completedAt: number | null;
    pomodorosCompleted: number;
    pomodorosEstimated: number;
}

export interface Reminder {
    id: string;
    taskId: string | null;
    title: string;
    message: string;
    triggerAt: number;
    repeat: 'none' | 'daily' | 'weekly';
    fired: boolean;
}

export interface AutomationRule {
    id: string;
    name: string;
    enabled: boolean;
    trigger: {
        type: 'schedule' | 'event';
        intervalMinutes?: number;
        event?: string;
    };
    action: {
        type: 'open_app' | 'run_command' | 'send_notification' | 'create_task';
        params: Record<string, any>;
    };
    lastRun: number | null;
}

export interface PomodoroState {
    isRunning: boolean;
    mode: 'work' | 'short_break' | 'long_break';
    timeRemaining: number;
    currentTaskId: string | null;
    sessionsCompleted: number;
    workDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    longBreakInterval: number;
}

interface TasksState {
    tasks: Task[];
    reminders: Reminder[];
    automationRules: AutomationRule[];
    pomodoro: PomodoroState;

    createTask: (task: Partial<Task> & { title: string }) => Task;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    completeTask: (id: string) => void;

    createReminder: (reminder: Omit<Reminder, 'id' | 'fired'>) => Reminder;
    deleteReminder: (id: string) => void;
    fireReminder: (id: string) => void;
    checkReminders: () => void;

    addRule: (rule: Omit<AutomationRule, 'id' | 'lastRun'>) => void;
    updateRule: (id: string, updates: Partial<AutomationRule>) => void;
    removeRule: (id: string) => void;
    toggleRule: (id: string) => void;

    startPomodoro: (taskId?: string) => void;
    pausePomodoro: () => void;
    resumePomodoro: () => void;
    resetPomodoro: () => void;
    skipToNext: () => void;
    tick: () => void;
    setPomodoroSettings: (settings: Partial<Pick<PomodoroState, 'workDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'longBreakInterval'>>) => void;
}

const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_POMODORO: PomodoroState = {
    isRunning: false,
    mode: 'work',
    timeRemaining: 25 * 60,
    currentTaskId: null,
    sessionsCompleted: 0,
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
};

export const useTasksStore = create<TasksState>()(
    persist(
        (set, get) => ({
            tasks: [],
            reminders: [],
            automationRules: [],
            pomodoro: { ...DEFAULT_POMODORO },

            createTask: (partial) => {
                const task: Task = {
                    id: genId('task'),
                    title: partial.title,
                    description: partial.description || '',
                    status: partial.status || 'todo',
                    priority: partial.priority || 'medium',
                    dueDate: partial.dueDate || null,
                    tags: partial.tags || [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    completedAt: null,
                    pomodorosCompleted: partial.pomodorosCompleted || 0,
                    pomodorosEstimated: partial.pomodorosEstimated || 0,
                };
                set((state) => ({ tasks: [task, ...state.tasks] }));
                return task;
            },

            updateTask: (id, updates) => set((state) => ({
                tasks: state.tasks.map((t) =>
                    t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
                ),
            })),

            deleteTask: (id) => set((state) => ({
                tasks: state.tasks.filter((t) => t.id !== id),
            })),

            completeTask: (id) => {
                set((state) => ({
                    tasks: state.tasks.map((t) =>
                        t.id === id
                            ? { ...t, status: 'done' as const, completedAt: Date.now(), updatedAt: Date.now() }
                            : t
                    ),
                }));
                const task = get().tasks.find((t) => t.id === id);
                if (task) {
                    useNotificationStore.getState().addNotification({
                        type: 'success',
                        title: 'Task Completed',
                        message: task.title,
                        autoDismissMs: 4000,
                    });
                }
            },

            createReminder: (partial) => {
                const reminder: Reminder = {
                    ...partial,
                    id: genId('rem'),
                    fired: false,
                };
                set((state) => ({ reminders: [...state.reminders, reminder] }));
                return reminder;
            },

            deleteReminder: (id) => set((state) => ({
                reminders: state.reminders.filter((r) => r.id !== id),
            })),

            fireReminder: (id) => {
                const reminder = get().reminders.find((r) => r.id === id);
                if (!reminder) return;

                useNotificationStore.getState().addNotification({
                    type: 'reminder',
                    title: reminder.title,
                    message: reminder.message,
                    autoDismissMs: 0,
                    action: reminder.taskId
                        ? { label: 'Open Tasks', appId: 'tasks', actionType: 'focus_task', payload: { taskId: reminder.taskId } }
                        : undefined,
                });

                try {
                    (window as any).electron?.system?.notification?.(
                        `Reminder: ${reminder.title}`,
                        reminder.message
                    );
                } catch {}

                if (reminder.repeat === 'none') {
                    set((state) => ({
                        reminders: state.reminders.map((r) =>
                            r.id === id ? { ...r, fired: true } : r
                        ),
                    }));
                } else {
                    const interval = reminder.repeat === 'daily' ? 86400000 : 604800000;
                    set((state) => ({
                        reminders: state.reminders.map((r) =>
                            r.id === id ? { ...r, triggerAt: r.triggerAt + interval } : r
                        ),
                    }));
                }
            },

            checkReminders: () => {
                const now = Date.now();
                const { reminders, fireReminder } = get();
                reminders
                    .filter((r) => !r.fired && r.triggerAt <= now)
                    .forEach((r) => fireReminder(r.id));
            },

            addRule: (rule) => set((state) => ({
                automationRules: [
                    ...state.automationRules,
                    { ...rule, id: genId('rule'), lastRun: null },
                ],
            })),

            updateRule: (id, updates) => set((state) => ({
                automationRules: state.automationRules.map((r) =>
                    r.id === id ? { ...r, ...updates } : r
                ),
            })),

            removeRule: (id) => set((state) => ({
                automationRules: state.automationRules.filter((r) => r.id !== id),
            })),

            toggleRule: (id) => set((state) => ({
                automationRules: state.automationRules.map((r) =>
                    r.id === id ? { ...r, enabled: !r.enabled } : r
                ),
            })),

            startPomodoro: (taskId) => set((state) => ({
                pomodoro: {
                    ...state.pomodoro,
                    isRunning: true,
                    currentTaskId: taskId || state.pomodoro.currentTaskId,
                    mode: 'work',
                    timeRemaining: state.pomodoro.workDuration * 60,
                },
            })),

            pausePomodoro: () => set((state) => ({
                pomodoro: { ...state.pomodoro, isRunning: false },
            })),

            resumePomodoro: () => set((state) => ({
                pomodoro: { ...state.pomodoro, isRunning: true },
            })),

            resetPomodoro: () => set((state) => ({
                pomodoro: {
                    ...DEFAULT_POMODORO,
                    workDuration: state.pomodoro.workDuration,
                    shortBreakDuration: state.pomodoro.shortBreakDuration,
                    longBreakDuration: state.pomodoro.longBreakDuration,
                    longBreakInterval: state.pomodoro.longBreakInterval,
                },
            })),

            skipToNext: () => {
                const { pomodoro } = get();
                const notify = useNotificationStore.getState().addNotification;

                if (pomodoro.mode === 'work') {
                    const newSessions = pomodoro.sessionsCompleted + 1;
                    const isLongBreak = newSessions % pomodoro.longBreakInterval === 0;
                    const nextMode = isLongBreak ? 'long_break' : 'short_break';
                    const duration = isLongBreak ? pomodoro.longBreakDuration : pomodoro.shortBreakDuration;

                    if (pomodoro.currentTaskId) {
                        const task = get().tasks.find((t) => t.id === pomodoro.currentTaskId);
                        if (task) {
                            get().updateTask(task.id, { pomodorosCompleted: task.pomodorosCompleted + 1 });
                        }
                    }

                    notify({
                        type: 'pomodoro',
                        title: 'Work session complete!',
                        message: isLongBreak ? 'Take a long break.' : 'Take a short break.',
                        autoDismissMs: 6000,
                    });

                    set((state) => ({
                        pomodoro: {
                            ...state.pomodoro,
                            mode: nextMode,
                            timeRemaining: duration * 60,
                            sessionsCompleted: newSessions,
                            isRunning: true,
                        },
                    }));
                } else {
                    notify({
                        type: 'pomodoro',
                        title: 'Break over!',
                        message: 'Time to focus.',
                        autoDismissMs: 6000,
                    });

                    set((state) => ({
                        pomodoro: {
                            ...state.pomodoro,
                            mode: 'work',
                            timeRemaining: state.pomodoro.workDuration * 60,
                            isRunning: true,
                        },
                    }));
                }
            },

            tick: () => {
                const { pomodoro } = get();
                if (!pomodoro.isRunning) return;

                if (pomodoro.timeRemaining <= 1) {
                    get().skipToNext();
                } else {
                    set((state) => ({
                        pomodoro: {
                            ...state.pomodoro,
                            timeRemaining: state.pomodoro.timeRemaining - 1,
                        },
                    }));
                }
            },

            setPomodoroSettings: (settings) => set((state) => ({
                pomodoro: { ...state.pomodoro, ...settings },
            })),
        }),
        {
            name: 'neuro-tasks',
            version: 1,
            partialize: (state) => ({
                tasks: state.tasks,
                reminders: state.reminders,
                automationRules: state.automationRules,
                pomodoro: {
                    ...state.pomodoro,
                    isRunning: false,
                },
            }),
        }
    )
);
