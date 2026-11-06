import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export function useHotkey(combo: string, handler: () => void, deps: unknown[] = [], enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const needsCtrl = parts.includes('ctrl') || parts.includes('mod');
    const needsShift = parts.includes('shift');
    const needsAlt = parts.includes('alt');
    const handlerFn = (event: KeyboardEvent): void => {
      const isCtrl = event.ctrlKey || event.metaKey;
      if (needsCtrl !== isCtrl) return;
      if (needsShift !== event.shiftKey) return;
      if (needsAlt !== event.altKey) return;
      if (event.key.toLowerCase() !== key) return;
      event.preventDefault();
      ref.current();
    };
    window.addEventListener('keydown', handlerFn);
    return () => window.removeEventListener('keydown', handlerFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, enabled, ...deps]);
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active = true): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const handler = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside, active]);
  return ref;
}

export function useElementSize<T extends HTMLElement>(): [RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, wait: number): (...args: A) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), wait);
    },
    [fn, wait],
  );
}

export function useInterval(fn: () => void, ms: number, enabled = true): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, []);
  return [copied, copy];
}
