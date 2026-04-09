import PropTypes from 'prop-types';

/**
 * ChipStrip — Horizontal scrollable filter chips.
 * Used for category filtering on Feed and Map. Spec: page 8, 29
 */
export default function ChipStrip({ chips, selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1 px-1">
      {chips.map((chip) => {
        const isActive = selected === chip;
        return (
          <button
            key={chip}
            onClick={() => onSelect(isActive ? null : chip)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-fluid whitespace-nowrap
              ${isActive
                ? 'bg-charcoal text-cream shadow-[0_2px_10px_rgba(26,23,20,0.15)]'
                : 'glass-pill text-text-muted hover:text-charcoal hover:bg-white/50'
              }`}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

ChipStrip.propTypes = {
  chips: PropTypes.arrayOf(PropTypes.string).isRequired,
  selected: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};
