# Neuro OS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â deep automation QA

Generated: 2026-11-08T21:34:20.778Z

| ID | Area | Status | Check | Evidence | ms |
| --- | --- | --- | --- | --- | --- |
| D-00 | ui | pass | mail setup card is centred and fully visible | left=505 width=520 viewport=1480 | 1153 |
| D-01 | fs | pass | mkdir + unicode write + read round-trip | 83 bytes at Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â±ÃƒËœÃ‚Â­ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â¹ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â¦.txt | 459 |
| D-02 | fs | pass | list + search find the new file | 1 entries, 1 search hits | 13 |
| D-03 | fs | pass | rename + overwrite + delete | rename ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ overwrite ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ delete verified | 83 |
| D-04 | fs | pass | large file (300 KB) write/read | 300000 bytes | 94 |
| D-05 | fs | warn | workspace boundary (read outside root) | read 92 bytes outside the workspace ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no path guard | 12 |
| D-06 | notes | pass | create, update and delete a note | create ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ update ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ delete | 1 |
| D-07 | spaces | pass | create a space, edit it and remove it | create ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ rename ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ remove | 2 |
| D-08 | notebooks | pass | create a notebook and run code + error cells | ok=DEEP_b20d5a3e error=error | 15 |
| D-09 | terminal | pass | spawn PTY, run a command, read buffer, resize, kill | 417 buffer chars, resize + kill ok | 3697 |
| D-10 | mail | pass | peer-to-peer send, receive, reply, read and delete | encrypted qa.peer@62cf1de790da5289.neuro send + reply, decrypt ok, peer removed | 910 |
| D-11 | automation | pass | save a workflow, run it, inspect steps and remove it | 2 steps, output DEEP_AUTOMATION_OK | 420 |
| D-12 | brain | pass | remember, recall, ask, timeline, forget | 3 hits, answer 337 chars, 3 events, forget ok | 66 |
| D-13 | web | pass | publish, serve HTML + asset, counts, unpublish | deep-429f36.neuro served (2 files), traversal blocked, unpublish ok | 665 |
| D-14 | marketplace | pass | install, toggle and uninstall a catalog item | Code Review (skill) install ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ toggle ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ uninstall | 398 |
| D-15 | plugins | pass | install a local plugin, list it, uninstall it | Deep QA plugin install ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ list ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ uninstall | 631 |
| D-16 | settings | pass | theme, density, locale and wallpaper patch | design ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ windows, locale ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ar/rtl, restored | 346 |
| D-17 | acp | pass | add a mock ACP provider, prompt it, then chat through it | acp.connect ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ prompt ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ chat turn streamed MOCK_ACP_OK | 1990 |
| D-18 | composio | warn | configure with the live key and search the catalog | NEURO_QA_COMPOSIO_KEY not set | 0 |
| D-19 | ui | pass | navigate every surface and capture it | 14 surfaces rendered + screenshotted | 13274 |
| D-20 | ui | pass | start menu opens and closes | open + scrim close | 2840 |
| D-21 | ui | pass | command palette opens with Ctrl+K and closes with Escape | Ctrl+K Ã¢â€ â€™ palette Ã¢â€ â€™ Escape | 1784 |
| D-22 | chat | pass | a session with no provider fails with a clear message | No provider is connected. Add one in Settings → Providers, then send again. | 44 |
| D-23 | terminal | pass | two concurrent PTY sessions keep separate buffers | two PTYs, isolated buffers, both killed | 3478 |
| D-24 | brain | pass | recording toggle, graph, profile and batch capture | recorded 2, graph 35 nodes, profile ? nodes | 3 |
| D-25 | mail | pass | sent folder holds the outgoing message | 2 sent, direction=out, encrypted=true | 0 |
| D-26 | web | pass | peer replication: another node publishes, this node serves it | replica-f78cf2.neuro published on peer, served by this gateway | 288 |
| D-27 | ui | pass | every theme renders and is captured | 8 themes rendered (light + dark) | 8995 |
| D-28 | ui | pass | provider picker renders icons in a light theme | 23 cards; {"display":"grid","cols":"293.4px 293.4px","width":593,"rect":592.7999877929688} | 3034 |
| D-29 | ui | pass | ChatGPT-style composer with provider/model selectors | 3 selectors, circular send, chip row removed | 2530 |
| D-31 | ui | pass | clicking a space card updates the detail panel | 2 cards; detail shows QA Space B | 1532 |
| D-32 | ui | pass | provider and tool-model pickers plus image attachments | 1 providers, tool-model dialog, image 70B | 3185 |
| D-33 | ui | pass | custom wallpaper applies from settings | desktop data-wallpaper=photo:custom, uploader present | 2690 |
| D-34 | ui | pass | model picker falls back to all models when none declare tools | 1 models listed (supportsTools=false fallback) | 1768 |
| D-35 | ui | pass | selecting a model creates/updates the conversation | pill=Model Pick \| Pick Me \| Thinking: Auto header=Neuro ÃƒÆ’Ã¢â‚¬Å¡Â· pick-me Â· Auto MODEL PICK | 2492 |
| D-37 | ui | pass | thinking level and custom model id are selectable | Think Provider \| pick-me \| Thinking: High Â· Think Provider \| custom-deployment \| Thinking: High | 3889 |
| D-38 | ui | pass | login terminal runs the ACP sign-in command | typed into powershell.exe; buffer has ACP_LOGIN_TEST | 2057 |
| D-39 | ui | pass | photo wallpapers stay readable on the light theme | label #fff on rgba(7,9,15,.62), dark scrim active | 2115 |
| D-40 | ui | pass | a brand-new conversation can send immediately | live=true content="TEXT
Copy
Executing shell.exec" | 17643 |
| D-41 | ui | pass | F11 fullscreen toggle IPC | entered fullscreen, then restored | 1344 |
