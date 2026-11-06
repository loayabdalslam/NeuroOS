import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { Icon } from './Icon';
import { SURFACES, SURFACE_ORDER } from '../surfaces/meta';
import type { SurfaceKind } from '@shared/types';

export function Dock(): JSX.Element {
  const t = useT();
  const navigate = useAppStore((s) => s.navigate);
  const activePageId = useAppStore((s) => s.activePageId);
  const pages = useAppStore((s) => s.pages);
  const collapsed = useAppStore((s) => s.dockCollapsed);
  const toggleDock = useAppStore((s) => s.toggleDock);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const anchorOpen = useAppStore((s) => s.anchorOpen);
  const setAnchorOpen = useAppStore((s) => s.setAnchorOpen);
  const profile = useAppStore((s) => s.settings?.profile);

  const activePage = pages.find((page) => page.id === activePageId);
  const isActive = (surface: SurfaceKind): boolean => activePage?.surface === surface;

  return (
    <nav className={`dock ${collapsed ? 'is-collapsed' : ''}`} aria-label="Primary">
      <div className="dock__orb" data-tip="Command palette" data-tip-side="right" onClick={() => setCommandOpen(true)} role="button" tabIndex={0}>
        <Icon name="command" size={17} />
      </div>

      <div className="dock__group">
        {SURFACE_ORDER.map((surface) => {
          const meta = SURFACES[surface];
          return (
            <button
              key={surface}
              type="button"
              className="dock__item"
              data-active={isActive(surface)}
              data-tip={t(meta.labelKey)}
              data-tip-side="right"
              onClick={() => navigate(surface)}
            >
              <span className="dock__icon" style={{ ['--dock-accent' as string]: meta.accent }}>
                <Icon name={meta.icon} size={20} />
              </span>
              <span className="dock__label">{t(meta.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="dock__spacer" />

      <div className="dock__group dock__group--bottom">
        <button
          type="button"
          className="dock__item"
          data-active={anchorOpen}
          data-tip={t('anchor.title')}
          data-tip-side="right"
          onClick={() => setAnchorOpen(!anchorOpen)}
        >
          <span className="dock__icon">
            <Icon name="anchor" size={17} />
          </span>
          <span className="dock__label">{t('anchor.title')}</span>
        </button>
        <button type="button" className="dock__item" data-tip={t('common.search')} data-tip-side="right" onClick={() => setCommandOpen(true)}>
          <span className="dock__icon">
            <Icon name="search" size={17} />
          </span>
        </button>
        <button
          type="button"
          className="dock__avatar"
          data-tip={profile?.name || 'Profile'}
          data-tip-side="right"
          onClick={() => {
            useAppStore.getState().setSettingsSection('profile');
            navigate('settings');
          }}
        >
          {(profile?.name || 'N').slice(0, 1).toUpperCase()}
        </button>
        <button type="button" className="dock__collapse" data-tip={collapsed ? 'Expand' : 'Collapse'} data-tip-side="right" onClick={toggleDock}>
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={13} />
        </button>
      </div>
    </nav>
  );
}

