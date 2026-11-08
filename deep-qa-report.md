# Neuro OS Ã¢â‚¬â€ deep automation QA

Generated: 2026-11-08T15:41:30.642Z

| ID | Area | Status | Check | Evidence | ms |
| --- | --- | --- | --- | --- | --- |
| D-01 | fs | pass | mkdir + unicode write + read round-trip | 50 bytes at Ã™â€¦Ã˜Â±Ã˜Â­Ã˜Â¨Ã˜Â§ Ã˜Â¹Ã˜Â§Ã™â€žÃ™â€¦.txt | 206 |
| D-02 | fs | pass | list + search find the new file | 1 entries, 1 search hits | 8 |
| D-03 | fs | pass | rename + overwrite + delete | rename Ã¢â€ â€™ overwrite Ã¢â€ â€™ delete verified | 36 |
| D-04 | fs | pass | large file (300 KB) write/read | 300000 bytes | 38 |
| D-05 | fs | warn | workspace boundary (read outside root) | read 92 bytes outside the workspace Ã¢â‚¬â€ no path guard | 7 |
| D-06 | notes | pass | create, update and delete a note | create Ã¢â€ â€™ update Ã¢â€ â€™ delete | 1 |
| D-07 | spaces | pass | create a space, edit it and remove it | create Ã¢â€ â€™ rename Ã¢â€ â€™ remove | 0 |
| D-08 | notebooks | pass | create a notebook and run code + error cells | ok=DEEP_8bf7c94b error=error | 8 |
| D-09 | terminal | pass | spawn PTY, run a command, read buffer, resize, kill | 412 buffer chars, resize + kill ok | 3580 |
| D-10 | mail | pass | peer-to-peer send, receive, reply, read and delete | encrypted qa.peer@42c4b193b90428f2.neuro send + reply, decrypt ok, peer removed | 815 |
| D-11 | automation | pass | save a workflow, run it, inspect steps and remove it | 2 steps, output DEEP_AUTOMATION_OK | 419 |
| D-12 | brain | pass | remember, recall, ask, timeline, forget | 3 hits, answer 336 chars, 2 events, forget ok | 46 |
| D-13 | web | pass | publish, serve HTML + asset, counts, unpublish | deep-457836.neuro served (2 files), traversal blocked, unpublish ok | 172 |
| D-14 | marketplace | pass | install, toggle and uninstall a catalog item | Code Review (skill) install Ã¢â€ â€™ toggle Ã¢â€ â€™ uninstall | 21 |
| D-15 | plugins | pass | install a local plugin, list it, uninstall it | Deep QA plugin install Ã¢â€ â€™ list Ã¢â€ â€™ uninstall | 341 |
| D-16 | settings | pass | theme, density, locale and wallpaper patch | design Ã¢â€ â€™ windows, locale Ã¢â€ â€™ ar/rtl, restored | 368 |
| D-17 | acp | pass | add a mock ACP provider, prompt it, then chat through it | acp.connect Ã¢â€ â€™ prompt Ã¢â€ â€™ chat turn streamed MOCK_ACP_OK | 1094 |
| D-18 | composio | warn | configure with the live key and search the catalog | NEURO_QA_COMPOSIO_KEY not set | 1 |
| D-19 | ui | pass | navigate every surface and capture it | 14 surfaces rendered + screenshotted | 11280 |
| D-20 | ui | pass | start menu opens and closes | open + scrim close | 2551 |
| D-21 | ui | pass | command palette opens with Ctrl+K and closes with Escape | Ctrl+K â†’ palette â†’ Escape | 1640 |
| D-22 | chat | pass | a session with no provider fails with a clear message | No provider is connected. Add one in Settings â†’ Providers, then send again. | 51 |
| D-23 | terminal | pass | two concurrent PTY sessions keep separate buffers | two PTYs, isolated buffers, both killed | 3462 |
| D-24 | brain | pass | recording toggle, graph, profile and batch capture | recorded 2, graph 35 nodes, profile ? nodes | 5 |
| D-25 | mail | pass | sent folder holds the outgoing message | 2 sent, direction=out, encrypted=true | 0 |
| D-26 | web | pass | peer replication: another node publishes, this node serves it | replica-aac7d8.neuro published on peer, served by this gateway | 95 |
| D-27 | ui | pass | every theme renders and is captured | 8 themes rendered (light + dark) | 7244 |
| D-28 | ui | pass | provider picker renders icons in a light theme | 23 cards; {"display":"grid","cols":"293.4px 293.4px","width":593,"rect":592.7999877929688} | 2861 |
