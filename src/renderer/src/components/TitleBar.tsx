import { useState } from 'react';
import type { PageInstance } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, modKey } from '../lib/ipc';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { SURFACES } from '../surfaces/meta';
import { IconButton, Menu, type MenuItem } from './ui';

export function TitleBar(): JSX.Element {
  const t = useT();
  const pages = useAppStore((s) => s.pages);
  const activePageId = useAppStore((s) => s.activePageId);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const closePage = useAppStore((s) => s.closePage);
  const navigate = useAppStore((s) => s.navigate);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const windowState = useAppStore((s) => s.windowState);
  const anchorOpen = useAppStore((s) => s.anchorOpen);
  const setAnchorOpen = useAppStore((s) => s.setAnchorOpen);
  const settings = useAppStore((s) => s.settings);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems: MenuItem[] = [
    { label: t('chat.newChat'), icon: 'message', onClick: () => navigate('chat', {}, { forceNew: true }) },
    { label: t('workspace.openFolder'), icon: 'folder-open', onClick: () => navigate('workspace') },
    { label: t('terminal.newTab'), icon: 'terminal', onClick: () => navigate('terminal') },
    { separator: true, label: '', onClick: () => {} },
    { label: t('settings.about'), icon: 'sparkles', onClick: () => { useAppStore.getState().setSettingsSection('about'); navigate('settings'); } },
    { label: t('menu.quit'), icon: 'power', danger: true, onClick: () => void invoke('app.quit', undefined) },
  ];

  return (
    <header className="titlebar drag">
      <div className="titlebar__brand no-drag" onClick={() => navigate('desktop')} role="button" tabIndex={0}>
        <BrandMark size={21} animated />
        <span className="titlebar__word display uppercase">
          Neuro<span className="titlebar__word-os">OS</span>
        </span>
        <span className="titlebar__ver mono">1.0</span>
      </div>

      <div className="titlebar__tabs no-drag">
        {pages.map((page) => (
          <PageTab
            key={page.id}
            page={page}
            active={page.id === activePageId}
            onSelect={() => setActivePage(page.id)}
            onClose={() => closePage(page.id)}
          />
        ))}
        <button type="button" className="titlebar__newtab" onClick={() => setCommandOpen(true)} aria-label="New tab">
          <Icon name="plus" size={13} />
        </button>
      </div>

      <div className="titlebar__actions no-drag">
        <button type="button" className="cmdbtn" onClick={() => setCommandOpen(true)}>
          <Icon name="search" size={13} />
          <span className="cmdbtn__label">{t('common.search')}</span>
          <span className="n-kbd">{modKey}</span>
          <span className="n-kbd">K</span>
        </button>

        <IconButton icon="anchor" label={t('anchor.title')} active={anchorOpen} onClick={() => setAnchorOpen(!anchorOpen)} />
        <div style={{ position: 'relative' }}>
          <IconButton icon="more" label="Menu" onClick={() => setMenuOpen(true)} />
          {menuOpen ? <Menu items={menuItems} onClose={() => setMenuOpen(false)} align="right" width={208} /> : null}
        </div>
        <div className="n-vdivider" style={{ height: 22, margin: '0 2px' }} />
        <div className="wincontrols">
          <button type="button" className="wincontrols__btn" aria-label="Minimize" onClick={() => void invoke('window.minimize', undefined)}>
            <Icon name="minus" size={13} />
          </button>
          <button
            type="button"
            className="wincontrols__btn"
            aria-label="Maximize"
            onClick={() => void invoke('window.maximize', undefined)}
          >
            <Icon name={windowState.maximized ? 'restore' : 'square'} size={11} />
          </button>
          <button type="button" className="wincontrols__btn wincontrols__btn--close" aria-label="Close" onClick={() => void invoke('window.close', undefined)}>
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>
      {settings ? <span className="sr-only">{settings.profile.name}</span> : null}
    </header>
  );
}

function PageTab({
  page,
  active,
  onSelect,
  onClose,
}: {
  page: PageInstance;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}): JSX.Element {
  const meta = SURFACES[page.surface];
  const t = useT();
  const title =
    page.surface === 'browser'
      ? page.title === 'Browser'
        ? 'Browser'
        : page.title
      : page.title === page.surface.charAt(0).toUpperCase() + page.surface.slice(1)
        ? t(meta.labelKey)
        : page.title;
  return (
    <div className="tab" data-active={active} onClick={onSelect} role="tab" tabIndex={0} onAuxClick={(event) => event.button === 1 && onClose()}>
      <span className="tab__icon" style={{ color: active ? meta.accent : undefined }}>
        <Icon name={meta.icon} size={13} />
      </span>
      <span className="tab__title truncate">{title}</span>
      {page.closable !== false ? (
        <button
          type="button"
          className="tab__close"
          aria-label="Close tab"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <Icon name="x" size={11} />
        </button>
      ) : null}
    </div>
  );
}

