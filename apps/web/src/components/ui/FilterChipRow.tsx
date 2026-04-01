import { los } from '../../design/tokens';

export type FilterChip<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  chips: FilterChip<T>[];
  value: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
};

export function FilterChipRow<T extends string>({
  chips,
  value,
  onChange,
  'aria-label': ariaLabel,
}: Props<T>) {
  return (
    <div className="flex flex-wrap gap-2.5" role="group" aria-label={ariaLabel ?? 'Filters'}>
      {chips.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`${los.chip} ${los.focusRing} ${
              active
                ? los.chipActive
                : 'hover:border-cyan-500/25 hover:bg-[#172234]/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.06)]'
            }`}
            aria-pressed={active}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
