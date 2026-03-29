import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { useWorkspaceStore } from './workspaceStore';

// Simple SHA-256 hash function using Web Crypto API
const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Compare PIN with hash
const verifyPin = async (pin: string, hash: string): Promise<boolean> => {
    const pinHash = await hashPin(pin);
    return pinHash === hash;
};

export interface UserProfile {
    id: string;
    name: string;
    bio: string;
    avatar: string; // URL or base64
    pin: string | null; // null if no pin set; stored as SHA-256 hash
}

interface AuthState {
    users: UserProfile[];
    activeUserId: string | null;
    isAuthenticated: boolean;
    isAddingUser: boolean; // UI state to trigger onboarding
    hasHydrated: boolean; // Persistence hydration status
    failedAttempts: Record<string, number>; // Track failed login attempts per user

    // Actions
    login: (userId: string, pin?: string) => Promise<boolean>;
    logout: () => void;
    addUser: (user: Omit<UserProfile, 'id'> & { pin?: string }) => Promise<void>;
    updateUser: (userId: string, data: Partial<UserProfile>) => Promise<void>;
    startAddUser: () => void;
    cancelAddUser: () => void;
    setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            users: [],
            activeUserId: null,
            isAuthenticated: false,
            isAddingUser: false,
            hasHydrated: false,
            failedAttempts: {},

            login: async (userId, pinInput) => {
                const { users, failedAttempts } = get();
                const user = users.find(u => u.id === userId);

                if (!user) return false;

                // Brute force protection: lock after 5 failed attempts
                const attempts = failedAttempts[userId] || 0;
                if (attempts >= 5) {
                    console.warn('Account temporarily locked due to too many failed login attempts');
                    return false;
                }

                // If no PIN set, allow login
                if (!user.pin) {
                    set({ isAuthenticated: true, activeUserId: userId, failedAttempts: { ...failedAttempts, [userId]: 0 } });
                    return true;
                }

                // Verify PIN hash
                const isValid = await verifyPin(pinInput || '', user.pin);
                if (isValid) {
                    set({ isAuthenticated: true, activeUserId: userId, failedAttempts: { ...failedAttempts, [userId]: 0 } });
                    return true;
                }

                // Increment failed attempts
                set({ failedAttempts: { ...failedAttempts, [userId]: attempts + 1 } });
                return false;
            },

            logout: () => {
                // Clear workspace on logout
                useWorkspaceStore.getState().setWorkspace(null);
                set({ isAuthenticated: false, activeUserId: null });
            },

            addUser: async (userData) => {
                const { pin, ...userDataWithoutPin } = userData as any;
                const pinHash = pin ? await hashPin(pin) : null;

                set((state) => {
                    const newUser = { ...userDataWithoutPin, id: uuidv4(), pin: pinHash };
                    return {
                        users: [...state.users, newUser],
                        activeUserId: newUser.id,
                        isAuthenticated: true, // Auto login
                        isAddingUser: false
                    };
                });
            },

            updateUser: async (userId, data) => {
                const { pin, ...dataWithoutPin } = data as any;
                const pinHash = pin ? await hashPin(pin) : undefined;
                const updateData = pinHash !== undefined ? { ...dataWithoutPin, pin: pinHash } : dataWithoutPin;

                set((state) => ({
                    users: state.users.map(u => u.id === userId ? { ...u, ...updateData } : u)
                }));
            },

            startAddUser: () => set({ isAddingUser: true }),
            cancelAddUser: () => set({ isAddingUser: false }),
            setHasHydrated: (val) => set({ hasHydrated: val }),
        }),
        {
            name: 'neuro-auth-storage-v4', // Incremented version for PIN hashing migration
            partialize: (state) => {
                // Force onboarding in dev mode by not persisting users
                if (import.meta.env.DEV) {
                    return {
                        users: [],
                        failedAttempts: {},
                    };
                }
                return {
                    users: state.users,
                    failedAttempts: state.failedAttempts,
                };
            },
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);

// Helper to set hydration status outside the create function if needed, 
// but adding an action is better.
export const useAuthStoreWithActions = () => {
    const store = useAuthStore();
    return {
        ...store,
        setHasHydrated: (val: boolean) => useAuthStore.setState({ hasHydrated: val })
    };
};
