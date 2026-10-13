import { useEffect, useState, type ReactNode } from 'react';
import { CircleAlert, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cx, fallbackImage, type Tone } from '../lib/format';
import { getErrorMessage } from '../api/client';

export function Spinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle size={size} className="spin" aria-hidden />;
}

export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}

/** Render free tier cold-starts can take ~30s; tell the user after a few seconds. */
function useSlowHint(delay = 4000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  return slow;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const slow = useSlowHint();
  return (
    <div className="state">
      <Spinner size={28} />
      <p>{label}</p>
      {slow && <p className="muted small">Waking up the server — first request can take up to 30s.</p>}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid--cards">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton skeleton--img" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line short" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="state state--error">
      <CircleAlert size={28} />
      <h3>{title}</h3>
      <p className="muted">{getErrorMessage(error)}</p>
      {onRetry && (
        <button className="btn btn--ghost" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <div className="state__icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

/** Image with graceful fallback to local editorial photography. */
export function SmartImage({ src, alt, hints = [], className }: { src?: string | null; alt: string; hints?: (string | null | undefined)[]; className?: string }) {
  const fallback = fallbackImage(alt, ...hints);
  const [current, setCurrent] = useState(src || fallback);
  useEffect(() => setCurrent(src || fallback), [src, fallback]);
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => current !== fallback && setCurrent(fallback)}
    />
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className={cx('modal', wide && 'modal--wide')} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function QuantityStepper({ value, onChange, min = 1, disabled }: { value: number; onChange: (v: number) => void; min?: number; disabled?: boolean }) {
  return (
    <div className="stepper">
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label="Decrease">
        −
      </button>
      <span>{value}</span>
      <button type="button" disabled={disabled} onClick={() => onChange(value + 1)} aria-label="Increase">
        +
      </button>
    </div>
  );
}
