import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { app, dialog, BrowserWindow } from 'electron';
import type { HandlerMap } from './core/ipc';
import { log } from './core/ipc';
import type { Kernel } from './kernel';
import { createAdapter } from './services/providers/adapters';
import { presetToProvider } from '@shared/providers';
import type { ProviderConfig } from '@shared/types';

export function buildHandlers(kernel: Kernel, getWindow: () => BrowserWindow | null): HandlerMap {
  const { settings, workspace, system, content, tools, marketplace, agent, mail, plugins, automation, compositions } = kernel;

  const changed = (): void => {
    kernel.emit('settings:changed', settings.public());
  };

  const saveDialog = async (options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> => {
    const win = getWindow();
    return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options);
  };

  const openDialog = async (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> => {
    const win = getWindow();
    return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
  };

  return {
    'system.info': () => system.info(),
    'system.stats': () => system.stats(),
    'system.kernel': () => kernel.status(),
    'system.openExternal': ({ url }) => system.openExternal(url),
    'system.showItemInFolder': ({ path: target }) => system.showItemInFolder(target),
    'system.pickDirectory': async (params) => {
      const win = getWindow();
      const result = win
        ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: params?.title ?? 'Select a folder' })
        : await dialog.showOpenDialog({ properties: ['openDirectory'], title: params?.title ?? 'Select a folder' });
      return { path: result.canceled ? null : result.filePaths[0] ?? null };
    },
    'system.pickFiles': async (params) => {
      const options = { properties: (params?.multiple ? ['openFile', 'multiSelections'] : ['openFile']) as ('openFile' | 'multiSelections')[] };
      const result = await openDialog(options);
      return { paths: result.canceled ? [] : result.filePaths };
    },
    'system.clipboardRead': () => ({ text: system.clipboardRead() }),
    'system.clipboardWrite': ({ text }) => system.clipboardWrite(text),
    'system.screenshot': () => system.screenshot(),
    'system.launchApp': ({ command, args }) => system.launchApp(command, args ?? []),
    'system.windows': () => system.windows(),
    'system.focusWindow': async ({ title }) => ({ ok: await system.focusWindow(title) }),
    'system.killProcess': async ({ pid }) => ({ ok: await system.killProcess(pid) }),
    'system.volume': ({ delta }) => system.volume(delta),
    'system.env': () => system.env(),
    'system.notify': ({ title, body }) => system.notify(title, body),

    'settings.get': () => settings.public(),
    'settings.patch': (patch) => {
      const next = settings.patch(patch);
      changed();
      return next;
    },
    'settings.reset': () => {
      const next = settings.reset();
      changed();
      return next;
    },
    'settings.export': async () => {
      const result = await saveDialog({
        title: 'Export Neuro OS settings',
        defaultPath: path.join(app.getPath('documents'), 'neuro-settings.json'),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { path: null };
      await settings.exportTo(result.filePath);
      return { path: result.filePath };
    },
    'settings.import': async () => {
      const result = await openDialog({
        title: 'Import Neuro OS settings',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const next = await settings.importFrom(result.filePaths[0]);
      changed();
      return next;
    },

    'providers.list': () => settings.public().providers,
    'providers.save': (provider) => {
      const next = settings.saveProvider(provider);
      changed();
      return next.providers;
    },
    'providers.remove': ({ id }) => {
      const next = settings.removeProvider(id);
      changed();
      return next.providers;
    },
    'providers.probe': async ({ id }) => {
      const provider = settings.getProvider(id);
      if (!provider) throw new Error('Provider not found');
      const probe = await createAdapter(provider).probe();
      settings.saveProvider({ ...provider, lastCheck: { ok: probe.ok, at: new Date().toISOString(), message: probe.message } });
      changed();
      return probe;
    },
    'providers.probeDraft': async (provider: ProviderConfig) => createAdapter(provider).probe(),
    'providers.discoverModels': async ({ kind, baseUrl, apiKey }) => {
      const draft = presetToProvider(
        { id: `draft-${Date.now()}`, name: 'Draft', brand: 'plug', kind: kind as ProviderConfig['kind'], baseUrl, models: [], color: '#4176e6', keyHint: '', docs: '', description: '' },
        apiKey,
      );
      return createAdapter(draft).listModels();
    },

    'agents.list': () => settings.public().agents,
    'agents.save': (agentConfig) => {
      const next = settings.saveAgent(agentConfig);
      changed();
      return next.agents;
    },
    'agents.remove': ({ id }) => {
      const next = settings.removeAgent(id);
      changed();
      return next.agents;
    },

    'chat.sessions': () => agent.listSessions(),
    'chat.session': ({ id }) => agent.getSession(id),
    'chat.create': (params) => agent.createSession(params),
    'chat.send': ({ sessionId, text, attachments }) => agent.send(sessionId, text, attachments as never),
    'chat.cancel': ({ sessionId }) => ({ ok: agent.cancel(sessionId) }),
    'chat.regenerate': ({ sessionId }) => agent.regenerate(sessionId).then(() => ({ ok: true })),
    'chat.patch': ({ id, ...patch }) => agent.patchSession(id, patch),
    'chat.delete': async ({ id }) => {
      await agent.deleteSession(id);
      return { ok: true };
    },
    'chat.approve': ({ callId, approve, always }) => {
      agent.approve(callId, approve, always);
      return { ok: true };
    },
    'chat.export': async ({ sessionId, format }) => {
      const session = await agent.getSession(sessionId);
      const result = await saveDialog({
        title: 'Export conversation',
        defaultPath: path.join(app.getPath('documents'), `${session.title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'conversation'}.${format}`),
        filters: format === 'md' ? [{ name: 'Markdown', extensions: ['md'] }] : [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { path: null };
      const body =
        format === 'json'
          ? JSON.stringify(session, null, 2)
          : [
              `# ${session.title}`,
              '',
              `- Model: ${session.model}`,
              `- Created: ${session.createdAt}`,
              `- Messages: ${session.messages.length}`,
              '',
              ...session.messages.map((m) => `## ${m.role}\n\n${m.content}\n`),
            ].join('\n');
      await fs.writeFile(result.filePath, body, 'utf8');
      return { path: result.filePath };
    },

    'tools.list': () => tools.list(),
    'tools.run': async ({ name, args }) => tools.invoke(name, args),
    'tools.policies': () => settings.public().toolPolicies,

    'terminal.list': () => kernel.terminal.list(),
    'terminal.create': (params) => kernel.terminal.create(params ?? {}),
    'terminal.write': ({ id, data }) => {
      kernel.terminal.write(id, data);
      return { ok: true };
    },
    'terminal.resize': ({ id, cols, rows }) => {
      kernel.terminal.resize(id, cols, rows);
      return { ok: true };
    },
    'terminal.kill': ({ id }) => {
      kernel.terminal.kill(id);
      return { ok: true };
    },
    'terminal.buffer': ({ id }) => ({ data: kernel.terminal.buffer(id) }),
    'terminal.shells': () => {
      const shells =
        process.platform === 'win32'
          ? [
              { name: 'PowerShell 7', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' },
              { name: 'Windows PowerShell', path: 'powershell.exe' },
              { name: 'Command Prompt', path: 'cmd.exe' },
              { name: 'Git Bash', path: 'C:\\Program Files\\Git\\bin\\bash.exe' },
            ].filter((shell) => {
              try {
                return shell.path.includes('\\') ? fsSync.existsSync(shell.path) : true;
              } catch {
                return false;
              }
            })
          : [
              { name: 'bash', path: '/bin/bash' },
              { name: 'zsh', path: '/bin/zsh' },
              { name: 'sh', path: '/bin/sh' },
            ];
      return { shells, default: shells[0]?.path ?? 'powershell.exe', pty: kernel.terminal.list().some((session) => session.usingPty) };
    },

    'fs.list': ({ path: target, showHidden }) => workspace.list(target, showHidden),
    'fs.read': ({ path: target }) => workspace.read(target),
    'fs.write': async ({ path: target, content: body }) => ({ ok: true, stat: await workspace.write(target, body) }),
    'fs.mkdir': async ({ path: target }) => {
      await workspace.mkdir(target);
      return { ok: true };
    },
    'fs.rename': async ({ from, to }) => {
      await workspace.rename(from, to);
      return { ok: true };
    },
    'fs.delete': async ({ paths }) => ({ ok: true, deleted: await workspace.remove(paths) }),
    'fs.stat': ({ path: target }) => workspace.stat(target),
    'fs.search': ({ root, query, maxResults }) => workspace.search(root, query, maxResults),
    'fs.workspace': ({ root }) => workspace.info(root),
    'fs.reveal': ({ path: target }) => system.showItemInFolder(target),
    'fs.watch': ({ root }) => {
      workspace.watch(root, (payload) => {
        kernel.emit('fs:changed', payload);
        automation.notifyFs(payload);
      });
      return { ok: true };
    },

    'spaces.list': () => content.spaces(),
    'spaces.save': (space) => content.saveSpace(space),
    'spaces.remove': ({ id }) => content.removeSpace(id),
    'spaces.create': (input) => content.createSpace(input),
    'notebooks.list': () => content.notebooks(),
    'notebooks.get': ({ id }) => {
      const notebook = content.notebook(id);
      if (!notebook) throw new Error('Notebook not found');
      return notebook;
    },
    'notebooks.save': (notebook) => content.saveNotebook(notebook),
    'notebooks.remove': ({ id }) => content.removeNotebook(id),
    'notebooks.runCell': ({ notebookId, cellId }) => content.runCell(notebookId, cellId),
    'notes.list': () => content.notes(),
    'notes.save': (note) => content.saveNote(note),
    'notes.remove': ({ id }) => content.removeNote(id),

    'marketplace.catalog': (params) => marketplace.list(params?.query, params?.kind),
    'marketplace.installed': () => marketplace.installedList(),
    'marketplace.install': async ({ id }) => {
      const next = await marketplace.install(id);
      kernel.emit('marketplace:changed', next);
      kernel.emit('tools:changed', tools.list());
      return next;
    },
    'marketplace.uninstall': async ({ id }) => {
      const next = await marketplace.uninstall(id);
      kernel.emit('marketplace:changed', next);
      return next;
    },
    'marketplace.toggle': async ({ id, enabled }) => {
      const next = await marketplace.toggle(id, enabled);
      kernel.emit('marketplace:changed', next);
      return next;
    },

    'acp.connect': async ({ providerId }) => {
      const provider = settings.getProvider(providerId);
      if (!provider) throw new Error('Provider not found');
      try {
        const client = await agent.ensureAcp(provider);
        return { ok: true, agentInfo: client.agentInfo };
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      }
    },
    'acp.disconnect': ({ providerId }) => {
      agent.disconnectAcp(providerId);
      return { ok: true };
    },
    'acp.prompt': async ({ providerId, text }) => {
      const provider = settings.getProvider(providerId);
      if (!provider) throw new Error('Provider not found');
      const client = await agent.ensureAcp(provider);
      if (!client.currentSession) await client.newSession(settings.public().workspaceRoot);
      const stop = await client.prompt(text);
      return { ok: true, message: stop };
    },
    'acp.cancel': ({ providerId }) => {
      const client = kernel.acpClient(providerId);
      client?.cancel();
      return { ok: true };
    },

    'window.minimize': () => {
      getWindow()?.minimize();
    },
    'window.maximize': () => {
      const win = getWindow();
      if (!win) return { maximized: false };
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      return { maximized: win.isMaximized() };
    },
    'window.close': () => getWindow()?.close(),
    'window.devtools': () => getWindow()?.webContents.openDevTools({ mode: 'detach' }),
    'app.quit': () => app.quit(),
    'app.openDataFolder': () => {
      void system.openExternal(settings.public().workspaceRoot || process.cwd());
    },

    'onboarding.complete': async (input) => {
      const next = settings.completeOnboarding(input);
      await workspace.ensureDemoWorkspace(next.workspaceRoot || undefined);
      content.seedSpaces();
      content.seedNotebooks();
      content.seedNotes();
      if (!next.marketplace.installed.length) {
        try {
          await marketplace.install('deep-research');
          await marketplace.install('git-nexus');
          await marketplace.install('code-review');
        } catch (error) {
          log.warn('marketplace', 'seed install failed', error);
        }
      }
      // Seed the Anchor with the workspace and the first note so the rail is
      // immediately useful instead of empty.
      const current = settings.public();
      if (!current.anchor.pins.length && current.workspaceRoot) {
        const { basename } = path;
        const firstNote = content.notes()[0];
        settings.patch({
          anchor: {
            ...current.anchor,
            pins: [
              {
                id: `pin_${Date.now().toString(36)}`,
                kind: 'file',
                ref: current.workspaceRoot,
                label: basename(current.workspaceRoot) || 'Workspace',
                subtitle: 'workspace root',
                order: 0,
              },
              ...(firstNote
                ? [
                    {
                      id: `pin_${Date.now().toString(36)}n`,
                      kind: 'note' as const,
                      ref: firstNote.id,
                      label: firstNote.title,
                      subtitle: firstNote.body.slice(0, 60),
                      order: 1,
                    },
                  ]
                : []),
            ],
          },
        });
      }
      kernel.emit('settings:changed', settings.public());
      return settings.public();
    },

    /* ---------------------------- decentralized mail --------------------------- */
    'mail.status': () => mail.status(),
    'mail.identityCreate': ({ name }) => mail.createIdentity(name),
    'mail.messages': (params) => mail.messages(params?.folder ?? 'inbox', params?.limit ?? 200),
    'mail.send': async ({ to, subject, body, encrypt, replyTo }) => {
      const message = await mail.send({ to, subject, body, encrypt, replyTo });
      return { ok: true, id: message.id, message: `Queued to ${message.to.address} (${message.delivery})` };
    },
    'mail.read': ({ id }) => ({ ok: mail.markRead(id) }),
    'mail.delete': ({ id }) => ({ ok: mail.deleteMessage(id) }),
    'mail.peers': () => mail.peers(),
    'mail.peerAdd': ({ host, port }) => mail.addPeer(host, Number(port)),
    'mail.peerRemove': ({ nodeId }) => mail.removePeer(nodeId),
    'mail.discovery': ({ enabled }) => mail.setDiscovery(enabled),
    'mail.sync': async () => {
      await mail.sync();
      return { ok: true };
    },

    /* --------------------------------- plugins -------------------------------- */
    'plugins.list': () => plugins.list(),
    'plugins.themes': () => plugins.themes(),
    'plugins.providers': () => plugins.providers(),
    'plugins.installFolder': async () => {
      const result = await openDialog({ properties: ['openDirectory'], title: 'Install plugin from folder' });
      if (result.canceled || !result.filePaths[0]) return { installed: null, message: 'cancelled' };
      try {
        const installed = await plugins.installFromPath(result.filePaths[0]);
        kernel.emit('plugins:changed', plugins.list());
        kernel.emit('tools:changed', tools.list());
        return { installed, message: `Installed ${installed.name} ${installed.version}` };
      } catch (error) {
        return { installed: null, message: (error as Error).message };
      }
    },
    'plugins.installPath': async ({ path: pluginPath }) => {
      try {
        const installed = await plugins.installFromPath(pluginPath);
        kernel.emit('plugins:changed', plugins.list());
        kernel.emit('tools:changed', tools.list());
        return { installed, message: `Installed ${installed.name} ${installed.version}` };
      } catch (error) {
        return { installed: null, message: (error as Error).message };
      }
    },
    'plugins.installArchive': async () => {
      const result = await openDialog({
        properties: ['openFile'],
        title: 'Install plugin archive',
        filters: [{ name: 'Neuro plugin', extensions: ['zip', 'neuro'] }],
      });
      if (result.canceled || !result.filePaths[0]) return { installed: null, message: 'cancelled' };
      try {
        const installed = await plugins.installFromArchive(result.filePaths[0]);
        kernel.emit('plugins:changed', plugins.list());
        kernel.emit('tools:changed', tools.list());
        return { installed, message: `Installed ${installed.name} ${installed.version}` };
      } catch (error) {
        return { installed: null, message: (error as Error).message };
      }
    },
    'plugins.installUrl': async ({ url }) => {
      try {
        const installed = await plugins.installFromUrl(url);
        kernel.emit('plugins:changed', plugins.list());
        kernel.emit('tools:changed', tools.list());
        return { installed, message: `Installed ${installed.name} ${installed.version}` };
      } catch (error) {
        return { installed: null, message: (error as Error).message };
      }
    },
    'plugins.uninstall': async ({ id }) => {
      const next = await plugins.uninstall(id);
      kernel.emit('plugins:changed', next);
      kernel.emit('tools:changed', tools.list());
      return next;
    },
    'plugins.toggle': async ({ id, enabled }) => {
      const next = await plugins.toggle(id, enabled);
      kernel.emit('plugins:changed', next);
      kernel.emit('tools:changed', tools.list());
      return next;
    },
    'plugins.reload': async ({ id }) => {
      const next = await plugins.reload(id);
      kernel.emit('plugins:changed', next);
      kernel.emit('tools:changed', tools.list());
      return next;
    },
    'plugins.openFolder': ({ id }) => {
      const record = plugins.list().find((item) => item.id === id);
      if (record) system.showItemInFolder(record.path);
    },
    'plugins.logs': ({ id }) => plugins.logs(id),
    'plugins.runCommand': ({ pluginId, commandId }) => plugins.runCommand(pluginId, commandId),

    /* -------------------------------- automation ------------------------------ */
    'automation.nodeTypes': () => automation.nodeTypes(),
    'automation.list': () => automation.list(),
    'automation.get': ({ id }) => automation.get(id),
    'automation.save': (workflow) => automation.save(workflow),
    'automation.remove': ({ id }) => automation.remove(id),
    'automation.run': ({ id, input }) => automation.run(id, 'manual', input ?? ''),
    'automation.cancel': ({ runId }) => {
      automation.cancel(runId);
      return { ok: true };
    },
    'automation.runs': (params) => automation.runs(params?.workflowId),

    /* ------------------------------ composition ------------------------------- */
    'composition.list': () => compositions.list(),
    'composition.save': (composition) => compositions.save(composition),
    'composition.remove': ({ id }) => compositions.remove(id),
    'composition.run': ({ id, input }) => compositions.run(id, input),
    'composition.runs': (params) => compositions.runs(params?.compositionId),
    'composition.cancel': ({ runId }) => {
      compositions.cancel(runId);
      return { ok: true };
    },

    'composio.status': () => kernel.composio.status(),
    'composio.configure': (input) => kernel.composio.configure(input),
    'composio.sync': async () => {
      const status = await kernel.composio.sync();
      await kernel.composio.refreshAccounts().catch(() => undefined);
      return status;
    },
    'composio.tools': (params) => kernel.composio.tools(params ?? undefined),
    'composio.toolkits': () => kernel.composio.toolkits(),
    'composio.accounts': () => kernel.composio.refreshAccounts(),
    'composio.connect': ({ toolkit }) => kernel.composio.connect(toolkit),
    'composio.toggle': ({ slug, enabled }) => kernel.composio.toggle(slug, enabled),
    'composio.execute': ({ slug, args }) => kernel.composio.execute(slug, args),

    'web.status': () => kernel.web.stats(),
    'web.list': () => kernel.web.list(),
    'web.publish': (input) => kernel.web.publish(input),
    'web.publishFolder': async ({ domain, title }) => {
      const win = getWindow();
      const picked = win
        ? await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Choose a folder to publish' })
        : await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choose a folder to publish' });
      if (picked.canceled || !picked.filePaths[0]) return { ok: false, error: 'cancelled' };
      return kernel.web.publishFolder(picked.filePaths[0], domain, title);
    },
    'web.unpublish': ({ domain }) => kernel.web.unpublish(domain),
    'web.resolve': ({ domain }) => kernel.web.resolve(domain),
    'web.peers': () => kernel.web.peers(),
    'web.peerAdd': ({ host, port }) => kernel.web.addPeer(host, Number(port)),
    'web.peerRemove': ({ nodeId }) => kernel.web.removePeer(nodeId),
    'web.gateway': () => ({ gateway: kernel.web.stats().gateway, port: kernel.web.stats().port }),

    'onboarding.state': () => ({ complete: settings.public().onboardingComplete }),
  } as HandlerMap;
}



