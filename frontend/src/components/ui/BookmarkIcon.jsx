import PropTypes from 'prop-types';
import { Bookmark } from 'lucide-react';

/**
 * BookmarkIcon — Wishlist save toggle.
 * Spec: page 9 — "Wishlist bookmark icon — tap to save"
 */
export default function BookmarkIcon({ saved, onToggle, size = 20 }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e);
      }}
      className="p-1.5 rounded-full hover:bg-surface transition-colors"
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
    >
      <Bookmark
        size={size}
        className={saved ? 'fill-terracotta text-terracotta' : 'text-text-muted'}
      />
    </button>
  );
}

BookmarkIcon.propTypes = {
  saved: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  size: PropTypes.number,
};
