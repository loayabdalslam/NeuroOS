import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
    workspacePath: string | null;
    setWorkspace: (path: string) => void;
    clearWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set) => ({
            workspacePath: null,
            setWorkspace: (path) => set({ workspacePath: path }),
            clearWorkspace: () => set({ workspacePath: null }),
        }),
        {
            name: 'neuro-workspace-v2',
        }
    )
);
