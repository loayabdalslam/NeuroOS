import type { IpcChannel, IpcParams, IpcResult, EventChannel, EventMap } from '@shared/ipc';

export const bridge = (): Window['neuro'] => window.neuro;

/** Typed invoke with a friendly error surface for the UI layer. */
export async function invoke<C extends IpcChannel>(channel: C, params: IpcParams<C>): Promise<IpcResult<C>> {
  try {
    return (await window.neuro.invoke(channel, params)) as IpcResult<C>;
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(cleanMessage(raw));
  }
}

function cleanMessage(raw: string): string {
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
    .replace(/\s*\{[\s\S]*$/, '')
    .trim();
}

export function on<E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): () => void {
  return window.neuro.on(channel, listener);
}

export const platform = window.neuro.platform;
export const isMac = platform === 'darwin';
export const modKey = isMac ? '⌘' : 'Ctrl';
