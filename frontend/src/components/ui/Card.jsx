import PropTypes from 'prop-types';

/**
 * Card — Liquid glass surface with translucent blur and soft glow.
 */
export default function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`glass rounded-2xl p-4 ${onClick ? 'cursor-pointer glass-hover active:scale-[0.98]' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  onClick: PropTypes.func,
};
