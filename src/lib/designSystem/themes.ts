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
