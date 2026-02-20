import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface UserProfile {
    id: string;
    name: string;
    bio: string;
    avatar: string; // URL or base64
    pin: string | null; // null if no pin set
}

interface AuthState {
    users: UserProfile[];
    activeUserId: string | null;
    isAuthenticated: boolean;
    isAddingUser: boolean; // UI state to trigger onboarding
    hasHydrated: boolean; // Persistence hydration status

    // Actions
    login: (userId: string, pin?: string) => boolean;
    logout: () => void;
    addUser: (user: Omit<UserProfile, 'id'>) => void;
    updateUser: (userId: string, data: Partial<UserProfile>) => void;
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

            login: (userId, pinInput) => {
                const { users } = get();
                const user = users.find(u => u.id === userId);

                if (!user) return false;

                // If no PIN set, allow login
                if (!user.pin) {
                    set({ isAuthenticated: true, activeUserId: userId });
                    return true;
                }
                console.log('Login Attempt:', { userId, inputPin: pinInput, storedPin: user.pin });

                // Check PIN
                if (user.pin === pinInput) {
                    set({ isAuthenticated: true, activeUserId: userId });
                    return true;
                }
                return false;
            },

            logout: () => set({ isAuthenticated: false, activeUserId: null }),

            addUser: (userData) => set((state) => {
                const newUser = { ...userData, id: uuidv4() };
                return {
                    users: [...state.users, newUser],
                    activeUserId: newUser.id,
                    isAuthenticated: true, // Auto login
                    isAddingUser: false
                };
            }),

            updateUser: (userId, data) => set((state) => ({
                users: state.users.map(u => u.id === userId ? { ...u, ...data } : u)
            })),

            startAddUser: () => set({ isAddingUser: true }),
            cancelAddUser: () => set({ isAddingUser: false }),
            setHasHydrated: (val) => set({ hasHydrated: val }),
        }),
        {
            name: 'neuro-auth-storage-v2', // Changed name to reset storage for migration
            partialize: (state) => ({
                users: state.users,
                // Do not persist auth state or temporary UI state
            }),
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
