import { useEffect, useMemo, useState } from 'react';
import { OS_APPS } from '@shared/apps';
import { useAppStore } from '../state/store';
import { Icon } from '../components/Icon';
import { BrandMark } from '../components/BrandMark';

const FEATURES = [
  {
    icon: 'dashboard',
    title: 'Fourteen surfaces, one tool bus',
    body: 'Chat, files, spaces, notebook, browser, terminal, mail, automation, composer, brain, sites, marketplace and settings — all native.',
    accent: '#5686fe',
  },
  {
    icon: 'terminal',
    title: 'A real operating environment',
    body: 'ConPTY terminal, real Chromium, real files, real git — the agent drives the same tools you do, with approvals.',
    accent: '#22c55e',
  },
  {
    icon: 'mail',
    title: 'Mail and web without a server',
    body: 'Signed, encrypted peer-to-peer mail and .neuro sites hosted from your own machine, replicated across the mesh.',
    accent: '#f472b6',
  },
  {
    icon: 'brain',
    title: 'Memory that never forgets',
    body: 'A local graph records every click, turn and tool call, then feeds the right memories back into the agent.',
    accent: '#ec4899',
  },
  {
    icon: 'workflow',
    title: 'Automation and agent composition',
    body: 'n8n-style workflows, schedules, triggers and multi-agent pipelines — with Composio for 100+ real integrations.',
    accent: '#fb7185',
  },
  {
    icon: 'puzzle',
    title: 'Extensible to the core',
    body: 'Plugins add tools, themes, providers and streaming adapters. Nine providers, fourteen languages, five themes.',
    accent: '#a78bfa',
  },
];

const TRAITS = ['local-first', 'bring your own model', 'keychain secrets', 'offline memory', 'signed plugins'];

const CAPS = [
  { icon: 'message', label: 'agents' },
  { icon: 'wrench', label: 'tools' },
  { icon: 'mail', label: 'p2p mail' },
  { icon: 'network', label: 'neuro web' },
  { icon: 'brain', label: 'memory' },
  { icon: 'plug', label: 'composio' },
];

export function WelcomeTicker(): JSX.Element {
  const [index, setIndex] = useState(0);
  const feature = FEATURES[index];

  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % FEATURES.length), 3800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="wmTicker">
      <div className="wmTicker__card" key={feature.title}>
        <span className="wmTicker__icon" style={{ background: `${feature.accent}1f`, borderColor: `${feature.accent}44` }}>
          <Icon name={feature.icon} size={20} />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="wmTicker__title">{feature.title}</div>
          <div className="wmTicker__body">{feature.body}</div>
        </div>
      </div>
      <div className="wmTicker__dots">
        {FEATURES.map((item, position) => (
          <button
            key={item.title}
            type="button"
            aria-label={item.title}
            data-active={position === index}
            onClick={() => setIndex(position)}
          >
            <span style={{ animationDuration: position === index ? '3.8s' : undefined }} />
          </button>
        ))}
      </div>
      <div className="wmTicker__traits">
        {TRAITS.map((trait) => (
          <span key={trait} className="wmTicker__trait">
            <Icon name="check" size={10} /> {trait}
          </span>
        ))}
      </div>
      <div className="wmMarquee" aria-hidden>
        <div className="wmMarquee__track">
          {[0, 1].map((copy) => (
            <span key={copy} className="wmMarquee__group">
              {[...OS_APPS.map((app) => app.name), 'p2p mail', 'neuro web', 'graph brain', 'automation', 'composio', 'plugins', 'themes', '14 languages', 'approvals', 'ACP'].map(
                (label) => (
                  <span key={`${copy}-${label}`} className="wmMarquee__item">
                    <i />
                    {label}
                  </span>
                ),
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WelcomePanel(): JSX.Element {
  const tools = useAppStore((s) => s.tools.length);
  const apps = useMemo(() => OS_APPS.slice(0, 14), []);
  const nodes = useMemo(() => {
    const cx = 260;
    const cy = 208;
    const rx = 204;
    const ry = 176;
    return apps.map((app, position) => {
      const angle = (position / apps.length) * Math.PI * 2 - Math.PI / 2;
      return {
        app,
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        delay: `${(position * 0.08).toFixed(2)}s`,
        angle,
      };
    });
  }, [apps]);

  return (
    <div className="wmPanel">
      <div className="wmPanel__head">
        <span className="n-badge n-badge--accent">system map</span>
        <span className="tiny faint mono">14 surfaces · live</span>
      </div>

      <div className="wmMap">
        <svg className="wmMap__wires" viewBox="0 0 520 416" aria-hidden>
          <defs>
            <radialGradient id="wmGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5686fe" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5686fe" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="260" cy="208" r="150" fill="url(#wmGlow)" />
          <circle cx="260" cy="208" r="96" className="wmMap__ring wmMap__ring--inner" />
          <circle cx="260" cy="208" r="150" className="wmMap__ring" />
          <ellipse cx="260" cy="208" rx="204" ry="176" className="wmMap__ring wmMap__ring--outer" />
          {nodes.map((node) => (
            <g key={node.app.id}>
              <line x1="260" y1="208" x2={node.x} y2={node.y} className="wmMap__line" />
              <circle r="2" className="wmMap__pulse">
                <animateMotion dur={`${3.6 + (node.angle + Math.PI) * 0.4}s`} repeatCount="indefinite" path={`M260 208 L${node.x} ${node.y}`} />
              </circle>
            </g>
          ))}
        </svg>

        <div className="wmMap__hub">
          <BrandMark size={40} animated />
          <span>NEURO</span>
        </div>

        {nodes.map((node) => (
          <div key={node.app.id} className="wmMap__node" style={{ left: `${(node.x / 520) * 100}%`, top: `${(node.y / 416) * 100}%`, animationDelay: node.delay }}>
            <span className="wmMap__chip" style={{ borderColor: `${node.app.accent}3d`, background: `${node.app.accent}18` }}>
              <Icon name={node.app.icon} size={15} />
            </span>
            <span className="wmMap__label">{node.app.name}</span>
          </div>
        ))}
      </div>

      <div className="wmPanel__stats">
        <div><span className="mono big">{apps.length}</span><span className="tiny faint uppercase">surfaces</span></div>
        <div><span className="mono big">{tools || 50}</span><span className="tiny faint uppercase">tools</span></div>
        <div><span className="mono big">9</span><span className="tiny faint uppercase">providers</span></div>
        <div><span className="mono big">14</span><span className="tiny faint uppercase">languages</span></div>
      </div>

      <div className="wmPanel__caps">
        {CAPS.map((cap) => (
          <span key={cap.label} className="wmCap">
            <Icon name={cap.icon} size={11} /> {cap.label === 'tools' ? `${tools || 50} tools` : cap.label}
          </span>
        ))}
      </div>
    </div>
  );
}
