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
    category: 'os' | 'file' | 'shell' | 'browser' | 'generate' | 'automation' | 'business';
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
    updateMemory: (key: string, value: any) => void;
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

const CATEGORY_ORDER: string[] = ['business', 'automation', 'os', 'file', 'generate', 'shell', 'browser'];
const CATEGORY_LABELS: Record<string, string> = {
    business: 'INTEGRATIONS (USE FIRST for email, slack, github, sheets, calendar, contacts)',
    automation: 'AUTOMATION & COMPOSIO',
    os: 'OS',
    file: 'FILE',
    generate: 'GENERATE',
    shell: 'SHELL',
    browser: 'BROWSER (use ONLY when no integration tool fits)',
};

export function getToolsForPrompt(): string {
    const tools = getAllTools();
    const grouped: Record<string, ToolDefinition[]> = {};
    tools.forEach(t => {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
    });

    let prompt = '';
    const orderedCategories = [
        ...CATEGORY_ORDER.filter(c => grouped[c]),
        ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)),
    ];

    for (const category of orderedCategories) {
        const categoryTools = grouped[category];
        if (!categoryTools) continue;
        const label = CATEGORY_LABELS[category] || category.toUpperCase();
        prompt += `\n[${label}]\n`;
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
 * 5. Nested objects in args
 */
export function parseToolCalls(text: string): ParsedToolCall[] {
    const calls: ParsedToolCall[] = [];
    const trimmed = text.trim();

    // Strategy 0: Pure JSON response (entire response is just a tool call)
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = tryParseToolCall(trimmed);
        if (parsed) {
            return [{ ...parsed, rawMatch: trimmed }];
        }
    }

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

    // Strategy 2: Find JSON objects with "tool" key anywhere in text using balanced brace extraction
    const toolKeyRegex = /"tool"\s*:/g;
    while ((match = toolKeyRegex.exec(text)) !== null) {
        // Find the opening brace before this "tool" key
        let braceStart = match.index - 1;
        while (braceStart >= 0 && text[braceStart] !== '{') {
            braceStart--;
        }
        
        if (braceStart >= 0) {
            const balanced = extractBalancedJson(text, braceStart);
            if (balanced) {
                const parsed = tryParseToolCall(balanced);
                if (parsed) {
                    // Check if this call overlaps with existing calls
                    const overlaps = calls.some(c => {
                        const existingStart = text.indexOf(c.rawMatch);
                        const existingEnd = existingStart + c.rawMatch.length;
                        return braceStart < existingEnd && braceStart + balanced.length > existingStart;
                    });
                    
                    if (!overlaps) {
                        calls.push({ ...parsed, rawMatch: balanced });
                    }
                }
            }
        }
    }

    return calls;
}

function tryParseToolCall(jsonStr: string): { tool: string; args: Record<string, any> } | null {
    try {
        // Clean up common issues
        let cleaned = jsonStr
            .replace(/,\s*}/g, '}')   // trailing commas
            .replace(/,\s*]/g, ']');   // trailing commas in arrays

        // Fix single-quote property names only (not apostrophes in values)
        // Replace 'propertyName': with "propertyName":
        cleaned = cleaned.replace(/'([a-zA-Z_][a-zA-Z0-9_]*)'(\s*:)/g, '"$1"$2');
        
        // Fix unquoted property names (common AI mistake)
        cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

        const obj = JSON.parse(cleaned);
        if (obj && typeof obj.tool === 'string') {
            return {
                tool: obj.tool,
                args: obj.args || {}
            };
        }
    } catch (e) {
        // Try to extract tool name and args using regex as fallback
        const toolMatch = jsonStr.match(/"tool"\s*:\s*"([^"]+)"/);
        if (toolMatch) {
            const toolName = toolMatch[1];
            // Try to extract args object
            const argsMatch = jsonStr.match(/"args"\s*:\s*(\{[\s\S]*\})/);
            if (argsMatch) {
                try {
                    const args = JSON.parse(argsMatch[1]);
                    return { tool: toolName, args };
                } catch {
                    // Return with empty args if parsing fails
                    return { tool: toolName, args: {} };
                }
            }
            return { tool: toolName, args: {} };
        }
    }
    return null;
}

function extractBalancedJson(text: string, startIdx: number): string | null {
    let depth = 0;
    let inString = false;
    let escape = false;
    const maxSearchLength = 10000; // Increased limit for complex tool calls

    for (let i = startIdx; i < text.length && i < startIdx + maxSearchLength; i++) {
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
    context: ToolContext,
    confirmCallback?: (toolName: string, args: Record<string, any>) => Promise<boolean>
): Promise<ToolResult> {
    const tool = getTool(toolCall.tool);

    if (!tool) {
        return {
            success: false,
            message: `Unknown tool "${toolCall.tool}". Available tools: ${getAllTools().map(t => t.name).join(', ')}`
        };
    }

    // Check if tool requires confirmation
    if (tool.requiresConfirmation && confirmCallback) {
        const confirmed = await confirmCallback(toolCall.tool, toolCall.args);
        if (!confirmed) {
            return {
                success: false,
                message: `Tool execution cancelled by user`
            };
        }
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
