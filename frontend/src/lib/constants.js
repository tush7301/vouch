// ===== VOUCH DESIGN TOKENS =====
// Mirrors the spec (pages 4–6) and Tailwind theme

export const COLORS = {
  cream: '#faf7f2',
  creamDeep: '#f3ede4',
  warmWhite: '#fefcf9',
  charcoal: '#1a1714',
  charcoalSoft: '#2d2926',
  textBody: '#4a4541',
  textMuted: '#8a8480',
  terracotta: '#c2653a',
  terracottaLight: '#e8a882',
  amber: '#d4943a',
  sage: '#7a8c72',
  sageLight: '#e8ede5',
  stone: '#d6cfc5',
  stoneLight: '#eae6df',
  // Legacy aliases
  brandOrange: '#c2653a',
  brandYellow: '#d4943a',
  primaryText: '#1a1714',
  secondaryText: '#8a8480',
  surface: '#f3ede4',
  divider: '#eae6df',
  background: '#faf7f2',
};

// ===== SCORE LABEL THRESHOLDS =====
// 0–4 → AVOID, 5–6 → MEH, 7–8 → RELIABLE, 9 → GREAT, 10 → TELL EVERYONE
export const SCORE_LABELS = [
  { min: 0, max: 4, label: 'AVOID' },
  { min: 5, max: 6, label: 'MEH' },
  { min: 7, max: 8, label: 'RELIABLE' },
  { min: 9, max: 9, label: 'GREAT' },
  { min: 10, max: 10, label: 'TELL EVERYONE' },
];

// ===== EXPERIENCE CATEGORIES =====
export const CATEGORIES = [
  'Food & Drink',
  'Live Events',
  'Sports',
  'Wellness & Fitness',
  'Arts & Culture',
  'Social Scenes',
];

// ===== TAG BANK =====
export const TAGS = [
  'Great for dates',
  'Bring cash',
  'Worth the hype',
  'Overhyped',
  'Hidden gem',
  'Good for groups',
  'Come early',
  'Book ahead',
];

// ===== NAVIGATION =====
export const NAV_ITEMS = [
  { key: 'feed', label: 'Explore', path: '/' },
  { key: 'search', label: 'Search', path: '/search' },
  { key: 'map', label: 'Map', path: '/map' },
  { key: 'friends', label: 'Friends', path: '/friends' },
  { key: 'profile', label: 'Profile', path: '/profile' },
];

// ===== API =====
// Resolve the API base URL with a runtime fallback so a missing/empty
// VITE_API_URL at build time (a Render Blueprint quirk on fresh static
// sites) doesn't take prod down. Order: build-time env → runtime hostname
// detection → localhost.
function _resolveApiBase() {
  const env = import.meta.env.VITE_API_URL;
  // A real URL must contain a dot (rules out Render's internal hostname like
  // "vouch-api-5pa4" that fromService.host returns — that's an internal
  // network name, not a public DNS name).
  if (env && env.includes('.')) {
    return env.startsWith('http') ? env : `https://${env}`;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && !/localhost|127\.0\.0\.1/.test(host)) {
      return 'https://vouch-api-5pa4.onrender.com';
    }
  }
  return 'http://localhost:8000';
}
const _apiBase = _resolveApiBase();
const _normalizedBase = _apiBase.replace(/\/+$/, '');
export const API_BASE_URL = _normalizedBase.endsWith('/api/v1')
  ? _normalizedBase
  : `${_normalizedBase}/api/v1`;
