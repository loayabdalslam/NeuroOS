import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'outline' | 'soft' | 'ghost' | 'danger' | 'icon';

export function Button({
  children,
  variant = 'ghost',
  size,
  icon,
  className = '',
  block,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'lg';
  icon?: string;
  block?: boolean;
}): JSX.Element {
  const classes = ['n-btn', `n-btn--${variant}`, size ? `n-btn--${size}` : '', block ? 'n-btn--block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  size = 16,
  active,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; size?: number; active?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={label}
      className={`n-btn n-btn--icon ${active ? 'is-active' : ''} ${className}`}
      style={active ? { color: 'var(--n-accent)', background: 'var(--n-accent-soft)' } : undefined}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Switch / segmented / slider                                         */
/* ------------------------------------------------------------------ */

export function Switch({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label?: string }): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-on={on}
      className="n-switch"
      onClick={() => onChange(!on)}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (value: T) => void;
  className?: string;
}): JSX.Element {
  return (
    <div className={`n-segmented ${className}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}): JSX.Element {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="n-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--pct' as string]: `${pct}%` }}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Field / section                                                     */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}): JSX.Element {
  return (
    <label className="n-field" htmlFor={htmlFor}>
      <span className="n-label">{label}</span>
      {children}
      {hint ? <span className="tiny faint" style={{ lineHeight: 1.5 }}>{hint}</span> : null}
    </label>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  padded = true,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}): JSX.Element {
  return (
    <section className="n-section" style={padded ? undefined : { padding: 0 }}>
      <div className="n-section__head" style={{ marginBottom: description || action ? 14 : 10 }}>
        <div>
          <div className="n-section__title">{title}</div>
          {description ? <div className="n-section__desc">{description}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ToggleRow({
  title,
  hint,
  on,
  onChange,
}: {
  title: string;
  hint?: string;
  on: boolean;
  onChange: (next: boolean) => void;
}): JSX.Element {
  return (
    <div className="n-row-toggle">
      <div>
        <div className="n-row-toggle__title">{title}</div>
        {hint ? <div className="n-row-toggle__hint">{hint}</div> : null}
      </div>
      <Switch on={on} onChange={onChange} label={title} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="n-modal-scrim" onMouseDown={onClose}>
      <div className="n-modal rise-in" style={{ width }} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal>
        <div className="n-modal__head">
          <div>
            <div className="n-modal__title">{title}</div>
            {description ? <div className="n-modal__desc">{description}</div> : null}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        {children ? <div className="n-modal__body n-scroll">{children}</div> : null}
        {footer ? <div className="n-modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function Spinner({ size = 14 }: { size?: number }): JSX.Element {
  return <Icon name="loader" size={size} className="spin" />;
}

export function EmptyState({
  icon = 'inbox',
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="n-empty">
      <div className="n-empty__icon">
        <Icon name={icon} size={22} />
      </div>
      <div className="n-empty__title">{title}</div>
      {body ? <div className="n-empty__body">{body}</div> : null}
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}

export function Dot({ state = 'idle' }: { state?: 'idle' | 'online' | 'warn' | 'offline' | 'live' }): JSX.Element {
  return <span className={`n-dot ${state !== 'idle' ? `n-dot--${state}` : ''}`} />;
}

export interface MenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
  hint?: string;
}

export function Menu({
  items,
  onClose,
  align = 'left',
  width = 200,
}: {
  items: MenuItem[];
  onClose: () => void;
  align?: 'left' | 'right';
  width?: number;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={ref}
      className="n-menu"
      style={{ width, [align === 'right' ? 'right' : 'left']: 0 }}
      role="menu"
    >
      {items.map((item, index) =>
        item.separator ? (
          <div key={`sep-${index}`} className="n-menu__sep" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="n-menu__item"
            data-danger={item.danger}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon ? <Icon name={item.icon} size={14} /> : <span style={{ width: 14 }} />}
            <span className="grow">{item.label}</span>
            {item.hint ? <span className="tiny faint">{item.hint}</span> : null}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
