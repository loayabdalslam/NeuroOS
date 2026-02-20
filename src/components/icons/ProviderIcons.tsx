import React from 'react';

export const ProviderLogos: Record<string, React.FC<{ className?: string, size?: number }>> = {
    openai: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729ZM13.2549 22.8109a4.8366 4.8366 0 0 1-3.9344-2.1934l-.4827-.8038-.9346.54c-1.554.895-3.523.3644-4.402-1.1856-.879-1.55.3344-3.5684 1.8885-4.4634l.8727-.5013-.3439-.938a4.808 4.808 0 0 1-.2247-2.969 4.8528 4.8528 0 0 1 3.0975-3.4116l1.2294-.4392.2906-1.1576A4.8986 4.8986 0 0 1 15.228 1.9566a4.8624 4.8624 0 0 1 4.3544 2.3794l.4302.8229.9823-.5352c1.554-.895 3.523-.3644 4.402 1.1856.879 1.55-.3343 3.5684-1.8885 4.4634l-.8727.5013.344.938a4.8128 4.8128 0 0 1 .2342 2.9594 4.8672 4.8672 0 0 1-3.1119 3.4212l-1.2294.4392-.2858 1.1528a4.8938 4.8938 0 0 1-4.7176 3.6934l-1.1094-.031Zm-2.7032-1.4l.2763-1.096 1.4586.3243a3.6749 3.6749 0 0 0 2.2548-.4653l-.8689-1.5173-1.0712-.5961-.7532 1.3065a1.8665 1.8665 0 0 1-1.297.944ZM5.0998 15.341l1.1046.3353 1.1235-.6486-1.6352-2.8318-1.0903.6294a3.6558 3.6558 0 0 0-1.278 1.8311l1.7754.6846Zm.8294-8.868.5113 1.0006.8784.868-1.554 2.722-.5018-.8728a3.651 3.651 0 0 0-.2526-2.227l.9187-1.4908Zm4.6272-1.9551.8134 1.4258-.2938 1.1687-3.0366-.5817.0667-1.2209a3.5938 3.5938 0 0 0-1.8211-.5341l.9429-1.5794 3.3285 1.3216Zm6.5658.0763-.2669 1.096-1.4633-.3195a3.67 3.67 0 0 0-2.2452.4605l.8689 1.5173 1.0711.5962.7533-1.3066a1.8617 1.8617 0 0 1 1.2827-.9395l-.0006-1.1044Zm4.7702 4.1913-1.1094-.3353-1.1235.6486 1.6353 2.8319 1.0903-.6294a3.6796 3.6796 0 0 0 1.278-1.8263l-1.7707-.6895Zm-.8199 8.8728-.5113-1.0007-.8784-.868 1.5588-2.7316.5019.8728a3.6796 3.6796 0 0 0 .2526 2.2318l-.9236 1.4957ZM12 10.6668a1.3333 1.3333 0 1 1-1.3333 1.3333A1.3333 1.3333 0 0 1 12 10.6668Z" />
        </svg>
    ),
    anthropic: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Simplified generic brain/sparkle shape for Anthropic as updated brand assets are strict */}
            <path d="M12 2L14.5 9H20.5L15.5 13L17.5 19.5L12 15.5L6.5 19.5L8.5 13L3.5 9H9.5L12 2Z" className="opacity-80" />
            {/* Actually, let's use a nice custom shape that looks like their 'Aeon' or just a brain abstraction */}
            <path d="M12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    ollama: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Llama-like shape or just the 'O' symbol used in some contexts, keeping it clean */}
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M10 8C10 8 11 9 12 9C13 9 14 8 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="9" cy="12" r="1" fill="currentColor" />
            <circle cx="15" cy="12" r="1" fill="currentColor" />
            <path d="M12 16V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    lmstudio: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 20H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="2" />
            <path d="M12 11L14 9" stroke="currentColor" strokeWidth="2" />
        </svg>
    ),
    gemini: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Star/Sparkle shape */}
            <path d="M12 2L14.2 8.5L21 10.8L14.2 13L12 19.5L9.8 13L3 10.8L9.8 8.5L12 2Z" />
        </svg>
    ),
    groq: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 18H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    mistral: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Wave/Fluid shape */}
            <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M7 14L10 9L13 14L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    custom: ({ className, size = 24 }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 9V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
};
