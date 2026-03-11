/**
 * NeuroOS Crew AI - Multi-Agent System
 * A sophisticated agentic framework inspired by Crew AI for complex task execution
 */

import { getLLMProvider } from '../llm/factory';
import { executeTool, ToolContext, ToolResult } from './toolEngine';
import { parseToolCalls } from './toolEngine';

export type AgentRole = 'planner' | 'executor' | 'researcher' | 'analyst' | 'coordinator';

export interface Agent {
    id: string;
    name: string;
    role: AgentRole;
    description: string;
    expertise: string[];
    tools: string[];
    model?: string;
}

export interface Task {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    assignedAgent?: string;
    result?: string;
    error?: string;
    dependencies: string[];
}

export interface CrewMember {
    agent: Agent;
    task: Task | null;
    status: 'idle' | 'working' | 'waiting' | 'completed';
    output?: string;
}

export interface CrewExecutionResult {
    success: boolean;
    tasks: Task[];
    finalOutput: string;
    executionTime: number;
    crewOutputs: Record<string, string>;
}

export interface CrewConfig {
    agents: Agent[];
    tasks: Task[];
    verbose?: boolean;
    maxIterations?: number;
    planningEnabled?: boolean;
}

const DEFAULT_AGENTS: Agent[] = [
    {
        id: 'coordinator',
        name: 'Coordinator',
        role: 'coordinator',
        description: 'Orchestrates the workflow, delegates tasks to other agents, and synthesizes results',
        expertise: ['project management', 'task delegation', 'result synthesis', 'multi-agent coordination'],
        tools: [
            // OS Tools
            'open_app', 'close_app', 'list_running_apps', 'send_notification', 'get_system_info',
            'open_file', 'add_board_widget', 'update_memory', 'save_to_workspace'
        ]
    },
    {
        id: 'planner',
        name: 'Planner',
        role: 'planner',
        description: 'Analyzes complex tasks and creates step-by-step breakdown detailed execution plans with',
        expertise: ['task analysis', 'planning', 'breakdown', 'dependency mapping', 'strategy'],
        tools: [
            // OS Tools
            'open_app', 'list_running_apps', 'get_system_info', 'get_app_windows', 'update_memory',
            // File Tools
            'list_files', 'read_file'
        ]
    },
    {
        id: 'researcher',
        name: 'Researcher',
        role: 'researcher',
        description: 'Gathers information, browses the web, scrapes pages, and retrieves relevant data',
        expertise: ['research', 'web browsing', 'information gathering', 'data extraction', 'web automation'],
        tools: [
            // Browser Tools - Navigation
            'browser_navigate', 'browser_tab', 'browser_back', 'browser_forward', 'browser_refresh',
            // Browser Tools - Content
            'browser_scrape', 'web_fetch', 'search_web', 'web_research',
            'browser_get_info', 'browser_get_links', 'browser_get_html',
            // Browser Tools - Interaction
            'browser_click', 'browser_type', 'browser_key', 'browser_submit', 'browser_scroll', 'browser_wait',
            'browser_evaluate', 'browser_save'
        ]
    },
    {
        id: 'executor',
        name: 'Executor',
        role: 'executor',
        description: 'Performs actions, creates files, runs commands, and executes tasks',
        expertise: ['execution', 'file operations', 'shell commands', 'code generation', 'automation'],
        tools: [
            // OS Tools
            'open_app', 'close_app', 'list_running_apps', 'send_notification', 'open_file',
            'add_board_widget', 'update_memory', 'save_to_workspace',
            // File Tools
            'save_file', 'read_file', 'append_file', 'update_file', 'list_files', 'create_folder', 'delete_file',
            // Shell Tools
            'run_shell',
            // Generate Tools
            'generate_report', 'generate_image'
        ]
    },
    {
        id: 'analyst',
        name: 'Analyst',
        role: 'analyst',
        description: 'Analyzes data, reviews outputs, provides insights, and optimizes results',
        expertise: ['analysis', 'review', 'optimization', 'data processing', 'quality assurance'],
        tools: [
            // OS Tools
            'get_app_windows', 'get_system_info', 'list_running_apps', 'update_memory',
            // File Tools
            'list_files', 'read_file', 'save_file', 'append_file',
            // Browser Tools
            'browser_scrape', 'web_fetch', 'browser_get_info', 'browser_get_links',
            // Generate Tools
            'generate_report'
        ]
    }
];

export class NeuroOSCrew {
    private config: CrewConfig;
    private crew: CrewMember[] = [];
    private taskQueue: Task[] = [];
    private completedTasks: Map<string, string> = new Map();
    private iteration: number = 0;
    private executionLog: string[] = [];

