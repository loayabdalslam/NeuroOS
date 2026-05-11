# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NeuroOS** is an AI-powered desktop operating system built with Electron, React, and TypeScript. It provides a windowed desktop environment with an integrated AI assistant that can execute tools, manage files, and control applications. The system features multi-user authentication, workspace management, and integration with multiple LLM providers (Gemini, OpenAI, Ollama) and external services via Composio.

## Development Commands

### Setup & Installation
```bash
npm install                    # Install dependencies
npm run lint                   # TypeScript type checking (no emit)
```

### Development
```bash
npm run dev                    # Start Vite dev server only (web mode, port 5173)
npm run electron:dev           # Start full Electron + Vite dev environment (recommended)
npm run preview               # Preview production build locally
```

### Building
```bash
npm run build                 # Full build: TypeScript + Vite + Electron
npm run electron:build        # Build production Electron app with installer
npm run clean                 # Remove build artifacts (dist, dist-electron)
```

### Key Notes
- **Development**: Use `npm run electron:dev` for full desktop app development. This runs Vite on port 5173 and launches Electron with hot reload.
- **Type Checking**: Run `npm run lint` before commits to catch TypeScript errors.
- **Build Output**: Production builds output to `release/{version}/` with NSIS installer for Windows.

## Architecture Overview

### High-Level Structure

NeuroOS follows a **layered architecture** with clear separation between the Electron main process, React frontend, and AI/tool systems:

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (src/)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ App.tsx (root) → Auth/Onboarding → Desktop Shell    │   │
│  │  ├─ WindowManager (app lifecycle)                   │   │
│  │  ├─ Taskbar, StartMenu, Desktop                     │   │
│  │  └─ Apps (Chat, FileExplorer, Settings, etc.)       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ State Management (Zustand stores)                    │   │
│  │  ├─ authStore (users, auth state)                   │   │
│  │  ├─ settingsStore (AI config, theme)                │   │
│  │  ├─ workspaceStore (file system path)               │   │
│  │  ├─ sessionStore (chat history)                     │   │
│  │  └─ composioStore (external integrations)           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI & Tool Systems (src/lib/ai/)                      │   │
│  │  ├─ crew.ts (multi-agent orchestration)             │   │
│  │  ├─ toolEngine.ts (tool registry & execution)       │   │
│  │  ├─ tools/ (business, composio, OS tools)           │   │
│  │  └─ llm/factory.ts (provider abstraction)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ IPC
┌─────────────────────────────────────────────────────────────┐
│              Electron Main Process (native-shell/)           │
│  ├─ main.ts (window creation, IPC handlers)                 │
│  ├─ preload.ts (context bridge for secure API)              │
│  └─ File system, app lifecycle, system integration          │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

#### 1. **IPC Communication (Electron ↔ React)**
- **Frontend → Main**: React calls `window.electron.*` methods (exposed via preload.ts)
- **Main → Frontend**: IPC events trigger React state updates
- **File System**: All file operations go through IPC to the main process for security
- **Path Validation**: `isPathSafe()` in main.ts validates all user-provided paths

#### 2. **State Management (Zustand)**
All state is managed via Zustand stores with persistence middleware:
- **authStore**: User profiles, authentication, PIN verification (SHA-256 hashed)
- **settingsStore**: AI provider config, theme, user preferences
- **workspaceStore**: Selected workspace path (persisted across restarts)
- **sessionStore**: Chat history and messages
- **composioStore**: External service integrations and permissions

#### 3. **AI & Tool Execution**
- **Tool Registry** (`toolEngine.ts`): Central registry of all available tools
- **Tool Categories**: `os`, `file`, `shell`, `browser`, `generate`, `automation`, `business`
- **Tool Execution**: `executeTool()` runs tools with context (file access, app control, etc.)
- **Multi-Agent System** (`crew.ts`): Agents (Coordinator, Planner, Researcher, etc.) with specialized roles and tool access
- **Composio Integration**: External app integrations (email, Slack, GitHub, etc.) via Composio SDK

#### 4. **LLM Provider Abstraction**
- **Factory Pattern** (`llm/factory.ts`): `getLLMProvider()` returns provider instance
- **Supported Providers**: Gemini, OpenAI, Ollama, any OpenAI-compatible API
- **Streaming**: All providers support token-by-token streaming responses
- **Vision Models**: Specific models (Claude, GPT-4V, Gemini Pro Vision) support image input

#### 5. **Application System**
- **App Registry** (`lib/apps.ts`): Defines all available apps with metadata
- **Window Management**: `WindowManager` orchestrates app lifecycle (open, close, minimize, maximize)
- **App Components**: Each app is a React component that receives `windowData` prop
- **Built-in Apps**: Chat, FileExplorer, Settings, Terminal, Board, LLMManager, etc.

### File Organization

