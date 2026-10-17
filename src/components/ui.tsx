import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { CircleAlert, LoaderCircle, RefreshCw, Star, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cx, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, isLiveOrder, type Art as ArtSpec, type Tone } from '../lib/format';
import { getErrorMessage } from '../api/client';
import type { OrderStatus } from '../types/api';

export function Spinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle size={size} className="spin" aria-hidden />;
}

export function Badge({ tone = 'neutral', children, dot, live }: { tone?: Tone | 'solid'; children: ReactNode; dot?: boolean; live?: boolean }) {
  return (
    <span className={cx('badge', `badge--${tone}`, live && 'badge--live')}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} dot live={isLiveOrder(status)}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Sets the browser tab title while a page is mounted. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · UTown` : 'UTown — food delivery, end to end';
  }, [title]);
}

/**
 * The API sleeps on Render's free tier and can take a couple of minutes to wake. Rather than an
 * unexplained spinner, say what's happening once a request is clearly slower than normal.
 */
function useWaitStage() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [3_000, 25_000, 150_000].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(window.clearTimeout);
  }, []);
  return stage;
}

/** Inline "why is this slow" note; renders nothing for the first few seconds. */
export function SlowServerHint() {
  const stage = useWaitStage();
  if (stage === 0) return null;
  return (
    <p className="slow-hint" role="status">
      <Spinner size={14} />
      {stage === 1
        ? 'Waking up the server — the free hosting sleeps when idle, so the first load can take a few minutes.'
        : stage === 2
          ? 'Still starting up. This only happens on the first visit after a quiet spell.'
          : 'Nearly there — a cold start can take up to five minutes. Thanks for waiting.'}
    </p>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <Spinner size={24} />
      <p>{label}</p>
      <SlowServerHint />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <>
      <SlowServerHint />
      <div className="rest-grid" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card skeleton-card">
            <div className="skeleton" />
            <div className="stack--sm stack" style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 18, width: '60%' }} />
              <div className="skeleton" style={{ height: 14, width: '90%' }} />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Placeholder rows shaped like the menu, shown under the restaurant header while dishes load. */
export function MenuSkeleton() {
  return (
    <div className="menu-section" aria-busy="true" aria-label="Loading menu">
      <SlowServerHint />
      <div className="skeleton" style={{ height: 22, width: 160, marginTop: 8 }} />
      <div className="dish-grid" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card dish">
            <div className="stack stack--sm">
              <div className="skeleton" style={{ height: 16, width: '55%' }} />
              <div className="skeleton" style={{ height: 13, width: '90%' }} />
              <div className="skeleton" style={{ height: 13, width: '30%', marginTop: 8 }} />
            </div>
            <div className="skeleton dish__media" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="state state--error">
      <div className="state__icon">
        <CircleAlert size={28} />
      </div>
      <h3>{title}</h3>
      <p>{getErrorMessage(error)}</p>
      {onRetry && (
        <button className="btn btn--secondary" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, boxed }: { icon: ReactNode; title: string; children?: ReactNode; boxed?: boolean }) {
  return (
    <div className={cx('state', boxed && 'state--boxed')}>
      <div className="state__icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="stack stack--sm" style={{ alignItems: 'center' }}>{children}</div>}
    </div>
  );
}

/** A photo when we have a matching one, otherwise a plain tile with an outline icon. */
export function Art({ art, src, alt = '', className, style }: { art: ArtSpec; src?: string | null; alt?: string; className?: string; style?: CSSProperties }) {
  const remote = src && /^https?:\/\//.test(src) && !src.includes('example.com') ? src : null;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [remote]);
  const photo = (!failed && remote) || art.photo;
  const Icon = art.icon;
  return (
    <div className={cx('art', photo && 'art--photo', className)} style={style}>
      {photo ? (
        <img src={photo} alt={alt} loading="lazy" onError={() => remote && setFailed(true)} />
      ) : (
        <Icon className="art__icon" strokeWidth={1.5} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={!alt} />
      )}
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

export function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat__label">
        {icon} {label}
      </span>
      <span className="stat__value">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={cx(value === o.value && 'is-active')} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <span className="seg__count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className={cx('modal', wide && 'modal--wide')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close">
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

export function QuantityStepper({ value, onChange, min = 1, max = 50, disabled, large }: { value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean; large?: boolean }) {
  return (
    <div className={cx('stepper', large && 'stepper--lg')}>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
