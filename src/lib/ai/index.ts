/**
 * Tool Loader — imports all tool modules to register them with the engine
 * Import this file once at app startup to register all tools
 */
import './tools/osTools';
import './tools/fileTools';
import './tools/shellTools';
import './tools/browserTools';
import './tools/generateTools';
import './tools/automationTools';
import './tools/composioTools';
import './tools/businessTools';

// Re-export engine for convenience
export {
    getAllTools,
    getTool,
    parseToolCalls,
    executeTool,
    stripToolCalls,
    getToolsForPrompt
} from './toolEngine';
export type { ToolContext, ToolResult, ParsedToolCall, ToolDefinition } from './toolEngine';

// Re-export Crew AI system
export { 
    NeuroOSCrew, 
    createCrew, 
    DEFAULT_CREW_AGENTS 
} from './crew';
export type { 
    Agent, 
    AgentRole, 
    Task, 
    CrewMember, 
    CrewConfig, 
    CrewExecutionResult 
} from './crew';
