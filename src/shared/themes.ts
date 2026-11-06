import type { Density, TaskbarPosition, ThemeDesign, ThemeSurface } from './types';

/**
 * Theme presets.
 *
 * A theme is a design language (Neuro, Windows 11 Fluent, Ubuntu Yaru, iOS) plus
 * an appearance mode. `design` drives typography, radii, elevation, glass and
 * chrome details in CSS; the preset also picks a wallpaper, accent and taskbar
 * placement so switching genuinely changes the feel of the OS.
 */
export interface ThemePreset {
  id: string;
  name: string;
  design: ThemeDesign;
  mode: 'dark' | 'light';
  surface: ThemeSurface;
  accent: 'neuro' | 'deepseek' | 'violet' | 'teal' | 'amber';
  radius: number;
  density: Density;
  transparency: boolean;
  glow: boolean;
  wallpaper: string;
  taskbar: TaskbarPosition;
  description: string;
  /** Preview swatches: background, surface, accent, text. */
  colors: [string, string, string, string];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'neuro-dark',
    name: 'Neuro OS',
    design: 'neuro',
    mode: 'dark',
    surface: 'standard',
    accent: 'neuro',
    radius: 14,
    density: 'comfortable',
    transparency: true,
    glow: true,
    wallpaper: 'nebula',
    taskbar: 'bottom',
    description: 'Deep space, aurora glow, Montserrat wordmark.',
    colors: ['#151517', '#232324', '#5686fe', '#f7f8fa'],
  },
  {
    id: 'neuro-white',
    name: 'Neuro White',
    design: 'neuro',
    mode: 'light',
    surface: 'white',
    accent: 'deepseek',
    radius: 14,
    density: 'comfortable',
    transparency: true,
    glow: false,
    wallpaper: 'paper',
    taskbar: 'bottom',
    description: 'Pure paper surfaces with the DeepSeek blue accent.',
    colors: ['#ffffff', '#f4f6f9', '#2f5fd0', '#15171b'],
  },
  {
    id: 'windows-11',
    name: 'Windows 11',
    design: 'windows',
    mode: 'dark',
    surface: 'standard',
    accent: 'deepseek',
    radius: 8,
    density: 'comfortable',
    transparency: true,
    glow: false,
    wallpaper: 'mica',
    taskbar: 'bottom',
    description: 'Fluent Mica, 8px corners, Segoe UI and the Windows accent.',
    colors: ['#202020', '#2b2b2b', '#0078d4', '#ffffff'],
  },
  {
    id: 'windows-11-light',
    name: 'Windows 11 Light',
    design: 'windows',
    mode: 'light',
    surface: 'standard',
    accent: 'deepseek',
    radius: 8,
    density: 'comfortable',
    transparency: true,
    glow: false,
    wallpaper: 'mica-light',
    taskbar: 'bottom',
    description: 'Fluent light with translucent Mica surfaces.',
    colors: ['#f3f3f3', '#ffffff', '#0067c0', '#1a1a1a'],
  },
  {
    id: 'ubuntu-dark',
    name: 'Ubuntu',
    design: 'ubuntu',
    mode: 'dark',
    surface: 'standard',
    accent: 'amber',
    radius: 10,
    density: 'comfortable',
    transparency: false,
    glow: false,
    wallpaper: 'aubergine',
    taskbar: 'top',
    description: 'Yaru aubergine, Ubuntu orange and a GNOME-style top bar.',
    colors: ['#1e1b1a', '#2c2c2c', '#e95420', '#f6f5f4'],
  },
  {
    id: 'ubuntu-light',
    name: 'Ubuntu Light',
    design: 'ubuntu',
    mode: 'light',
    surface: 'white',
    accent: 'amber',
    radius: 10,
    density: 'comfortable',
    transparency: false,
    glow: false,
    wallpaper: 'yaru-light',
    taskbar: 'top',
    description: 'Yaru light — warm greys with the orange accent.',
    colors: ['#fafafa', '#ffffff', '#c7162b', '#2c2c2c'],
  },
  {
    id: 'ios-light',
    name: 'iOS',
    design: 'ios',
    mode: 'light',
    surface: 'white',
    accent: 'neuro',
    radius: 20,
    density: 'comfortable',
    transparency: true,
    glow: false,
    wallpaper: 'aurora',
    taskbar: 'bottom',
    description: 'Frosted glass, 20px radii, SF-style typography.',
    colors: ['#f2f2f7', '#ffffff', '#0a84ff', '#1c1c1e'],
  },
  {
    id: 'ios-dark',
    name: 'iOS Dark',
    design: 'ios',
    mode: 'dark',
    surface: 'standard',
    accent: 'neuro',
    radius: 20,
    density: 'comfortable',
    transparency: true,
    glow: true,
    wallpaper: 'midnight',
    taskbar: 'bottom',
    description: 'OLED black, saturated glass and pill controls.',
    colors: ['#000000', '#1c1c1e', '#0a84ff', '#ffffff'],
  },
];

export const themePreset = (id: string): ThemePreset | undefined => THEME_PRESETS.find((preset) => preset.id === id);

export const designLabel: Record<ThemeDesign, string> = {
  neuro: 'Neuro OS',
  windows: 'Windows 11',
  ubuntu: 'Ubuntu',
  ios: 'iOS',
};

export const WALLPAPERS = [
  { id: 'nebula', label: 'Nebula' },
  { id: 'void', label: 'Void' },
  { id: 'grid', label: 'Grid' },
  { id: 'paper', label: 'Paper' },
  { id: 'mica', label: 'Mica' },
  { id: 'mica-light', label: 'Mica light' },
  { id: 'aubergine', label: 'Aubergine' },
  { id: 'yaru-light', label: 'Yaru light' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'midnight', label: 'Midnight' },
];
