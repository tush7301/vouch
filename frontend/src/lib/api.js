import { API_BASE_URL } from './constants';

/**
 * Base fetch wrapper for Vouch API calls.
 * Handles JSON parsing, auth headers, and error responses.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('vouch_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'API request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

// ===== AUTH =====
export const api = {
  auth: {
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    loginGoogle: (credential) => request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
    loginInstagram: (code) => request('/auth/instagram', { method: 'POST', body: JSON.stringify({ code }) }),
    me: () => request('/auth/me'),
  },

  // ===== USERS =====
  users: {
    getProfile: (userId) => request(`/users/${userId}`),
    updateProfile: (data) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    completeOnboarding: (data) => request('/users/me/onboarding', { method: 'POST', body: JSON.stringify(data) }),
    searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
    getFollowers: (userId) => request(`/users/${userId}/followers`),
    getFollowing: (userId) => request(`/users/${userId}/following`),
    follow: (userId) => request(`/users/${userId}/follow`, { method: 'POST' }),
    unfollow: (userId) => request(`/users/${userId}/follow`, { method: 'DELETE' }),
    getStats: (userId) => request(`/users/${userId}/stats`),
    getRatings: (userId) => request(`/users/${userId}/ratings`),
    getRelationship: (userId) => request(`/users/${userId}/relationship`),
    getTastemakers: (limit = 20) => request(`/users/tastemakers?limit=${limit}`),
  },

  // ===== TASTE MATCH =====
  tasteMatch: {
    twins: (limit = 10) => request(`/taste-match/twins?limit=${limit}`),
    with: (userId) => request(`/taste-match/with/${userId}`),
  },

  // ===== EXPERIENCES =====
  experiences: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/experiences/${qs ? `?${qs}` : ''}`);
    },
    search: (q, category) => {
      const params = new URLSearchParams({ q });
      if (category) params.set('category', category);
      return request(`/experiences/search?${params}`);
    },
    get: (id) => request(`/experiences/${id}`),
    create: (data) => request('/experiences/', { method: 'POST', body: JSON.stringify(data) }),
    searchPlaces: (q, lat, lng, radius) => {
      const params = new URLSearchParams({ q });
      if (lat) params.set('lat', lat);
      if (lng) params.set('lng', lng);
      if (radius) params.set('radius', radius);
      return request(`/experiences/external/places?${params}`);
    },
    searchEvents: (q, city) => {
      const params = new URLSearchParams({ q });
      if (city) params.set('city', city);
      return request(`/experiences/external/events?${params}`);
    },
  },

  // ===== RATINGS =====
  ratings: {
    create: (data) => request('/ratings/', { method: 'POST', body: JSON.stringify(data) }),
    update: (ratingId, data) => request(`/ratings/${ratingId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getMine: (experienceId) => request(`/ratings/mine/${experienceId}`),
    getForExperience: (experienceId) => request(`/ratings/experience/${experienceId}`),
    getForUser: (userId) => request(`/ratings/user/${userId}`),
  },

  // ===== FEED =====
  feed: {
    get: (cursor, category, lat, lng) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (category) params.set('category', category);
      if (lat != null) params.set('lat', lat);
      if (lng != null) params.set('lng', lng);
      const qs = params.toString();
      return request(`/feed/${qs ? `?${qs}` : ''}`);
    },
  },

  // ===== WISHLIST =====
  wishlist: {
    get: () => request('/wishlist/'),
    getExperiences: () => request('/wishlist/experiences'),
    add: (experienceId) => request(`/wishlist/${experienceId}`, { method: 'POST' }),
    remove: (experienceId) => request(`/wishlist/${experienceId}`, { method: 'DELETE' }),
    check: (experienceId) => request(`/wishlist/check/${experienceId}`),
  },

  // ===== LISTS =====
  lists: {
    getMine: () => request('/lists/'),
    getForUser: (userId) => request(`/lists/user/${userId}`),
    get: (listId) => request(`/lists/${listId}`),
    getExperiences: (listId) => request(`/lists/${listId}/experiences`),
    create: (data) => request('/lists/', { method: 'POST', body: JSON.stringify(data) }),
    update: (listId, data) => request(`/lists/${listId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (listId) => request(`/lists/${listId}`, { method: 'DELETE' }),
    addItem: (listId, experienceId) =>
      request(`/lists/${listId}/items/${experienceId}`, { method: 'POST' }),
    removeItem: (listId, experienceId) =>
      request(`/lists/${listId}/items/${experienceId}`, { method: 'DELETE' }),
  },

  // ===== MAP =====
  map: {
    getPins: (params = {}) => {
      const qs = new URLSearchParams();
      if (params.category) qs.set('category', params.category);
      if (params.layer) qs.set('layer', params.layer);
      if (params.lat != null) qs.set('lat', params.lat);
      if (params.lng != null) qs.set('lng', params.lng);
      if (params.radius_km != null) qs.set('radius_km', params.radius_km);
      const s = qs.toString();
      return request(`/map/pins${s ? `?${s}` : ''}`);
    },
    getNeighborhoods: (category) => {
      const qs = category ? `?category=${encodeURIComponent(category)}` : '';
      return request(`/map/neighborhoods${qs}`);
    },
    /** Resolve a free-text area (e.g. "Soho") to lat/lng + radius. */
    locate: (query) => request(`/map/locate?query=${encodeURIComponent(query)}`),
  },
};
