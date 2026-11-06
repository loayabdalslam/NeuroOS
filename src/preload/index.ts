import { contextBridge, ipcRenderer } from 'electron';
import type { EventChannel, EventMap, IpcChannel, IpcParams, IpcResult, RendererBridge } from '@shared/ipc';

const bridge: RendererBridge = {
  invoke: <C extends IpcChannel>(channel: C, params: IpcParams<C>): Promise<IpcResult<C>> =>
    ipcRenderer.invoke(channel, params) as Promise<IpcResult<C>>,

  on: <E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: EventMap[E]): void => listener(payload);
    ipcRenderer.on(`evt:${channel}`, wrapped);
    return () => ipcRenderer.removeListener(`evt:${channel}`, wrapped);
  },

  once: <E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): void => {
    ipcRenderer.once(`evt:${channel}`, (_event, payload: EventMap[E]) => listener(payload));
  },

  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
};

contextBridge.exposeInMainWorld('neuro', bridge);
contextBridge.exposeInMainWorld('neuroPlatform', { platform: process.platform, arch: process.arch });
