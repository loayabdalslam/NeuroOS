import { useEffect, useMemo, useState } from 'react';
import type { AgentConfig, InstalledTheme, PermissionPolicy, PluginProviderEntry, ProviderConfig, Settings, ToolDescriptor } from '@shared/types';
import { LANGUAGES } from '@shared/i18n';
import { PROVIDER_PRESETS, presetToProvider } from '@shared/providers';
import { THEME_PRESETS, WALLPAPERS } from '@shared/themes';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, modKey } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { Icon } from '../components/Icon';
import { Flag } from '../components/Flag';
import { BrandMark } from '../components/BrandMark';
import { Button, Field, IconButton, Modal, Section, Segmented, Slider, Spinner, Switch, ToggleRow } from '../components/ui';

const SECTIONS = [
  { id: 'appearance', labelKey: 'settings.appearance', icon: 'palette' },
  { id: 'language', labelKey: 'settings.language', icon: 'languages' },
  { id: 'profile', labelKey: 'settings.profile', icon: 'user' },
  { id: 'providers', labelKey: 'settings.providers', icon: 'plug' },
  { id: 'agents', labelKey: 'settings.agents', icon: 'brain' },
  { id: 'tools', labelKey: 'settings.tools', icon: 'wrench' },
  { id: 'taskbar', labelKey: 'settings.taskbar', icon: 'panel-bottom' },
  { id: 'anchor', labelKey: 'settings.anchor', icon: 'pin' },
  { id: 'workspace', labelKey: 'settings.workspace', icon: 'folder' },
  { id: 'shortcuts', labelKey: 'settings.shortcuts', icon: 'keyboard' },
  { id: 'advanced', labelKey: 'settings.advanced', icon: 'sliders' },
  { id: 'about', labelKey: 'settings.about', icon: 'sparkles' },
];

const ACCENTS = [
  { id: 'neuro', color: '#5686fe' },
  { id: 'deepseek', color: '#4176e6' },
  { id: 'violet', color: '#a78bfa' },
  { id: 'teal', color: '#14b8a6' },
  { id: 'amber', color: '#f59e0b' },
];

