/**
 * Life OS UI — premium dark shell + cyan intelligence accent (exact visual blueprint).
 */
export const los = {
  page: 'min-h-0 text-slate-100 antialiased',
  /** Base app tint (cool navy-charcoal). */
  surface: 'bg-[#070B12]',
  /** Fixed atmospheric layer — use behind content. */
  atmosphere:
    'bg-[#070B12] bg-[radial-gradient(ellipse_120%_90%_at_50%_-30%,rgba(34,211,238,0.14),transparent_50%),radial-gradient(ellipse_70%_50%_at_100%_20%,rgba(59,130,246,0.07),transparent_50%),linear-gradient(180deg,#0B1020_0%,#070B12_42%,#06080f_100%)]',
  /** Shell sits above page content so nav dropdowns (More, etc.) float over cards. */
  shellBar:
    'relative z-50 overflow-visible border-b border-white/[0.06] bg-[#0A0F18]/85 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
  surfaceCard:
    'rounded-[20px] border border-cyan-500/10 bg-[#131C2A]/90 shadow-[0_12px_40px_rgba(0,0,0,0.38),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-[2px]',
  surfaceCardHover:
    'hover:border-cyan-400/22 hover:shadow-[0_12px_48px_rgba(34,211,238,0.07)] transition-[box-shadow,border-color] duration-200',
  surfaceHero:
    'rounded-[22px] border border-cyan-400/28 bg-gradient-to-br from-[#172234]/95 via-[#131C2A]/95 to-[#121B2A]/90 shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_20px_56px_rgba(0,229,255,0.07)]',
  borderSubtle: 'border-white/[0.08]',
  textPrimary: 'text-slate-50',
  textSecondary: 'text-slate-400',
  textMuted: 'text-slate-500',
  textLabel:
    'text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-500/75',
  accent: 'text-cyan-400',
  accentLink:
    'text-cyan-400/95 hover:text-cyan-300 underline-offset-2 hover:underline',
  btnPrimary:
    'rounded-2xl bg-gradient-to-b from-cyan-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.22)] hover:from-cyan-300 hover:to-cyan-400 disabled:opacity-50 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0',
  btnSecondary:
    'rounded-2xl border border-white/15 bg-[#131C2A]/90 px-4 py-2 text-sm font-medium text-slate-200 hover:border-cyan-500/35 hover:bg-[#172234]/95 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0',
  /** Compact actions on cards (brief suggestions). */
  btnCompactPrimary:
    'rounded-xl bg-cyan-500/20 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50',
  btnCompactSecondary:
    'rounded-xl border border-white/12 bg-[#0F1624]/80 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-500/25 disabled:opacity-50',
  navInactive: 'text-slate-400 hover:text-slate-200 transition-colors',
  navActive: 'text-cyan-400',
  navActivePill:
    'rounded-lg bg-cyan-500/12 px-2.5 py-1 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]',
  focusRing:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B12]',
  input:
    'w-full rounded-2xl border border-white/10 bg-[#0F1624]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600',
  chip: 'rounded-full border border-white/10 bg-[#0F1624]/85 px-3.5 py-1.5 text-xs font-medium text-slate-300 shadow-sm transition-[box-shadow,border-color,background]',
  chipActive:
    'border-cyan-400/45 bg-cyan-500/14 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.12)]',
  emptyStatePanel:
    'rounded-[24px] border border-cyan-500/15 bg-[#131C2A]/85 px-8 py-12 text-center shadow-[0_0_64px_-16px_rgba(34,211,238,0.18)]',
  trustedBar:
    'border-t border-white/[0.06] bg-[#0A0F18]/60 text-[11px] text-slate-500',
  brandWordmark: 'font-semibold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent',
  /** Logo lockup — cool cyan vertical gradient (dark neon / “illuminated” wordmark). */
  brandWordmarkNeon:
    'font-semibold tracking-tight bg-gradient-to-b from-[#E0FFFB] via-cyan-300 to-[#1a5c58] bg-clip-text text-transparent',
} as const;
