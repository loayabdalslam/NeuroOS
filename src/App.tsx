import React from 'react';
import { useOS } from './hooks/useOS';
import { Taskbar } from './components/Taskbar';
import { StartMenu } from './components/StartMenu';
import { Desktop } from './components/Desktop';
import { WindowManager } from './components/WindowManager';
import { LockScreen } from './components/LockScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { SystemAssistant } from './components/SystemAssistant';
import { ContextMenuProvider } from './components/ContextMenu';
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
          className="flex flex-col items-center gap-6"
        >
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-light tracking-tighter text-zinc-900">
              Neuro OS<span className="align-top text-[10px] ml-1 font-bold">TM</span>
            </h1>
            <div className="w-12 h-[1px] bg-zinc-200 overflow-hidden">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-full h-full bg-zinc-900"
              />
            </div>
          </div>
          <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-zinc-400">Initializing Core</span>
        </motion.div>
      </div>
    );
  }

  return (
    <ContextMenuProvider>
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

        {/* Boot Overlay */}
        {users.length > 0 && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[10000] bg-white flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-2 text-zinc-900"
            >
              <h1 className="text-4xl font-light tracking-tighter">
                Neuro OS<span className="align-top text-[12px] ml-1 font-bold">TM</span>
              </h1>
              <div className="h-[1px] w-8 bg-zinc-200 mt-2" />
            </motion.div>
          </motion.div>
        )}
      </div>
    </ContextMenuProvider>
  );
}