export function SettingsSurface(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const tools = useAppStore((s) => s.tools);
  const info = useAppStore((s) => s.info);
  const section = useAppStore((s) => s.settingsSection);
  const setSection = useAppStore((s) => s.setSettingsSection);
  const patch = useAppStore((s) => s.patchSettings);
  const pushToast = useAppStore((s) => s.pushToast);
  const [providerModal, setProviderModal] = useState<ProviderConfig | null>(null);
  const [agentModal, setAgentModal] = useState<AgentConfig | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [pluginThemes, setPluginThemes] = useState<InstalledTheme[]>([]);
  const [pluginProviders, setPluginProviders] = useState<PluginProviderEntry[]>([]);

  useEffect(() => {
    void invoke('plugins.themes', undefined).then(setPluginThemes).catch(() => {});
    void invoke('plugins.providers', undefined).then(setPluginProviders).catch(() => {});
  }, []);

  if (!settings) return <div />;

  const update = (partial: Parameters<typeof patch>[0]): void => {
    void patch(partial).catch((error) => pushToast({ title: 'Update failed', message: (error as Error).message, kind: 'error' }));
  };

  return (
    <div className="settings">
      <aside className="settings__nav">
        <div className="settings__profile">
          <div className="settings__avatar">{(settings.profile.name || 'N').slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div className="small strong truncate">{settings.profile.name || 'Explorer'}</div>
            <div className="tiny faint truncate">{settings.profile.role || 'Set a role'}</div>
          </div>
        </div>
        <nav className="settings__navList">
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" data-active={section === item.id} onClick={() => setSection(item.id)}>
              <Icon name={item.icon} size={15} />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>
        <div className="settings__navFoot">
          <span className="tiny faint mono">neuro {info?.version ?? '1.0.0'}</span>
        </div>
      </aside>

      <div className="settings__main n-scroll">
        {section === 'appearance' ? (
          <>
            <SettingsHeader
              title={t('settings.appearance')}
              description="Choose a whole desktop language — or fine-tune it. Every change applies instantly across the OS."
            />
            <Section title="Theme gallery" description="Windows, Ubuntu, iOS or Neuro OS. Each preset also moves the taskbar and picks its wallpaper.">
              <div className="themeGrid">
                {THEME_PRESETS.map((preset) => {
                  const active =
                    settings.theme.design === preset.design &&
                    settings.theme.mode === preset.mode &&
                    settings.theme.surface === preset.surface;
                  const [bg, surface, accent, text] = preset.colors;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className="themeCard"
                      data-active={active}
                      onClick={() =>
                        update({
                          theme: {
                            design: preset.design,
                            mode: preset.mode,
                            surface: preset.surface,
                            accent: preset.accent,
                            radius: preset.radius,
                            density: preset.density,
                            transparency: preset.transparency,
                            glow: preset.glow,
                            wallpaper: preset.wallpaper,
                          },
                          taskbar: { position: preset.taskbar },
                        })
                      }
                    >
                      <div className="themeCard__preview" style={{ background: bg, borderRadius: preset.radius }}>
                        <div className="themeCard__bar" style={{ background: surface }}>
                          <span style={{ background: accent }} />
                          <span style={{ background: text, opacity: 0.35 }} />
                          <span style={{ background: text, opacity: 0.2 }} />
                        </div>
                        <div className="themeCard__body">
                          <div className="themeCard__side" style={{ background: surface }}>
                            <span style={{ background: accent, opacity: 0.9 }} />
                            <span style={{ background: text, opacity: 0.25 }} />
                            <span style={{ background: text, opacity: 0.25 }} />
                          </div>
                          <div className="themeCard__pane">
                            <span className="themeCard__title" style={{ background: text, opacity: 0.75 }} />
                            <span className="themeCard__line" style={{ background: text, opacity: 0.18 }} />
                            <span className="themeCard__line" style={{ background: text, opacity: 0.18, width: '64%' }} />
                            <span className="themeCard__pill" style={{ background: accent }} />
                          </div>
                        </div>
                      </div>
                      <div className="themeCard__meta">
                        <span className="small strong truncate">{preset.name}</span>
                        <span className="tiny faint">{preset.design === 'neuro' ? 'Neuro' : preset.design}</span>
                      </div>
                      <div className="themeCard__desc tiny faint">{preset.description}</div>
                      {active ? (
                        <span className="themeCard__check">
                          <Icon name="check" size={11} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Section>

            {pluginThemes.length ? (
              <Section title="Installed themes" description="Contributed by plugins in Marketplace → Extensions.">
                <div className="themeGrid themeGrid--plugins">
                  {pluginThemes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className="themeCard"
                      onClick={() =>
                        update({
                          theme: {
                            design: theme.design,
                            mode: theme.mode,
                            surface: theme.surface ?? 'standard',
                            accent: (theme.accent ?? 'neuro') as Settings['theme']['accent'],
                            radius: theme.radius ?? 14,
                            wallpaper: theme.wallpaper ?? settings.theme.wallpaper,
                          },
                        })
                      }
                    >
                      <div
                        className="themeCard__preview"
                        style={{ background: theme.colors?.bg ?? 'var(--n-bg)', borderRadius: theme.radius ?? 12 }}
                      >
                        <div className="themeCard__bar" style={{ background: theme.colors?.surface ?? 'var(--n-layer-1)' }}>
                          <span style={{ background: theme.colors?.accent ?? 'var(--n-accent)' }} />
                          <span style={{ background: theme.colors?.text ?? 'var(--n-text)', opacity: 0.35 }} />
                        </div>
                        <div className="themeCard__body">
                          <div className="themeCard__side" style={{ background: theme.colors?.surface ?? 'var(--n-layer-1)' }}>
                            <span style={{ background: theme.colors?.accent ?? 'var(--n-accent)' }} />
                            <span style={{ background: theme.colors?.text ?? 'var(--n-text)', opacity: 0.25 }} />
                          </div>
                          <div className="themeCard__pane">
                            <span className="themeCard__title" style={{ background: theme.colors?.text ?? 'var(--n-text)', opacity: 0.7 }} />
                            <span className="themeCard__line" style={{ background: theme.colors?.text ?? 'var(--n-text)', opacity: 0.2 }} />
                            <span className="themeCard__pill" style={{ background: theme.colors?.accent ?? 'var(--n-accent)' }} />
                          </div>
                        </div>
                      </div>
                      <div className="themeCard__meta">
                        <span className="small strong truncate">{theme.name}</span>
                        <span className="tiny faint">plugin</span>
                      </div>
                      <div className="themeCard__desc tiny faint">{theme.description ?? `From ${theme.pluginId}`}</div>
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section title="Design & mode" description="Mix any design with dark, light or system appearance.">
              <div className="settings__fieldRow">
                <span className="n-label">Design language</span>
                <Segmented
                  value={settings.theme.design}
                  onChange={(design) => update({ theme: { design } })}
                  options={[
                    { value: 'neuro', label: 'Neuro' },
                    { value: 'windows', label: 'Windows' },
                    { value: 'ubuntu', label: 'Ubuntu' },
                    { value: 'ios', label: 'iOS' },
                  ]}
                />
              </div>
              <div className="settings__fieldRow">
                <span className="n-label">{t('common.theme')}</span>
                <Segmented
                  value={settings.theme.mode}
                  onChange={(mode) => update({ theme: { mode } })}
                  options={[
                    { value: 'dark', label: t('common.dark'), icon: 'moon' },
                    { value: 'light', label: t('common.light'), icon: 'sun' },
                    { value: 'system', label: t('common.system'), icon: 'monitor' },
                  ]}
                />
              </div>
              <ToggleRow
                title="White theme"
                hint="Force pure-white surfaces — the highest-contrast light mode."
                on={settings.theme.surface === 'white'}
                onChange={(white) => update({ theme: { surface: white ? 'white' : 'standard' } })}
              />
              <div className="settings__fieldRow">
                <span className="n-label">{t('settings.accent')}</span>
                <div className="row" style={{ gap: 8 }}>
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      className="swatch"
                      data-active={settings.theme.accent === accent.id}
                      style={{ background: accent.color }}
                      onClick={() => update({ theme: { accent: accent.id as Settings['theme']['accent'] } })}
                      aria-label={accent.id}
                    />
                  ))}
                </div>
              </div>
            </Section>

            <Section title={t('settings.wallpaper')} description="Wallpapers follow the design language — pick any.">
              <div className="wallpaperGrid">
                {WALLPAPERS.map((wallpaper) => (
                  <button
                    key={wallpaper.id}
                    type="button"
                    className="wallpaperSwatch"
                    data-active={settings.theme.wallpaper === wallpaper.id}
                    data-wallpaper={wallpaper.id}
                    onClick={() => update({ theme: { wallpaper: wallpaper.id } })}
                  >
                    <span>{wallpaper.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Interface" description="Density, scale and surface treatment.">
              <div className="settings__fieldRow">
                <span className="n-label">{t('settings.density')}</span>
                <Segmented
                  value={settings.theme.density}
                  onChange={(density) => update({ theme: { density } })}
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                  ]}
                />
              </div>
              <div className="settings__sliderRow">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="n-label">{t('settings.radius')}</span>
                  <span className="mono tiny">{settings.theme.radius}px</span>
                </div>
                <Slider value={settings.theme.radius} min={2} max={26} onChange={(radius) => update({ theme: { radius } })} />
              </div>
              <div className="settings__sliderRow">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="n-label">{t('settings.fontScale')}</span>
                  <span className="mono tiny">{Math.round(settings.theme.fontScale * 100)}%</span>
                </div>
                <Slider value={settings.theme.fontScale} min={0.85} max={1.25} step={0.05} onChange={(fontScale) => update({ theme: { fontScale } })} />
              </div>
              <ToggleRow title={t('settings.transparency')} hint="Blur and translucency on chrome surfaces." on={settings.theme.transparency} onChange={(transparency) => update({ theme: { transparency } })} />
              <ToggleRow title={t('settings.glow')} hint="Ambient aurora behind the workspace." on={settings.theme.glow} onChange={(glow) => update({ theme: { glow } })} />
              <ToggleRow
                title={t('settings.motion')}
                hint="Reduced motion disables all non-essential animation."
                on={settings.theme.motion === 'reduced'}
                onChange={(reduced) => update({ theme: { motion: reduced ? 'reduced' : 'full' } })}
              />
            </Section>
          </>
        ) : null}

        {section === 'language' ? (
          <>
            <SettingsHeader title={t('settings.language')} description="Interface language, direction and regional formatting. Flags are vector — not emoji." />
            <Section title="Interface language" description="Right-to-left languages flip the entire layout.">
              <div className="settings__languages">
                {LANGUAGES.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    className="langRow"
                    data-active={settings.locale === language.code}
                    onClick={() => update({ locale: language.code })}
                  >
                    <Flag code={language.flag} size={26} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small">{language.nativeName}</div>
                      <div className="tiny faint">{language.name} · {language.region}</div>
                    </div>
                    <span className="mono tiny faint uppercase">{language.code}</span>
                    {language.dir === 'rtl' ? <span className="n-badge">RTL</span> : null}
                    {settings.locale === language.code ? <Icon name="check" size={14} style={{ color: 'var(--n-accent)' }} /> : null}
                  </button>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {section === 'profile' ? (
          <>
            <SettingsHeader title={t('settings.profile')} description="How the OS addresses you." />
            <Section title="Identity">
              <div className="settings__profileEdit">
                <div className="settings__avatar settings__avatar--lg">{(settings.profile.name || 'N').slice(0, 1).toUpperCase()}</div>
                <div className="col grow" style={{ gap: 12 }}>
                  <Field label="Name">
                    <input className="n-input" value={settings.profile.name} onChange={(event) => update({ profile: { name: event.target.value } })} />
                  </Field>
                  <Field label="Role">
                    <input className="n-input" value={settings.profile.role} onChange={(event) => update({ profile: { role: event.target.value } })} />
                  </Field>
                </div>
              </div>
            </Section>
            <Section title="Kernel identity">
              <div className="settings__kvGrid">
                <KV label="Profile dir" value={info?.userData ?? ''} mono />
                <KV label="Home" value={info?.home ?? ''} mono />
                <KV label="Platform" value={`${info?.platform} ${info?.arch}`} />
                <KV label="Shell" value={info?.shell ?? ''} />
              </div>
            </Section>
          </>
        ) : null}

        {section === 'providers' ? (
          <>
            <SettingsHeader
              title={t('settings.providers')}
              description="Bring any endpoint. Keys are encrypted with the OS keychain and never leave this machine."
              action={
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={() => setProviderModal(presetToProvider(PROVIDER_PRESETS[0]))}
                >
                  Add provider
                </Button>
              }
            />
            <div className="settings__providers">
              {settings.providers.length === 0 ? (
                <div className="settings__emptyCard">
                  <Icon name="plug" size={22} />
                  <div className="small strong">No providers connected</div>
                  <div className="tiny faint" style={{ maxWidth: 360, textAlign: 'center' }}>
                    Add DeepSeek, OpenAI, Anthropic, Gemini, a local Ollama server, or any ACP agent. Chat stays disabled until one is
                    connected.
                  </div>
                  <Button variant="primary" icon="plus" onClick={() => setProviderModal(presetToProvider(PROVIDER_PRESETS[0]))}>
                    Connect a provider
                  </Button>
                </div>
              ) : (
                settings.providers.map((provider) => (
                  <div key={provider.id} className="providerRow">
                    <span className="providerRow__dot" style={{ background: provider.color ?? 'var(--n-accent)' }} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="small strong">{provider.name}</span>
                        <span className="n-badge">{provider.kind}</span>
                        {provider.lastCheck ? (
                          <span className={`n-badge ${provider.lastCheck.ok ? 'n-badge--success' : 'n-badge--danger'}`}>
                            {provider.lastCheck.ok ? 'reachable' : 'error'}
                          </span>
                        ) : null}
                      </div>
                      <div className="tiny faint truncate">
                        {provider.baseUrl || provider.acp?.command || '—'} · {provider.models.length} models · key{' '}
                        {provider.apiKey ? '••••' : 'none'}
                      </div>
                      {provider.lastCheck && !provider.lastCheck.ok ? (
                        <div className="tiny errText truncate">{provider.lastCheck.message}</div>
                      ) : null}
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="zap"
                        onClick={async () => {
                          try {
                            const probe = await invoke('providers.probe', { id: provider.id });
                            pushToast({
                              title: probe.ok ? `${provider.name} reachable` : `${provider.name} failed`,
                              message: probe.message,
                              kind: probe.ok ? 'success' : 'error',
                            });
                            useAppStore.getState().setSettings(await invoke('settings.get', undefined));
                          } catch (error) {
                            pushToast({ title: 'Probe failed', message: (error as Error).message, kind: 'error' });
                          }
                        }}
                      >
                        Test
                      </Button>
                      <IconButton icon="pencil" label="Edit" onClick={() => setProviderModal(provider)} />
                      <IconButton
                        icon="trash"
                        label="Remove"
                        onClick={async () => {
                          await invoke('providers.remove', { id: provider.id });
                          useAppStore.getState().setSettings(await invoke('settings.get', undefined));
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}

        {section === 'agents' ? (
          <>
            <SettingsHeader
              title={t('settings.agents')}
              description="Agents are system prompts plus a tool allowlist. The active agent drives every new conversation."
              action={
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={() =>
                    setAgentModal({
                      id: `agent_${Date.now().toString(36)}`,
                      name: 'New agent',
                      description: '',
                      systemPrompt: 'You are a focused agent inside Neuro OS.\n\n',
                      temperature: 0.3,
                      maxSteps: 24,
                      tools: 'all',
                      color: '#4176e6',
                      icon: 'bot',
                    })
                  }
                >
                  New agent
                </Button>
              }
            />
            <div className="settings__agents">
              {settings.agents.map((agent) => (
                <div key={agent.id} className="agentRow" data-active={agent.id === settings.activeAgentId}>
                  <span className="agentRow__glyph" style={{ color: agent.color, background: `${agent.color}1f`, borderColor: `${agent.color}44` }}>
                    <Icon name={agent.icon} size={16} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="small strong">{agent.name}</span>
                      {agent.builtin ? <span className="n-badge">built-in</span> : null}
                      {agent.id === settings.activeAgentId ? <span className="n-badge n-badge--accent">active</span> : null}
                    </div>
                    <div className="tiny faint truncate">{agent.description}</div>
                    <div className="row" style={{ gap: 10, marginTop: 4 }}>
                      <span className="mono tiny faint">{agent.tools === 'all' ? 'all tools' : `${agent.tools.length} tools`}</span>
                      <span className="mono tiny faint">max {agent.maxSteps} steps</span>
                      <span className="mono tiny faint">t° {agent.temperature}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <Button variant={agent.id === settings.activeAgentId ? 'soft' : 'outline'} size="sm" onClick={() => update({ activeAgentId: agent.id })}>
                      {agent.id === settings.activeAgentId ? 'Active' : 'Use'}
                    </Button>
                    <IconButton icon="pencil" label="Edit" onClick={() => setAgentModal(agent)} />
                    {!agent.builtin ? (
                      <IconButton
                        icon="trash"
                        label="Delete"
                        onClick={async () => {
                          await invoke('agents.remove', { id: agent.id });
                          useAppStore.getState().setSettings(await invoke('settings.get', undefined));
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {section === 'tools' ? <ToolsSection tools={tools} settings={settings} onChange={(policies) => update({ toolPolicies: policies })} /> : null}

        {section === 'taskbar' ? (
          <>
            <SettingsHeader title={t('settings.taskbar')} description="Position, size and what the bar shows." />
            <Section title="Placement">
              <div className="settings__fieldRow">
                <span className="n-label">Position</span>
                <Segmented
                  value={settings.taskbar.position}
                  onChange={(position) => update({ taskbar: { position } })}
                  options={[
                    { value: 'bottom', label: 'Bottom' },
                    { value: 'top', label: 'Top' },
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                  ]}
                />
              </div>
              <div className="settings__fieldRow">
                <span className="n-label">Size</span>
                <Segmented
                  value={settings.taskbar.size}
                  onChange={(size) => update({ taskbar: { size } })}
                  options={[
                    { value: 'sm', label: 'S' },
                    { value: 'md', label: 'M' },
                    { value: 'lg', label: 'L' },
                  ]}
                />
              </div>
              <ToggleRow title="Show labels" hint="Show text next to pinned icons." on={settings.taskbar.showLabels} onChange={(showLabels) => update({ taskbar: { showLabels } })} />
              <ToggleRow title="24-hour clock" on={settings.taskbar.clock24h} onChange={(clock24h) => update({ taskbar: { clock24h } })} />
              <ToggleRow title="System stats" hint="Live CPU and memory meters." on={settings.taskbar.showSystemStats} onChange={(showSystemStats) => update({ taskbar: { showSystemStats } })} />
              <ToggleRow title="Language indicator" on={settings.taskbar.showLanguage} onChange={(showLanguage) => update({ taskbar: { showLanguage } })} />
            </Section>
            <Section title="Pinned apps" description="Click to pin or unpin from the taskbar.">
              <div className="settings__pinGrid">
                {(['desktop', 'chat', 'workspace', 'space', 'notebook', 'browser', 'terminal', 'mail', 'automation', 'composer', 'marketplace', 'settings'] as const).map((surface) => {
                  const pinned = settings.taskbar.pinned.includes(surface);
                  return (
                    <button
                      key={surface}
                      type="button"
                      className="n-chip"
                      data-active={pinned}
                      onClick={() =>
                        update({
                          taskbar: {
                            pinned: pinned ? settings.taskbar.pinned.filter((id) => id !== surface) : [...settings.taskbar.pinned, surface],
                          },
                        })
                      }
                    >
                      <Icon name={pinned ? 'check' : 'plus'} size={11} />
                      {surface}
                    </button>
                  );
                })}
              </div>
            </Section>
          </>
        ) : null}

        {section === 'anchor' ? (
          <>
            <SettingsHeader title={t('settings.anchor')} description="A persistent rail for the things you keep reaching for." />
            <Section title="Behaviour">
              <ToggleRow title="Enable Anchor" on={settings.anchor.enabled} onChange={(enabled) => update({ anchor: { enabled } })} />
              <div className="settings__fieldRow">
                <span className="n-label">Side</span>
                <Segmented
                  value={settings.anchor.side}
                  onChange={(side) => update({ anchor: { side } })}
                  options={[
                    { value: 'right', label: 'Right' },
                    { value: 'left', label: 'Left' },
                  ]}
                />
              </div>
              <div className="settings__sliderRow">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="n-label">Width</span>
                  <span className="mono tiny">{settings.anchor.width}px</span>
                </div>
                <Slider value={settings.anchor.width} min={260} max={420} step={4} onChange={(width) => update({ anchor: { width } })} />
              </div>
            </Section>
            <Section title="Pinned" description="Everything currently anchored.">
              {settings.anchor.pins.length === 0 ? (
                <div className="tiny faint">Nothing pinned. Pin a conversation, note, file or link from any surface.</div>
              ) : (
                <div className="col" style={{ gap: 6 }}>
                  {settings.anchor.pins.map((pin) => (
                    <div key={pin.id} className="anchorRow">
                      <Icon name="pin" size={12} className="faint" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="small truncate">{pin.label}</div>
                        <div className="tiny faint truncate">{pin.kind} · {pin.ref}</div>
                      </div>
                      <span className="tiny faint">{relativeTime(new Date().toISOString())}</span>
                      <IconButton
                        icon="x"
                        label="Unpin"
                        onClick={() => update({ anchor: { ...settings.anchor, pins: settings.anchor.pins.filter((item) => item.id !== pin.id) } })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : null}

        {section === 'workspace' ? (
          <>
            <SettingsHeader title={t('settings.workspace')} description="The folder every file tool is scoped to." />
            <Section title="Active workspace">
              <div className="settings__pathRow">
                <Icon name="folder" size={15} style={{ color: 'var(--n-accent)' }} />
                <span className="mono small truncate grow">{settings.workspaceRoot || 'Not set'}</span>
                <Button
                  variant="outline"
                  size="sm"
                  icon="folder-open"
                  onClick={async () => {
                    const result = await invoke('system.pickDirectory', { title: 'Select workspace' });
                    if (result.path) update({ workspaceRoot: result.path, recentWorkspaces: [result.path, ...settings.recentWorkspaces.filter((item) => item !== result.path)].slice(0, 6) });
                  }}
                >
                  Change
                </Button>
                <IconButton icon="folder-open" label="Reveal" onClick={() => void invoke('fs.reveal', { path: settings.workspaceRoot })} />
              </div>
            </Section>
            <Section title="Recent">
              <div className="col" style={{ gap: 4 }}>
                {settings.recentWorkspaces.map((recent) => (
                  <button key={recent} type="button" className="settings__recent" onClick={() => update({ workspaceRoot: recent })}>
                    <Icon name="history" size={13} />
                    <span className="mono tiny truncate grow">{recent}</span>
                    {recent === settings.workspaceRoot ? <Icon name="check" size={12} style={{ color: 'var(--n-accent)' }} /> : null}
                  </button>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {section === 'shortcuts' ? (
          <>
            <SettingsHeader title={t('settings.shortcuts')} description="Keyboard-first, everywhere." />
            <Section title="Global">
              <div className="settings__shortcuts">
                {[
                  [modKey, 'K', 'Command palette'],
                  [modKey, 'J', 'Toggle Anchor'],
                  [modKey, 'B', 'Toggle dock'],
                  [modKey, '`', 'Terminal'],
                  [modKey, ',', 'Settings'],
                  [modKey, '⇧', 'N', 'New conversation'],
                  [modKey, '1–9', 'Switch tab'],
                ].map((keys) => (
                  <div key={keys.join('')} className="shortcutRow">
                    <div className="row" style={{ gap: 4 }}>
                      {keys.slice(0, -1).map((key) => (
                        <span key={key} className="n-kbd">{key}</span>
                      ))}
                    </div>
                    <span className="small">{keys[keys.length - 1]}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Editor">
              <div className="settings__shortcuts">
                {[
                  [modKey, 'S', 'Save file'],
                  [modKey, 'F', 'Find in file'],
                  [modKey, 'Z', 'Undo'],
                  ['Ctrl', '↵', 'Run notebook cell'],
                ].map((keys) => (
                  <div key={keys.join('')} className="shortcutRow">
                    <div className="row" style={{ gap: 4 }}>
                      {keys.slice(0, -1).map((key) => (
                        <span key={key} className="n-kbd">{key}</span>
                      ))}
                    </div>
                    <span className="small">{keys[keys.length - 1]}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {section === 'advanced' ? (
          <>
            <SettingsHeader title={t('settings.advanced')} description="Escape hatches and data ownership." />
            <Section title="Developer">
              <ToggleRow title="Developer mode" hint="Expose extra diagnostics in the kernel status and logs." on={settings.developerMode} onChange={(developerMode) => update({ developerMode })} />
              <ToggleRow title="Telemetry" hint="Off by default. Neuro OS never phones home." on={settings.telemetry} onChange={(telemetry) => update({ telemetry })} />
            </Section>
            <Section title="Data" description="State lives in readable JSON under the profile directory.">
              <div className="row wrap" style={{ gap: 8 }}>
                <Button variant="outline" icon="folder-open" onClick={() => void invoke('app.openDataFolder', undefined)}>Open data folder</Button>
                <Button variant="outline" icon="download" onClick={() => void invoke('settings.export', undefined).then((result) => result.path && pushToast({ title: 'Settings exported', message: result.path, kind: 'success' }))}>
                  Export settings
                </Button>
                <Button variant="outline" icon="upload" onClick={() => void invoke('settings.import', undefined).then((next) => next && useAppStore.getState().setSettings(next))}>
                  Import settings
                </Button>
                <Button variant="outline" icon="power" onClick={() => void invoke('app.quit', undefined)}>Quit Neuro OS</Button>
              </div>
            </Section>
            <Section title={t('settings.danger')}>
              <div className="dangerBox">
                <div>
                  <div className="small strong">Reset all settings</div>
                  <div className="tiny faint">Providers, agents, pins and layout return to defaults. Files are untouched.</div>
                </div>
                <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>Reset</Button>
              </div>
            </Section>
          </>
        ) : null}

        {section === 'about' ? (
          <>
            <div className="about">
              <BrandMark size={56} animated />
              <div>
                <div className="about__name display">Neuro OS</div>
                <div className="tiny faint mono">version {info?.version} · build 2026.11</div>
              </div>
            </div>
            <Section title="Runtime">
              <div className="settings__kvGrid">
                <KV label="Electron" value={info?.electron ?? ''} />
                <KV label="Chromium" value={info?.chrome ?? ''} />
                <KV label="Node" value={info?.node ?? ''} />
                <KV label="V8" value={info?.v8 ?? ''} />
                <KV label="Platform" value={`${info?.platform} ${info?.arch}`} />
                <KV label="Terminal" value={info?.ptyAvailable ? 'native PTY (ConPTY)' : 'pipe fallback'} />
              </div>
            </Section>
            <Section title="Design">
              <p className="small muted" style={{ lineHeight: 1.7 }}>
                Built on the DeepSeek Harness design language — neutral-bluish surfaces, DeepSeek blue, Montserrat wordmark. The token
                layer maps the DSH palette onto semantic surface, elevation and motion scales so every surface stays coherent.
              </p>
            </Section>
            <Section title="Credits">
              <div className="col" style={{ gap: 6 }}>
                {[
                  ['DeepSeek Harness', 'design language, palette and typography'],
                  ['Agent Client Protocol', 'stdio agent protocol v1'],
                  ['CodeMirror 6', 'editor engine'],
                  ['xterm.js', 'terminal renderer'],
                  ['Lucide', 'icon set'],
                  ['Electron + React', 'runtime'],
                ].map(([name, role]) => (
                  <div key={name} className="row" style={{ gap: 8 }}>
                    <span className="small strong" style={{ width: 180 }}>{name}</span>
                    <span className="tiny faint">{role}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : null}
      </div>

      <ProviderModal provider={providerModal} onClose={() => setProviderModal(null)} pluginProviders={pluginProviders} />
      <AgentModal agent={agentModal} onClose={() => setAgentModal(null)} tools={tools} />
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Neuro OS?"
        description="This clears settings, providers, agents and pins. Workspace files are never touched."
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                const next = await invoke('settings.reset', undefined);
                useAppStore.getState().setSettings(next);
                setResetOpen(false);
                pushToast({ title: 'Settings reset', kind: 'success' });
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <div className="tiny faint">You will be returned to onboarding on next launch.</div>
      </Modal>
    </div>
  );
}

function SettingsHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }): JSX.Element {
  return (
    <header className="settings__header">
      <div>
        <h1 className="settings__title display">{title}</h1>
        {description ? <p className="small muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="kvRow">
      <span className="tiny faint uppercase">{label}</span>
      <span className={`tiny truncate ${mono ? 'mono' : ''}`} title={value}>{value}</span>
    </div>
  );
}

function ToolsSection({ tools, settings, onChange }: { tools: ToolDescriptor[]; settings: Settings; onChange: (policies: Record<string, PermissionPolicy>) => void }): JSX.Element {
  const t = useT();
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => {
    const map = new Map<string, ToolDescriptor[]>();
    for (const tool of tools) {
      if (filter && !`${tool.name} ${tool.title}`.toLowerCase().includes(filter.toLowerCase())) continue;
      const list = map.get(tool.category) ?? [];
      list.push(tool);
      map.set(tool.category, list);
    }
    return [...map.entries()];
  }, [tools, filter]);

  const policy = (name: string): PermissionPolicy => (settings.toolPolicies[name] as PermissionPolicy) ?? ((settings.toolPolicies.default as PermissionPolicy) ?? 'ask');

  const setPolicy = (name: string, value: PermissionPolicy): void => {
    onChange({ ...settings.toolPolicies, [name]: value });
  };

  return (
    <>
      <SettingsHeader
        title={t('settings.tools')}
        description="Full control over tool calling. Every tool has an explicit policy: auto runs it, ask requires approval, deny blocks it."
        action={
          <div className="mkt__search">
            <Icon name="search" size={13} className="faint" />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter tools" />
          </div>
        }
      />
      <Section title="Default policy" description="Applies to any tool without an explicit override.">
        <Segmented
          value={((settings.toolPolicies.default as PermissionPolicy) ?? 'ask')}
          onChange={(value) => onChange({ ...settings.toolPolicies, default: value })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'ask', label: 'Ask' },
            { value: 'deny', label: 'Deny' },
          ]}
        />
      </Section>
      {groups.map(([category, list]) => (
        <Section key={category} title={category} description={`${list.length} tools`}>
          <div className="toolTable">
            {list.map((tool) => (
              <div key={tool.name} className="toolRow">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="mono small">{tool.name}</span>
                    <span className={`n-badge n-badge--${tool.danger === 'high' ? 'danger' : tool.danger === 'medium' ? 'warn' : 'default'}`}>
                      {tool.danger}
                    </span>
                    {tool.source !== 'builtin' ? <span className="n-badge n-badge--accent">{tool.source}</span> : null}
                  </div>
                  <div className="tiny faint truncate">{tool.description}</div>
                </div>
                <Segmented
                  value={policy(tool.name)}
                  onChange={(value) => setPolicy(tool.name, value)}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'ask', label: 'Ask' },
                    { value: 'deny', label: 'Deny' },
                  ]}
                />
              </div>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

function ProviderModal({
  provider,
  onClose,
  pluginProviders,
}: {
  provider: ProviderConfig | null;
  onClose: () => void;
  pluginProviders: PluginProviderEntry[];
}): JSX.Element | null {
  const pushToast = useAppStore((s) => s.pushToast);
  const [draft, setDraft] = useState<ProviderConfig | null>(provider);
  const [modelsText, setModelsText] = useState('');
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<{ ok: boolean; message: string } | null>(null);
  const [step, setStep] = useState<'pick' | 'configure'>(provider ? 'configure' : 'pick');

  useEffect(() => {
    setDraft(provider);
    setModelsText(provider?.models.map((model) => model.id).join(', ') ?? '');
    setProbe(null);
    setStep(provider ? 'configure' : 'pick');
  }, [provider]);

  if (!provider || !draft) return null;

  const save = async (): Promise<void> => {
    const models = modelsText
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => ({ id, label: id, supportsTools: true }));
    const next: ProviderConfig = {
      ...draft,
      models: models.length ? models : draft.models,
      defaultModel: models[0]?.id ?? draft.defaultModel,
      createdAt: draft.createdAt ?? new Date().toISOString(),
    };
    await invoke('providers.save', next);
    useAppStore.getState().setSettings(await invoke('settings.get', undefined));
    onClose();
    pushToast({ title: `${next.name} saved`, kind: 'success' });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={step === 'pick' ? 'Add a provider' : `Configure ${draft.name}`}
      description={step === 'pick' ? 'Pick a preset — every field stays editable.' : 'Keys are encrypted with the OS keychain.'}
      width={640}
      footer={
        step === 'pick' ? (
          <Button onClick={onClose}>Cancel</Button>
        ) : (
          <>
            <Button onClick={() => setStep('pick')}>Back</Button>
            <span className="grow" />
            <Button
              variant="outline"
              icon="zap"
              disabled={probing}
              onClick={async () => {
                setProbing(true);
                try {
                  const result = await invoke('providers.probeDraft', draft);
                  setProbe({ ok: result.ok, message: `${result.message} · ${result.latencyMs}ms` });
                } catch (error) {
                  setProbe({ ok: false, message: (error as Error).message });
                } finally {
                  setProbing(false);
                }
              }}
            >
              {probing ? <Spinner size={13} /> : null} Test
            </Button>
            <Button variant="primary" icon="save" onClick={() => void save()}>
              Save provider
            </Button>
          </>
        )
      }
    >
      {step === 'pick' ? (
        <div className="providerGrid">
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="providerPick"
              onClick={() => {
                setDraft(presetToProvider(preset));
                setModelsText(preset.models.map((model) => model.id).join(', '));
                setStep('configure');
              }}
            >
              <span className="providerCard__dot" style={{ background: preset.color }} />
              <div style={{ minWidth: 0 }}>
                <div className="small strong">{preset.name}</div>
                <div className="tiny faint">{preset.description}</div>
              </div>
            </button>
          ))}
          {pluginProviders.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="providerPick"
              onClick={() => {
                const models = (entry.models.length ? entry.models : ['default']).map((id) => ({ id, label: id, supportsTools: true }));
                setDraft({
                  id: entry.id,
                  name: `${entry.pluginName} · ${entry.name}`,
                  kind: entry.kind === 'adapter' ? 'custom' : 'openai',
                  baseUrl: entry.kind === 'adapter' ? `plugin://${entry.id}` : (entry.baseUrl ?? ''),
                  apiKey: '',
                  enabled: true,
                  models,
                  defaultModel: models[0].id,
                  color: '#a78bfa',
                  createdAt: new Date().toISOString(),
                });
                setModelsText(models.map((model) => model.id).join(', '));
                setStep('configure');
              }}
            >
              <span className="providerCard__dot" style={{ background: '#a78bfa' }} />
              <div style={{ minWidth: 0 }}>
                <div className="small strong">{entry.name}</div>
                <div className="tiny faint">
                  plugin · {entry.pluginName} {entry.kind === 'adapter' ? '(streaming adapter)' : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="col" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <Field label="Display name">
              <input className="n-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </Field>
            <Field label="Kind">
              <select className="n-select" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as ProviderConfig['kind'] })}>
                {['openai', 'anthropic', 'gemini', 'ollama', 'custom', 'acp'].map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
            </Field>
          </div>
          {draft.kind === 'acp' ? (
            <>
              <Field label="Agent command" hint="Spawned over stdio. The client negotiates ACP v1, sessions, fs and terminal capabilities.">
                <input className="n-input n-input--mono" value={draft.acp?.command ?? ''} onChange={(event) => setDraft({ ...draft, acp: { command: event.target.value, args: draft.acp?.args ?? [] } })} placeholder="npx" />
              </Field>
              <Field label="Arguments" hint="Space separated.">
                <input
                  className="n-input n-input--mono"
                  value={(draft.acp?.args ?? []).join(' ')}
                  onChange={(event) => setDraft({ ...draft, acp: { command: draft.acp?.command ?? '', args: event.target.value.split(/\s+/).filter(Boolean) } })}
                  placeholder="-y @google/gemini-cli --experimental-acp"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Base URL" hint="OpenAI-compatible endpoints should end with /v1.">
                <input className="n-input n-input--mono" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
              </Field>
              <Field label="API key" hint={draft.apiKey ? 'Stored encrypted — replace to rotate.' : 'Paste the key. It never leaves this machine.'}>
                <input className="n-input n-input--mono" type="password" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} />
              </Field>
              <Field label="Models" hint="Comma separated model ids.">
                <input className="n-input n-input--mono" value={modelsText} onChange={(event) => setModelsText(event.target.value)} />
              </Field>
            </>
          )}
          {probe ? <div className={`tiny ${probe.ok ? 'okText' : 'errText'}`}>{probe.ok ? '● ' : '× '}{probe.message}</div> : null}
        </div>
      )}
    </Modal>
  );
}

function AgentModal({ agent, onClose, tools }: { agent: AgentConfig | null; onClose: () => void; tools: ToolDescriptor[] }): JSX.Element | null {
  const [draft, setDraft] = useState<AgentConfig | null>(agent);

  useEffect(() => setDraft(agent), [agent]);

  if (!agent || !draft) return null;
  const allTools = draft.tools === 'all';

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${draft.name}`}
      description="System prompt, sampling and the exact tool allowlist."
      width={720}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <span className="grow" />
          <Button
            variant="primary"
            icon="save"
            onClick={async () => {
              await invoke('agents.save', draft);
              useAppStore.getState().setSettings(await invoke('settings.get', undefined));
              onClose();
            }}
          >
            Save agent
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <Field label="Name">
            <input className="n-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="Accent">
            <input className="n-input n-input--mono" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <input className="n-input" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </Field>
        <Field label="System prompt" hint="The agent's operating contract. Be explicit about verification and boundaries.">
          <textarea className="n-input n-textarea n-textarea--mono" rows={8} value={draft.systemPrompt} onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })} />
        </Field>
        <div className="row" style={{ gap: 18 }}>
          <div className="grow">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="n-label">Temperature</span>
              <span className="mono tiny">{draft.temperature.toFixed(2)}</span>
            </div>
            <Slider value={draft.temperature} min={0} max={1} step={0.05} onChange={(temperature) => setDraft({ ...draft, temperature })} />
          </div>
          <div className="grow">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="n-label">Max steps</span>
              <span className="mono tiny">{draft.maxSteps}</span>
            </div>
            <Slider value={draft.maxSteps} min={1} max={60} onChange={(maxSteps) => setDraft({ ...draft, maxSteps })} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="n-label">Tools</span>
          <label className="row" style={{ gap: 6 }}>
            <span className="tiny faint">all tools</span>
            <Switch on={allTools} onChange={(next) => setDraft({ ...draft, tools: next ? 'all' : tools.map((tool) => tool.name) })} />
          </label>
        </div>
        {!allTools ? (
          <div className="agentToolGrid n-scroll">
            {tools.map((tool) => {
              const enabled = (draft.tools as string[]).includes(tool.name);
              return (
                <button
                  key={tool.name}
                  type="button"
                  className="n-chip"
                  data-active={enabled}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      tools: enabled ? (draft.tools as string[]).filter((name) => name !== tool.name) : [...(draft.tools as string[]), tool.name],
                    })
                  }
                >
                  <Icon name={enabled ? 'check' : 'plus'} size={10} />
                  <span className="mono tiny">{tool.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
