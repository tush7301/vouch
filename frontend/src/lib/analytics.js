/**
 * Analytics — unified GA4 + Amplitude event tracking.
 *
 * Funnel events tracked:
 *   1. page_view (auto via GA4)
 *   2. login_page_viewed
 *   3. signup_started
 *   4. signup_completed
 *   5. login_completed
 *   6. onboarding_started
 *   7. onboarding_categories_selected
 *   8. onboarding_completed
 *   9. first_search
 *  10. first_rating
 *  11. first_wishlist_add
 */

function ga4Event(name, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

function ampEvent(name, params = {}) {
  if (window.amplitude?.track) {
    window.amplitude.track(name, params);
  }
}

function ampIdentify(userId, props = {}) {
  if (window.amplitude?.setUserId) {
    window.amplitude.setUserId(String(userId));
  }
  if (window.amplitude?.identify && Object.keys(props).length > 0) {
    const identify = new window.amplitude.Identify();
    Object.entries(props).forEach(([k, v]) => identify.set(k, v));
    window.amplitude.identify(identify);
  }
}

// ===== Public API =====

export function trackLoginPageViewed() {
  ga4Event('login_page_viewed');
  ampEvent('Login Page Viewed');
}

export function trackSignupStarted(method = 'email') {
  ga4Event('signup_started', { method });
  ampEvent('Signup Started', { method });
}

export function trackSignupCompleted(user) {
  ga4Event('sign_up', { method: 'email' });
  ampEvent('Signup Completed', { user_id: user.id });
  ampIdentify(user.id, { email: user.email, username: user.username });
}

export function trackLoginCompleted(user, method = 'email') {
  ga4Event('login', { method });
  ampEvent('Login Completed', { method, user_id: user.id });
  ampIdentify(user.id, { email: user.email, username: user.username });
}

export function trackOnboardingStarted() {
  ga4Event('onboarding_started');
  ampEvent('Onboarding Started');
}

export function trackOnboardingCategoriesSelected(categories) {
  ga4Event('onboarding_categories_selected', { count: categories.length });
  ampEvent('Onboarding Categories Selected', { categories, count: categories.length });
}

export function trackOnboardingCompleted() {
  ga4Event('onboarding_completed');
  ampEvent('Onboarding Completed');
}

export function trackSearch(query, tab) {
  ga4Event('search', { search_term: query, tab });
  ampEvent('Search Performed', { query, tab });
}

export function trackRatingCreated(experienceId, score) {
  ga4Event('rating_created', { experience_id: experienceId, score });
  ampEvent('Rating Created', { experience_id: experienceId, score });
}

export function trackWishlistAdd(experienceId) {
  ga4Event('wishlist_add', { experience_id: experienceId });
  ampEvent('Wishlist Add', { experience_id: experienceId });
}

export function trackPageView(pageName) {
  ga4Event('page_view', { page_title: pageName });
  ampEvent('Page Viewed', { page: pageName });
}
