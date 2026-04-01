import type { ReactNode } from 'react';
import { los } from '../../design/tokens';

type Props = {
  title: string;
  tagline: string;
  summary?: ReactNode;
};

export function PageHeader({ title, tagline, summary }: Props) {
  return (
    <header className="mb-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.65rem]">{title}</h1>
        <p className={`mt-2 max-w-2xl text-[15px] leading-relaxed ${los.textSecondary}`}>{tagline}</p>
      </div>
      {summary ? (
        <div
          className={`flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.06] pt-4 text-sm ${los.textMuted}`}
        >
          {summary}
        </div>
      ) : null}
    </header>
  );
}