```
src/
├── apps/                      # Application components
│   ├── Chat.tsx              # AI chat with streaming & tool execution
│   ├── FileExplorer/         # File manager with workspace support
│   ├── Settings.tsx          # AI provider & system settings
│   ├── Terminal.tsx          # Terminal emulator
│   ├── Board/                # Dashboard/widget system
│   ├── LLMManager/           # LLM provider management
│   ├── MCPConnectors.tsx     # Model Context Protocol integration
│   └── [other apps]
│
├── components/               # Shared UI components
│   ├── WindowManager.tsx     # App window orchestration
│   ├── Taskbar.tsx          # Bottom taskbar with app launcher
│   ├── StartMenu.tsx        # Application menu
│   ├── Desktop.tsx          # Desktop background & icons
│   ├── OSWindow.tsx         # Draggable window container
│   ├── LockScreen.tsx       # PIN authentication
│   ├── OnboardingFlow.tsx   # First-run setup
│   ├── ContextMenu.tsx      # Right-click context menus
│   └── [other components]
│
├── hooks/                    # Custom React hooks
│   ├── useOS.ts             # OS state & app control
│   └── useFileSystem.ts     # File system operations bridge
│
├── stores/                   # Zustand state stores
│   ├── authStore.ts         # User auth & profiles
│   ├── settingsStore.ts     # App settings & AI config
│   ├── workspaceStore.ts    # Workspace path persistence
│   ├── sessionStore.ts      # Chat history
│   └── composioStore.ts     # External integrations
│
├── lib/
│   ├── ai/
│   │   ├── crew.ts          # Multi-agent orchestration
│   │   ├── toolEngine.ts    # Tool registry & execution
│   │   ├── tools/
│   │   │   ├── businessTools.ts    # Composio integrations
│   │   │   ├── composioTools.ts    # Composio SDK wrapper
│   │   │   └── [other tool sets]
│   │   └── llm/
│   │       ├── factory.ts          # Provider abstraction
│   │       ├── types.ts            # LLM type definitions
│   │       ├── errors.ts           # Error handling
│   │       └── [provider implementations]
│   ├── composio/
│   │   ├── composioClient.ts       # Composio SDK client
│   │   └── composioSDKClient.ts    # SDK wrapper
│   ├── designSystem/               # Theme & styling
│   ├── apps.ts                     # App registry
│   └── utils.ts                    # Shared utilities
│
├── types/
│   └── electron.d.ts        # Window.electron type definitions
│
├── App.tsx                  # Root component (auth flow, boot animation)
└── main.tsx                 # React entry point

native-shell/
├── main.ts                  # Electron main process
├── preload.ts              # Context bridge (secure API)
└── tsconfig.json           # Electron TypeScript config
```

## Key Concepts & Patterns

### Tool Execution Flow
1. **User Input** → Chat component receives message
2. **LLM Call** → Provider streams response with tool calls (XML/JSON format)
3. **Tool Parsing** → `parseToolCalls()` extracts tool name and arguments
4. **Tool Execution** → `executeTool()` runs tool with context (file access, app control)
5. **Result Handling** → Tool result sent back to LLM for synthesis
6. **Iteration** → Loop continues until LLM stops calling tools (max 12 iterations)

### Multi-Agent System (Crew)
- **Coordinator**: Orchestrates workflow, delegates tasks, synthesizes results
- **Planner**: Analyzes complex tasks, creates execution plans
- **Researcher**: Gathers information, searches, analyzes data
- **Analyst**: Performs analysis, generates insights
- **Executor**: Executes tasks, runs tools, manages operations

Each agent has specific tools and expertise. Tasks can have dependencies and are executed in order.

### Authentication & Security
- **PIN-Based**: Users authenticate with PIN (SHA-256 hashed, never stored plaintext)
- **Multi-User**: Multiple user profiles with separate settings
- **Path Validation**: All file paths validated against whitelist (home dir, app dir, allowed roots)
- **Context Isolation**: Electron context isolation enabled, nodeIntegration disabled
- **IPC Security**: All IPC handlers validate input and check authentication

### Workspace System
- **Persistent Path**: User selects workspace folder on first run, persisted in store
- **File Operations**: All file operations scoped to workspace path
- **Validation**: Workspace path checked on startup; cleared if moved/deleted

## Common Development Tasks

### Adding a New Tool
1. Create tool definition in `src/lib/ai/tools/[category]Tools.ts`
2. Implement handler function with `ToolContext` parameter
3. Register tool: `registerTool(toolDefinition)`
4. Add to appropriate agent's tool list in `crew.ts`

### Adding a New App
1. Create component in `src/apps/[AppName].tsx`
2. Add to app registry in `src/lib/apps.ts`
3. Implement `windowData` prop handling
4. Add icon and metadata to registry entry

### Adding a New LLM Provider
1. Create provider class in `src/lib/llm/providers/[Provider].ts`
2. Implement `stream()` method for streaming responses
3. Register in factory: `src/lib/llm/factory.ts`
4. Add to settings UI for configuration

### Debugging Tool Execution
- Chat component logs thinking blocks with tool calls/results
- `ThinkBlock` component shows execution timeline
- Tool errors display with fallback suggestions
- Check `toolEngine.ts` for parsing/execution logic

## Important Notes

### Composio Integration
- Composio provides 1000+ external app integrations
- Tools are loaded dynamically based on user permissions
- Requires API key configuration in settings
- Business tools (email, Slack, GitHub, etc.) use Composio SDK

### Streaming & Performance
- All LLM responses stream token-by-token for responsiveness
- Tool execution happens during streaming (agentic loop)
- Max 12 iterations to prevent infinite loops
- Thinking blocks track execution timeline for debugging

### Type Safety
- TypeScript strict mode enabled
- Electron types defined in `src/types/electron.d.ts`
- Tool definitions are strongly typed
- Store actions are type-safe via Zustand

### Environment Variables
- `GEMINI_API_KEY`: Gemini API key (optional, can be set in Settings)
- `VITE_DEV_SERVER_URL`: Set by electron:dev script
- Other provider keys configured via Settings UI

## Testing & Verification

- **Type Checking**: `npm run lint` (no emit, just checking)
- **Build Verification**: `npm run build` compiles everything
- **Dev Testing**: `npm run electron:dev` for interactive testing
- **Production Build**: `npm run electron:build` creates installer

## Git & Deployment

- **Main Branch**: Production-ready code
- **Releases**: Published via GitHub (electron-updater configured)
- **Installer**: NSIS-based Windows installer with auto-update support
- **Version**: Managed in `package.json`, used in build output path
