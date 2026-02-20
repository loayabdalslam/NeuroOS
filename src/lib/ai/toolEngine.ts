/**
 * NeuroOS Tool Engine
 * Central registry for AI tools with robust JSON parsing and multi-step execution
 */

export interface ToolParameter {
    type: string;
    description: string;
    enum?: string[];
    required?: boolean;
}

export interface ToolDefinition {
    name: string;
    description: string;
    category: 'os' | 'file' | 'shell' | 'browser' | 'generate' | 'automation';
    parameters: Record<string, ToolParameter>;
    requiresConfirmation?: boolean;
    handler: (args: Record<string, any>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
    openApp: (id: string, name: string) => void;
    closeWindow: (id: string) => void;
    sendAppAction: (idOrComponent: string, type: string, payload: any) => void;
    getAppWindows: () => any[];
    appWindows: any[];
    workspacePath: string | null;
    writeFile: (path: string, content: string) => Promise<void>;
    readFile: (path: string) => Promise<string>;
    listFiles: (path: string) => Promise<any[]>;
    createDir: (path: string) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    addMessage: (role: 'assistant' | 'system', content: string) => void;
}

export interface ToolResult {
    success: boolean;
    message: string;
    data?: any;
    /** If true, don't send result back to AI - just display it */
    displayOnly?: boolean;
}

export interface ParsedToolCall {
    tool: string;
    args: Record<string, any>;
    rawMatch: string;
}

// ─── Tool Registry ───────────────────────────────────────────────
const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
    toolRegistry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
    return toolRegistry.get(name);
}

export function getAllTools(): ToolDefinition[] {
    return Array.from(toolRegistry.values());
}

export function getToolsForPrompt(): string {
    const tools = getAllTools();
    const grouped: Record<string, ToolDefinition[]> = {};
    tools.forEach(t => {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
    });

    let prompt = '';
    for (const [category, categoryTools] of Object.entries(grouped)) {
        prompt += `\n[${category.toUpperCase()}]\n`;
        categoryTools.forEach(t => {
            const params = Object.entries(t.parameters)
                .map(([k, v]) => `${k}: ${v.type}${v.required !== false ? ' (required)' : ''} — ${v.description}`)
                .join(', ');
            prompt += `- ${t.name}(${params}): ${t.description}\n`;
        });
    }
    return prompt;
}

// ─── Robust JSON Parser ──────────────────────────────────────────
/**
 * Extracts tool calls from AI response text.
 * Handles multiple formats:
 * 1. Pure JSON: { "tool": "name", "args": {} }
 * 2. Markdown fences: ```json { "tool": "name", "args": {} } ```
 * 3. JSON with surrounding text
 * 4. Multiple tool calls in one response
 */
export function parseToolCalls(text: string): ParsedToolCall[] {
    const calls: ParsedToolCall[] = [];

    // Strategy 1: Extract from markdown code fences (```json ... ```)
    const fenceRegex = /```(?:json)?\s*\n?\s*(\{[\s\S]*?\})\s*\n?\s*```/g;
    let match;
    while ((match = fenceRegex.exec(text)) !== null) {
        const parsed = tryParseToolCall(match[1]);
        if (parsed) {
            calls.push({ ...parsed, rawMatch: match[0] });
        }
    }

    if (calls.length > 0) return calls;

    // Strategy 2: Find JSON objects with "tool" key anywhere in text
    const jsonRegex = /\{[^{}]*"tool"\s*:\s*"[^"]+"\s*,\s*"args"\s*:\s*\{[^{}]*\}[^{}]*\}/g;
    while ((match = jsonRegex.exec(text)) !== null) {
        const parsed = tryParseToolCall(match[0]);
        if (parsed) {
            calls.push({ ...parsed, rawMatch: match[0] });
        }
    }

    if (calls.length > 0) return calls;

    // Strategy 3: Find any JSON object that might be a tool call
    const anyJsonRegex = /\{[\s\S]*?"tool"\s*:[\s\S]*?\}/g;
    while ((match = anyJsonRegex.exec(text)) !== null) {
        // Try to find the balanced braces
        const balanced = extractBalancedJson(text, match.index);
        if (balanced) {
            const parsed = tryParseToolCall(balanced);
            if (parsed) {
                calls.push({ ...parsed, rawMatch: balanced });
            }
        }
    }

    return calls;
}

function tryParseToolCall(jsonStr: string): { tool: string; args: Record<string, any> } | null {
    try {
        // Clean up common issues
        const cleaned = jsonStr
            .replace(/,\s*}/g, '}')   // trailing commas
            .replace(/,\s*]/g, ']')   // trailing commas in arrays
            .replace(/'/g, '"');       // single quotes to double

        const obj = JSON.parse(cleaned);
        if (obj && typeof obj.tool === 'string') {
            return {
                tool: obj.tool,
                args: obj.args || {}
            };
        }
    } catch {
        // Not valid JSON
    }
    return null;
}

function extractBalancedJson(text: string, startIdx: number): string | null {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < text.length && i < startIdx + 2000; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\' && inString) {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') depth++;
            if (char === '}') {
                depth--;
                if (depth === 0) {
                    return text.slice(startIdx, i + 1);
                }
            }
        }
    }
    return null;
}

// ─── Tool Executor ───────────────────────────────────────────────
export async function executeTool(
    toolCall: ParsedToolCall,
    context: ToolContext
): Promise<ToolResult> {
    const tool = getTool(toolCall.tool);

    if (!tool) {
        return {
            success: false,
            message: `Unknown tool "${toolCall.tool}". Available tools: ${getAllTools().map(t => t.name).join(', ')}`
        };
    }

    try {
        const result = await tool.handler(toolCall.args, context);
        return result;
    } catch (error: any) {
        return {
            success: false,
            message: `Tool "${toolCall.tool}" failed: ${error.message}`
        };
    }
}

// ─── Strip tool calls from display text ──────────────────────────
export function stripToolCalls(text: string, calls: ParsedToolCall[]): string {
    let clean = text;
    for (const call of calls) {
        clean = clean.replace(call.rawMatch, '');
    }

    // Proactive stripping for streaming: hide partial JSON blocks
    // 1. Matches ```json { ... up to the end of string (unclosed fence)
    clean = clean.replace(/```(?:json)?\s*\{[\s\S]*$/g, '');
    // 2. Matches standalone { "tool": ... up to the end of string (unclosed object)
    clean = clean.replace(/\{[^{}]*"tool"[\s\S]*$/g, '');

    // Clean up leftover markdown fences and whitespace
    clean = clean.replace(/```(?:json)?\s*```/g, '').trim();
    return clean;
}
