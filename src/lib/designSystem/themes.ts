/**
 * Comprehensive Design System for NeuroOS
 * Multiple color themes with complete design tokens
 */

export type ThemeVariant = 'system' | 'light' | 'dark' | 'cyan' | 'purple' | 'amber' | 'rose' | 'slate';

export interface DesignToken {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceLight: string;
    border: string;
    text: string;
    textSecondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    glass: string;
    glassStrong: string;
    shadow: string;
    shadowStrong: string;
    wallpaperTint: string;
    dock: string;
    radius: string;
    blur: string;
}

export const themes: Record<ThemeVariant, DesignToken> = {
    light: {
        primary: '#3b82f6', // Blue
        secondary: '#6366f1',
        accent: '#8b5cf6',
        background: '#ffffff',
        surface: '#f9fafb',
        surfaceLight: '#f3f4f6',
        border: '#e5e7eb',
        text: '#1f2937',
        textSecondary: '#6b7280',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4',
        glass: 'rgba(255,255,255,0.62)',
        glassStrong: 'rgba(255,255,255,0.82)',
        shadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
        shadowStrong: '0 28px 80px rgba(15, 23, 42, 0.18)',
        wallpaperTint: 'rgba(255,255,255,0.18)',
        dock: 'rgba(255,255,255,0.72)',
        radius: '22px',
        blur: '22px',
    },
    dark: {
        primary: '#60a5fa', // Lighter Blue for dark mode
        secondary: '#818cf8',
        accent: '#a78bfa',
        background: '#0f172a',
        surface: '#1e293b',
        surfaceLight: '#334155',
        border: '#475569',
        text: '#f1f5f9',
        textSecondary: '#cbd5e1',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#f87171',
        info: '#22d3ee',
        glass: 'rgba(15,23,42,0.58)',
        glassStrong: 'rgba(15,23,42,0.8)',
        shadow: '0 24px 60px rgba(2, 6, 23, 0.45)',
        shadowStrong: '0 28px 90px rgba(2, 6, 23, 0.6)',
        wallpaperTint: 'rgba(15,23,42,0.24)',
        dock: 'rgba(15,23,42,0.72)',
        radius: '22px',
        blur: '24px',
    },
    cyan: {
        primary: '#06b6d4',
        secondary: '#0891b2',
        accent: '#0e7490',
        background: '#f0f9fa',
        surface: '#ecf9fb',
        surfaceLight: '#e0f2fe',
        border: '#a5f3fc',
        text: '#082f49',
        textSecondary: '#0c4a6e',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4',
        glass: 'rgba(236,249,251,0.74)',
        glassStrong: 'rgba(240,249,250,0.88)',
        shadow: '0 24px 60px rgba(8, 145, 178, 0.15)',
        shadowStrong: '0 28px 80px rgba(8, 145, 178, 0.2)',
        wallpaperTint: 'rgba(224,242,254,0.26)',
        dock: 'rgba(236,249,251,0.72)',
        radius: '22px',
        blur: '22px',
    },
    purple: {
        primary: '#a78bfa',
        secondary: '#c084fc',
        accent: '#d8b4fe',
        background: '#faf5ff',
        surface: '#f5f3ff',
        surfaceLight: '#ede9fe',
        border: '#ddd6fe',
        text: '#4c1d95',
        textSecondary: '#6b21a8',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#a78bfa',
        glass: 'rgba(245,243,255,0.74)',
        glassStrong: 'rgba(250,245,255,0.9)',
        shadow: '0 24px 60px rgba(107, 33, 168, 0.14)',
        shadowStrong: '0 28px 80px rgba(107, 33, 168, 0.2)',
        wallpaperTint: 'rgba(237,233,254,0.28)',
        dock: 'rgba(245,243,255,0.74)',
        radius: '22px',
        blur: '22px',
    },
    amber: {
        primary: '#f59e0b',
        secondary: '#d97706',
        accent: '#b45309',
        background: '#fffbeb',
        surface: '#fef3c7',
        surfaceLight: '#fde68a',
        border: '#fcd34d',
        text: '#78350f',
        textSecondary: '#92400e',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4',
        glass: 'rgba(254,243,199,0.74)',
        glassStrong: 'rgba(255,251,235,0.9)',
        shadow: '0 24px 60px rgba(180, 83, 9, 0.16)',
        shadowStrong: '0 28px 80px rgba(180, 83, 9, 0.22)',
        wallpaperTint: 'rgba(253,230,138,0.26)',
        dock: 'rgba(254,243,199,0.74)',
        radius: '22px',
        blur: '22px',
    },
    rose: {
        primary: '#fb7185',
        secondary: '#f43f5e',
        accent: '#e11d48',
        background: '#fff1f5',
        surface: '#ffe4e6',
        surfaceLight: '#ffd6dd',
        border: '#fbcfe8',
        text: '#4c0519',
        textSecondary: '#831843',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#fb7185',
        info: '#06b6d4',
        glass: 'rgba(255,228,230,0.74)',
        glassStrong: 'rgba(255,241,245,0.9)',
        shadow: '0 24px 60px rgba(190, 24, 93, 0.15)',
        shadowStrong: '0 28px 80px rgba(190, 24, 93, 0.22)',
        wallpaperTint: 'rgba(251,207,232,0.28)',
        dock: 'rgba(255,228,230,0.74)',
        radius: '22px',
        blur: '22px',
    },
    slate: {
        primary: '#64748b',
        secondary: '#475569',
        accent: '#334155',
        background: '#f8fafc',
        surface: '#f1f5f9',
        surfaceLight: '#e2e8f0',
        border: '#cbd5e1',
        text: '#1e293b',
        textSecondary: '#64748b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4',
        glass: 'rgba(241,245,249,0.74)',
        glassStrong: 'rgba(248,250,252,0.9)',
        shadow: '0 24px 60px rgba(71, 85, 105, 0.14)',
        shadowStrong: '0 28px 80px rgba(71, 85, 105, 0.2)',
        wallpaperTint: 'rgba(226,232,240,0.26)',
        dock: 'rgba(241,245,249,0.74)',
        radius: '22px',
        blur: '22px',
    },
    system: {
        // Will be determined by system preference
        primary: '#3b82f6',
        secondary: '#6366f1',
        accent: '#8b5cf6',
        background: '#ffffff',
        surface: '#f9fafb',
        surfaceLight: '#f3f4f6',
        border: '#e5e7eb',
        text: '#1f2937',
        textSecondary: '#6b7280',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4',
        glass: 'rgba(255,255,255,0.62)',
        glassStrong: 'rgba(255,255,255,0.82)',
        shadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
        shadowStrong: '0 28px 80px rgba(15, 23, 42, 0.18)',
        wallpaperTint: 'rgba(255,255,255,0.18)',
        dock: 'rgba(255,255,255,0.72)',
        radius: '22px',
        blur: '22px',
    },
};

export function getThemeTokens(variant: ThemeVariant, isDark?: boolean): DesignToken {
    if (variant === 'system') {
        const prefersDark = isDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
        return themes[prefersDark ? 'dark' : 'light'];
    }
    return themes[variant];
}

export function applyThemeToDOM(variant: ThemeVariant, isDark?: boolean): void {
    const tokens = getThemeTokens(variant, isDark);
    const root = document.documentElement;

    Object.entries(tokens).forEach(([key, value]) => {
        const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVar, value);
    });

    root.style.setProperty('--shell-radius', tokens.radius);
    root.style.setProperty('--shell-blur', tokens.blur);
    root.style.setProperty('--shell-shadow', tokens.shadow);
    root.style.setProperty('--shell-shadow-strong', tokens.shadowStrong);

    // Update Tailwind dark mode class
    if (isDark || (variant === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
}

export const themeDescriptions: Record<ThemeVariant, string> = {
    light: 'Clean and bright interface',
    dark: 'Easy on the eyes dark mode',
    cyan: 'Cool cyan accent colors',
    purple: 'Creative purple aesthetic',
    amber: 'Warm amber tones',
    rose: 'Soft rose colors',
    slate: 'Professional slate gray',
    system: 'Follow system preferences',
};
