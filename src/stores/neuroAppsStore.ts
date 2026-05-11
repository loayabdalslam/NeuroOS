/**
 * NeuroApps Store - Persist generated apps
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NeuroApp } from '../lib/runtime/runtimeMachine';

interface NeuroAppsState {
    apps: NeuroApp[];
    addApp: (app: NeuroApp) => void;
    updateApp: (id: string, updates: Partial<NeuroApp>) => void;
    deleteApp: (id: string) => void;
    getApp: (id: string) => NeuroApp | undefined;
    listApps: () => NeuroApp[];
    getRecent: (limit?: number) => NeuroApp[];
    searchApps: (query: string) => NeuroApp[];
    clearAll: () => void;
}

export const useNeuroAppsStore = create<NeuroAppsState>()(
    persist(
        (set, get) => ({
            apps: [],

            addApp: (app) => set((state) => ({
                apps: [app, ...state.apps.filter(a => a.id !== app.id)]
            })),

            updateApp: (id, updates) => set((state) => ({
                apps: state.apps.map(a => a.id === id ? { ...a, ...updates } : a)
            })),

            deleteApp: (id) => set((state) => ({
                apps: state.apps.filter(a => a.id !== id)
            })),

            getApp: (id) => get().apps.find(a => a.id === id),

            listApps: () => get().apps,

            getRecent: (limit = 10) => get().apps
                .sort((a, b) => (b.lastRun || b.createdAt) - (a.lastRun || a.createdAt))
                .slice(0, limit),

            searchApps: (query) => {
                const q = query.toLowerCase();
                return get().apps.filter(app =>
                    app.name.toLowerCase().includes(q) ||
                    app.description.toLowerCase().includes(q) ||
                    app.tags.some(t => t.toLowerCase().includes(q))
                );
            },

            clearAll: () => set({ apps: [] }),
        }),
        {
            name: 'neuro-apps-v1',
        }
    )
);