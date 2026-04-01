import type { ReactNode } from 'react';
import { los } from '../../design/tokens';

type Props = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  emphasis?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
};

export function PriorityCard({ title, eyebrow, subtitle, emphasis, children, footer }: Props) {
  const shell = emphasis
    ? `${los.surfaceHero} px-5 py-4`
    : `${los.surfaceCard} ${los.surfaceCardHover} px-4 py-4`;
  return (
    <article className={shell}>
      {eyebrow ? <div className={`mb-1.5 ${los.textLabel}`}>{eyebrow}</div> : null}
      <h3 className={`text-[15px] font-semibold leading-snug tracking-tight ${los.textPrimary}`}>
        {title}
      </h3>
      {subtitle ? (
        <p className={`mt-1.5 text-sm leading-relaxed ${los.textSecondary}`}>{subtitle}</p>
      ) : null}
      {children ? <div className="mt-2 text-sm">{children}</div> : null}
      {footer ? <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">{footer}</div> : null}
    </article>
  );
}
