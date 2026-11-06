# Graph Brain

The Brain is the app's long-term memory. It records what you do — every click,
navigation, agent turn, mail, published site, workflow run and tool call — and
turns that stream into a small, queryable knowledge graph that the agent can use
as context.

Open **Brain** from the dock, the Start menu or the command palette.

---

## 1. What is recorded

| Source | Example node |
| --- | --- |
| UI clicks | `action: Publish to the mesh` |
| Navigation | `page: Settings page` |
| Apps | `app: chat`, `app: mail` |
| Agent turns | `action: Asked Neuro: summarise my mail` |
| Mail | `person: ada@…` + relation `sent_to` |
| Sites | `site: selftest.neuro` + relation `published` |
| Automation | `workflow: Selftest pipeline` + relation `ran` |
| Tools | `tool: shell.exec` + relation `ran` |
| Explicit memories | `memory: Prefers concise answers` |

Each capture is written to a **raw event log** (capped at 6,000, newest kept)
and aggregated into **nodes** (unique entities, weighted by use) and **edges**
(typed relations: `used`, `visited`, `interacted`, `sent_to`, `published`,
`ran`, `related`). Labels are truncated and never include input values beyond
the text you typed into a form field (e.g. a search query) — never passwords
(they are not captured by the click label).

Recording can be paused at any time from the Brain header; nothing is stored
while paused.

---

## 2. Storage & retrieval

- State: `state/brain.json` (nodes, edges, events). Plain JSON, readable,
  deletable, exportable.
- Search: **Orama** (`@orama/orama`, MIT, ~2 MB, zero infrastructure) indexes
  `label + detail + kind + surface + tags` with BM25 and typo tolerance.
- Recall = Orama hits + **one-hop graph expansion** + salience:
  `salience = 0.2 + log1p(weight)·0.28 + recency·0.22`.
- Profile aggregates top apps, actions, topics, collaborators, sites and an
  hour-of-day histogram.
- Retention: above 4,000 nodes the lowest-salience 10% is pruned with its edges;
  event log keeps the latest 6,000 entries.

### Why Orama (and not Mem0/Graphiti/Hindsight/Cognee)

The strongest open-source memory systems in 2026 all assume a backend:

| Tool | What it needs | Fit for a desktop app |
| --- | --- | --- |
| **Mem0** | LLM for extraction, external vector DB in production | ✗ needs a model + service |
| **Graphiti / Zep** | Neo4j or FalkorDB | ✗ external graph database |
| **Hindsight** | Docker + embedded PostgreSQL | ✗ server runtime |
| **Cognee** | Python + SQLite/LanceDB/Kuzu pipeline | ✗ Python process |
| **Orama** | nothing — pure JS, in-process | ✓ |

For an offline-first Electron app the memory engine must ship inside the binary
and work with no accounts, no daemons and no Docker. Orama is the only mature
option in that class, so the Brain pairs it with a native temporal graph layer
(weights, relations, salience decay) instead of a full server product.

---

## 3. Agent integration

- **Automatic context**: before every turn, `AgentService` asks the brain for up
  to six memories relevant to the prompt and appends a `## Long-term memory`
  block (max 1,400 chars) to the system prompt.
- **Tools**: `brain.recall`, `brain.remember`, `brain.stats` let the agent search
  or write memory deliberately.
- Context is only added when `recording` is on, and it is scoped to this device.

---

## 4. The interface

- **Graph** — canvas force layout, colour-coded by node kind, drag to pan, wheel
  to zoom, double-click to recenter, hover for labels, click for the inspector.
- **Timeline** — the raw event stream, newest first, click to jump to the node.
- **Ask** — natural-language recall with an answer composed from the graph plus
  the stats, and the individual hits with their scores and reasons.
- **Profile** — top apps/actions/topics/people with bars and an activity-by-hour
  histogram.
- **Inspector** — node detail, tags, relations and a **Forget** action that
  removes the node and its edges from both the graph and the index.
- **Wipe** — deletes the entire brain (with confirmation via the toast flow).

---

## 5. Privacy

- Nothing is uploaded; there is no telemetry and no cloud memory.
- `state/brain.json` lives in your profile folder; **Open data folder** in
  Settings reveals it.
- Wipe removes nodes, edges and events immediately; the file is overwritten on
  the next write.

---

## 6. Limits

- Recall is lexical + graph-based; there are no embeddings yet, so synonyms that
  share no tokens may miss (the graph expansion usually catches them).
- No cross-device sync: each installation has its own brain.
- Event log is bounded (6,000) and nodes are pruned (4,000), optimised for a
  single-user desktop, not a multi-tenant server.
- Node labels are truncated to 90–120 chars; full text is kept in `detail` for
  events, but very large clipboard content is not stored.

---

## 7. Verified by the QA harness

```text
brain: nodes=36 edges=37 events=27 indexed=36 recall=4 top="Appearance" ask="I remember 8 related memories…"
sidebar labels: …, Brain, Marketplace, Settings, …
```

The harness seeds realistic events, performs a real DOM click (to prove the
renderer capture works), then calls `brain.recall` and `brain.ask`.
