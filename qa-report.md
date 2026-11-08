# Neuro OS QA run

Generated: 2026-11-08T15:06:22.186Z

## ACP-01 â€” ACP provider handshake, session and streamed prompt

- area: acp
- severity: high
- status: pass
- evidence: user: ping
assistant: MOCK_ACP_OK
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


## CMP-01 â€” Composio catalog sync with a real API key

- area: composio
- severity: high
- status: pass
- evidence: configured=true tools=1000 toolkits=26 accounts=13


## CMP-02 â€” Composio catalog search

- area: composio
- severity: medium
- status: pass
- evidence: gmail hits=20


## CMP-03 â€” Composio action execution through the tool bridge

- area: composio
- severity: medium
- status: warn
- evidence: No github authenticated-user action in the catalog