    constructor(config: CrewConfig) {
        this.config = {
            verbose: true,
            maxIterations: 10,
            planningEnabled: true,
            ...config
        };
        
        this.initializeCrew();
    }

    private initializeCrew() {
        this.crew = this.config.agents.map(agent => ({
            agent,
            task: null,
            status: 'idle'
        }));
        this.taskQueue = [...this.config.tasks];
        this.log('Crew initialized with agents:', this.config.agents.map(a => a.name).join(', '));
    }

    private log(...args: any[]) {
        if (this.config.verbose) {
            const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
            this.executionLog.push(`[${new Date().toISOString()}] ${message}`);
            console.log('[NeuroOS Crew]', message);
        }
    }

    private getAgentByRole(role: AgentRole): CrewMember | undefined {
        return this.crew.find(c => c.agent.role === role);
    }

    private getAvailableAgent(): CrewMember | undefined {
        return this.crew.find(c => c.status === 'idle');
    }

    private async executeAgentTask(member: CrewMember, context: ToolContext): Promise<string> {
        const llm = getLLMProvider();
        
        const systemPrompt = this.buildAgentSystemPrompt(member);
        const taskContext = this.buildTaskContext(member);
        
        const messages = [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: taskContext }
        ];

        try {
            let fullResponse = '';
            
            await llm.stream(messages, (chunk) => {
                fullResponse += chunk;
            });

            const toolCalls = parseToolCalls(fullResponse);
            
            if (toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    this.log(`Agent ${member.agent.name} executing tool: ${toolCall.tool}`);
                    const result = await executeTool(toolCall, context);
                    fullResponse += `\n\n[Tool Result: ${result.message}]`;
                }
            }

