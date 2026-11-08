# Neuro OS QA run

Generated: 2026-11-08T20:59:04.909Z

## ACP-01 â€” ACP provider handshake, session and streamed prompt

- area: acp
- severity: high
- status: fail
- evidence: user: ping
assistant: 
- repro: Add a provider with kind=acp and command "node scripts/mock-acp-agent.cjs", then send a message.

## ACP-02 â€” OpenCode exposes an ACP server

- area: acp
- severity: high
- status: pass
- evidence: agent=OpenCode v1.18.33 protocol=ok
- repro: opencode acp â†’ initialize â†’ session/new

## ACP-04 â€” ACP registry presets are available in the provider picker

- area: acp
- severity: medium
- status: pass
- evidence: 44 presets; codex=npx -y @agentclientprotocol/codex-acp@2.5.0
- repro: Settings → Providers → Add provider → ACP agents

## ACP-03 â€” ACP coverage of the locally installed agents

- area: acp
- severity: low
- status: pass
- evidence: native ACP: opencode; verified adapter: @agentclientprotocol/codex-acp v2.5.0; 44 registry presets added; DeepSeek Harness has no ACP mode


## OLL-01 â€” Ollama chat round-trip (tools fallback)

- area: chat
- severity: high
- status: fail
- evidence: empty response after 90s


## REAL-01 â€” Groq provider round-trip with the configured key

- area: chat
- severity: high
- status: pass
- evidence: GROQ_OK


## REAL-02 â€” Ollama provider round-trip with the configured local models

- area: chat
- severity: high
- status: pass
- evidence: OLLAMA_REAL_OK



## REAL-03 â€” Local ACP provider (OpenCode) handshake

- area: acp
- severity: high
- status: warn
- evidence: initialized OpenCode; prompt requires CLI login (opencode auth login)


## CMP-01 â€” Composio live validation

- area: composio
- severity: high
- status: warn
- evidence: NEURO_QA_COMPOSIO_KEY was not provided at launch

