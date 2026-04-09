import PropTypes from 'prop-types';

/**
 * Button — Liquid glass style with warm glow on hover.
 */
export default function Button({ children, variant = 'primary', size = 'md', onClick, disabled = false, className = '', type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-full transition-fluid focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]';

  const variants = {
    primary: 'bg-charcoal text-cream hover:bg-terracotta hover:shadow-[0_4px_20px_rgba(194,101,58,0.25)] focus:ring-terracotta',
    secondary: 'glass text-charcoal hover:border-terracotta/30 hover:text-terracotta hover:shadow-[0_4px_16px_rgba(194,101,58,0.1)] focus:ring-stone',
    ghost: 'bg-transparent text-terracotta hover:bg-terracotta/8 focus:ring-terracotta',
  };

  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-base px-6 py-3',
  };

  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.string,
};
