/**
 * Neuro OS system iconography.
 *
 * Feature icons are hand-built duotone glyphs with their own colour identity —
 * this is what makes the desktop feel like an OS rather than a dashboard.
 * Utility glyphs (chevrons, close, check…) are custom stroke icons so the whole
 * interface shares one hand.
 */
import type { CSSProperties } from 'react';

type Tone = 0 | 1 | 2 | 3;

interface Shape {
  d?: string;
  rect?: [number, number, number, number, number];
  circle?: [number, number, number];
  t?: Tone;
  opacity?: number;
}

interface Glyph {
  mode: 'fill' | 'stroke';
  colors?: [string, string, string, string];
  width?: number;
  shapes: Shape[];
}

const N = 'currentColor';

const BLUE: [string, string, string, string] = ['#5686fe', '#93c5fd', '#2f5fd0', '#dbeafe'];
const VIOLET: [string, string, string, string] = ['#a78bfa', '#ddd6fe', '#7c3aed', '#ede9fe'];
const GREEN: [string, string, string, string] = ['#22c55e', '#86efac', '#15803d', '#dcfce7'];
const AMBER: [string, string, string, string] = ['#f59e0b', '#fde68a', '#b45309', '#fef3c7'];
const TEAL: [string, string, string, string] = ['#14b8a6', '#99f6e4', '#0f766e', '#ccfbf1'];
const PINK: [string, string, string, string] = ['#f472b6', '#fbcfe8', '#be185d', '#fce7f3'];
const RED: [string, string, string, string] = ['#f25a5a', '#fca5a5', '#b91c1c', '#fee2e2'];
const SLATE: [string, string, string, string] = ['#94a3b8', '#cbd5e1', '#475569', '#e2e8f0'];

/** Filled duotone glyph. */
const f = (colors: [string, string, string, string], shapes: Shape[]): Glyph => ({ mode: 'fill', colors, shapes });
/** Stroked utility glyph. */
const s = (shapes: Shape[], width = 1.8): Glyph => ({ mode: 'stroke', colors: [N, N, N, N], width, shapes });
const p = (d: string, t: Tone = 0, opacity = 1): Shape => ({ d, t, opacity });
const r = (x: number, y: number, w: number, h: number, rad = 2, t: Tone = 0, opacity = 1): Shape => ({
  rect: [x, y, w, h, rad],
  t,
  opacity,
});
const c = (cx: number, cy: number, rad: number, t: Tone = 0, opacity = 1): Shape => ({ circle: [cx, cy, rad], t, opacity });

