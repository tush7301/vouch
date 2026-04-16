import PropTypes from 'prop-types';
import { Star } from 'lucide-react';

/**
 * TastemakerBadge — verified-style badge for curated tastemaker accounts.
 *
 * Two display modes:
 *   - inline (default): small pill with star + "Tastemaker" or specialty
 *   - icon: just the star (for tight spaces, name-adjacent)
 *
 * Renders nothing if !isTastemaker.
 */
export default function TastemakerBadge({
  isTastemaker,
  specialty,
  size = 'md',
  variant = 'inline',
}) {
  if (!isTastemaker) return null;

  const sizes = {
    sm: { pill: 'px-2 py-0.5 text-[10px]', icon: 11 },
    md: { pill: 'px-2.5 py-1 text-xs', icon: 13 },
    lg: { pill: 'px-3 py-1.5 text-sm', icon: 15 },
  };
  const s = sizes[size];

  if (variant === 'icon') {
    return (
      <span
        className="inline-flex items-center justify-center text-amber"
        title={specialty ? `Tastemaker · ${specialty}` : 'Tastemaker'}
      >
        <Star size={s.icon} fill="currentColor" strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <span
      className={`backdrop-blur-md ${s.pill} text-amber bg-amber/10 border border-amber/30 rounded-full font-semibold inline-flex items-center gap-1 transition-fluid`}
      title={specialty ? `Tastemaker · ${specialty}` : 'Curated tastemaker — vetted for quality recs'}
    >
      <Star size={s.icon} fill="currentColor" strokeWidth={1.5} />
      <span>{specialty || 'Tastemaker'}</span>
    </span>
  );
}

TastemakerBadge.propTypes = {
  isTastemaker: PropTypes.bool,
  specialty: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  variant: PropTypes.oneOf(['inline', 'icon']),
};
