import { useAppStore } from '../state/store';
import { Icon } from './Icon';

const KIND_ICON: Record<string, string> = {
  info: 'sparkles',
  success: 'check-circle',
  warning: 'alert',
  error: 'alert',
};

export function ToastHost(): JSX.Element {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind ?? 'info'}`} role="status">
          <span className="toast__icon">
            <Icon name={KIND_ICON[toast.kind ?? 'info']} size={14} />
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="toast__title">{toast.title}</div>
            {toast.message ? <div className="toast__body">{toast.message}</div> : null}
          </div>
          <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