            return fullResponse;
        } catch (error: any) {
            this.log(`Agent ${member.agent.name} error:`, error.message);
            return `Error: ${error.message}`;
        }
    }

    private buildAgentSystemPrompt(member: CrewMember): string {
        const agent = member.agent;
        
        return `You are ${agent.name}, an AI agent with the following role: ${agent.role}.

DESCRIPTION:
${agent.description}

EXPERTISE:
${agent.expertise.map(e => `- ${e}`).join('\n')}

Your goal is to complete your assigned task efficiently and report back with your results.

Guidelines:
1. Think step by step before taking action
2. Use available tools when needed to accomplish your task
3. If you need information from another agent, request it in your response
4. Always provide clear, actionable results
5. If you encounter errors, explain what happened and suggest alternatives

Remember: You are part of a crew working together. Coordinate with other agents when needed.`;
    }

    private buildTaskContext(member: CrewMember): string {
        let context = '';
        
        if (member.task) {
            context += `TASK: ${member.task.description}\n`;
            
            if (member.task.dependencies.length > 0) {
                context += `\nDEPENDENCIES:\n`;
                for (const depId of member.task.dependencies) {
                    const depResult = this.completedTasks.get(depId);
                    if (depResult) {
                        context += `- ${depId}: ${depResult.slice(0, 200)}...\n`;
                    }
                }
            }
        }

        context += `\nCURRENT TASK QUEUE:\n`;
        for (const task of this.taskQueue) {
            context += `- ${task.id}: ${task.status} - ${task.description}\n`;
        }

        context += `\nProvide your output clearly. If the task is complete, state "TASK COMPLETE" and summarize your results.`;
        
        return context;
    }

    private async planTasks(context: ToolContext): Promise<void> {
        if (!this.config.planningEnabled) return;
        
        this.log('Starting planning phase...');
        
        const planner = this.getAgentByRole('planner');
        if (!planner) {
            this.log('No planner agent found, using default task assignment');
            return;
        }

        const llm = getLLMProvider();
        
        const planningPrompt = `You are the Planner agent. Analyze the following tasks and assign them to the most appropriate agents.

AVAILABLE AGENTS:
${this.config.agents.map(a => `- ${a.name} (${a.role}): ${a.description}`).join('\n')}

TASKS TO PLAN:
${this.config.tasks.map(t => `- ${t.id}: ${t.description}`).join('\n')}

For each task, determine:
1. Which agent is best suited to execute it
2. What dependencies it has on other tasks
3. The optimal execution order

Respond in JSON format:
{
  "planned_tasks": [
    {
      "task_id": "string",
      "assigned_agent": "string",
      "dependencies": ["task_id"],
      "reasoning": "string"
    }
  ]
}`;

        try {
            const messages = [
                { role: 'system' as const, content: this.buildAgentSystemPrompt(planner) },
                { role: 'user' as const, content: planningPrompt }
            ];

            let response = '';
            await llm.stream(messages, (chunk) => {
                response += chunk;
            });

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const plan = JSON.parse(jsonMatch[0]);
                if (plan.planned_tasks) {
                    this.taskQueue = this.config.tasks.map(t => {
                        const planned = plan.planned_tasks.find((p: any) => p.task_id === t.id);
                        if (planned) {
                            return { ...t, assignedAgent: planned.assigned_agent, dependencies: planned.dependencies || [] };
                        }
                        return t;
                    });
                    this.log('Task planning complete');
                }
            }
        } catch (error: any) {
            this.log('Planning failed, using default assignment:', error.message);
        }
    }

    async execute(context: ToolContext): Promise<CrewExecutionResult> {
        const startTime = Date.now();
        
        this.log('Starting crew execution...');
        
        await this.planTasks(context);

        while (this.taskQueue.length > 0 && this.iteration < (this.config.maxIterations || 10)) {
            this.iteration++;
            this.log(`\n=== Iteration ${this.iteration} ===`);
            
            const task = this.taskQueue.find(t => 
                t.status === 'pending' && 
                t.dependencies.every(dep => this.completedTasks.has(dep))
            );

            if (!task) {
                const pending = this.taskQueue.filter(t => t.status === 'pending');
                if (pending.length > 0) {
                    this.log('No tasks ready to execute (dependencies not met)');
                    break;
                }
                break;
            }

            task.status = 'in_progress';
            
            const agentMember = task.assignedAgent 
                ? this.crew.find(c => c.agent.id === task.assignedAgent) 
                : this.getAvailableAgent();

            if (!agentMember) {
                task.status = 'failed';
                task.error = 'No available agent';
                continue;
            }

            agentMember.status = 'working';
            agentMember.task = task;

            this.log(`Executing task: ${task.description} with agent: ${agentMember.agent.name}`);

            try {
                const result = await this.executeAgentTask(agentMember, context);
                
                task.status = 'completed';
                task.result = result;
                this.completedTasks.set(task.id, result);
                
                agentMember.output = result;
                agentMember.status = 'completed';
                
                this.log(`Task ${task.id} completed successfully`);
                
                this.crew.forEach(c => {
                    if (c.agent.id === agentMember.agent.id) {
                        c.status = 'idle';
                        c.task = null;
                    }
                });

            } catch (error: any) {
                task.status = 'failed';
                task.error = error.message;
                agentMember.status = 'idle';
                agentMember.task = null;
                this.log(`Task ${task.id} failed:`, error.message);
            }

            this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
        }

        const finalOutput = await this.synthesizeResults();
        
        const result: CrewExecutionResult = {
            success: this.completedTasks.size > 0,
            tasks: this.config.tasks,
            finalOutput,
            executionTime: Date.now() - startTime,
            crewOutputs: Object.fromEntries(this.completedTasks)
        };

        this.log(`\nCrew execution complete. Success: ${result.success}, Time: ${result.executionTime}ms`);

        return result;
    }

    private async synthesizeResults(): Promise<string> {
        const coordinator = this.getAgentByRole('coordinator');
        
        if (!coordinator) {
            return Array.from(this.completedTasks.entries())
                .map(([taskId, result]) => `Task ${taskId}:\n${result}`)
                .join('\n\n');
        }

        const synthesisPrompt = `You are the Coordinator agent. Synthesize the results from all completed tasks into a coherent final output.

COMPLETED TASK RESULTS:
${Array.from(this.completedTasks.entries())
    .map(([taskId, result]) => `Task ${taskId}:\n${result}`)
    .join('\n\n')}

Provide a clear, concise summary of what was accomplished.`;

        const llm = getLLMProvider();
        
        try {
            const messages = [
                { role: 'system' as const, content: this.buildAgentSystemPrompt(coordinator) },
                { role: 'user' as const, content: synthesisPrompt }
            ];

            let result = '';
            await llm.stream(messages, (chunk) => {
                result += chunk;
            });

            return result;
        } catch (error: any) {
            return `Synthesis failed: ${error.message}. Results:\n${Array.from(this.completedTasks.values()).join('\n\n')}`;
        }
    }

    getExecutionLog(): string[] {
        return this.executionLog;
    }

    getCrewStatus(): { agent: string; status: string; task: string | null }[] {
        return this.crew.map(c => ({
            agent: c.agent.name,
            status: c.status,
            task: c.task?.description || null
        }));
    }
}

export function createCrew(config: Omit<CrewConfig, 'agents'> & { 
    agentConfigs?: Partial<Agent>[] 
}): NeuroOSCrew {
    const agents = config.agentConfigs 
        ? config.agentConfigs.map((ac, i) => ({ ...DEFAULT_AGENTS[i % DEFAULT_AGENTS.length], ...ac }))
        : DEFAULT_AGENTS;

    return new NeuroOSCrew({
        ...config,
        agents
    });
}

export const DEFAULT_CREW_AGENTS = DEFAULT_AGENTS;
