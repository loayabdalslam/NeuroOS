/**
 * Code Agent - AI-powered app generator
 * Generates, builds, and runs small applications using the runtime machine
 */

import { runtimeMachine, NeuroApp, createAppFromCode } from './runtimeMachine';
import { getLLMProvider } from '../llm/factory';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export interface GenerationResult {
    success: boolean;
    app?: NeuroApp;
    error?: string;
    logs: string[];
}

export interface AppSpec {
    name: string;
    description: string;
    type: 'html' | 'react' | 'node' | 'script';
    features: string[];
    tags: string[];
    author: string;
}

const HTML_PROMPT_TEMPLATE = (spec: AppSpec) => `You are an expert web developer. Generate a complete, self-contained HTML file for the following app.

APP SPEC:
- Name: ${spec.name}
- Description: ${spec.description}
- Type: Single HTML file with embedded CSS and JavaScript
- Features: ${spec.features.join(', ')}

REQUIREMENTS:
1. Create a single HTML file with embedded <style> and <script> tags
2. Make it visually polished with good UI/UX
3. Use modern JavaScript (ES6+)
4. No external dependencies - everything must be self-contained
5. Include a clear visual design with good typography and spacing
6. Make it responsive where appropriate
7. Store any data in localStorage
8. Include error handling for user interactions

Return ONLY the HTML code, no explanations. The response should start with <!DOCTYPE html>`;

const REACT_PROMPT_TEMPLATE = (spec: AppSpec) => `You are an expert React developer. Generate a complete React component for the following app.

APP SPEC:
- Name: ${spec.name}
- Description: ${spec.description}
- Features: ${spec.features.join(', ')}

REQUIREMENTS:
1. Single self-contained React component (default export)
2. Use TypeScript with proper types
3. Use Tailwind CSS classes for styling
4. Use lucide-react for icons if needed
5. Use react and motion/react for animations
6. Handle all states (loading, error, empty, data)
7. Make it fully functional with proper event handlers
8. No external API calls - use mock/seed data where needed

Return ONLY the React component code, no explanations.`;

const SCRIPT_PROMPT_TEMPLATE = (spec: AppSpec) => `You are an expert developer. Generate a Node.js script for the following task.

APP/TASK SPEC:
- Name: ${spec.name}
- Description: ${spec.description}
- Features: ${spec.features.join(', ')}

REQUIREMENTS:
1. Self-contained Node.js script
2. Use ES6+ syntax
3. Handle errors gracefully
4. Log progress to console
5. Can use built-in Node.js modules only (fs, path, http if needed)
6. If file operations needed, use process.cwd() as base path

Return ONLY the script code, no explanations.`;

export class CodeAgent {
    private logs: string[] = [];

    private log(msg: string) {
        const timestamp = new Date().toISOString();
        this.logs.push(`[${timestamp}] ${msg}`);
        console.log('[CodeAgent]', msg);
    }

    clearLogs() {
        this.logs = [];
    }

    getLogs(): string[] {
        return [...this.logs];
    }

    async generateApp(spec: AppSpec, signal?: AbortSignal): Promise<GenerationResult> {
        this.clearLogs();
        this.log(`Starting generation: ${spec.name}`);

        try {
            let prompt: string;
            let type: NeuroApp['type'] = spec.type;

            switch (spec.type) {
                case 'react':
                    prompt = REACT_PROMPT_TEMPLATE(spec);
                    break;
                case 'script':
                    prompt = SCRIPT_PROMPT_TEMPLATE(spec);
                    break;
                case 'html':
                default:
                    prompt = HTML_PROMPT_TEMPLATE(spec);
                    type = 'html';
            }

            this.log(`Generating ${type} app...`);

            let code = '';
            const llm = getLLMProvider();

            await llm.stream(
                [
                    { role: 'system', content: 'You are a world-class developer. Write clean, efficient, and beautiful code.' },
                    { role: 'user', content: prompt }
                ],
                (chunk) => {
                    code += chunk;
                },
                signal
            );

            // Clean up the generated code
            code = this.cleanGeneratedCode(code, type);
            this.log(`Generated ${code.length} characters of code`);

            if (code.length < 100) {
                return { success: false, error: 'Generated code is too short', logs: this.logs };
            }

            // Create the app
            const app = createAppFromCode(
                spec.name,
                spec.description,
                { 'main': code },
                type,
                spec.tags,
                spec.author
            );

            // Register with runtime
            const result = runtimeMachine.registerApp(app);
            this.log(`Registered app with ID: ${result.id}`);

            return { success: true, app, logs: this.logs };

        } catch (error: any) {
            this.log(`Error: ${error.message}`);
            return { success: false, error: error.message, logs: this.logs };
        }
    }

