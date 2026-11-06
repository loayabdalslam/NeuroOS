# Neuro OS QA run

Generated: 2026-11-06T12:44:19.540Z

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

## ACP-03 â€” ACP availability of the locally installed agents

- area: acp
- severity: medium
- status: warn
- evidence: No ACP-capable CLI on PATH: Codex CLI, DeepSeek Harness, Antigravity CLI. Only opencode exposes "acp".
- repro: where codex / where dsh / where antigravity

## CMP-01 â€” Composio catalog sync with a real API key

- area: composio
- severity: high
- status: pass
- evidence: configured=true tools=1000 toolkits=26 accounts=13


## CMP-02 â€” Composio catalog search

- area: composio
- severity: medium
- status: fail
- evidence: gmail hits=0


## CMP-03 â€” Composio action execution through the tool bridge

- area: composio
- severity: medium
- status: warn
- evidence: No github authenticated-user action in the catalog

