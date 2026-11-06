import { useEffect, useState } from 'react';
import { useWindowStore } from '../state/windows';
import { useAppStore } from '../state/store';
import { fullDate } from '../lib/format';
import { BrandMark } from './BrandMark';
import { Icon } from './Icon';

export function LockScreen(): JSX.Element | null {
  const locked = useWindowStore((s) => s.locked);
  const setLocked = useWindowStore((s) => s.setLocked);
  const settings = useAppStore((s) => s.settings);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [locked]);

  useEffect(() => {
    if (!locked) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === 'Escape') setLocked(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, setLocked]);

  if (!locked) return null;

  return (
    <div className="lockscreen" onClick={() => setLocked(false)} role="button" tabIndex={0}>
      <div className="lockscreen__bg">
        <div className="n-aurora">
          <span />
          <span />
          <span />
        </div>
        <div className="n-grid-bg" />
      </div>
      <div className="lockscreen__clock mono">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
      <div className="lockscreen__date">{fullDate(now, settings?.locale)}</div>
      <div className="lockscreen__user">
        <span className="lockscreen__avatar">{(settings?.profile.name || 'N').slice(0, 1).toUpperCase()}</span>
        <div>
          <div className="small strong">{settings?.profile.name || 'Explorer'}</div>
          <div className="tiny faint">Neuro OS · locked</div>
        </div>
      </div>
      <div className="lockscreen__hint">
        <Icon name="lock" size={14} />
        <span>Press Enter or click to unlock</span>
      </div>
      <div className="lockscreen__brand">
        <BrandMark size={18} />
        <span className="tiny faint mono uppercase">Neuro OS 1.0</span>
      </div>
    </div>
  );
}
