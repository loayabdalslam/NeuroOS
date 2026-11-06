# ACP agents in Neuro OS

Neuro OS speaks the [Agent Client Protocol](https://agentclientprotocol.com) v1 over stdio. Every agent below can be added from
**Settings → Providers → Add provider → ACP agents**, and from the provider step of onboarding (curated subset).

Source: the official ACP registry (`https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`), snapshot of 2026-11-06.
The registry is curated by the ACP project and only lists agents that support authentication. Community wrappers are included in the registry too — “official” here means “listed in the registry”, not “first-party”.

## How a preset launches

- `npx` agents: `npx -y <package> …` — the package is fetched on first launch and cached by npm.
- `uvx` agents: `uvx <package> …` — requires [uv](https://docs.astral.sh/uv/).
- `binary` agents: download the Windows archive, extract it, and point the command at the executable (the preset carries the archive URL).
- Authentication is handled by the agent itself (`/login`, env vars, or its own config). Neuro never stores agent credentials.

> **Security:** any ACP agent is a local process with your user privileges. Install only agents you trust, and prefer the registry’s official links. Plugins are separate and still run in an in-process VM (see BUG-001).

## All registry agents (44)

| Agent | Registry id | Distribution | Windows | Repository |
| --- | --- | --- | --- | --- |
| Agoragentic | `agoragentic-acp` | npx: `npx -y agoragentic-mcp@1.3.0` | npx | [rhein1/agoragentic-integrations](https://github.com/rhein1/agoragentic-integrations) |
| Amp | `amp-acp` | binary: `https://github.com/tao12345666333/amp-acp/releases/download/v0.12.0/amp-acp-windows-x86_64.zip` | amp-acp.exe | [tao12345666333/amp-acp](https://github.com/tao12345666333/amp-acp) |
| Google Antigravity | `antigravity-acp` | binary: `https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.5-windows-x86_64.zip` | ./agy_acp_server.exe | — |
| Auggie CLI | `auggie` | npx: `npx -y @augmentcode/auggie@0.37.0` | npx | [augmentcode/auggie](https://github.com/augmentcode/auggie) |
| Autohand Code | `autohand` | binary: `https://github.com/autohandai/code-cli/releases/download/v0.9.10/autohand-windows-x64.zip` | ./autohand.exe | [autohandai/code-cli](https://github.com/autohandai/code-cli) |
| Bob | `bob` | npx: `npx -y @ibm/bob@2.0.9` | npx | — |
| Claude Agent | `claude-acp` | npx: `npx -y @agentclientprotocol/claude-agent-acp@0.101.0` | npx | [agentclientprotocol/claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp) |
| Cline | `cline` | npx: `npx -y cline@3.0.74` | npx | [cline/cline](https://github.com/cline/cline) |
| Codebuddy Code | `codebuddy-code` | npx: `npx -y @tencent-ai/codebuddy-code@2.180.0` | npx | — |
| Codex | `codex-acp` | npx: `npx -y @agentclientprotocol/codex-acp@2.5.0` | npx | [agentclientprotocol/codex-acp](https://github.com/agentclientprotocol/codex-acp) |
| Cortex Code | `cortex-code` | binary: `https://sfc-repo.snowflakecomputing.com/cortex-code-cli/a4643c4278/1.0.73%2B180523.e6179a031de9/coco-1.0.73%2B180523.e6179a031de9-windows-amd64.tar.gz` | ./coco-1.0.73+180523.e6179a031de9-windows-amd64/cortex.exe | [https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) |
| Corust Agent | `corust-agent` | binary: `https://github.com/Corust-ai/corust-agent-release/releases/download/v0.6.0/agent-windows-x64.zip` | ./corust-agent-acp.exe | [Corust-ai/corust-agent-release](https://github.com/Corust-ai/corust-agent-release) |
| crow-cli | `crow-cli` | binary: `https://github.com/crow-cli/crow-cli/releases/download/v0.1.49/crow-cli-windows-x86_64.zip` | ./crow-cli.exe | [crow-cli/crow-cli](https://github.com/crow-cli/crow-cli) |
| Cursor | `cursor` | binary: `https://downloads.cursor.com/lab/2026.11.05-86047df/windows/x64/agent-cli-package.zip` | ./dist-package\cursor-agent.cmd | — |
| DeepAgents | `deepagents` | npx: `npx -y deepagents-acp@0.1.7` | npx | [langchain-ai/deepagentsjs](https://github.com/langchain-ai/deepagentsjs) |
| Devin | `devin` | binary: `https://static.devin.ai/cli/3000.11.234/devin-3000.11.234-x86_64-pc-windows.zip` | ./bin\devin.exe | [CognitionAI/devin-cli](https://github.com/CognitionAI/devin-cli) |
| DimCode | `dimcode` | npx: `npx -y dimcode@0.5.24` | npx | — |
| Dirac | `dirac` | npx: `npx -y dirac-cli@0.5.24` | npx | [dirac-run/dirac](https://github.com/dirac-run/dirac) |
| Factory Droid | `factory-droid` | npx: `npx -y droid@1.5.0` | npx | — |
| fast-agent | `fast-agent` | uvx: `uvx fast-agent-acp==0.10.1` | uv | [evalstate/fast-agent](https://github.com/evalstate/fast-agent) |
| Gemini CLI | `gemini` | npx: `npx -y @google/gemini-cli@0.67.0` | npx | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) |
| GitHub Copilot | `github-copilot-cli` | npx: `npx -y @github/copilot@1.0.106` | npx | [github/copilot-cli](https://github.com/github/copilot-cli) |
| GLM Agent | `glm-acp-agent` | npx: `npx -y glm-acp-agent@1.17.0` | npx | [stefandevo/glm-acp-agent](https://github.com/stefandevo/glm-acp-agent) |
| goose | `goose` | binary: `https://github.com/block/goose/releases/download/v1.57.0/goose-x86_64-pc-windows-msvc.zip` | ./goose-package\goose.exe | [block/goose](https://github.com/block/goose) |
| Grok Build | `grok-build` | npx: `npx -y @xai-official/grok@1.0.78` | npx | — |
| Harn | `harn` | binary: `https://github.com/burin-labs/harn/releases/download/v0.10.188/harn-x86_64-pc-windows-msvc.zip` | harn.exe | [burin-labs/harn](https://github.com/burin-labs/harn) |
| Junie | `junie` | binary: `https://github.com/JetBrains/junie-acp-release/releases/download/3959.5/junie-release-3959.5-windows-amd64.zip` | ./junie/junie.exe | [JetBrains/junie-acp-release](https://github.com/JetBrains/junie-acp-release) |
| Kilo | `kilo` | npx: `npx -y @kilocode/cli@7.8.27` | npx | [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) |
| Kimchi | `kimchi` | binary: `https://github.com/getkimchi/kimchi/releases/download/v1.28.3/kimchi_windows_amd64.zip` | ./bin/kimchi.exe | [getkimchi/kimchi](https://github.com/getkimchi/kimchi) |
| Kimi CLI | `kimi` | binary: `https://github.com/MoonshotAI/kimi-cli/releases/download/1.52.0/kimi-1.52.0-x86_64-pc-windows-msvc.zip` | ./kimi.exe | [MoonshotAI/kimi-cli](https://github.com/MoonshotAI/kimi-cli) |
| Kiro CLI | `kiro` | binary | no build | [kirodotdev/Kiro](https://github.com/kirodotdev/Kiro) |
| MiniMax Code | `minimax-code` | npx: `npx -y @minimax-ai/code@0.2.7` | npx | — |
| Minion Code | `minion-code` | uvx: `uvx minion-code@0.1.44` | uv | [femto/minion-code](https://github.com/femto/minion-code) |
| Mistral Vibe | `mistral-vibe` | binary: `https://github.com/mistralai/mistral-vibe/releases/download/v3.1.0/vibe-acp-windows-x86_64-3.1.0.zip` | ./vibe-acp.exe | [mistralai/mistral-vibe](https://github.com/mistralai/mistral-vibe) |
| Nova | `nova` | npx: `npx -y @compass-ai/nova@1.1.64` | npx | [Compass-Agentic-Platform/nova](https://github.com/Compass-Agentic-Platform/nova) |
| OpenCode | `opencode` | binary: `https://github.com/anomalyco/opencode/releases/download/v2.2.5/opencode-windows-x64.zip` | ./opencode.exe | [anomalyco/opencode](https://github.com/anomalyco/opencode) |
| OpenCode V2 | `opencode-v2` | binary: `https://opencode.ai/files/bin/2.2.5/opencode-windows-x64.zip` | ./opencode.exe | [anomalyco/opencode](https://github.com/anomalyco/opencode) |
| pi ACP | `pi-acp` | npx: `npx -y pi-acp@0.0.34` | npx | [svkozak/pi-acp](https://github.com/svkozak/pi-acp) |
| Poolside | `poolside` | binary: `https://downloads.poolside.ai/pool/v1.0.16/pool-windows-amd64.tar.gz` | ./pool-windows-amd64.exe | [poolsideai/pool](https://github.com/poolsideai/pool) |
| Qoder CLI | `qoder` | npx: `npx -y @qoder-ai/qodercli@0.2.14` | npx | — |
| Qwen Code | `qwen-code` | npx: `npx -y @qwen-code/qwen-code@0.26.8` | npx | [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code) |
| siGit Code | `sigit` | npx: `npx -y @smbcloud/sigit@1.7.8` | npx | [getsigit/sigit](https://github.com/getsigit/sigit) |
| Stakpak | `stakpak` | binary: `https://github.com/stakpak/agent/releases/download/v0.3.88/stakpak-windows-x86_64.zip` | ./stakpak.exe | [stakpak/agent](https://github.com/stakpak/agent) |
| VT Code | `vtcode` | binary: `https://github.com/vinhnx/VTCode/releases/download/0.96.14/vtcode-0.96.14-x86_64-pc-windows-msvc.zip` | vtcode.exe | [vinhnx/VTCode](https://github.com/vinhnx/VTCode) |

## Curated in onboarding

`acp-claude-acp`, `acp-codex-acp`, `acp-gemini`, `acp-opencode`, `acp-qwen-code`, `acp-goose`, `acp-cursor`, `acp-github-copilot-cli`.

## Notes and known gaps

- **Codex** uses the registry’s `@agentclientprotocol/codex-acp` adapter (Codex CLI itself has no `acp` subcommand). The adapter looks for the `codex` binary on `PATH`; this machine keeps it under `%LOCALAPPDATA%\OpenAI\Codex\bin\…`, so add that folder to the provider environment or PATH.
- **Gemini CLI** is the registry npx package; Google’s own CLI also exposes `--experimental-acp`.
- **OpenCode** ships `opencode acp` natively; the preset uses the binary command and expects it on `PATH`.
- **DeepSeek Harness** is not in the registry and has no ACP mode; its headless CLI needs `DEEPSEEK_API_KEY`.
- **Antigravity** is listed with a downloadable `agy_acp_server` binary; the IDE itself is not the ACP server.
- Binary presets cannot be verified until downloaded; the provider will report a spawn error with the exact command.

## Testing status (this machine)

| Check | Result |
| --- | --- |
| Mock ACP agent (initialize → session → streamed prompt) | PASS |
| OpenCode `opencode acp` initialize | PASS (v1.18.33) |
| OpenCode prompt | blocked: 0 credentials, free model requires login |
| Codex adapter package | resolves on npm; not launched here (Codex binary not on PATH) |
| Gemini / Qwen / Goose / Cursor / Copilot | preset added from registry; not installed on this machine |
| Antigravity | binary preset added; not downloaded |
