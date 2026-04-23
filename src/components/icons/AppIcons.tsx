import React from 'react';
import { cn } from '../../lib/utils';

interface IconProps {
  className?: string;
  size?: number;
}

// Terminal Icon - Command line with prompt
export const TerminalIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M6 8L10 12L6 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 16H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Files Icon - Folder with document
export const FilesIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <path d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C9.851 5 10.1054 5.10536 10.2929 5.29289L12 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M7 13H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Chat Icon - Brain circuit with chat bubble
export const ChatIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.5 20 9.1 19.7 7.8 19.1L3 20L4.3 16.1C3.5 14.7 3 13.2 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="8" cy="11.5" r="1" fill="currentColor"/>
    <circle cx="12" cy="11.5" r="1" fill="currentColor"/>
    <circle cx="16" cy="11.5" r="1" fill="currentColor"/>
  </svg>
);

// Settings Icon - Gear with sliders
export const SettingsIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

// Viewer Icon - Eye with document
export const ViewerIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <path d="M12 5C5.63636 5 2 12 2 12C2 12 5.63636 19 12 19C18.3636 19 22 12 22 12C22 12 18.3636 5 12 5Z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M7 9L9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M17 9L15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Board Icon - Kanban board
export const BoardIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M9 3V21" stroke="currentColor" strokeWidth="2"/>
    <path d="M15 3V21" stroke="currentColor" strokeWidth="2"/>
    <rect x="5" y="6" width="3" height="4" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="11" y="6" width="3" height="6" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="17" y="6" width="3" height="3" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="5" y="13" width="3" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="11" y="15" width="3" height="3" rx="1" fill="currentColor" opacity="0.3"/>
  </svg>
);

// Browser Icon - Globe with window
export const BrowserIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M2 8H22" stroke="currentColor" strokeWidth="2"/>
    <circle cx="5" cy="6" r="1" fill="currentColor"/>
    <circle cx="8" cy="6" r="1" fill="currentColor"/>
    <circle cx="11" cy="6" r="1" fill="currentColor"/>
    <circle cx="12" cy="14" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M12 12V14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// LLM Manager Icon - CPU with neural network
export const LLMIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M9 2V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M15 2V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M9 19V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M15 19V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 9H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 15H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 9H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 15H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="9" r="1.5" fill="currentColor"/>
    <circle cx="9" cy="15" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="15" r="1.5" fill="currentColor"/>
    <path d="M10.5 9H13.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10.5 15H13.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 10.5V13.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M15 10.5V13.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// MCP Connectors Icon - Lightning bolt with connections
export const MCPIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <path d="M13 2L4 14H11L10 22L20 10H13L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M8 6H16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
    <path d="M6 8V16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
    <path d="M18 8V16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
    <path d="M8 18H16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
  </svg>
);

// Music Icon - Headphones with note
export const MusicIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <path d="M9 18V5L21 3V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M12 8L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M15 7L15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Media Icon - Image with play button
export const MediaIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
    <path d="M21 15L16 10L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M14 14L12 12V16L14 14Z" fill="currentColor"/>
  </svg>
);

// Tasks Icon - Checklist with checkmark
export const TasksIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M7 8L9 10L13 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 14L9 16L13 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 8H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M15 14H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Map app IDs to icons
export const APP_ICONS: Record<string, React.FC<IconProps>> = {
  terminal: TerminalIcon,
  files: FilesIcon,
  chat: ChatIcon,
  settings: SettingsIcon,
  viewer: ViewerIcon,
  board: BoardIcon,
  browser: BrowserIcon,
  llmmanager: LLMIcon,
  mcp: MCPIcon,
  music: MusicIcon,
  media: MediaIcon,
  tasks: TasksIcon,
};

// Helper to get icon component by app ID
export const getAppIcon = (appId: string): React.FC<IconProps> => {
  return APP_ICONS[appId] || TerminalIcon;
};
