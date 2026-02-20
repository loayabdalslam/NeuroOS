import React from 'react';
import { useOS } from './hooks/useOS';
import { Taskbar } from './components/Taskbar';
import { StartMenu } from './components/StartMenu';
import { Desktop } from './components/Desktop';
import { WindowManager } from './components/WindowManager';
import { LockScreen } from './components/LockScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { SystemAssistant } from './components/SystemAssistant';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const { users, isAddingUser, isAuthenticated, hasHydrated } = useAuthStore();

  if (!hasHydrated) {
    return (
      <div className="h-screen w-screen bg-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-zinc-900 rounded-full flex items-center justify-center font-bold text-2xl animate-pulse">N</div>
          <span className="text-xs font-bold tracking-[0.3em] uppercase opacity-20">Initializing Neuro Core</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-zinc-50 overflow-hidden relative font-sans text-zinc-900 selection:bg-zinc-900 selection:text-white">

      {/* Security Layer */}
      <AnimatePresence mode="wait">
        {(users.length === 0 || isAddingUser) ? (
          <OnboardingFlow key="onboarding" />
        ) : (
          !isAuthenticated && <LockScreen key="lockscreen" />
        )}
      </AnimatePresence>

      {/* Background & Icons */}
      {isAuthenticated && (
        <>
          <Desktop />

          {/* Application Layer */}
          <WindowManager />

          {/* UI Shell */}
          <StartMenu />
          <Taskbar />
          <SystemAssistant />
        </>
      )}

      {/* Boot Overlay (Only show if not first run to avoid conflict with onboarding) */}
      {/* Boot Overlay (Only show if users exist to avoid conflict with onboarding) */}
      {users.length > 0 && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[10000] bg-white flex flex-col items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-4 text-zinc-900"
          >
            <div className="w-12 h-12 border-2 border-zinc-900 rounded-full flex items-center justify-center font-bold text-2xl">N</div>
            <span className="text-sm font-bold tracking-[0.2em] uppercase">NeuroOS</span>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
