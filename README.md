
<p align="center">
<img width="1472" height="958" alt="Screenshot 2026-04-02 213707" src="https://github.com/user-attachments/assets/79544ea6-fb37-4d26-958f-978a67ff4c6b" />

</p>


<h1 align="center">NeuroOS</h1>

<p align="center">
  <strong>An AI-powered desktop operating system built with Electron, React & TypeScript</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-30.0-47848F?logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

---

## 🧠 What is NeuroOS?

**NeuroOS** is a fully-featured desktop environment that runs inside Electron, designed to feel like a real operating system while being powered by AI at its core. It features a windowed application system, user authentication, an AI chat assistant, a file explorer with workspace management, and much more.

---

## ✨ Features

### 🖥️ Desktop Environment
- **Window Management** — Drag, resize, minimize, maximize, and close application windows
- **Taskbar** — Quick-launch apps and view running applications
- **Start Menu** — Browse and launch all installed apps
- **Custom Wallpapers** — Set your own desktop background
- **Right-Click Context Menus** — Native-style context menus everywhere (Desktop, Windows, Files, Chat)
- **Boot Animation** — Sleek startup sequence with fade transition

### 🤖 AI Chat Assistant
- **Multi-Provider Support** — Connect to Ollama, OpenAI, Gemini, or any OpenAI-compatible API
- **Streaming Responses** — Real-time token-by-token AI responses
- **Tool Integration** — AI can:
  - 🚀 **Open apps** on your desktop
  - 📋 **List running apps**
  - 💾 **Generate & save files** directly to your workspace
  - 📂 **Browse your workspace** contents
- **Stop Generation** — Halt AI responses mid-stream
- **Markdown Rendering** — Rich formatting with syntax-highlighted code blocks

### 📁 File Explorer
- **Workspace Setup Wizard** — Select a folder on your machine as your workspace
- **Full File Management** — Create, rename, delete, upload files and folders
- **Breadcrumb Navigation** — Click-through path navigation
- **File Type Icons** — Color-coded icons for 20+ file extensions
- **Inline Search** — Filter files instantly
- **Persistent Workspace** — Remembers your workspace across restarts
- **Right-Click Actions** — Rename, Copy Path, Delete from context menu

### ⚙️ Settings
- **AI Provider Configuration** — Add/remove LLM providers with custom endpoints
- **Model Selection** — Choose models per provider
- **Wallpaper Settings** — Customize your desktop background
- **User Management** — Multi-user support with PIN authentication

### 🔐 Authentication
- **Lock Screen** — PIN-based user authentication
- **Onboarding Flow** — First-run setup wizard for new users
- **Multi-User Support** — Switch between user profiles
- **Hydration Guard** — Prevents UI flash during auth state loading

### 📦 More Apps
- **Terminal** — Built-in terminal emulator
- **Agent Studio** — AI agent management interface
- **LLM Manager** — Configure and manage language models
- **MCP Connectors** — Model Context Protocol integration
- **Automation Engine** — Workflow automation tools

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Electron 30 |
| **Frontend** | React 19 + TypeScript 5.8 |
| **Build Tool** | Vite 6.2 |
| **Styling** | Tailwind CSS 4 |
| **Animations** | Framer Motion (motion) |
| **State** | Zustand (with persistence) |
| **Icons** | Lucide React |
| **Markdown** | react-markdown |
| **Database** | better-sqlite3 |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **npm** 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/NeuroOS.git
cd NeuroOS

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Configure AI Providers

Edit your `.env` file:

```env
GEMINI_API_KEY="your-gemini-api-key"
```

Or configure providers directly in the Settings app after launching.

### Development

```bash
# Start in development mode (Vite + Electron)
npm run electron:dev
```

This will:
1. Start the Vite dev server on `http://localhost:5173`
2. Compile the Electron main process
3. Launch the Electron window

### Production Build

```bash
# Build for production
npm run electron:build
```

---

## 📁 Project Structure

```
NeuroOS/
├── native-shell/              # Electron main process
│   ├── main.ts                # Main process entry (IPC handlers, window)
│   ├── preload.ts             # Context bridge (secure API exposure)
│   └── tsconfig.json          # TypeScript config for Electron
├── src/
│   ├── apps/                  # Application components
│   │   ├── Chat.tsx           # AI Chat with streaming & tools
│   │   ├── FileExplorer/      # File manager with workspace support
│   │   ├── Settings.tsx       # System settings & AI config
│   │   ├── Terminal.tsx       # Terminal emulator
│   │   ├── AgentStudio.tsx    # AI agent management
│   │   ├── LLMManager.tsx     # Language model management
│   │   ├── MCPConnectors.tsx  # MCP integration
│   │   └── AutomationEngine.tsx
│   ├── components/            # Shared UI components
│   │   ├── OSWindow.tsx       # Draggable window container
│   │   ├── Taskbar.tsx        # Bottom taskbar
│   │   ├── Desktop.tsx        # Desktop background & icons
│   │   ├── StartMenu.tsx      # Application launcher
│   │   ├── ContextMenu.tsx    # Right-click context menu system
│   │   ├── LockScreen.tsx     # PIN authentication screen
│   │   ├── OnboardingFlow.tsx # First-run setup
│   │   └── WindowManager.tsx  # Window orchestration
│   ├── hooks/                 # Custom React hooks
│   │   ├── useOS.ts           # OS state management
│   │   └── useFileSystem.ts   # File system operations bridge
│   ├── stores/                # Zustand state stores
│   │   ├── authStore.ts       # Authentication state
│   │   ├── settingsStore.ts   # App settings & AI config
│   │   └── workspaceStore.ts  # Workspace path persistence
│   ├── lib/                   # Utilities & services
│   │   ├── apps.ts            # App registry & config
│   │   ├── llm/               # LLM provider implementations
│   │   └── utils.ts           # Shared utilities
│   ├── types/                 # TypeScript declarations
│   │   └── electron.d.ts      # Window.electron type definitions
│   ├── App.tsx                # Root application component
│   └── main.tsx               # React entry point
├── public/                    # Static assets
├── .env.example               # Environment variables template
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server only (web mode) |
| `npm run electron:dev` | Start full Electron + Vite dev environment |
| `npm run electron:build` | Build production Electron app |
| `npm run build` | Build everything (TypeScript + Vite + Electron) |
| `npm run clean` | Remove build artifacts |
| `npm run lint` | TypeScript type checking |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with ❤️ by the NeuroOS team
</p>
