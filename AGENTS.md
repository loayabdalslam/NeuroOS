# NeuroOS Agents Documentation

## Overview

NeuroOS features a powerful multi-agent AI system inspired by Crew AI, designed to handle complex tasks through collaborative agent workflows. Each agent has specific roles, expertise, and access to system tools.

---

## Agent System Architecture

### Agent Roles

| Agent | Role | Description |
|-------|------|-------------|
| **Coordinator** | Orchestrator | Manages workflow, delegates tasks, synthesizes results |
| **Planner** | Strategist | Analyzes tasks, creates execution plans, maps dependencies |
| **Researcher** | Information Gatherer | Browses web, scrapes pages, retrieves data |
| **Executor** | Action Performer | Creates files, runs commands, executes tasks |
| **Analyst** | Reviewer | Analyzes data, reviews outputs, provides insights |

---

## Available Tools by Agent

### Coordinator Agent
- `open_app` - Open system applications
- `close_app` - Close running applications
- `list_running_apps` - List open windows
- `send_notification` - Show system notifications
- `get_system_info` - Get system information
- `open_file` - Open files in viewer
- `add_board_widget` - Add widgets to NeuroBoard
- `update_memory` - Save persistent memory
- `save_to_workspace` - Save files to workspace

### Planner Agent
- `open_app` - Open applications
- `list_running_apps` - List running apps
- `get_system_info` - System information
- `get_app_windows` - Get window list
- `update_memory` - Update memory
- `list_files` - List workspace files
- `read_file` - Read file contents

### Researcher Agent
**Browser Tools:**
- `browser_navigate` - Navigate to URL
- `browser_scrape` - Extract page content
- `web_fetch` - CORS-free fetch
- `search_web` - Google search
- `web_research` - Multi-URL research
- `browser_click` - Click elements
- `browser_type` - Type in inputs
- `browser_key` - Press keyboard keys
- `browser_submit` - Submit forms
- `browser_scroll` - Scroll pages
- `browser_wait` - Wait for elements
- `browser_evaluate` - Execute JavaScript
- `browser_get_info` - Get page metadata
- `browser_get_links` - Extract links
- `browser_get_html` - Get raw HTML
- `browser_save` - Save content to workspace

**File Tools:**
- `read_file` - Read files
- `list_files` - List directory contents

### Executor Agent
**OS Tools:**
- `open_app`, `close_app`, `list_running_apps`
- `send_notification`, `open_file`
- `add_board_widget`, `update_memory`, `save_to_workspace`

**File Tools:**
- `save_file` - Create/write files
- `read_file` - Read files
- `append_file` - Append to files
- `update_file` - Update files (find/replace)
- `list_files` - List directory
- `create_folder` - Create directories
- `delete_file` - Delete files

**Shell Tools:**
- `run_shell` - Execute shell commands

**Generate Tools:**
- `generate_report` - Generate markdown reports
- `generate_image` - Generate AI images

### Analyst Agent
- `get_app_windows`, `get_system_info`, `list_running_apps`
- `update_memory`
- `list_files`, `read_file`, `save_file`, `append_file`
- `browser_scrape`, `web_fetch`, `browser_get_info`, `browser_get_links`
- `generate_report`

---

## Using the Crew AI System

### Basic Usage

```typescript
import { createCrew } from './lib/ai/crew';

const crew = createCrew({
    tasks: [
        { 
            id: 'research', 
            description: 'Research the latest AI trends', 
            status: 'pending', 
            dependencies: [] 
        },
        { 
            id: 'write_report', 
            description: 'Write a research report', 
            status: 'pending', 
            dependencies: ['research'] 
        }
    ],
    verbose: true,
    planningEnabled: true
});

const result = await crew.execute(context);
console.log(result.finalOutput);
```

### Task Configuration

```typescript
interface Task {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    assignedAgent?: string;
    result?: string;
    error?: string;
    dependencies: string[];
}
```

### Execution Flow

1. **Planning Phase** - Planner analyzes tasks and assigns agents
2. **Execution Phase** - Agents execute their assigned tasks
3. **Dependency Resolution** - Tasks wait for dependencies to complete
4. **Synthesis** - Coordinator aggregates results

---

## Browser Automation

The Researcher agent has full access to Neuro Browser automation:

### Navigation
```json
{ "tool": "browser_navigate", "args": { "url": "https://example.com" } }
```

### Scraping
```json
{ "tool": "browser_scrape", "args": { "maxLength": 6000 } }
```

### Search
```json
{ "tool": "search_web", "args": { "query": "latest AI news" } }
```

### Interaction
```json
{ "tool": "browser_click", "args": { "selector": "#submit-btn" } }
{ "tool": "browser_type", "args": { "text": "hello", "selector": "#input" } }
```

---

## File Operations

### Read File
```json
{ "tool": "read_file", "args": { "filename": "data.json" } }
```

### Write File
```json
{ "tool": "save_file", "args": { "filename": "output.md", "content": "# Report" } }
```

### List Files
```json
{ "tool": "list_files", "args": { "path": "documents" } }
```

---

## Best Practices

1. **Clear Task Descriptions** - Provide detailed task descriptions for better results
2. **Set Dependencies** - Define task dependencies for proper execution order
3. **Use Appropriate Agents** - Match tasks to agent capabilities
4. **Enable Planning** - Let the Planner optimize task assignments
5. **Monitor Execution** - Use verbose mode to track progress

---

## Error Handling

The system includes:
- Automatic retry for transient failures
- Dependency deadlock detection
- Maximum iteration limits (prevents infinite loops)
- Timeout handling for long-running operations

---

## Performance

- Task execution is parallelized when dependencies allow
- Tool results are cached for reuse
- Memory is persisted across sessions
- Browser automation uses efficient DOM targeting
