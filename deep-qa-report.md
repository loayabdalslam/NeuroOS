# Neuro OS Ã¢â‚¬â€ deep automation QA

Generated: 2026-11-08T17:02:05.779Z

| ID | Area | Status | Check | Evidence | ms |
| --- | --- | --- | --- | --- | --- |
| D-00 | ui | pass | mail setup card is centred and fully visible | left=505 width=520 viewport=1480 | 1012 |
| D-01 | fs | pass | mkdir + unicode write + read round-trip | 50 bytes at Ã™â€¦Ã˜Â±Ã˜Â­Ã˜Â¨Ã˜Â§ Ã˜Â¹Ã˜Â§Ã™â€žÃ™â€¦.txt | 256 |
| D-02 | fs | pass | list + search find the new file | 1 entries, 1 search hits | 47 |
| D-03 | fs | pass | rename + overwrite + delete | rename Ã¢â€ â€™ overwrite Ã¢â€ â€™ delete verified | 93 |
| D-04 | fs | pass | large file (300 KB) write/read | 300000 bytes | 70 |
| D-05 | fs | warn | workspace boundary (read outside root) | read 92 bytes outside the workspace Ã¢â‚¬â€ no path guard | 11 |
| D-06 | notes | pass | create, update and delete a note | create Ã¢â€ â€™ update Ã¢â€ â€™ delete | 1 |
| D-07 | spaces | pass | create a space, edit it and remove it | create Ã¢â€ â€™ rename Ã¢â€ â€™ remove | 1 |
| D-08 | notebooks | pass | create a notebook and run code + error cells | ok=DEEP_ea8fe718 error=error | 10 |
| D-09 | terminal | pass | spawn PTY, run a command, read buffer, resize, kill | 400 buffer chars, resize + kill ok | 3652 |
| D-10 | mail | pass | peer-to-peer send, receive, reply, read and delete | encrypted qa.peer@d1a3973b4c5af096.neuro send + reply, decrypt ok, peer removed | 843 |
| D-11 | automation | pass | save a workflow, run it, inspect steps and remove it | 2 steps, output DEEP_AUTOMATION_OK | 420 |
| D-12 | brain | pass | remember, recall, ask, timeline, forget | 3 hits, answer 336 chars, 3 events, forget ok | 80 |
| D-13 | web | pass | publish, serve HTML + asset, counts, unpublish | deep-e3da61.neuro served (2 files), traversal blocked, unpublish ok | 314 |
| D-14 | marketplace | pass | install, toggle and uninstall a catalog item | Code Review (skill) install Ã¢â€ â€™ toggle Ã¢â€ â€™ uninstall | 67 |
| D-15 | plugins | pass | install a local plugin, list it, uninstall it | Deep QA plugin install Ã¢â€ â€™ list Ã¢â€ â€™ uninstall | 413 |
| D-16 | settings | pass | theme, density, locale and wallpaper patch | design Ã¢â€ â€™ windows, locale Ã¢â€ â€™ ar/rtl, restored | 425 |
| D-17 | acp | pass | add a mock ACP provider, prompt it, then chat through it | acp.connect Ã¢â€ â€™ prompt Ã¢â€ â€™ chat turn streamed MOCK_ACP_OK | 1323 |
| D-18 | composio | warn | configure with the live key and search the catalog | NEURO_QA_COMPOSIO_KEY not set | 0 |
| D-19 | ui | pass | navigate every surface and capture it | 14 surfaces rendered + screenshotted | 13594 |
| D-20 | ui | pass | start menu opens and closes | open + scrim close | 2720 |
| D-21 | ui | pass | command palette opens with Ctrl+K and closes with Escape | Ctrl+K â†’ palette â†’ Escape | 1849 |
| D-22 | chat | pass | a session with no provider fails with a clear message | No provider is connected. Add one in Settings â†’ Providers, then send again. | 116 |
| D-23 | terminal | pass | two concurrent PTY sessions keep separate buffers | two PTYs, isolated buffers, both killed | 3524 |
| D-24 | brain | pass | recording toggle, graph, profile and batch capture | recorded 2, graph 35 nodes, profile ? nodes | 4 |
| D-25 | mail | pass | sent folder holds the outgoing message | 2 sent, direction=out, encrypted=true | 1 |
| D-26 | web | pass | peer replication: another node publishes, this node serves it | replica-5e9730.neuro published on peer, served by this gateway | 165 |
| D-27 | ui | pass | every theme renders and is captured | 8 themes rendered (light + dark) | 8721 |
| D-28 | ui | pass | provider picker renders icons in a light theme | 23 cards; {"display":"grid","cols":"293.4px 293.4px","width":593,"rect":592.7999877929688} | 3060 |
| D-29 | ui | pass | ChatGPT-style composer with provider/model selectors | 2 selectors, circular send, chip row removed | 2175 |
| D-31 | ui | pass | clicking a space card updates the detail panel | 2 cards; detail shows QA Space B | 1530 |
| D-32 | ui | pass | provider and tool-model pickers plus image attachments | 1 providers, tool-model dialog, image 70B | 2904 |
| D-33 | ui | pass | custom wallpaper applies from settings | desktop data-wallpaper=photo:custom, uploader present | 2609 |
| D-34 | ui | pass | model picker falls back to all models when none declare tools | 1 models listed (supportsTools=false fallback) | 1583 |
| D-35 | ui | pass | selecting a model creates/updates the conversation | pill=Model Pick \| Pick Me header=Neuro Â· pick-me MODEL PICK | 2408 |
