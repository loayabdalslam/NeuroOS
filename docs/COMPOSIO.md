# Composio integrations

Composio is the bridge between Neuro OS and real third-party services. One API
key unlocks a catalog of actions across Gmail, Google Drive/Sheets/Calendar,
GitHub, Slack, Notion, Linear, Jira, Trello, Asana, HubSpot, Stripe, Discord,
Telegram, LinkedIn and more.

Open **Settings → Integrations**.

---

## 1. Connect

1. Create an account at [composio.dev](https://composio.dev) and copy an API key
   from **Settings → API keys**.
2. Paste it in **Settings → Integrations**. It is stored in the OS keychain
   (`vault.json`), never in `settings.json`.
3. Press **Save & sync**. Neuro OS fetches the action catalog and the toolkit
   list from the Composio REST API.

The status strip shows actions, toolkits, connected accounts and enabled tools.
Nothing leaves your machine except the calls you make to Composio.

---

## 2. Connecting a service

1. Open the **Toolkits** tab.
2. Press **Connect** on a toolkit (for example GitHub).
3. Neuro OS asks Composio for an auth config and creates a link session, then
   opens the Composio authorization page in your browser.
4. Authorize the service. Press **Refresh accounts** — the account appears with
   a green `active` badge.

> The OAuth callback is handled by Composio. Neuro OS never sees the provider
> tokens; it only references the connected account through your `user_id`.

If a toolkit has no auth config yet, Composio returns an error and the UI tells
you to create one in the Composio dashboard (**Auth configs → New**). This is a
Composio project setting, not a Neuro OS limitation.

---

## 3. How tools reach the agent

Two complementary layers:

### Enabled actions → first-class tools

Every action you enable in **Actions** is registered in the tool bus as:

```text
composio.<slug>          e.g. composio.github_create_issue
```

- Its parameters are the action's own JSON Schema, so the model sees exactly the
  fields Composio expects.
- It obeys the per-tool policy in **Settings → Tools** (`auto` / `ask` / `deny`)
  and appears in tool call cards like any built-in tool.
- Updating an action's schema only requires a **Sync catalog** and toggle.

### Meta tools → the whole catalog

Two tools are always available while Composio is configured:

| Tool | Purpose |
| --- | --- |
| `composio.search` | Search the catalog by intent (`"send an email"`, `"create issue"`). Returns slugs, names, toolkits and whether they are enabled. |
| `composio.execute` | Run any action by slug with a JSON `arguments` object. |

This means the agent can use the long tail of integrations without bloating the
prompt with hundreds of tool definitions.

### Suggested agent flow

```text
composio.search { query: "create a github issue" }
  → composio.execute { slug: "GITHUB_CREATE_ISSUE", arguments: { owner, repo, title } }
```

Enable the actions you use every day for direct calling, and keep the meta tools
for everything else.

---

## 4. Automation

Any Composio action is available to workflows through the `tool.call` node. Set
the tool name to `composio.<slug>` and pass the action arguments as JSON.

```text
trigger.schedule (09:00)
  → tool.call (composio.gmail_fetch_emails)
  → agent.run (summarize)
  → tool.call (composio.slack_send_message)
```

This is how a scheduled digest reaches a real inbox and a real Slack channel.

---

## 5. API surface used

Base: `https://backend.composio.dev/api/v3.1` (override in `composio.configure`
for proxies or tests). Auth: `x-api-key`.

| Call | Endpoint |
| --- | --- |
| Catalog | `GET /tools?limit=100&page=N` |
| Toolkits | `GET /toolkits?limit=100` |
| Connected accounts | `GET /connected_accounts?user_ids=<userId>&limit=100` |
| Auth config | `GET /auth_configs?toolkit_slug=<slug>&limit=1` |
| Link session | `POST /connected_accounts/link` |
| Execute | `POST /tools/execute/<slug>` |

Responses are normalised defensively (`items`, `data` or a bare array), and
errors surface as readable messages in the panel and in the logs.

The QA harness starts a local stand-in server (`src/main/selftest/mockComposio.ts`)
implementing these endpoints, so sync, tool registration and execution are
verified without a real key.

---

## 6. Security

- The API key lives in the OS keychain via `SecretVault`; it is never rendered
  back into the UI (the field is always empty when re-opened).
- The `userId` is generated locally (`neuro-xxxxxxxx`) and is what ties connected
  accounts to your installation.
- `composio.execute` has `danger: medium`; keep its policy on `ask` if you want
  to approve third-party side effects manually.
- Tool arguments and responses flow through the same tool bus, so they are
  visible in the chat transcript and in automation run logs.

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Composio HTTP 401` | API key invalid or rotated. Enter the new key. |
| Sync returns 0 tools | The key belongs to an empty project, or the base URL is wrong. |
| Connect says "No auth config" | Create an auth config for that toolkit in the Composio dashboard. |
| Account stays `pending` | Authorization was not completed in the browser; press Connect again. |
| Tool missing from the agent | Toggle it on in Actions, then check **Settings → Tools** policy. |
| Catalog looks stale | Press **Sync catalog**. |

---

## 8. Limitations

- Composio is a hosted service; using it requires a Composio account and network
  access. Without a key the rest of Neuro OS works normally.
- Only the REST API v3.1 is used; webhooks from Composio are not wired into
  automations yet.
- Each action executes with the `user_id` stored for this installation; there is
  no per-agent user switching yet.
- The catalog is bounded to 400 actions per sync (4 pages of 100) to keep the
  panel fast; the meta tools can still execute any slug returned by a fresh
  search.
