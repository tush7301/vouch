import PropTypes from 'prop-types';

/**
 * FriendBadge — Shows relationship state between current user and another user.
 *
 * Three states:
 *   - mutual (true Friend): green sage badge with checkmark
 *   - following (one-way): subtle neutral pill
 *   - follower (they follow you): "Follows you" hint
 *
 * Renders nothing if no relationship at all.
 */
export default function FriendBadge({ isMutual, isFollowing, isFollower, size = 'md' }) {
  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  if (isMutual) {
    return (
      <span
        className={`backdrop-blur-md ${sizes[size]} text-sage bg-sage-light/40 border border-sage/40 rounded-full font-semibold inline-flex items-center gap-1 transition-fluid`}
        title="You and this person follow each other"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.5 9L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Friend
      </span>
    );
  }

  if (isFollowing) {
    return (
      <span className={`glass-pill ${sizes[size]} font-medium text-charcoal/70 inline-flex items-center gap-1`}>
        Following
      </span>
    );
  }

  if (isFollower) {
    return (
      <span className={`glass-pill ${sizes[size]} font-medium text-charcoal/60 italic inline-flex items-center gap-1`}>
        Follows you
      </span>
    );
  }

  return null;
}

FriendBadge.propTypes = {
  isMutual: PropTypes.bool,
  isFollowing: PropTypes.bool,
  isFollower: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};
