import type { SVGProps } from 'react';
import { useId } from 'react';
import { los } from '../../design/tokens';

/** 32×32 icon grid — Logo A (ring, continuity curves, rising point). */
const VB = '0 0 32 32';

type MarkProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /**
   * Hero / nav: soft bloom on strokes + subtle ground wash (presentation only; not for flat export).
   */
  presentation?: boolean;
};

function LogoGeometry({
  filterId,
  presentation,
}: {
  filterId: string;
  presentation: boolean;
}) {
  const gProps = presentation
    ? { filter: `url(#${filterId})` as const }
    : {};

  return (
    <>
      {presentation ? (
        <defs>
          <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="0.9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      ) : null}
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...gProps}
      >
        <circle cx="16" cy="16" r="12.75" fill="none" />
        <path fill="none" d="M3.5 20.25c3.6-2.85 8.1-1.75 12.5 3.65 4.4-5.4 8.9-6.5 12.5-3.65" />
        <path fill="none" d="M5.75 23.35c3.35-1.35 6.35.35 10.25 3.55 3.9-3.2 6.9-4.9 10.25-3.55" />
      </g>
      <circle cx="16" cy="10.85" r="1.9" fill="currentColor" />
    </>
  );
}

/**
 * Logo A — icon-only mark.
 * Stroke/fill use `currentColor`; set `className` with `text-*` for tint.
 */
export function LifeOSLogoMark({ className, presentation = false, ...rest }: MarkProps) {
  const uid = useId();
  const filterId = `lifeos-bloom-${uid.replace(/:/g, '')}`;

  if (!presentation) {
    return (
      <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden {...rest}>
        <LogoGeometry filterId={filterId} presentation={false} />
      </svg>
    );
  }

  return (
    <span
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center text-cyan-400 drop-shadow-[0_0_14px_rgba(160,240,237,0.35)] ${className ?? ''}`}
    >
      <span
        className="pointer-events-none absolute -bottom-0.5 left-1/2 z-0 h-2.5 w-[130%] max-w-[3.25rem] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(160,240,237,0.28),rgba(42,90,88,0.12)_45%,transparent_72%)] blur-[6px]"
        aria-hidden
      />
      <span className="relative z-[1] block h-full w-full">
        <svg viewBox={VB} fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden>
          <LogoGeometry filterId={filterId} presentation />
        </svg>
      </span>
    </span>
  );
}

type LockupProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  presentation?: boolean;
};

/**
 * Horizontal lockup: mark + “Life OS” wordmark (icon left, text right).
 */
export function LifeOSLogoLockup({
  className,
  iconClassName,
  wordmarkClassName,
  presentation = true,
}: LockupProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LifeOSLogoMark
        className={iconClassName ?? 'h-9 w-9 text-cyan-400'}
        presentation={presentation}
      />
      <span
        className={`text-lg font-semibold ${presentation ? los.brandWordmarkNeon : los.brandWordmark} ${wordmarkClassName ?? ''}`}
      >
        Life OS
      </span>
    </span>
  );
}
