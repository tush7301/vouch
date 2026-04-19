import PropTypes from 'prop-types';

/**
 * TasteMatchBadge — Shows the % taste similarity between two users.
 *
 * Color shifts with strength:
 *   85%+ = sage glow (strong match)
 *   60–84% = terracotta (good)
 *   <60% = neutral
 *
 * If pct is null/undefined, shows "No overlap yet".
 */
export default function TasteMatchBadge({ pct, overlap, size = 'md' }) {
  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  if (pct === null || pct === undefined) {
    return (
      <span className={`glass-pill ${sizes[size]} font-medium text-charcoal/60 inline-flex items-center gap-1`}>
        <span>—</span>
        <span>No overlap</span>
      </span>
    );
  }

  let toneClass = 'text-charcoal/70 bg-white/40 border border-white/50';
  let dot = '#9CA3AF';
  if (pct >= 85) {
    toneClass = 'text-sage bg-sage-light/40 border border-sage/30 shadow-[0_0_12px_rgba(122,140,114,0.25)]';
    dot = '#7a8c72';
  } else if (pct >= 60) {
    toneClass = 'text-terracotta bg-terracotta/10 border border-terracotta/30';
    dot = '#C2653A';
  }

  return (
    <span
      className={`backdrop-blur-md ${sizes[size]} ${toneClass} rounded-full font-semibold inline-flex items-center gap-1.5 transition-fluid`}
      title={overlap ? `${overlap} shared rating${overlap === 1 ? '' : 's'}` : undefined}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: dot }}
      />
      <span>{pct}% match</span>
    </span>
  );
}

TasteMatchBadge.propTypes = {
  pct: PropTypes.number,
  overlap: PropTypes.number,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};