    private cleanGeneratedCode(code: string, type: NeuroApp['type']): string {
        // Remove markdown code blocks if present
        code = code.replace(/^```(?:html|javascript|typescript|jsx|tsx)?\s*/i, '');
        code = code.replace(/\s*```$/i, '');

        // Trim whitespace
        code = code.trim();

        // Validate basic structure based on type
        if (type === 'html' && !code.includes('<!DOCTYPE') && !code.includes('<html')) {
            throw new Error('Invalid HTML: missing DOCTYPE or html tag');
        }

        if ((type === 'react') && !code.includes('export default') && !code.includes('function ')) {
            throw new Error('Invalid React: missing component');
        }

        return code;
    }

    async generateFromPrompt(
        userPrompt: string,
        signal?: AbortSignal
    ): Promise<GenerationResult> {
        this.log(`Parsing user prompt: ${userPrompt}`);

        // Determine the best type based on the prompt
        let type: NeuroApp['type'] = 'html';
        if (userPrompt.toLowerCase().includes('react') || userPrompt.toLowerCase().includes('component')) {
            type = 'react';
        } else if (userPrompt.toLowerCase().includes('script') || userPrompt.toLowerCase().includes('node')) {
            type = 'script';
        }

        // Use AI to generate the spec from the user prompt
        const llm = getLLMProvider();
        let specPrompt = '';

        if (type === 'html') {
            specPrompt = `Analyze this app request and provide a JSON specification:
Request: "${userPrompt}"

Provide a JSON object with:
- name: short app name (1-3 words)
- description: one sentence description
- features: array of 3-5 specific features this app should have
- tags: array of relevant tags

Return ONLY the JSON object, no markdown or explanation.`;
        }

        let specText = '';
        await llm.stream([
            { role: 'system', content: 'You are a JSON generator. Output ONLY valid JSON.' },
            { role: 'user', content: specPrompt }
        ], (chunk) => { specText += chunk; }, signal);

        try {
            const jsonMatch = specText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { success: false, error: 'Failed to parse spec from response', logs: this.logs };
            }

            const spec = JSON.parse(jsonMatch[0]) as AppSpec;
            spec.type = type;
            spec.author = 'AI Generated';

            return await this.generateApp(spec, signal);
        } catch (error: any) {
            return { success: false, error: `Spec parsing failed: ${error.message}`, logs: this.logs };
        }
    }

    async iterateOnApp(
        appId: string,
        feedback: string,
        signal?: AbortSignal
    ): Promise<GenerationResult> {
        const app = runtimeMachine.getApp(appId);
        if (!app) {
            return { success: false, error: 'App not found', logs: this.logs };
        }

        this.log(`Iterating on app: ${app.name}`);
        this.log(`User feedback: ${feedback}`);

        const iterPrompt = `You have an existing ${app.type} app called "${app.name}" that needs to be updated.

EXISTING CODE:
\`\`\`${app.type === 'html' ? 'html' : 'jsx'}
${app.code.main}
\`\`\`

USER FEEDBACK:
${feedback}

INSTRUCTIONS:
1. Apply the feedback to improve the app
2. Keep what works, fix what doesn't
3. Maintain the same tech stack (${app.type})
4. Make it better than before

Return ONLY the updated code, no explanations.`;

        try {
            let newCode = '';
            const llm = getLLMProvider();

            await llm.stream([
                { role: 'system', content: 'You are a world-class developer improving existing code.' },
                { role: 'user', content: iterPrompt }
            ], (chunk) => { newCode += chunk; }, signal);

            newCode = this.cleanGeneratedCode(newCode, app.type);
            runtimeMachine.updateApp(appId, {
                code: { main: newCode },
                lastRun: Date.now(),
            });

            const updatedApp = runtimeMachine.getApp(appId);
            return { success: true, app: updatedApp, logs: this.logs };

        } catch (error: any) {
            return { success: false, error: error.message, logs: this.logs };
        }
    }
}

export const codeAgent = new CodeAgent();