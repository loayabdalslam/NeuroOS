/**
 * Automation Tools — tasks, reminders, pomodoro, automation rules
 */
import { registerTool, ToolResult } from '../toolEngine';
import { useTasksStore } from '../../../stores/tasksStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useOS } from '../../../hooks/useOS';

const ensureTasksApp = () => {
    let win = useOS.getState().appWindows.find((w) => w.component === 'tasks');
    if (!win) {
        useOS.getState().openApp('tasks', 'Tasks');
    }
};

// ─── Create Task ────────────────────────────────────────────────
registerTool({
    name: 'create_task',
    description: 'Creates a new task in the Tasks app. Use for to-do items, action items, or anything the user wants to track.',
    category: 'automation',
    parameters: {
        title: { type: 'string', description: 'Task title', required: true },
        description: { type: 'string', description: 'Task description', required: false },
        priority: { type: 'string', description: 'Priority level', enum: ['low', 'medium', 'high'], required: false },
        due_date: { type: 'string', description: 'Due date in ISO 8601 format (e.g. 2026-04-25)', required: false },
        tags: { type: 'string', description: 'Comma-separated tags', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const task = useTasksStore.getState().createTask({
            title: args.title,
            description: args.description || '',
            priority: args.priority || 'medium',
            dueDate: args.due_date ? new Date(args.due_date).getTime() : null,
            tags: args.tags ? args.tags.split(',').map((t: string) => t.trim()) : [],
        });
        ensureTasksApp();
        return {
            success: true,
            message: `Created task: **${task.title}** (${task.priority} priority)`,
            data: { id: task.id, title: task.title },
        };
    },
});

// ─── List Tasks ─────────────────────────────────────────────────
registerTool({
    name: 'list_tasks',
    description: 'Lists all tasks, optionally filtered by status or priority.',
    category: 'automation',
    parameters: {
        status: { type: 'string', description: 'Filter by status', enum: ['todo', 'in_progress', 'done'], required: false },
        priority: { type: 'string', description: 'Filter by priority', enum: ['low', 'medium', 'high'], required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        let tasks = useTasksStore.getState().tasks;
        if (args.status) tasks = tasks.filter((t) => t.status === args.status);
        if (args.priority) tasks = tasks.filter((t) => t.priority === args.priority);

        if (tasks.length === 0) {
            return { success: true, message: 'No tasks found.' };
        }
        const list = tasks
            .map((t) => `• [${t.status === 'done' ? '✓' : ' '}] **${t.title}** (${t.priority}) ${t.dueDate ? `— due ${new Date(t.dueDate).toLocaleDateString()}` : ''}`)
            .join('\n');
        return { success: true, message: `**Tasks (${tasks.length}):**\n${list}`, data: { tasks, count: tasks.length } };
    },
});

// ─── Complete Task ──────────────────────────────────────────────
registerTool({
    name: 'complete_task',
    description: 'Marks a task as done. Can match by title (partial) or ID.',
    category: 'automation',
    parameters: {
        title: { type: 'string', description: 'Task title (partial match) or task ID', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const store = useTasksStore.getState();
        const query = args.title.toLowerCase();
        const task = store.tasks.find(
            (t) => t.id === args.title || t.title.toLowerCase().includes(query)
        );
        if (!task) return { success: false, message: `Task not found: "${args.title}"` };
        store.completeTask(task.id);
        return { success: true, message: `Completed task: **${task.title}**` };
    },
});

// ─── Delete Task ────────────────────────────────────────────────
registerTool({
    name: 'delete_task',
    description: 'Deletes a task by title (partial match) or ID.',
    category: 'automation',
    parameters: {
        title: { type: 'string', description: 'Task title (partial match) or task ID', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const store = useTasksStore.getState();
        const query = args.title.toLowerCase();
        const task = store.tasks.find(
            (t) => t.id === args.title || t.title.toLowerCase().includes(query)
        );
        if (!task) return { success: false, message: `Task not found: "${args.title}"` };
        store.deleteTask(task.id);
        return { success: true, message: `Deleted task: **${task.title}**` };
    },
});

// ─── Set Reminder ───────────────────────────────────────────────
registerTool({
    name: 'set_reminder',
    description: 'Creates a timed reminder that will trigger a notification. Supports "in X minutes" style or absolute ISO date.',
    category: 'automation',
    parameters: {
        title: { type: 'string', description: 'Reminder title', required: true },
        message: { type: 'string', description: 'Reminder message', required: false },
        in_minutes: { type: 'string', description: 'Minutes from now to trigger (e.g. "30")', required: false },
        at: { type: 'string', description: 'Absolute trigger time in ISO 8601', required: false },
        repeat: { type: 'string', description: 'Repeat interval', enum: ['none', 'daily', 'weekly'], required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        let triggerAt: number;
        if (args.in_minutes) {
            triggerAt = Date.now() + parseInt(args.in_minutes, 10) * 60 * 1000;
        } else if (args.at) {
            triggerAt = new Date(args.at).getTime();
        } else {
            return { success: false, message: 'Provide either `in_minutes` or `at` for the reminder time.' };
        }

        const reminder = useTasksStore.getState().createReminder({
            taskId: null,
            title: args.title,
            message: args.message || args.title,
            triggerAt,
            repeat: args.repeat || 'none',
        });
        const timeStr = new Date(triggerAt).toLocaleTimeString();
        return { success: true, message: `Reminder set: **${args.title}** at ${timeStr}`, data: { id: reminder.id } };
    },
});

// ─── Start Pomodoro ─────────────────────────────────────────────
registerTool({
    name: 'start_pomodoro',
    description: 'Starts a Pomodoro focus timer. Optionally link to a task by title.',
    category: 'automation',
    parameters: {
        task_title: { type: 'string', description: 'Task to link (partial match)', required: false },
        work_minutes: { type: 'string', description: 'Work duration in minutes (default 25)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const store = useTasksStore.getState();
        let taskId: string | undefined;

        if (args.task_title) {
            const query = args.task_title.toLowerCase();
            const task = store.tasks.find((t) => t.title.toLowerCase().includes(query));
            if (task) taskId = task.id;
        }

        if (args.work_minutes) {
            store.setPomodoroSettings({ workDuration: parseInt(args.work_minutes, 10) });
        }

        store.startPomodoro(taskId);
        ensureTasksApp();

        const duration = args.work_minutes || store.pomodoro.workDuration;
        return {
            success: true,
            message: `Pomodoro started: ${duration} minutes${taskId ? ` (linked to task)` : ''}`,
        };
    },
});

// ─── Stop Pomodoro ──────────────────────────────────────────────
registerTool({
    name: 'stop_pomodoro',
    description: 'Pauses or resets the Pomodoro timer.',
    category: 'automation',
    parameters: {
        action: { type: 'string', description: 'Pause or reset', enum: ['pause', 'reset'], required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const store = useTasksStore.getState();
        if (args.action === 'reset') {
            store.resetPomodoro();
            return { success: true, message: 'Pomodoro timer reset.' };
        }
        store.pausePomodoro();
        return { success: true, message: 'Pomodoro timer paused.' };
    },
});

// ─── Add Automation Rule ────────────────────────────────────────
registerTool({
    name: 'add_automation_rule',
    description: 'Creates an automation rule that triggers actions on events or schedules.',
    category: 'automation',
    parameters: {
        name: { type: 'string', description: 'Rule name', required: true },
        trigger_type: { type: 'string', description: 'Trigger type', enum: ['schedule', 'event'], required: true },
        trigger_value: { type: 'string', description: 'For schedule: interval in minutes. For event: event name (task_completed, task_created, pomodoro_done, pomodoro_break_done, reminder_fired, app_opened)', required: true },
        action_type: { type: 'string', description: 'Action type', enum: ['send_notification', 'open_app', 'create_task', 'run_command', 'navigate_url', 'send_to_board'], required: true },
        action_params: { type: 'string', description: 'JSON string of action parameters', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        let params: Record<string, any> = {};
        if (args.action_params) {
            try { params = JSON.parse(args.action_params); } catch {}
        }

        useTasksStore.getState().addRule({
            name: args.name,
            enabled: true,
            trigger: {
                type: args.trigger_type,
                ...(args.trigger_type === 'schedule'
                    ? { intervalMinutes: parseInt(args.trigger_value, 10) }
                    : { event: args.trigger_value }),
            },
            action: { type: args.action_type, params },
        });
        ensureTasksApp();
        return { success: true, message: `Automation rule created: **${args.name}**` };
    },
});

// ─── List Automation Rules ──────────────────────────────────────
registerTool({
    name: 'list_automation_rules',
    description: 'Lists all automation rules.',
    category: 'automation',
    parameters: {},
    handler: async (): Promise<ToolResult> => {
        const rules = useTasksStore.getState().automationRules;
        if (rules.length === 0) return { success: true, message: 'No automation rules configured.' };
        const list = rules
            .map((r) => `• ${r.enabled ? '🟢' : '⚫'} **${r.name}** — ${r.trigger.type}: ${r.trigger.event || r.trigger.intervalMinutes + 'min'} → ${r.action.type}`)
            .join('\n');
        return { success: true, message: `**Automation Rules (${rules.length}):**\n${list}`, data: { rules } };
    },
});