export const SYSTEM_ICONS: Record<string, Glyph> = {
  /* --------------------------- apps & surfaces --------------------------- */
  anchor: f(BLUE, [
    c(12, 4.4, 2.2, 1),
    p('M11.1 6.6h1.8v9.8h-1.8z', 0),
    p('M12 16.4c-4.2 0-7.4-2.8-7.8-6.4H2.4c.4 4.9 4.4 8.2 9.6 8.2s9.2-3.3 9.6-8.2h-1.8c-.4 3.6-3.6 6.4-7.8 6.4z', 0),
    p('M6.2 10.4h3.6v1.8H6.2zM14.2 10.4h3.6v1.8h-3.6z', 2, 0.85),
  ]),
  dashboard: f(BLUE, [r(3, 3, 7.5, 7.5, 2.2, 0), r(13.5, 3, 7.5, 7.5, 2.2, 1), r(3, 13.5, 7.5, 7.5, 2.2, 2), r(13.5, 13.5, 7.5, 7.5, 2.2, 3)]),
  message: f(BLUE, [
    p('M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7.2L7 21.4V17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 0),
    p('M6.5 7.5h11v1.8h-11zM6.5 11h7v1.8h-7z', 1, 0.95),
  ]),
  chat: f(BLUE, [
    p('M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7.2L7 21.4V17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 0),
    p('M6.5 7.5h11v1.8h-11zM6.5 11h7v1.8h-7z', 1, 0.95),
  ]),
  files: f(AMBER, [
    p('M3 6.5a2 2 0 0 1 2-2h4.2l2 2.2h7.6a2 2 0 0 1 2 2v1.8H3z', 2),
    p('M3 9h18a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z', 0),
    p('M3 12h18v2H3z', 1, 0.55),
  ]),
  folder: f(AMBER, [
    p('M2.8 6a2 2 0 0 1 2-2h4.4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2z', 0),
    p('M2.8 10.5h18.4V18a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2z', 1, 0.55),
  ]),
  'folder-open': f(AMBER, [
    p('M2.8 6a2 2 0 0 1 2-2h4.4l2 2.2h8a2 2 0 0 1 2 2v2.4H2.8z', 2),
    p('M2.4 10.6a1.6 1.6 0 0 1 1.6-1.8h18.2a1.6 1.6 0 0 1 1.5 2.2l-2.6 7a2 2 0 0 1-1.9 1.4H4.2a2 2 0 0 1-1.9-1.4z', 0),
    p('M4.4 12.4h15.4l-1.3 4.8H5.6z', 1, 0.5),
  ]),
  terminal: f(GREEN, [
    r(2, 3.5, 20, 17, 3.4, 1, 0.16),
    p('M2 6.5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v.6H2z', 1, 0.35),
    p('M6.2 10.2l3.4 3.4-3.4 3.4 1.3 1.3 4.7-4.7-4.7-4.7z', 0),
    p('M12.6 16.6h5.2V18h-5.2z', 0, 0.9),
  ]),
  globe: f(TEAL, [
    c(12, 12, 9.4, 0),
    p('M2.6 12c2.6 2 5.8 3 9.4 3s6.8-1 9.4-3v1.6c-2.6 2-5.8 3-9.4 3s-6.8-1-9.4-3z', 1, 0.55),
    p('M11.2 2.8h1.6v18.4h-1.6z', 1, 0.28),
    p('M4 7.6h16v1.6H4zM4 15h16v1.6H4z', 1, 0.28),
  ]),
  'notebook-pen': f(AMBER, [
    p('M6 2.6h11.4a2.6 2.6 0 0 1 2.6 2.6v13.6a2.6 2.6 0 0 1-2.6 2.6H6z', 0),
    p('M2.6 4.4h3v5.2h-3zM2.6 11h3v5h-3zM2.6 17.6h3v3.6h-3z', 2),
    p('M9 7h7v1.6H9zM9 11h5v1.6H9z', 1),
    p('M17.4 9.2l1.8 1.8-4.4 4.4-2.3.5.5-2.3z', 2),
  ]),
  mail: f(PINK, [
    p('M2.6 5.4h18.8a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H2.6a2 2 0 0 1-2-2V7.4a2 2 0 0 1 2-2z', 0),
    p('M1.4 6.6l10.6 7.4 10.6-7.4v2.4l-10.6 7.4L1.4 9z', 1, 0.9),
    p('M1 17.4l7-5.4 1.2 1.5-7 5.3zM23 17.4l-7-5.4-1.2 1.5 7 5.3z', 2, 0.55),
  ]),
  inbox: f(PINK, [
    p('M2.6 5.4h18.8a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H2.6a2 2 0 0 1-2-2V7.4a2 2 0 0 1 2-2z', 1, 0.3),
    p('M1 8.6l7 4.6V18H2.6a2 2 0 0 1-2-2V9z', 0, 0.95),
    p('M23 8.6l-7 4.6V18h5.4a2 2 0 0 0 2-2V9z', 0, 0.95),
    p('M1.2 13.4h6.2l1.4 1.8h6.4l1.4-1.8h6.2V15H1.2z', 2, 0.8),
  ]),
  automation: f(BLUE, [
    p('M6.4 8h4.2v2H6.4zM13.4 8h4.2v2h-4.2zM11 9h2v6.6h-2zM7.4 14.4h9.2v2H7.4z', 2, 0.8),
    c(4.4, 9, 3.2, 0),
    c(19.6, 9, 3.2, 1),
    c(12, 18.4, 3.2, 2),
    c(12, 4.4, 2.6, 3),
  ]),
  workflow: f(VIOLET, [
    p('M5.6 7.4h4.8v1.8H5.6zM13.6 7.4h4.8v1.8h-4.8zM11 8.3h2v7.4h-2z', 2, 0.65),
    c(3.4, 8.3, 2.8, 0),
    c(20.6, 8.3, 2.8, 1),
    c(12, 17.6, 2.8, 2),
  ]),
  composer: f(VIOLET, [
    p('M12 1.6l4.6 2.7v5.4L12 12.4 7.4 9.7V4.3z', 0),
    p('M5 12.2l4.6 2.7v5.4L5 23l-4.6-2.7v-5.4z', 1),
    p('M19 12.2l4.6 2.7v5.4L19 23l-4.6-2.7v-5.4z', 2),
    p('M9.6 6.9L4.4 10v1.8l5.2-3.1zM14.4 6.9l5.2 3.1V12l-5.2-3.1z', 3, 0.6),
  ]),
  boxes: f(VIOLET, [
    p('M12 2.4l3.2 1.9v3.8L12 10l-3.2-1.9V4.3z', 0),
    p('M5.2 12.4l3.2 1.9v3.8L5.2 20l-3.2-1.9v-3.8z', 1),
    p('M18.8 12.4l3.2 1.9v3.8L18.8 20l-3.2-1.9v-3.8z', 2),
  ]),
  layers: f(VIOLET, [
    r(3.4, 3.2, 17.2, 4.6, 2, 0),
    r(2.4, 9.2, 19.2, 4.6, 2, 1),
    r(3.4, 15.2, 17.2, 4.6, 2, 2, 0.95),
  ]),
  package: f(PINK, [
    p('M12 2.2l9.6 4.6v10.4L12 21.8 2.4 17.2V6.8z', 1, 0.5),
    p('M12 2.2l9.6 4.6L12 11.4 2.4 6.8z', 0),
    p('M2.4 6.8l9.6 4.6v10.4L2.4 17.2z', 2, 0.85),
    p('M11.2 2.8h1.6v19h-1.6z', 3, 0.4),
  ]),
  marketplace: f(PINK, [
    p('M12 2.2l9.6 4.6v10.4L12 21.8 2.4 17.2V6.8z', 1, 0.5),
    p('M12 2.2l9.6 4.6L12 11.4 2.4 6.8z', 0),
    p('M2.4 6.8l9.6 4.6v10.4L2.4 17.2z', 2, 0.85),
  ]),
  settings: f(SLATE, [
    p('M10.4 1.8h3.2l.5 2.4 1.9.8 2.1-1.3 2.3 2.3-1.3 2.1.8 1.9 2.4.5v3.2l-2.4.5-.8 1.9 1.3 2.1-2.3 2.3-2.1-1.3-1.9.8-.5 2.4h-3.2l-.5-2.4-1.9-.8-2.1 1.3-2.3-2.3 1.3-2.1-.8-1.9-2.4-.5v-3.2l2.4-.5.8-1.9L3.6 6l2.3-2.3 2.1 1.3 1.9-.8z', 0),
    c(12, 12, 3.1, 1),
  ]),
  sliders: f(SLATE, [
    p('M3 6h18v2H3zM3 16h18v2H3z', 1, 0.85),
    p('M8 3h2v8H8zM14 13h2v8h-2z', 0),
  ]),
  wrench: f(BLUE, [
    p('M14.8 2.6a6.4 6.4 0 0 1 5 8l-3.2-1.1a3.2 3.2 0 0 0-1.9-3.7z', 1, 0.8),
    p('M16.6 14.4l2.2 2.2-7.6 7.6-2.2-2.2z', 0),
    p('M9.4 9.6a5.2 5.2 0 1 0-6.8 6.8l3.4-3.4 2.9 2.9z', 0, 0.9),
    c(6.2, 5.4, 2.2, 2),
  ]),
  code: f(VIOLET, [
    p('M8.4 5.6l1.6 1.6-5 5 5 5-1.6 1.6L1.8 12z', 0),
    p('M15.6 5.6l6.6 6.4-6.6 6.4-1.6-1.6 5-4.8-5-4.8z', 1),
    p('M13.4 3.6l1.8.6-4.4 15.8-1.8-.6z', 2, 0.85),
  ]),
  braces: f(VIOLET, [
    p('M7.4 3.4c-2.2 0-3.2 1.1-3.2 3.4v2.6c0 1.2-.6 1.8-1.8 1.8v1.6c1.2 0 1.8.6 1.8 1.8v2.6c0 2.3 1 3.4 3.2 3.4h1.2v-1.8H7.8c-1 0-1.4-.5-1.4-1.6v-2.6c0-1.4-.5-2.2-1.5-2.6 1-.4 1.5-1.2 1.5-2.6V6.8c0-1.1.4-1.6 1.4-1.6h1.2V3.4z', 0),
    p('M16.6 3.4c2.2 0 3.2 1.1 3.2 3.4v2.6c0 1.2.6 1.8 1.8 1.8v1.6c-1.2 0-1.8.6-1.8 1.8v2.6c0 2.3-1 3.4-3.2 3.4h-1.2v-1.8h.8c1 0 1.4-.5 1.4-1.6v-2.6c0-1.4.5-2.2 1.5-2.6-1-.4-1.5-1.2-1.5-2.6V6.8c0-1.1-.4-1.6-1.4-1.6h-.8V3.4z', 1),
  ]),
  brain: f(PINK, [
    p('M12 4.2c-1-1.3-2.5-2-4.2-1.8C5.2 2.7 3.4 4.8 3.6 7.4c-1.4.9-2 2.6-1.5 4.2.4 1.3 1.4 2.2 2.7 2.6-.1 2.3 1.6 4.2 3.9 4.3 1.3 0 2.5-.6 3.3-1.6z', 0),
    p('M12 4.2c1-1.3 2.5-2 4.2-1.8 2.6.3 4.4 2.4 4.2 5-1.4.9-2 2.6-1.5 4.2.4 1.3 1.4 2.2 2.7 2.6.1 2.3-1.6 4.2-3.9 4.3-1.3 0-2.5-.6-3.3-1.6z', 1),
    p('M12 3.4h.1v17.2H12z', 2, 0.35),
  ]),
  sparkles: f(AMBER, [
    p('M12 2.2l1.7 5.1 5.1 1.7-5.1 1.7L12 15.8l-1.7-5.1L5.2 9l5.1-1.7z', 0),
    p('M18.6 14.2l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z', 1),
    p('M5.2 14.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z', 2, 0.8),
  ]),
  shield: f(GREEN, [
    p('M12 1.8l8.6 3v6.4c0 5.1-3.5 9.4-8.6 11-5.1-1.6-8.6-5.9-8.6-11V4.8z', 0),
    p('M10.6 14.6l-2.5-2.5 1.5-1.5 1 1 4-4 1.5 1.5z', 1),
  ]),
  'shield-check': f(GREEN, [
    p('M12 1.8l8.6 3v6.4c0 5.1-3.5 9.4-8.6 11-5.1-1.6-8.6-5.9-8.6-11V4.8z', 0),
    p('M10.6 14.6l-2.5-2.5 1.5-1.5 1 1 4-4 1.5 1.5z', 1),
  ]),
  lock: f(AMBER, [
    p('M6.2 10.4h11.6a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2v-7.2a2 2 0 0 1 2-2z', 0),
    p('M8 10.4V7.6a4 4 0 0 1 8 0v2.8h-2V7.6a2 2 0 0 0-4 0v2.8z', 2),
    c(12, 15.4, 1.6, 1),
  ]),
  key: f(AMBER, [
    c(7.6, 7.6, 4.6, 0),
    p('M10.8 10.8l9.4 9.4-2.6 2.6-1.8-1.8-1.8 1.8-2-2 1.8-1.8-1.2-1.2-2.4 2.4-2.6-2.6 4.8-4.8z', 1, 0.9),
    c(7.6, 7.6, 1.6, 3),
  ]),
  'key-round': f(AMBER, [
    c(7.6, 7.6, 4.6, 0),
    p('M10.8 10.8l9.4 9.4-2.6 2.6-1.8-1.8-1.8 1.8-2-2 1.8-1.8-1.2-1.2-2.4 2.4-2.6-2.6 4.8-4.8z', 1, 0.9),
    c(7.6, 7.6, 1.6, 3),
  ]),
  cpu: f(BLUE, [
    r(5.4, 5.4, 13.2, 13.2, 2.4, 0),
    r(8.6, 8.6, 6.8, 6.8, 1.4, 1),
    p('M9 1.8h1.8v3.6H9zM13.2 1.8H15v3.6h-1.8zM9 18.6h1.8v3.6H9zM13.2 18.6H15v3.6h-1.8zM1.8 9h3.6v1.8H1.8zM1.8 13.2h3.6V15H1.8zM18.6 9h3.6v1.8h-3.6zM18.6 13.2h3.6V15h-3.6z', 2),
  ]),
  database: f(TEAL, [
    p('M2.8 5.2c0-1.7 4.1-3.1 9.2-3.1s9.2 1.4 9.2 3.1v13.6c0 1.7-4.1 3.1-9.2 3.1s-9.2-1.4-9.2-3.1z', 0),
    p('M2.8 5.2c0 1.7 4.1 3.1 9.2 3.1s9.2-1.4 9.2-3.1v1.6c0 1.7-4.1 3.1-9.2 3.1S2.8 8.5 2.8 6.8z', 1, 0.85),
    p('M2.8 10.4c0 1.7 4.1 3.1 9.2 3.1s9.2-1.4 9.2-3.1v1.6c0 1.7-4.1 3.1-9.2 3.1s-9.2-1.4-9.2-3.1z', 1, 0.55),
  ]),
  network: f(BLUE, [
    p('M11.2 6.4h1.6v4.4h-1.6zM6 11.5h1.6v4.4H6zM16.4 11.5H18v4.4h-1.6zM6 12.2h12V14H6z', 2, 0.65),
    c(12, 4.4, 2.8, 0),
    c(4.8, 18, 2.8, 1),
    c(19.2, 18, 2.8, 3),
    c(12, 11.6, 1.9, 2),
  ]),
  clock: f(AMBER, [c(12, 12, 9.6, 0), c(12, 12, 7.4, 1), p('M11.1 6.4h1.8v6.3h-1.8zM12 11.2h5.2v1.8H12z', 2)]),
  chart: f(GREEN, [
    r(3, 12, 3.6, 9, 1.2, 1),
    r(8.4, 7, 3.6, 14, 1.2, 0),
    r(13.8, 10, 3.6, 11, 1.2, 2),
    r(19.2, 4, 3.6, 17, 1.2, 3),
  ]),
  'chart-scatter': f(GREEN, [
    p('M3 3h1.8v16.2H21V21H3z', 2, 0.6),
    c(8, 15, 1.8, 0),
    c(12.4, 10, 1.8, 1),
    c(16.8, 13.4, 1.8, 0),
    c(19, 6.8, 1.8, 3),
  ]),
  activity: f(GREEN, [
    p('M2.4 12.6h4.2l2.4-6.4 3.8 11.6 2.4-5.2h6.4v1.8h-5.4l-3.4 7.2-3.6-11-1.6 5.6H2.4z', 0),
  ]),
  route: f(TEAL, [
    p('M6 7.8h4.4v1.8H6zM13.4 11.4h4.6v1.8h-4.6zM8.6 7.8h1.8v7.2H8.6zM15.6 11.4h1.8v7.2h-1.8z', 2, 0.65),
    c(4.2, 8.6, 2.6, 0),
    c(12, 15, 2.4, 1),
    c(19.6, 12.2, 2.6, 3),
  ]),
  scan: f(RED, [
    p('M3 8V5.2A2.2 2.2 0 0 1 5.2 3H8v2H5.2a.2.2 0 0 0-.2.2V8zM16 3h2.8A2.2 2.2 0 0 1 21 5.2V8h-2V5.2a.2.2 0 0 0-.2-.2H16zM3 16h2v2.8c0 .1.1.2.2.2H8v2H5.2A2.2 2.2 0 0 1 3 18.8zM19 16h2v2.8a2.2 2.2 0 0 1-2.2 2.2H16v-2h2.8c.1 0 .2-.1.2-.2z', 0),
    p('M11.1 6.6h1.8v10.8h-1.8z', 1),
  ]),
  telescope: f(VIOLET, [
    p('M15.6 2.6l5.8 3.4-8.4 14.4-3.4-2z', 1),
    p('M3 9.4l9.6-5.6 2 3.4-9.6 5.6z', 0, 0.95),
    p('M7.4 15.6l1.9 1.1-2.4 4.1-1.9-1.1zM13.2 15.6l1.9 1.1-2.4 4.1-1.9-1.1z', 2, 0.8),
    c(18.4, 19.2, 1.2, 0),
    c(21.2, 14.6, 0.9, 1),
  ]),
  flask: f(TEAL, [
    p('M9 2.6h6v2h-6zM10 4.6h4v5l4.4 9.2a1.8 1.8 0 0 1-1.6 2.6H7.2a1.8 1.8 0 0 1-1.6-2.6L10 9.6z', 0),
    p('M8.2 14.4h7.6l2 4.2H6.2z', 1, 0.7),
    c(10.4, 16.8, 0.9, 3),
    c(13.8, 17.6, 0.6, 3),
  ]),
  'git-branch': f(AMBER, [
    p('M6 5.4h1.8v13.2H6zM7.8 6.2h6.4v1.8H7.8z', 2, 0.6),
    p('M13.6 6.2h1.8v8.2h-1.8z', 2, 0.6),
    c(6.9, 4.2, 2.2, 0),
    c(14.4, 4.2, 2.2, 1),
    c(6.9, 19.8, 2.2, 0),
    c(14.4, 16, 2.2, 3),
  ]),
  server: f(SLATE, [
    p('M3 3.8h18v7.2H3zM3 13h18v7.2H3z', 0),
    p('M3 10.4h18v1.4H3zM3 19.6h18v1.4H3z', 2, 0.6),
    c(6.4, 7.2, 1.1, 1),
    c(6.4, 16.4, 1.1, 1),
    p('M10 6.8h6v1.4h-6zM10 16h6v1.4h-6z', 3, 0.8),
  ]),
  'server-cog': f(SLATE, [
    p('M2.6 2.8h18.8v6.6H2.6z', 0),
    p('M2.6 10.6h18.8v6.6H2.6z', 1, 0.75),
    c(6, 6.1, 1.1, 3),
    c(6, 13.9, 1.1, 3),
  ]),
  plug: f(TEAL, [
    p('M9 2.4h1.8v4H9zM13.2 2.4H15v4h-1.8z', 2),
    p('M6.6 6.4h10.8v4.2a5.4 5.4 0 0 1-10.8 0z', 0),
    p('M11.1 15.4h1.8v5.2h-1.8z', 1),
  ]),
  bot: f(VIOLET, [
    p('M4.6 7.4h14.8a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H4.6a2 2 0 0 1-2-2V9.4a2 2 0 0 1 2-2z', 0),
    p('M11.1 3.4h1.8v4h-1.8z', 2),
    c(12, 2.6, 1.5, 1),
    c(8.6, 12.4, 1.5, 3),
    c(15.4, 12.4, 1.5, 3),
    p('M8.6 16.4h6.8v1.6H8.6z', 1, 0.8),
  ]),
  user: f(BLUE, [c(12, 8, 4.4, 0), p('M3.6 21.2c0-4.4 3.8-7.2 8.4-7.2s8.4 2.8 8.4 7.2z', 1)]),
  'user-round': f(BLUE, [c(12, 8, 4.4, 0), p('M3.6 21.2c0-4.4 3.8-7.2 8.4-7.2s8.4 2.8 8.4 7.2z', 1)]),
  palette: f(PINK, [
    p('M12 2.4c5.5 0 9.8 3.6 9.8 8.2 0 2.8-2 4.6-4.4 4.6h-1.8c-1.2 0-2.1 1-2.1 2.1 0 .6.2 1 .2 1.7 0 1.4-1.1 2.6-2.6 2.6C6 21.6 2.2 17.3 2.2 12S6.5 2.4 12 2.4z', 0),
    c(8, 8, 1.5, 1),
    c(12.4, 6.4, 1.5, 2),
    c(16.2, 8.4, 1.5, 3),
    c(7.4, 13, 1.5, 1),
  ]),
  puzzle: f(PINK, [
    p('M9.4 3.4a2.4 2.4 0 0 1 4.6 0h3.4v3.4a2.4 2.4 0 0 0 0 4.6v3.6h-3.6a2.4 2.4 0 0 0-4.6 0H5.6v-3.4a2.4 2.4 0 0 1 0-4.6V3.4z', 0),
    p('M9.4 15h4.6v5.6H9.4z', 1, 0.55),
  ]),
  book: f(TEAL, [
    p('M3 4.2a2 2 0 0 1 2-2h5.2a2 2 0 0 1 2 2v16.2a3 3 0 0 0-2.2-1H3z', 0),
    p('M21 4.2a2 2 0 0 0-2-2h-5.2a2 2 0 0 0-2 2v16.2a3 3 0 0 1 2.2-1H21z', 1),
    p('M12 2.2h1v17.6h-1z', 2, 0.5),
  ]),
  grid: f(BLUE, [
    r(3, 3, 5, 5, 1.4, 0),
    r(10, 3, 5, 5, 1.4, 1),
    r(17, 3, 4, 5, 1.4, 2),
    r(3, 10, 5, 5, 1.4, 3),
    r(10, 10, 5, 5, 1.4, 0),
    r(17, 10, 4, 5, 1.4, 1),
    r(3, 17, 5, 4, 1.4, 2),
    r(10, 17, 5, 4, 1.4, 3),
    r(17, 17, 4, 4, 1.4, 0),
  ]),
  monitor: f(BLUE, [
    p('M2.8 4.4h18.4a1.8 1.8 0 0 1 1.8 1.8v10.4a1.8 1.8 0 0 1-1.8 1.8H2.8A1.8 1.8 0 0 1 1 16.6V6.2a1.8 1.8 0 0 1 1.8-1.8z', 0),
    p('M1 8.2h22v1.6H1z', 1, 0.55),
    p('M9 20.4h6v1.8H9zM11.1 18.4h1.8v2h-1.8z', 2),
  ]),
  zap: f(AMBER, [p('M13.4 1.8L4.2 13.4h6L9.4 22.2l9.6-12.2h-6.2z', 0)]),
  sun: f(AMBER, [
    c(12, 12, 4.8, 0),
    p('M11.1 1.8h1.8v3.4h-1.8zM11.1 18.8h1.8v3.4h-1.8zM1.8 11.1h3.4v1.8H1.8zM18.8 11.1h3.4v1.8h-3.4zM4.4 3.2l2.4 2.4-1.3 1.3L3.1 4.5zM17.2 17.1l2.4 2.4-1.3 1.3-2.4-2.4zM4.4 20.8l2.4-2.4 1.3 1.3-2.4 2.4zM17.2 6.9l2.4-2.4 1.3 1.3-2.4 2.4z', 1),
  ]),
  moon: f(VIOLET, [p('M20.8 14.6A9.2 9.2 0 0 1 9.4 3.2a9.4 9.4 0 1 0 11.4 11.4z', 0), c(17.6, 5.4, 1.3, 1)]),
  send: f(BLUE, [
    p('M22.4 2.2L1.6 9.8l7.2 2.8 2.8 7.2z', 0),
    p('M22.4 2.2L8.8 12.6l2.8 7.2z', 1, 0.55),
  ]),
  'paper-plane': f(BLUE, [p('M22.4 2.2L1.6 9.8l7.2 2.8 2.8 7.2z', 0), p('M22.4 2.2L8.8 12.6l2.8 7.2z', 1, 0.55)]),
  archive: f(AMBER, [
    p('M2.8 3.4h18.4v4.2H2.8z', 1),
    p('M4.2 8.4h15.6v12.2H4.2z', 0),
    p('M9 11.4h6v1.8H9z', 3, 0.75),
  ]),
  'hard-drive': f(SLATE, [
    p('M3 4.2h18a2 2 0 0 1 2 2v11.6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2z', 0),
    p('M1 13.4h22v1.8H1z', 2, 0.7),
    c(18.4, 16.2, 1, 1),
    c(6, 7.4, 1, 1),
  ]),
  'clipboard-list': f(BLUE, [
    p('M6 4.4h12a2 2 0 0 1 2 2v13.6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.4a2 2 0 0 1 2-2z', 0),
    p('M8.6 2.2h6.8v4H8.6z', 1),
    p('M7.6 9.2h8.8v1.6H7.6zM7.6 13h6v1.6h-6zM7.6 16.6h4.4V18H7.6z', 3, 0.8),
  ]),
  history: f(SLATE, [
    p('M12 2.6a9.4 9.4 0 1 1-8.2 4.8l1.6 1a7.6 7.6 0 1 0 6.6-4.2z', 0),
    p('M1.4 3.2l4.8.6-1.2 4.6-1.6-1 .6-2.2-2.2-.4z', 1),
    p('M11.1 7h1.8v5.6H15v1.8h-3.9z', 2),
  ]),
  'rotate-ccw': f(SLATE, [
    p('M12 3.2a8.8 8.8 0 1 1-8 5.4l2 .8a6.8 6.8 0 1 0 6-4.4z', 0, 0.85),
    p('M1.8 2.2l5.4.8-1.2 5.2-1.8-1 .6-2.4-2.4-.4z', 1, 0.85),
  ]),
  search: f(BLUE, [
    c(10.6, 10.6, 6.4, 0),
    c(10.6, 10.6, 4, 1, 0.18),
    p('M15.2 16.6l6.2 6.2-2 2-6.2-6.2z', 1),
  ]),
  command: f(BLUE, [
    p('M6.4 3.2a3.2 3.2 0 0 1 3.2 3.2v11.2a3.2 3.2 0 1 1-3.2-3.2h11.2a3.2 3.2 0 1 1-3.2 3.2V6.4a3.2 3.2 0 1 1 3.2 3.2H6.4A3.2 3.2 0 0 1 6.4 3.2z', 0),
    p('M6.4 5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM6.4 16.2a1.4 1.4 0 1 0 1.4 1.4 1.4 1.4 0 0 0-1.4-1.4zM17.6 5a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM17.6 16.2a1.4 1.4 0 1 0 1.4 1.4 1.4 1.4 0 0 0-1.4-1.4z', 3, 0.5),
  ]),
  languages: f(TEAL, [
    c(12, 12, 9.6, 0),
    p('M2.4 11.1h19.2v1.8H2.4zM6.4 8.2c1.8 2.4 4 3.8 6.4 4.6-2.4.8-4.6 2.2-6.4 4.6l-1.4-1.1c2-2.6 4.2-4 6.6-4.7-2.4-.7-4.6-2.1-6.6-4.7z', 1, 0.55),
  ]),
  home: f(BLUE, [
    p('M12 2.2l9.8 8.4-1.2 1.4-1.4-1.2V21H4.8V10.8L3.4 12 2.2 10.6z', 0),
    p('M9.4 13.6h5.2V21H9.4z', 1),
  ]),
  image: f(GREEN, [
    p('M3 4.2h18a1.8 1.8 0 0 1 1.8 1.8v12a1.8 1.8 0 0 1-1.8 1.8H3A1.8 1.8 0 0 1 1.2 18V6A1.8 1.8 0 0 1 3 4.2z', 0),
    c(8.4, 9.4, 1.8, 1),
    p('M2.4 18.4l5.8-6 4 4.2 3.6-3.4 5.8 5.2v.4H2.4z', 1),
  ]),
  pin: f(RED, [
    p('M12 1.8a6.8 6.8 0 0 1 6.8 6.8c0 4.9-6.8 13.6-6.8 13.6S5.2 13.5 5.2 8.6A6.8 6.8 0 0 1 12 1.8z', 0),
    c(12, 8.4, 2.6, 1, 0.95),
    p('M11.2 15.4h1.6v6.2h-1.6z', 2, 0.6),
  ]),
  star: f(AMBER, [p('M12 1.8l3.1 6.4 7 .9-5.1 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7-5.1-4.9 7-.9z', 0)]),
  tag: f(TEAL, [
    p('M2.4 2.4h8.8l10.4 10.4-8.8 8.8L2.4 11.2z', 0),
    c(7, 7, 1.6, 1),
  ]),
  keyboard: f(SLATE, [
    p('M2.6 6h18.8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2.6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 0),
    p('M4.4 8.6h2v2h-2zM8.2 8.6h2v2h-2zM12 8.6h2v2h-2zM15.8 8.6h2v2h-2zM17.6 12.4h2v2h-2zM4.4 12.4h2v2h-2zM8.2 12.4h7.6v2H8.2zM6.4 16h11.2v1.4H6.4z', 1, 0.75),
  ]),
  'panel-left': s([p('M3.4 4.2h17.2a1.6 1.6 0 0 1 1.6 1.6v12.4a1.6 1.6 0 0 1-1.6 1.6H3.4a1.6 1.6 0 0 1-1.6-1.6V5.8a1.6 1.6 0 0 1 1.6-1.6z'), p('M9 4.6v15.2')]),
  'panel-right': s([p('M3.4 4.2h17.2a1.6 1.6 0 0 1 1.6 1.6v12.4a1.6 1.6 0 0 1-1.6 1.6H3.4a1.6 1.6 0 0 1-1.6-1.6V5.8a1.6 1.6 0 0 1 1.6-1.6z'), p('M15 4.6v15.2')]),
  'panel-top': s([p('M3.4 4.2h17.2a1.6 1.6 0 0 1 1.6 1.6v12.4a1.6 1.6 0 0 1-1.6 1.6H3.4a1.6 1.6 0 0 1-1.6-1.6V5.8a1.6 1.6 0 0 1 1.6-1.6z'), p('M2 9h20')]),
  'panel-bottom': s([p('M3.4 4.2h17.2a1.6 1.6 0 0 1 1.6 1.6v12.4a1.6 1.6 0 0 1-1.6 1.6H3.4a1.6 1.6 0 0 1-1.6-1.6V5.8a1.6 1.6 0 0 1 1.6-1.6z'), p('M2 15h20')]),
  sidebar: s([p('M3.4 4.2h17.2a1.6 1.6 0 0 1 1.6 1.6v12.4a1.6 1.6 0 0 1-1.6 1.6H3.4a1.6 1.6 0 0 1-1.6-1.6V5.8a1.6 1.6 0 0 1 1.6-1.6z'), p('M8.4 4.6v15.2')]),
  'file-ts': f(BLUE, [p('M5.4 2.4h8.2l5 5v14.2H5.4z', 1, 0.5), p('M13.6 2.4l5 5h-5z', 0), p('M7.6 12.6h5.6v1.5H7.6zM7.6 16h3.6v1.5H7.6z', 2, 0.8)]),
  'file-code': f(BLUE, [p('M5.4 2.4h8.2l5 5v14.2H5.4z', 1, 0.5), p('M13.6 2.4l5 5h-5z', 0), p('M9.2 12.2l1.2-1 3 3-3 3-1.2-1 2-2zM13.6 12.4l1.2-1 3 3-3 3-1.2-1 2-2z', 2, 0.85)]),
  'file-json': f(AMBER, [p('M5.4 2.4h8.2l5 5v14.2H5.4z', 1, 0.5), p('M13.6 2.4l5 5h-5z', 0), p('M8 12.4c-1 0-1.4.5-1.4 1.4v1c0 .5-.2.7-.7.8.5.1.7.3.7.8v1c0 .9.4 1.4 1.4 1.4v1.2c-1.6 0-2.4-.8-2.4-2.4v-.8c0-.4-.1-.6-.6-.7.5-.1.6-.3.6-.7v-.8c0-1.6.8-2.4 2.4-2.4zM16 12.4c1 0 1.4.5 1.4 1.4v1c0 .5.2.7.7.8-.5.1-.7.3-.7.8v1c0 .9-.4 1.4-1.4 1.4v1.2c1.6 0 2.4-.8 2.4-2.4v-.8c0-.4.1-.6.6-.7-.5-.1-.6-.3-.6-.7v-.8c0-1.6-.8-2.4-2.4-2.4z', 2, 0.9)]),
  'file-text': f(SLATE, [p('M5.4 2.4h8.2l5 5v14.2H5.4z', 1, 0.55), p('M13.6 2.4l5 5h-5z', 0), p('M8.2 12h7.6v1.5H8.2zM8.2 15.2h7.6v1.5H8.2zM8.2 18.4h4.6V20H8.2z', 2, 0.85)]),
  file: f(SLATE, [p('M5.4 2.4h8.2l5 5v14.2H5.4z', 1, 0.55), p('M13.6 2.4l5 5h-5z', 0)]),
  'file-plus': f(SLATE, [p('M5.4 2.4h8.2l5 5v14.2H5.4z', 1, 0.55), p('M13.6 2.4l5 5h-5z', 0), p('M11.1 11.4h1.8v3h3v1.8h-3v3h-1.8v-3h-3v-1.8h3z', 2)]),
  'folder-plus': f(AMBER, [
    p('M2.8 6a2 2 0 0 1 2-2h4.4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2z', 0),
    p('M11.1 10.4h1.8v3h3v1.8h-3v3h-1.8v-3h-3v-1.8h3z', 1, 0.95),
  ]),
  library: f(TEAL, [
    p('M3.4 3.2h3.2v17.6H3.4zM8.6 3.2h3.2v17.6H8.6z', 1, 0.85),
    p('M13.8 4.4l3.2-.8 3.6 16.4-3.2.8z', 0),
  ]),
  tree: f(GREEN, [
    p('M5 4.4h1.8v15.2H5zM5 5.2h7v1.8H5zM5 11.4h9v1.8H5zM5 17.6h6V19H5z', 2, 0.65),
    c(13.4, 6.1, 2, 0),
    c(15.4, 12.3, 2, 1),
    c(12.4, 18.5, 2, 3),
  ]),
  'git-pull-request': f(AMBER, [
    p('M5 4.4h1.8v15.2H5zM6.8 5.2h5.4v1.8H6.8zM11 6.8h1.8v8.2H11z', 2, 0.6),
    c(5.9, 3.4, 2, 0),
    c(5.9, 20.6, 2, 0),
    c(12.4, 16.4, 2, 1),
  ]),
  'book-open': f(TEAL, [
    p('M2.8 4.2h6.4a2.8 2.8 0 0 1 2.8 2.8v14.6a4 4 0 0 0-2.8-1.2H2.8z', 0),
    p('M21.2 4.2h-6.4A2.8 2.8 0 0 0 12 7v14.6a4 4 0 0 1 2.8-1.2h6.4z', 1),
  ]),
  fullscreen: s([p('M3.4 9V4.6A1.2 1.2 0 0 1 4.6 3.4H9'), p('M15 3.4h4.4a1.2 1.2 0 0 1 1.2 1.2V9'), p('M20.6 15v4.4a1.2 1.2 0 0 1-1.2 1.2H15'), p('M9 20.6H4.6a1.2 1.2 0 0 1-1.2-1.2V15')]),
  maximize: s([p('M3.4 9V4.6A1.2 1.2 0 0 1 4.6 3.4H9'), p('M15 3.4h4.4a1.2 1.2 0 0 1 1.2 1.2V9'), p('M20.6 15v4.4a1.2 1.2 0 0 1-1.2 1.2H15'), p('M9 20.6H4.6a1.2 1.2 0 0 1-1.2-1.2V15')]),
  minimize: s([p('M4 12h16')]),
  restore: s([p('M8 8h10v10H8z'), p('M5.4 15.2H4.8a1 1 0 0 1-1-1V5.2a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.6')]),
  square: s([p('M5.4 5.4h13.2v13.2H5.4z')]),
  'arrow-up-right': s([p('M7 17L17 7'), p('M9 7h8v8')]),
  x: s([p('M6 6l12 12M18 6L6 18')]),
  plus: s([p('M12 5v14M5 12h14')]),
  minus: s([p('M5 12h14')]),
  check: s([p('M4.6 12.6l4.6 4.6L19.4 6.8')]),
  'check-circle': s([c(12, 12, 9), p('M8 12.2l2.8 2.8 5.4-5.6')]),
  'chevron-down': s([p('M5.6 8.8L12 15.2l6.4-6.4')]),
  'chevron-up': s([p('M5.6 15.2L12 8.8l6.4 6.4')]),
  'chevron-left': s([p('M15.2 5.6L8.8 12l6.4 6.4')]),
  'chevron-right': s([p('M8.8 5.6L15.2 12l-6.4 6.4')]),
  'arrow-left': s([p('M19 12H5'), p('M11 6l-6 6 6 6')]),
  'arrow-right': s([p('M5 12h14'), p('M13 6l6 6-6 6')]),
  'arrow-up': s([p('M12 19V5'), p('M6 11l6-6 6 6')]),
  'arrow-down': s([p('M12 5v14'), p('M6 13l6 6 6-6')]),
  'arrow-down-right': s([p('M7 7l10 10'), p('M17 9v8H9')]),
  copy: s([p('M9 9h10.4a1.6 1.6 0 0 1 1.6 1.6v8.8a1.6 1.6 0 0 1-1.6 1.6H9a1.6 1.6 0 0 1-1.6-1.6v-8.8A1.6 1.6 0 0 1 9 9z'), p('M6.4 15H4.6A1.6 1.6 0 0 1 3 13.4V4.6A1.6 1.6 0 0 1 4.6 3h8.8A1.6 1.6 0 0 1 15 4.6v1.8')]),
  trash: s([p('M4 7h16'), p('M9 7V4.6h6V7'), p('M6.4 7l.9 13.2h9.4L17.6 7'), p('M10 10.6v6M14 10.6v6')]),
  refresh: s([p('M20 11a8 8 0 1 0-2.4 6.4'), p('M20 4v7h-7')]),
  play: s([p('M8 5.4l10 6.6-10 6.6z')]),
  more: s([c(5, 12, 1.3), c(12, 12, 1.3), c(19, 12, 1.3)]),
  eye: s([p('M2.4 12s3.6-6.4 9.6-6.4S21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12z'), c(12, 12, 3)]),
  'eye-off': s([p('M3 3l18 18'), p('M10.6 6c.5-.1 1-.1 1.4-.1 6 0 9.6 6.1 9.6 6.1a17 17 0 0 1-3 3.6'), p('M6.4 7.6A17 17 0 0 0 2.4 12S6 18.1 12 18.1c1.4 0 2.7-.3 3.9-.8')]),
  info: s([c(12, 12, 9), p('M12 10.6V17'), c(12, 7.6, 1.1)]),
  alert: s([p('M12 3L22 20H2z'), p('M12 9v5'), c(12, 17.4, 1.1)]),
  circle: s([c(12, 12, 8.6)]),
  'circle-dot': s([c(12, 12, 8.6), c(12, 12, 3.4)]),
  loader: s([p('M12 3a9 9 0 1 0 9 9')]),
  link: s([p('M10 13.8a4.4 4.4 0 0 0 6.2 0l2.4-2.4a4.4 4.4 0 0 0-6.2-6.2l-1.2 1.2'), p('M14 10.2a4.4 4.4 0 0 0-6.2 0l-2.4 2.4a4.4 4.4 0 0 0 6.2 6.2l1.2-1.2')]),
  'external-link': s([p('M14 4h6v6'), p('M20 4l-9 9'), p('M18 14v4.6a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6V7.4A1.4 1.4 0 0 1 5.4 6H10')]),
  download: s([p('M12 4v11'), p('M7 10l5 5 5-5'), p('M5 20h14')]),
  upload: s([p('M12 20V9'), p('M7 14l5-5 5 5'), p('M5 4h14')]),
  paperclip: s([p('M20 11.4l-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.4 8.4a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8')]),
  pencil: s([p('M4 20l4.2-1 10.6-10.6a2.2 2.2 0 0 0-3.1-3.1L5 15.8z'), p('M14.6 6.4l3 3')]),
  'pen-line': s([p('M4 20l4.2-1 10.6-10.6a2.2 2.2 0 0 0-3.1-3.1L5 15.8z'), p('M13 20h7')]),
  save: s([p('M5 4h11l3 3v13H5z'), p('M8 4v6h8V4'), p('M8 20v-6h8v6')]),
  filter: s([p('M3 5h18l-7 8v6l-4 2v-8z')]),
  mic: s([p('M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z'), p('M5.5 11.5a6.5 6.5 0 0 0 13 0'), p('M12 18v3')]),
  'mouse-pointer': s([p('M5 3l14 7-6 1.4L10 18z')]),
  snowflake: s([p('M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17')]),
  replace: s([p('M4 8h13l-3-3'), p('M20 16H7l3 3')]),
  'pin-off': s([p('M4 4l16 16'), p('M9 9l-3 3 2 2 4-4'), p('M14 3l7 7-2 2-7-7z')]),
  sidebar2: s([p('M4 4h16v16H4z'), p('M9 4v16')]),
  layout: s([p('M4 4h16v16H4z'), p('M4 10h16M10 10v10')]),
  'term-line': s([p('M4 5h16v14H4z'), p('M7 10l3 2.6L7 15'), p('M13 15h4')]),
  folder2: f(AMBER, [p('M2.8 6a2 2 0 0 1 2-2h4.4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2z', 0)]),
  dot: f(BLUE, [c(12, 12, 4, 0)]),
  spark: f(AMBER, [p('M12 2l1.4 7 6.6 3-6.6 3-1.4 7-1.4-7L4 12l6.6-3z', 0)]),
};

export type IconName = keyof typeof SYSTEM_ICONS | string;

const ALIASES: Record<string, string> = {
  'app-window': 'monitor',
  'terminal-line': 'terminal',
  'chart-scatter': 'chart',
  'hard-drive': 'hard-drive',
  'git-pull-request': 'git-pull-request',
  'server-cog': 'server-cog',
  'folder-open': 'folder-open',
  'folder-plus': 'folder-plus',
  'file-code': 'file-code',
  'file-json': 'file-json',
  'file-text': 'file-text',
  'file-plus': 'file-plus',
  'check-circle': 'check-circle',
  'circle-dot': 'circle-dot',
  'mouse-pointer': 'mouse-pointer',
  'eye-off': 'eye-off',
  'arrow-up-right': 'arrow-up-right',
  'arrow-down-right': 'arrow-down-right',
  'rotate-ccw': 'rotate-ccw',
  'panel-left': 'panel-left',
  'panel-right': 'panel-right',
  'panel-top': 'panel-top',
  'panel-bottom': 'panel-bottom',
  'book-open': 'book-open',
  'pen-line': 'pen-line',
  'paper-plane': 'paper-plane',
  'key-round': 'key-round',
  'user-round': 'user-round',
  'shield-check': 'shield-check',
  'pin-off': 'pin-off',
  'notebook-pen': 'notebook-pen',
  'terminal': 'terminal',
  'glob': 'globe',
  'search-icon': 'search',
  'menubar': 'sidebar',
  'library-icon': 'library',
  'tree-icon': 'tree',
  'fullscreen': 'fullscreen',
  'restore': 'restore',
  'maximize': 'maximize',
  'minimize': 'minimize',
  'sparkles': 'sparkles',
  'bolt': 'zap',
  'gear': 'settings',
  'mail-open': 'mail',
  'send-plane': 'send',
  'inbox-tray': 'inbox',
  'grid-2': 'grid',
  'layout-dashboard': 'dashboard',
  'arrow-path': 'refresh',
  'clock-icon': 'clock',
  'circle-help': 'info',
  'alert-triangle': 'alert',
  'circle-check': 'check-circle',
  'x-circle': 'x',
  'refresh-cw': 'refresh',
  'trash-2': 'trash',
  'copy-icon': 'copy',
  'download-icon': 'download',
  'upload-icon': 'upload',
  'link-2': 'link',
  'users': 'user',
  'bot-icon': 'bot',
  'database-icon': 'database',
  'server-icon': 'server',
  'code-2': 'code',
  'braces-icon': 'braces',
  'flask-icon': 'flask',
  'telescope-icon': 'telescope',
  'cpu-icon': 'cpu',
  'layers-icon': 'layers',
  'package-icon': 'package',
  'puzzle-icon': 'puzzle',
  'palette-icon': 'palette',
  'route-icon': 'route',
  'scan-icon': 'scan',
  'clock-2': 'clock',
  'lock-icon': 'lock',
  'key-icon': 'key',
  'star-icon': 'star',
  'tag-icon': 'tag',
  'pin-icon': 'pin',
  'book-icon': 'book',
  'image-icon': 'image',
  'home-icon': 'home',
  'user-icon': 'user',
  'folder-icon': 'folder',
  'files-icon': 'files',
  'file-icon': 'file',
  'archive-icon': 'archive',
  'activity-icon': 'activity',
  'gauge-icon': 'activity',
  'command-icon': 'command',
  'keyboard-icon': 'keyboard',
  'languages-icon': 'languages',
  'palette2': 'palette',
  'layout': 'grid',
  'sparkle': 'sparkles',
  'zap-icon': 'zap',
  'sun-icon': 'sun',
  'moon-icon': 'moon',
  'monitor-icon': 'monitor',
  'memory-icon': 'cpu',
  'network-icon': 'network',
  'git-branch-icon': 'git-branch',
  'git-pull-request-icon': 'git-pull-request',
  'history-icon': 'history',
  'clock-3': 'clock',
  'calendar': 'clock',
  'calendar-days': 'clock',
  'star-filled': 'star',
  'sparkles-2': 'sparkles',
  'clipboard': 'clipboard-list',
  'clipboard-list-icon': 'clipboard-list',
  'shield-icon': 'shield',
  'lock-open': 'lock',
  'plug-icon': 'plug',
  'wrench-icon': 'wrench',
  'sliders-icon': 'sliders',
  'settings-icon': 'settings',
  'sidebar-icon': 'sidebar',
  'archive-box': 'archive',
  'hard-drive-icon': 'hard-drive',
  'loader-icon': 'loader',
};

export function resolveGlyph(name: string): Glyph {
  const key = SYSTEM_ICONS[name] ? name : ALIASES[name] ?? 'circle-dot';
  return SYSTEM_ICONS[key] ?? SYSTEM_ICONS['circle-dot'];
}

export interface SystemIconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  mono?: boolean;
  title?: string;
  role?: string;
  onClick?: () => void;
  'aria-hidden'?: boolean;
}

export function SystemIcon({ name, size = 16, className, style, mono, title, role, onClick, ...rest }: SystemIconProps): JSX.Element {
  const glyph = resolveGlyph(name);
  const tone = (t: Tone): string => (mono ? 'currentColor' : (glyph.colors?.[t] ?? 'currentColor'));
  const stroke = glyph.mode === 'stroke';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: 'block', flex: 'none', ...style }}
      role={role ?? (title ? 'img' : 'presentation')}
      onClick={onClick}
      aria-label={title}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {glyph.shapes.map((shape, index) => {
        const color = tone(shape.t ?? 0);
        if (shape.rect) {
          const [x, y, w, h, rad] = shape.rect;
          return <rect key={index} x={x} y={y} width={w} height={h} rx={rad} fill={color} opacity={shape.opacity ?? 1} />;
        }
        if (shape.circle) {
          const [cx, cy, rad] = shape.circle;
          return stroke ? (
            <circle key={index} cx={cx} cy={cy} r={rad} fill="none" stroke={color} strokeWidth={glyph.width ?? 1.8} opacity={shape.opacity ?? 1} />
          ) : (
            <circle key={index} cx={cx} cy={cy} r={rad} fill={color} opacity={shape.opacity ?? 1} />
          );
        }
        return (
          <path
            key={index}
            d={shape.d}
            fill={stroke ? 'none' : color}
            stroke={stroke ? color : undefined}
            strokeWidth={stroke ? glyph.width ?? 1.8 : undefined}
            strokeLinecap={stroke ? 'round' : undefined}
            strokeLinejoin={stroke ? 'round' : undefined}
            opacity={shape.opacity ?? 1}
          />
        );
      })}
    </svg>
  );
}

/** App identity marks used by the desktop, dock, start menu and window chrome. */
export const APP_ICON: Record<string, string> = {
  overview: 'dashboard',
  chat: 'message',
  workspace: 'files',
  terminal: 'terminal',
  browser: 'globe',
  notebook: 'notebook-pen',
  mail: 'mail',
  automation: 'automation',
  composer: 'composer',
  spaces: 'layers',
  marketplace: 'marketplace',
  settings: 'settings',
  space: 'layers',
};
