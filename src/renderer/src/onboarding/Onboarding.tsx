import { useEffect, useMemo, useState } from 'react';
import type { ProviderConfig } from '@shared/types';
import { LANGUAGES } from '@shared/i18n';
import { PROVIDER_PRESETS, presetToProvider, type ProviderPreset } from '@shared/providers';
import { THEME_PRESETS } from '@shared/themes';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { BrandMark } from '../components/BrandMark';
import { Flag } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Button, Spinner } from '../components/ui';

type Step = 'welcome' | 'language' | 'profile' | 'appearance' | 'intelligence' | 'workspace' | 'ready';
const STEPS: Step[] = ['welcome', 'language', 'profile', 'appearance', 'intelligence', 'workspace', 'ready'];

const ACCENTS = [
  { id: 'neuro', color: '#5686fe', label: 'Neuro' },
  { id: 'deepseek', color: '#4176e6', label: 'DeepSeek' },
  { id: 'violet', color: '#a78bfa', label: 'Violet' },
  { id: 'teal', color: '#14b8a6', label: 'Teal' },
  { id: 'amber', color: '#f59e0b', label: 'Amber' },
];

export function Onboarding(): JSX.Element {
  const t = useT();
  const setSettings = useAppStore((s) => s.setSettings);
  const [step, setStep] = useState<Step>('welcome');
  const [locale, setLocale] = useState('en');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [design, setDesign] = useState<'neuro' | 'windows' | 'ubuntu' | 'ios'>('neuro');
  const [white, setWhite] = useState(false);
  const [accent, setAccent] = useState('neuro');
  const [preset, setPreset] = useState<ProviderPreset | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const language = LANGUAGES.find((item) => item.code === locale) ?? LANGUAGES[0];
  const index = STEPS.indexOf(step);
  const progress = ((index + 1) / STEPS.length) * 100;

  /* Locale + theme preview applies instantly to the onboarding itself. */
  useEffect(() => {
    const root = document.documentElement;
    root.lang = language.code;
    root.dir = language.dir;
    root.dataset.theme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    root.dataset.accent = accent;
    root.dataset.design = design;
    root.dataset.surface = white ? 'white' : 'standard';
    const preset = THEME_PRESETS.find((item) => item.design === design && item.mode === (theme === 'system' ? 'dark' : theme));
    root.dataset.wallpaper = preset?.wallpaper ?? (white ? 'paper' : 'nebula');
  }, [language, theme, accent, design, white]);

  const next = (): void => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]);
  const back = (): void => setStep(STEPS[Math.max(0, index - 1)]);

  const draftProvider = useMemo<ProviderConfig | null>(() => {
    if (!preset) return null;
    const provider = presetToProvider(preset, apiKey);
    if (baseUrl.trim()) provider.baseUrl = baseUrl.trim();
    return provider;
  }, [preset, apiKey, baseUrl]);

  const testConnection = async (): Promise<void> => {
    if (!draftProvider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke('providers.probeDraft', draftProvider);
      setTestResult({ ok: result.ok, message: result.ok ? `${result.message} · ${result.latencyMs}ms` : result.message });
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const pickFolder = async (): Promise<void> => {
    const result = await invoke('system.pickDirectory', { title: t('onboarding.selectFolder') });
    if (result.path) setWorkspace(result.path);
  };

  const finish = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const provider = draftProvider && (apiKey.trim() || preset?.local) ? draftProvider : null;
      const settings = await invoke('onboarding.complete', {
        locale,
        name: name.trim(),
        role: role.trim(),
        theme,
        accent,
        design,
        surface: white ? 'white' : 'standard',
        workspaceRoot: workspace,
        provider,
      });
      setSettings(settings);
      document.body.dataset.neuroReady = '1';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const canContinue = (): boolean => {
    if (step === 'profile') return name.trim().length > 0;
    return true;
  };

  return (
    <div className="onboard" data-step={step}>
      <div className="onboard__stage" aria-hidden>
        <div className="n-aurora">
          <span />
          <span />
          <span />
        </div>
        <div className="n-grid-bg" />
        <div className="onboard__orbit">
          <span className="onboard__ring onboard__ring--1" />
          <span className="onboard__ring onboard__ring--2" />
          <span className="onboard__ring onboard__ring--3" />
          <span className="onboard__core">
            <BrandMark size={64} animated />
          </span>
          {['message', 'files', 'terminal', 'globe', 'notebook-pen', 'package'].map((icon, i) => (
            <span key={icon} className={`onboard__satellite onboard__satellite--${i + 1}`}>
              <Icon name={icon} size={14} />
            </span>
          ))}
        </div>
        <div className="onboard__vignette" />
      </div>

      <header className="onboard__top">
        <div className="onboard__brand">
          <BrandMark size={22} />
          <span className="display uppercase">Neuro<span style={{ color: 'var(--n-accent)' }}>OS</span></span>
          <span className="n-badge">1.0</span>
        </div>
        <div className="onboard__steps">
          {STEPS.map((item, i) => (
            <button
              key={item}
              type="button"
              className="onboard__step"
              data-active={i === index}
              data-done={i < index}
              onClick={() => i <= index && setStep(item)}
              aria-label={item}
            />
          ))}
          <span className="onboard__progress">
            <span style={{ width: `${progress}%` }} />
          </span>
        </div>
        <div className="onboard__topRight">
          <span className="tiny faint mono uppercase">
            {t('onboarding.step')} {index + 1} / {STEPS.length}
          </span>
          {step !== 'welcome' && step !== 'ready' ? (
            <button type="button" className="onboard__skip" onClick={finish} disabled={busy}>
              {t('common.skip')}
            </button>
          ) : null}
        </div>
      </header>

      <main className="onboard__main">
        <div className="onboard__copy" key={`${step}-copy`}>
          <div className="onboard__eyebrow mono uppercase">
            <span className="onboard__pulse" />
            {step === 'welcome' ? 'system online' : `${t('onboarding.step')} ${index + 1}`}
          </div>
          <h1 className="onboard__title display">
            {step === 'welcome' ? t('onboarding.welcome') : null}
            {step === 'language' ? t('onboarding.chooseLanguage') : null}
            {step === 'profile' ? t('onboarding.yourName') : null}
            {step === 'appearance' ? t('onboarding.appearance') : null}
            {step === 'intelligence' ? t('onboarding.connectProvider') : null}
            {step === 'workspace' ? t('onboarding.chooseWorkspace') : null}
            {step === 'ready' ? t('onboarding.ready') : null}
          </h1>
          <p className="onboard__sub">
            {step === 'welcome' ? t('onboarding.tagline') : null}
            {step === 'language' ? t('onboarding.languageHint') : null}
            {step === 'profile' ? t('onboarding.yourRole') : null}
            {step === 'appearance' ? 'Theme, accent and density are live — the whole OS updates as you choose.' : null}
            {step === 'intelligence' ? t('onboarding.providerHint') : null}
            {step === 'workspace' ? 'Neuro reads and writes real files. Pick a folder, or start with a generated demo workspace.' : null}
            {step === 'ready' ? `Everything is wired, ${name.trim() || 'explorer'}. Your kernel, tools and surfaces are ready.` : null}
          </p>

          {step === 'welcome' ? (
            <div className="onboard__facts">
              <Fact icon="brain" title="One agent, every surface" body="Chat, files, browser, terminal and notebooks share a single tool bus." />
              <Fact icon="plug" title="Any provider, any protocol" body="OpenAI-compatible APIs, Anthropic, Gemini, Ollama, or ACP agents over stdio." />
              <Fact icon="shield" title="Local-first by design" body="Keys are encrypted with your OS keychain. State is readable JSON on disk." />
            </div>
          ) : null}

          {step === 'profile' ? (
            <div className="onboard__profile">
              <div className="onboard__avatar" style={{ ['--hue' as string]: name.length * 12 }}>
                {(name.trim()[0] ?? 'N').toUpperCase()}
              </div>
              <div className="onboard__fields">
                <label className="n-field">
                  <span className="n-label">{t('onboarding.yourName')}</span>
                  <input
                    className="n-input n-input--lg"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('onboarding.namePlaceholder')}
                    autoFocus
                    maxLength={40}
                  />
                </label>
                <label className="n-field">
                  <span className="n-label">{t('onboarding.yourRole')}</span>
                  <input
                    className="n-input n-input--lg"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder={t('onboarding.rolePlaceholder')}
                    maxLength={60}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="onboard__panel" key={step}>
          {step === 'profile' ? (
            <div className="onboard__profileCard">
              <div className="onboard__profileAvatar" style={{ ['--hue' as string]: name.length * 12 }}>
                {(name.trim()[0] ?? 'N').toUpperCase()}
              </div>
              <div className="onboard__profileName display">{name.trim() || 'Your name'}</div>
              <div className="onboard__profileRole">{role.trim() || 'What you build'}</div>
              <div className="onboard__profileChips">
                <span className="n-chip">
                  <Flag code={language.flag} size={13} /> {language.nativeName}
                </span>
                <span className="n-chip">
                  <Icon name="palette" size={11} /> {design === 'neuro' ? 'Neuro' : design}
                </span>
                <span className="n-chip">
                  <Icon name="lock" size={11} /> local-first
                </span>
              </div>
              <div className="onboard__profileNote">
                Your profile is a plain JSON file on this machine. Neuro OS never uploads it, and you can edit or delete it at any
                time.
              </div>
              <div className="onboard__profileQuote">
                “An operating system should know how you work — and never phone home about it.”
              </div>
            </div>
          ) : null}

          {step === 'welcome' ? (
            <div className="onboard__welcomeCard">
              <div className="onboard__welcomeHead">
                <span className="n-badge n-badge--accent">v1.0 · kernel ready</span>
                <span className="tiny faint mono">build 2026.11</span>
              </div>
              <div className="onboard__terminalPreview mono">
                <div className="onboard__terminalBar">
                  <span className="n-dot n-dot--offline" />
                  <span className="n-dot n-dot--warn" />
                  <span className="n-dot n-dot--online" />
                  <span className="tiny faint">neuro@kernel — shell</span>
                </div>
                <div className="onboard__terminalBody">
                  <div><span className="prompt">❯</span> neuro status</div>
                  <div className="ok">✔ 36 tools online · 6 surfaces mounted · 0 pending approvals</div>
                  <div><span className="prompt">❯</span> neuro providers</div>
                  <div className="dim">deepseek · anthropic · gemini · ollama · acp · custom</div>
                  <div><span className="prompt">❯</span> <span className="caret" /></div>
                </div>
              </div>
              <div className="onboard__welcomeStats">
                <div><span className="mono big">36</span><span className="tiny faint uppercase">tools</span></div>
                <div><span className="mono big">9</span><span className="tiny faint uppercase">surfaces</span></div>
                <div><span className="mono big">14</span><span className="tiny faint uppercase">languages</span></div>
                <div><span className="mono big">∞</span><span className="tiny faint uppercase">spaces</span></div>
              </div>
            </div>
          ) : null}

          {step === 'language' ? (
            <div className="onboard__languages n-scroll">
              {LANGUAGES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className="langcard"
                  data-active={locale === item.code}
                  onClick={() => setLocale(item.code)}
                >
                  <Flag code={item.flag} size={30} radius={4} title={item.name} />
                  <span className="langcard__native">{item.nativeName}</span>
                  <span className="langcard__region tiny">{item.region}</span>
                  {locale === item.code ? (
                    <span className="langcard__check">
                      <Icon name="check" size={11} />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {step === 'appearance' ? (
            <div className="onboard__appearance">
              <div className="designGrid">
                {(['neuro', 'windows', 'ubuntu', 'ios'] as const).map((item) => {
                  const preset = THEME_PRESETS.find((entry) => entry.design === item)!;
                  const [bg, surface, accentColor] = preset.colors;
                  return (
                    <button
                      key={item}
                      type="button"
                      className="designCard"
                      data-active={design === item}
                      onClick={() => {
                        setDesign(item);
                        if (item === 'windows') setAccent('deepseek');
                        if (item === 'ubuntu') setAccent('amber');
                        if (item === 'ios') setAccent('neuro');
                      }}
                    >
                      <span className="designCard__preview" style={{ background: bg }}>
                        <span
                          className="designCard__chip"
                          style={{ background: surface, boxShadow: `inset 0 0 0 1.5px ${accentColor}` }}
                        >
                          <span className="designCard__dot" style={{ background: accentColor }} />
                        </span>
                      </span>
                      <span className="designCard__name">{preset.design === 'neuro' ? 'Neuro OS' : preset.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="themePreview" data-theme-preview={theme} data-design-preview={design}>
                <div className="themePreview__bar">
                  <span className="n-dot n-dot--offline" />
                  <span className="n-dot n-dot--warn" />
                  <span className="n-dot n-dot--online" />
                  <span className="tiny faint" style={{ marginLeft: 6 }}>
                    {design === 'windows' ? 'Mica' : design === 'ubuntu' ? 'Yaru' : design === 'ios' ? 'Glass' : 'Aurora'}
                  </span>
                </div>
                <div className="themePreview__body">
                  <div className="themePreview__side">
                    <BrandMark size={14} />
                    <span className="themePreview__nav is-active" />
                    <span className="themePreview__nav" />
                    <span className="themePreview__nav" />
                    <span className="themePreview__nav" />
                  </div>
                  <div className="themePreview__content">
                    <div className="themePreview__title" />
                    <div className="themePreview__line" style={{ width: '74%' }} />
                    <div className="themePreview__line" style={{ width: '52%' }} />
                    <div className="themePreview__chip">{design === 'windows' ? 'fluent' : design === 'ubuntu' ? 'yaru' : design === 'ios' ? 'ios' : accent}</div>
                  </div>
                </div>
              </div>

              <div className="onboard__controlRow">
                <span className="n-label">{t('common.theme')}</span>
                <div className="n-segmented">
                  {(['dark', 'light', 'system'] as const).map((mode) => (
                    <button key={mode} type="button" data-active={theme === mode} onClick={() => setTheme(mode)}>
                      <Icon name={mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'monitor'} size={12} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                      {t(`common.${mode}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onboard__controlRow">
                <span className="n-label">White theme</span>
                <button type="button" className="n-switch" data-on={white} onClick={() => setWhite(!white)} aria-label="White theme" />
              </div>

              <div className="onboard__controlRow">
                <span className="n-label">{t('settings.accent')}</span>
                <div className="onboard__swatches">
                  {ACCENTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="swatch"
                      data-active={accent === item.id}
                      style={{ background: item.color }}
                      onClick={() => setAccent(item.id)}
                      aria-label={item.label}
                    >
                      {accent === item.id ? <Icon name="check" size={12} /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 'intelligence' ? (
            <div className="onboard__providers">
              <div className="onboard__providerGrid n-scroll">
                {PROVIDER_PRESETS.filter((item) => item.id !== 'custom').map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="providerCard"
                    data-active={preset?.id === item.id}
                    onClick={() => {
                      setPreset(item);
                      setBaseUrl(item.baseUrl);
                      setApiKey(item.kind === 'acp' ? '' : '');
                      setTestResult(null);
                    }}
                  >
                    <span className="providerCard__dot" style={{ background: item.color }} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="providerCard__name">{item.name}</span>
                        {item.badge ? <span className="n-badge n-badge--accent">{item.badge}</span> : null}
                      </div>
                      <div className="providerCard__desc tiny">{item.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              {preset ? (
                <div className="onboard__providerForm">
                  {preset.kind === 'acp' ? (
                    <>
                      <label className="n-field">
                        <span className="n-label">Agent command</span>
                        <input
                          className="n-input n-input--mono"
                          value={baseUrl}
                          onChange={(event) => setBaseUrl(event.target.value)}
                          placeholder="npx -y @google/gemini-cli --experimental-acp"
                        />
                      </label>
                      <p className="tiny faint" style={{ lineHeight: 1.6 }}>
                        Neuro spawns the process and speaks ACP v1 over stdio — initialize, session/new, session/prompt, fs and
                        terminal bridging, permission mediation.
                      </p>
                    </>
                  ) : preset.local ? (
                    <p className="tiny faint" style={{ lineHeight: 1.6 }}>
                      {preset.name} runs on this machine. No key needed — Neuro connects to {preset.baseUrl}.
                    </p>
                  ) : (
                    <label className="n-field">
                      <span className="n-label">API key</span>
                      <input
                        className="n-input n-input--mono"
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={preset.keyHint}
                        autoFocus
                      />
                    </label>
                  )}
                  <div className="row" style={{ gap: 8 }}>
                    <Button variant="outline" size="sm" onClick={() => void testConnection()} disabled={testing}>
                      {testing ? <Spinner /> : <Icon name="zap" size={13} />}
                      Test connection
                    </Button>
                    {testResult ? (
                      <span className={`tiny ${testResult.ok ? 'okText' : 'errText'}`} style={{ flex: 1 }}>
                        {testResult.ok ? '● ' : '× '}
                        {testResult.message}
                      </span>
                    ) : (
                      <span className="tiny faint" style={{ flex: 1 }}>{t('onboarding.privacy')}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="onboard__providerHint">
                  <Icon name="shield" size={16} className="faint" />
                  <div>
                    <div className="small strong">{t('onboarding.demoMode')}</div>
                    <div className="tiny faint">{t('onboarding.demoNote')}</div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {step === 'workspace' ? (
            <div className="onboard__workspace">
              <button type="button" className="workspaceOption" data-active={!workspace} onClick={() => setWorkspace(null)}>
                <span className="workspaceOption__icon">
                  <Icon name="sparkles" size={18} />
                </span>
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div className="small strong">Demo workspace</div>
                  <div className="tiny faint">A generated project with code, notes, data and a PowerShell health check.</div>
                </div>
                {!workspace ? <Icon name="check-circle" size={16} style={{ color: 'var(--n-accent)' }} /> : null}
              </button>
              <button type="button" className="workspaceOption" data-active={Boolean(workspace)} onClick={() => void pickFolder()}>
                <span className="workspaceOption__icon">
                  <Icon name="folder-open" size={18} />
                </span>
                <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <div className="small strong">{workspace ? workspace.split(/[\\/]/).pop() : 'Choose a folder'}</div>
                  <div className="tiny faint truncate">{workspace ?? 'Point Neuro at an existing repository or project.'}</div>
                </div>
                <Icon name="chevron-right" size={15} className="faint" />
              </button>
              <div className="onboard__workspaceNote">
                <Icon name="lock" size={13} className="faint" />
                <span className="tiny faint">
                  Reads and writes stay inside this folder unless you explicitly allow otherwise. Every file tool call is
                  policy-gated.
                </span>
              </div>
            </div>
          ) : null}

          {step === 'ready' ? (
            <div className="onboard__ready">
              <div className="readyRow">
                <Icon name="check-circle" size={15} />
                <span>Kernel</span>
                <span className="grow" />
                <span className="mono tiny okText">online</span>
              </div>
              <div className="readyRow">
                <Icon name="check-circle" size={15} />
                <span>Language</span>
                <span className="grow" />
                <span className="row" style={{ gap: 6 }}>
                  <Flag code={language.flag} size={16} />
                  <span className="mono tiny">{language.nativeName}</span>
                </span>
              </div>
              <div className="readyRow">
                <Icon name={draftProvider ? 'check-circle' : 'alert'} size={15} />
                <span>Provider</span>
                <span className="grow" />
                <span className="mono tiny">{draftProvider ? draftProvider.name : 'add later'}</span>
              </div>
              <div className="readyRow">
                <Icon name="check-circle" size={15} />
                <span>Workspace</span>
                <span className="grow" />
                <span className="mono tiny truncate" style={{ maxWidth: 220 }}>
                  {workspace ? workspace.split(/[\\/]/).pop() : 'Neuro Demo'}
                </span>
              </div>
              <div className="readyRow">
                <Icon name="check-circle" size={15} />
                <span>Appearance</span>
                <span className="grow" />
                <span className="row" style={{ gap: 6 }}>
                  <span className="readyDot" style={{ background: ACCENTS.find((a) => a.id === accent)?.color }} />
                  <span className="mono tiny">{theme}</span>
                </span>
              </div>
              {error ? <div className="errText tiny">{error}</div> : null}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="onboard__foot">
        <div className="onboard__footLeft">
          {step !== 'welcome' ? (
            <Button variant="ghost" icon="arrow-left" onClick={back}>
              {t('common.back')}
            </Button>
          ) : (
            <span className="tiny faint mono">press ↵ to begin</span>
          )}
        </div>
        <div className="onboard__footRight">
          {step === 'intelligence' ? (
            <Button variant="ghost" onClick={next}>
              {t('onboarding.skipProvider')}
            </Button>
          ) : null}
          {step === 'ready' ? (
            <Button variant="primary" size="lg" icon="arrow-right" onClick={() => void finish()} disabled={busy}>
              {busy ? <Spinner size={15} /> : null}
              {t('onboarding.start')}
            </Button>
          ) : (
            <Button variant="primary" size="lg" icon="arrow-right" onClick={next} disabled={!canContinue()}>
              {t('common.next')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Fact({ icon, title, body }: { icon: string; title: string; body: string }): JSX.Element {
  return (
    <div className="onboardFact">
      <span className="onboardFact__icon">
        <Icon name={icon} size={15} />
      </span>
      <div>
        <div className="small strong">{title}</div>
        <div className="tiny faint" style={{ lineHeight: 1.55 }}>{body}</div>
      </div>
    </div>
  );
}
