import { los } from '../../design/tokens';

type Props = {
  title: string;
  subtitle?: string;
  id?: string;
};

export function SectionHeader({ title, subtitle, id }: Props) {
  return (
    <div className="mb-4" id={id}>
      <h2 className={los.textLabel}>{title}</h2>
      {subtitle ? <p className={`mt-1.5 text-xs leading-relaxed text-slate-600`}>{subtitle}</p> : null}
    </div>
  );
}
