import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Star, Loader2, Clock, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { trackSearch, trackWishlistAdd } from '../lib/analytics';
import PhotoCarousel from '../components/ui/PhotoCarousel';
import BookmarkIcon from '../components/ui/BookmarkIcon';

const TABS = [
  { key: 'places', label: 'Discover Places' },
  { key: 'events', label: 'Find Events' },
  { key: 'local', label: 'Vouched' },
];

// Curated trending search templates — `{city}` substituted at render time.
const TRENDING_TEMPLATES = [
  'best rooftop bars {city}',
  'brunch spots {city}',
  'late-night eats {city}',
  'cocktail bars {city}',
  'hidden gem restaurants {city}',
  'speakeasy {city}',
  'coffee shops {city}',
  'live music tonight {city}',
];

const HISTORY_KEY = 'vouch_search_history';
const HISTORY_MAX = 10;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function pushHistory(q) {
  const trimmed = (q || '').trim();
  if (!trimmed) return [];
  try {
    const cur = loadHistory().filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...cur].slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch { /* ignore */ }
}

/**
 * Search page — liquid glass search with translucent result cards.
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { location } = useLocation();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('places');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState(null);
  const [vouchedItems, setVouchedItems] = useState([]);
  const [vouchedLoaded, setVouchedLoaded] = useState(false);
  const [savedState, setSavedState] = useState({});
  const [scoreFilter, setScoreFilter] = useState('all'); // 'all' | '9+' | '7-8' | '5-6' | '0-4'
  const [history, setHistory] = useState(() => loadHistory());

  // Load wishlist once
  useEffect(() => {
    api.wishlist.get()
      .then((items) => {
        const map = {};
        (items || []).forEach((w) => { map[w.experience_id] = true; });
        setSavedState(map);
      })
      .catch(() => {});
  }, []);

  const toggleWishlist = async (e, expId) => {
    e?.stopPropagation?.();
    if (!expId) return;
    const wasSaved = savedState[expId];
    setSavedState((s) => ({ ...s, [expId]: !wasSaved }));
    try {
      if (wasSaved) await api.wishlist.remove(expId);
      else { await api.wishlist.add(expId); trackWishlistAdd(expId); }
    } catch {
      setSavedState((s) => ({ ...s, [expId]: wasSaved }));
    }
  };

  // ── Load user's vouched ratings when on the local tab ──────────
  useEffect(() => {
    if (activeTab !== 'local' || !user?.id) return;
    if (vouchedLoaded) return;
    setLoading(true);
    api.users.getRatings(user.id)
      .then((ratings) => {
        const items = ratings.map((r) => ({
          id: r.experience_id,
          name: r.experience_name,
          category: r.experience_category,
          cover_photo_url: r.experience_cover_photo,
          overall_score: r.overall_score,
        }));
        setVouchedItems(items);
        setVouchedLoaded(true);
      })
      .catch(() => setVouchedItems([]))
      .finally(() => setLoading(false));
  }, [activeTab, user?.id, vouchedLoaded]);

  // ── Core search function ───────────────────────────────────────
  // Accepts an optional override query so we can call it with a default
  // when auto-loading without the user having typed anything.
  const doSearch = useCallback(async (overrideQuery) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    // Remember this search in the user's local history (every tab).
    setHistory(pushHistory(q));
    if (!overrideQuery) trackSearch(q, activeTab);
    try {
      if (activeTab === 'local') {
        const data = await api.experiences.search(q, category || undefined);
        setResults(data);
      } else if (activeTab === 'places') {
        const data = await api.experiences.searchPlaces(q, location?.latitude, location?.longitude, 50000);
        setResults(data.results || []);
      } else {
        // Ticketmaster wants just the city name, not "San Francisco, CA"
        const cityOnly = location?.city?.split(',')[0]?.trim();
        const data = await api.experiences.searchEvents(q, cityOnly);
        setResults(data.results || []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeTab, category, location]);

  // ── Auto-load when location is set (or changes) ───────────────
  // Directly calls the API instead of going through doSearch so there
  // is no stale-closure risk with useCallback.
  useEffect(() => {
    if (!location?.latitude || !location?.longitude) return;
    if (activeTab === 'local') return;

    let cancelled = false;
    setLoading(true);
    setSearched(true);
    setQuery('');

    const run = async () => {
      try {
        let results = [];
        if (activeTab === 'places') {
          const data = await api.experiences.searchPlaces(
            'restaurants bars things to do',
            location.latitude,
            location.longitude,
            50000,
          );
          results = data.results || [];
        } else {
          const cityOnly = location.city.split(',')[0].trim();
          const data = await api.experiences.searchEvents('events', cityOnly);
          results = data.results || [];
        }
        if (!cancelled) setResults(results);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [location, activeTab]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') doSearch(); // no override — uses typed query
  };

  const navigateTo = async (item, tab) => {
    if ((tab === 'local' || tab === 'vouched') && item.id) {
      navigate(`/experience/${item.id}`);
      return;
    }
    if (item.google_place_id || item.ticketmaster_id) {
      try {
        setImporting(item.google_place_id || item.ticketmaster_id);
        const exp = await api.experiences.create({
          name: item.name,
          category: item.category || 'Food & Drink',
          subcategory: item.subcategory || '',
          address: item.address || '',
          description: item.description || '',
          google_place_id: item.google_place_id || null,
          ticketmaster_id: item.ticketmaster_id || null,
          cover_photo_url: item.cover_photo_url || '',
          latitude: item.latitude || null,
          longitude: item.longitude || null,
          is_event: item.is_event || false,
          event_date: item.event_date || null,
        });
        navigate(`/experience/${exp.id}`);
      } catch {
        navigate('/search');
      } finally {
        setImporting(null);
      }
    }
  };

  return (
    <div className="pb-20 lg:pb-8">
      <div className="px-4 lg:px-8 pt-4 max-w-6xl mx-auto">

        {/* Search input — glass */}
        <div className="glass-input rounded-full px-4 py-3 flex items-center gap-2 max-w-2xl">
          <Search className="w-4 h-4 text-secondary-text shrink-0" />
          <input
            type="text"
            placeholder={location ? `Search in ${location.city.split(',')[0]}…` : 'Search places, events, restaurants…'}
            className="bg-transparent outline-none text-sm w-full text-primary-text placeholder:text-secondary-text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
              className="text-secondary-text text-xs hover:text-primary-text transition-fluid"
            >
              Clear
            </button>
          )}
        </div>

        {/* Source tabs — glass pills */}
        <div className="flex gap-2 mt-4 items-center">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setResults([]); setSearched(false); }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-fluid ${
                activeTab === tab.key
                  ? 'bg-charcoal text-cream shadow-[0_2px_10px_rgba(26,23,20,0.15)]'
                  : 'glass-pill text-text-muted hover:text-charcoal hover:bg-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Score filter — right-aligned, active only on the Vouched tab */}
          {activeTab === 'local' && (
            <div className="ml-auto flex items-center gap-1.5">
              <Star size={12} className="text-secondary-text" />
              <select
                value={scoreFilter}
                onChange={(e) => setScoreFilter(e.target.value)}
                className="text-xs glass-pill rounded-full px-3 py-1.5 font-medium text-primary-text cursor-pointer focus:outline-none"
                title="Filter by score"
              >
                <option value="all">All scores</option>
                <option value="9+">9–10 · Great</option>
                <option value="7-8">7–8 · Good</option>
                <option value="5-6">5–6 · Mid</option>
                <option value="0-4">0–4 · Skip</option>
              </select>
            </div>
          )}
        </div>

        {/* Category filter (local tab) */}
        {activeTab === 'local' && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setCategory('')}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-fluid ${
                !category
                  ? 'bg-charcoal text-cream'
                  : 'glass-pill text-text-muted hover:text-charcoal'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-fluid ${
                  category === cat
                    ? 'bg-charcoal text-cream'
                    : 'glass-pill text-text-muted hover:text-charcoal'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Trending + history — always visible above results when input is empty */}
        {!query && activeTab !== 'local' && (
          <div className="mt-5 space-y-5">
            {history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                    <Clock size={12} /> Recent searches
                  </div>
                  <button
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-text-muted hover:text-terracotta transition-fluid"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((h) => (
                    <button
                      key={h}
                      onClick={() => { setQuery(h); doSearch(h); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full glass-pill text-primary-text hover:bg-white/60 transition-fluid"
                    >
                      <Clock size={10} className="text-text-muted" />
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                <TrendingUp size={12} />
                Trending{location ? ` in ${location.city.split(',')[0]}` : ''}
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING_TEMPLATES.map((t) => {
                  const q = t.replace('{city}', location?.city?.split(',')[0] || 'near me');
                  return (
                    <button
                      key={q}
                      onClick={() => { setQuery(q); doSearch(q); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full glass-pill text-primary-text hover:bg-white/60 transition-fluid"
                    >
                      <TrendingUp size={10} className="text-terracotta" />
                      {q}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="mt-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-terracotta animate-spin" />
            </div>
          )}

          {/* Vouched tab */}
          {!loading && activeTab === 'local' && (() => {
            const inScoreBand = (s) => {
              if (scoreFilter === 'all') return true;
              if (scoreFilter === '9+') return s >= 9;
              if (scoreFilter === '7-8') return s >= 7 && s < 9;
              if (scoreFilter === '5-6') return s >= 5 && s < 7;
              if (scoreFilter === '0-4') return s < 5;
              return true;
            };
            const filtered = vouchedItems
              .filter((v) => (category ? v.category === category : true))
              .filter((v) => inScoreBand(v.overall_score ?? 0));
            if (filtered.length > 0) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((item) => (
                    <ResultCard
                      key={item.id}
                      item={item}
                      tab="local"
                      navigate={navigateTo}
                      saved={savedState[item.id] || false}
                      onToggleSave={toggleWishlist}
                    />
                  ))}
                </div>
              );
            }
            if (vouchedLoaded) {
              return (
                <div className="text-center py-16">
                  <div className="glass rounded-2xl p-8 max-w-sm mx-auto">
                    <Star className="w-10 h-10 text-stone mx-auto mb-3" />
                    <p className="text-secondary-text text-sm">
                      {category
                        ? `No vouched experiences in ${category} yet.`
                        : "You haven\u2019t rated any experiences yet."}
                    </p>
                    <p className="text-secondary-text/60 text-xs mt-1">
                      Discover places and rate them to build your vouched list.
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Places / Events search results */}
          {!loading && activeTab !== 'local' && searched && results.length === 0 && (
            <div className="text-center py-16">
              <div className="glass rounded-2xl p-8 max-w-sm mx-auto">
                <p className="text-secondary-text text-sm">
                  No results found for &ldquo;{query}&rdquo;.
                </p>
              </div>
            </div>
          )}

          {!loading && activeTab !== 'local' && results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((item, i) => (
                <ResultCard
                  key={item.id || item.google_place_id || item.ticketmaster_id || i}
                  item={item}
                  tab={activeTab}
                  navigate={navigateTo}
                  saved={savedState[item.id] || false}
                  onToggleSave={toggleWishlist}
                />
              ))}
            </div>
          )}

          {/* Default state — shown only when there's no query, no results, and nothing is auto-loading */}
          {!loading && activeTab !== 'local' && !searched && !query && results.length === 0 && (
            <div className="text-center py-6">
              <div className="glass rounded-2xl p-6 max-w-sm mx-auto">
                <Search className="w-8 h-8 text-stone mx-auto mb-2" />
                <p className="text-secondary-text text-sm">
                  {location
                    ? `Loading ${activeTab === 'events' ? 'events' : 'places'} near ${location.city.split(',')[0]}…`
                    : 'Set your location in the sidebar, or tap a trending search above.'}
                </p>
                <p className="text-secondary-text/60 text-xs mt-2">
                  {activeTab === 'places' && 'Powered by Google Places'}
                  {activeTab === 'events' && 'Powered by Ticketmaster'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/** Single result card — matches Feed DiscoverCard style. */
function ResultCard({ item, tab, navigate, saved, onToggleSave }) {
  const isEvent = tab === 'events' || item.is_event;

  return (
    <div
      className="glass rounded-2xl overflow-hidden glass-hover cursor-pointer group"
      onClick={() => navigate(item, tab)}
    >
      <div className="relative">
        {(item.cover_photo_url || item.photo_urls) ? (
          <PhotoCarousel
            coverUrl={item.cover_photo_url}
            photoUrlsStr={item.photo_urls}
            alt={item.name}
          />
        ) : (
          <div className="aspect-square w-full bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center">
            {isEvent
              ? <Calendar className="w-8 h-8 text-stone" />
              : <MapPin className="w-8 h-8 text-stone" />}
          </div>
        )}
        {item.id && onToggleSave && (
          <div className="absolute top-2 right-2">
            <BookmarkIcon saved={saved} onToggle={(e) => onToggleSave(e, item.id)} />
          </div>
        )}
        {isEvent && item.event_date && (
          <div className="absolute bottom-2 left-2 glass-pill text-charcoal text-xs px-2.5 py-1 rounded-full font-medium">
            {new Date(item.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      <div className="p-3.5">
        <h3 className="font-serif font-bold text-sm text-primary-text line-clamp-1 group-hover:text-terracotta transition-fluid">
          {item.name}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs px-2.5 py-0.5 glass-pill rounded-full text-secondary-text font-medium">
            {item.category}
          </span>
          {item.subcategory && item.subcategory !== item.category && (
            <span className="text-xs text-secondary-text">{item.subcategory}</span>
          )}
        </div>

        {(item.neighborhood || item.address) && (
          <p className="text-xs text-secondary-text mt-1.5 flex items-center gap-1 line-clamp-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {item.neighborhood || item.address}
          </p>
        )}

        {item.description && (
          <p className="text-xs text-secondary-text/80 mt-1.5 line-clamp-2">{item.description}</p>
        )}

        {tab === 'local' && item.overall_score && (
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-3 h-3 text-amber fill-amber" />
            <span className="text-xs font-semibold">{item.overall_score}</span>
          </div>
        )}
      </div>
    </div>
  );
}
