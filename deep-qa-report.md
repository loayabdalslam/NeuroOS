# Neuro OS Ã¢â‚¬â€ deep automation QA

Generated: 2026-11-08T14:51:19.545Z

| ID | Area | Status | Check | Evidence | ms |
| --- | --- | --- | --- | --- | --- |
| D-01 | fs | pass | mkdir + unicode write + read round-trip | 50 bytes at Ã™â€¦Ã˜Â±Ã˜Â­Ã˜Â¨Ã˜Â§ Ã˜Â¹Ã˜Â§Ã™â€žÃ™â€¦.txt | 217 |
| D-02 | fs | pass | list + search find the new file | 1 entries, 1 search hits | 7 |
| D-03 | fs | pass | rename + overwrite + delete | rename Ã¢â€ â€™ overwrite Ã¢â€ â€™ delete verified | 41 |
| D-04 | fs | pass | large file (300 KB) write/read | 300000 bytes | 69 |
| D-05 | fs | warn | workspace boundary (read outside root) | read 92 bytes outside the workspace Ã¢â‚¬â€ no path guard | 8 |
| D-06 | notes | pass | create, update and delete a note | create Ã¢â€ â€™ update Ã¢â€ â€™ delete | 2 |
| D-07 | spaces | pass | create a space, edit it and remove it | create Ã¢â€ â€™ rename Ã¢â€ â€™ remove | 1 |
| D-08 | notebooks | pass | create a notebook and run code + error cells | ok=DEEP_6c5f6f1f error=error | 12 |
| D-09 | terminal | pass | spawn PTY, run a command, read buffer, resize, kill | 376 buffer chars, resize + kill ok | 3667 |
| D-10 | mail | pass | peer-to-peer send, receive, reply, read and delete | encrypted qa.peer@065c8c69f5f5daca.neuro send + reply, decrypt ok, peer removed | 923 |
| D-11 | automation | pass | save a workflow, run it, inspect steps and remove it | 2 steps, ?ms, output  | 432 |
| D-12 | brain | pass | remember, recall, ask, timeline, forget | 3 hits, answer 336 chars, 2 events, forget ok | 96 |
| D-13 | web | pass | publish, serve HTML + asset, counts, unpublish | deep-da6c3e.neuro served (2 files), traversal blocked, unpublish ok | 362 |
| D-14 | marketplace | pass | install, toggle and uninstall a catalog item | Code Review (skill) install Ã¢â€ â€™ toggle Ã¢â€ â€™ uninstall | 61 |
| D-15 | plugins | pass | install a local plugin, list it, uninstall it | Deep QA plugin install Ã¢â€ â€™ list Ã¢â€ â€™ uninstall | 157 |
| D-16 | settings | pass | theme, density, locale and wallpaper patch | design Ã¢â€ â€™ windows, locale Ã¢â€ â€™ ar/rtl, restored | 357 |
| D-17 | acp | pass | add a mock ACP provider, prompt it, then chat through it | acp.connect Ã¢â€ â€™ prompt Ã¢â€ â€™ chat turn streamed MOCK_ACP_OK | 1917 |
| D-18 | composio | pass | configure with the live key and search the catalog | 1000 tools, 26 toolkits, 0 github hits | 11321 |
| D-19 | ui | pass | navigate every surface and capture it | 14 surfaces rendered + screenshotted | 14126 |
| D-20 | ui | pass | start menu opens and closes | open + scrim close | 2823 |
| D-21 | ui | pass | command palette opens with Ctrl+K and closes with Escape | Ctrl+K â†’ palette â†’ Escape | 1762 |
| D-22 | chat | warn | a session with no provider fails with a clear message | send did not throw without a provider | 157 |
| D-23 | terminal | pass | two concurrent PTY sessions keep separate buffers | two PTYs, isolated buffers, both killed | 3557 |
| D-24 | brain | pass | recording toggle, graph, profile and batch capture | recorded 2, graph 35 nodes, profile ? nodes | 5 |
| D-25 | mail | pass | sent folder holds the outgoing message | 2 sent, direction=out, encrypted=true | 1 |
| D-26 | web | pass | peer replication: another node publishes, this node serves it | replica-d10f15.neuro published on peer, served by this gateway | 129 |
