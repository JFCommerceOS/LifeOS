import type { ReactNode } from 'react';
import { los } from '../../design/tokens';

type Props = {
  title: string;
  description?: string;
  children?: ReactNode;
  /** Premium elevated panel (obligations empty, key moments). */
  variant?: 'default' | 'premium';
};

export function EmptyState({ title, description, children, variant = 'default' }: Props) {
  const shell =
    variant === 'premium'
      ? los.emptyStatePanel
      : `${los.surfaceCard} px-4 py-8 text-center`;

  return (
    <div className={shell} role="status">
      <p
        className={
          variant === 'premium'
            ? 'text-xl font-semibold tracking-tight text-slate-50'
            : `font-medium ${los.textSecondary}`
        }
      >
        {title}
      </p>
      {description ? (
        <p
          className={
            variant === 'premium'
              ? `mx-auto mt-3 max-w-md text-[15px] leading-relaxed ${los.textSecondary}`
              : `mt-2 text-sm ${los.textMuted}`
          }
        >
          {description}
        </p>
      ) : null}
      {children ? (
        <div
          className={`flex flex-wrap items-center justify-center gap-3 ${variant === 'premium' ? 'mt-8' : 'mt-4'}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
