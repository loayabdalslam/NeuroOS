import { Overview } from '../surfaces/Overview';
import { Chat } from '../surfaces/Chat';
import { Workspace } from '../surfaces/Workspace';
import { TerminalSurface } from '../surfaces/Terminal';
import { BrowserSurface } from '../surfaces/Browser';
import { NotebookSurface } from '../surfaces/Notebook';
import { MailSurface } from '../surfaces/Mail';
import { AutomationSurface } from '../surfaces/Automation';
import { ComposerSurface } from '../surfaces/Composer';
import { Spaces } from '../surfaces/Spaces';
import { Marketplace } from '../surfaces/Marketplace';
import { SettingsSurface } from '../surfaces/Settings';

/** Maps a desktop app id to the surface component rendered inside its window. */
export function AppContent({ appId }: { appId: string }): JSX.Element {
  switch (appId) {
    case 'overview':
      return <Overview />;
    case 'chat':
      return <Chat />;
    case 'workspace':
      return <Workspace params={{}} />;
    case 'terminal':
      return <TerminalSurface />;
    case 'browser':
      return <BrowserSurface params={{}} />;
    case 'notebook':
      return <NotebookSurface params={{}} />;
    case 'mail':
      return <MailSurface />;
    case 'automation':
      return <AutomationSurface />;
    case 'composer':
      return <ComposerSurface />;
    case 'spaces':
      return <Spaces />;
    case 'marketplace':
      return <Marketplace />;
    case 'settings':
      return <SettingsSurface />;
    default:
      return <Overview />;
  }
}
