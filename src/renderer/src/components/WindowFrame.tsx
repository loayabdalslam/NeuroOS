import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { OsWindow } from '@shared/types';
import { appById } from '@shared/apps';
import { useWindowStore } from '../state/windows';
import { Icon } from './Icon';
import { AppContent } from './AppContent';

const MIN_W = 380;
const MIN_H = 260;

type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function WindowFrame({ win, areaW, areaH }: { win: OsWindow; areaW: number; areaH: number }): JSX.Element {
  const store = useWindowStore();
  const focused = store.focusedId === win.id;
  const app = appById(win.appId);
  const drag = useRef<{
    mode: 'move' | 'resize';
    dir?: Direction;
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const beginMove = (event: ReactPointerEvent): void => {
    if (event.button !== 0) return;
    store.focus(win.id);
    if (win.maximized) return;
    drag.current = { mode: 'move', startX: event.clientX, startY: event.clientY, x: win.x, y: win.y, w: win.width, h: win.height };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const beginResize = (event: ReactPointerEvent, dir: Direction): void => {
    event.stopPropagation();
    store.focus(win.id);
    if (win.maximized) return;
    drag.current = { mode: 'resize', dir, startX: event.clientX, startY: event.clientY, x: win.x, y: win.y, w: win.width, h: win.height };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent): void => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.mode === 'move') {
      store.setBounds(win.id, {
        x: Math.min(areaW - 80, Math.max(-win.width + 120, state.x + dx)),
        y: Math.min(areaH - 40, Math.max(0, state.y + dy)),
      });
      return;
    }
    const dir = state.dir ?? 'se';
    let { x, y, w, h } = state;
    if (dir.includes('e')) w = Math.max(MIN_W, state.w + dx);
    if (dir.includes('s')) h = Math.max(MIN_H, state.h + dy);
    if (dir.includes('w')) {
      w = Math.max(MIN_W, state.w - dx);
      x = state.x + (state.w - w);
    }
    if (dir.includes('n')) {
      h = Math.max(MIN_H, state.h - dy);
      y = state.y + (state.h - h);
    }
    store.setBounds(win.id, { x, y, width: w, height: h });
  };

  const onPointerUp = (): void => {
    if (drag.current?.mode === 'move' && !win.maximized) {
      const pointer = { x: win.x, y: win.y };
      if (pointer.x <= 8) store.snap(win.id, 'left');
      else if (pointer.x + win.width >= areaW - 8) store.snap(win.id, 'right');
    }
    drag.current = null;
  };

  const style = win.maximized
    ? { left: 0, top: 0, width: areaW, height: areaH, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.z };

  return (
    <div
      className="oswindow"
      data-focused={focused}
      data-minimized={win.minimized}
      data-maximized={win.maximized}
      style={style}
      onPointerDown={() => store.focus(win.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <header className="oswindow__bar" onPointerDown={beginMove} onDoubleClick={() => store.toggleMaximize(win.id)}>
        <span className="oswindow__icon" style={{ color: win.accent }}>
          <Icon name={win.icon} size={14} />
        </span>
        <span className="oswindow__title truncate">{win.title}</span>
        <span className="oswindow__meta tiny mono">{app?.description ? '' : ''}</span>
        <span className="grow" />
        <div className="oswindow__controls" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" aria-label="Minimize" onClick={() => store.minimize(win.id)}>
            <Icon name="minus" size={12} />
          </button>
          <button type="button" aria-label="Maximize" onClick={() => store.toggleMaximize(win.id)}>
            <Icon name={win.maximized ? 'restore' : 'square'} size={10} />
          </button>
          <button type="button" aria-label="Close" className="oswindow__close" onClick={() => store.close(win.id)}>
            <Icon name="x" size={12} />
          </button>
        </div>
      </header>
      <div className="oswindow__content">
        <AppContent appId={win.appId} />
      </div>
      {!win.maximized && win.resizable ? (
        <>
          {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Direction[]).map((dir) => (
            <span
              key={dir}
              className={`oswindow__resize oswindow__resize--${dir}`}
              onPointerDown={(event) => beginResize(event, dir)}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
