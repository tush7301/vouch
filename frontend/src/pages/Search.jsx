import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Star, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { trackSearch } from '../lib/analytics';

const TABS = [
  { key: 'places', label: 'Discover Places' },
  { key: 'events', label: 'Find Events' },
  { key: 'local', label: 'Vouched' },
];

/**
 * Search page — liquid glass search with translucent result cards.
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('places');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState(null);
  const [vouchedItems, setVouchedItems] = useState([]);
  const [vouchedLoaded, setVouchedLoaded] = useState(false);

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

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    trackSearch(query, activeTab);
    try {
      if (activeTab === 'local') {
        const data = await api.experiences.search(query, category || undefined);
        setResults(data);
      } else if (activeTab === 'places') {
        const data = await api.experiences.searchPlaces(query);
        setResults(data.results || []);
      } else {
        const data = await api.experiences.searchEvents(query);
        setResults(data.results || []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeTab, category]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') doSearch();
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
            placeholder="Search places, events, restaurants…"
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
        <div className="flex gap-2 mt-4">
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

        {/* Results */}
        <div className="mt-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-terracotta animate-spin" />
            </div>
          )}

          {/* Vouched tab */}
          {!loading && activeTab === 'local' && (() => {
            const filtered = category
              ? vouchedItems.filter((v) => v.category === category)
              : vouchedItems;
            if (filtered.length > 0) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((item) => (
                    <ResultCard key={item.id} item={item} tab="local" navigate={navigateTo} />
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
                <ResultCard key={item.id || item.google_place_id || item.ticketmaster_id || i} item={item} tab={activeTab} navigate={navigateTo} />
              ))}
            </div>
          )}

          {/* Default state */}
          {!loading && activeTab !== 'local' && !searched && (
            <div className="text-center py-16 lg:py-24">
              <div className="glass rounded-2xl p-8 max-w-sm mx-auto">
                <Search className="w-10 h-10 text-stone mx-auto mb-3" />
                <p className="text-secondary-text text-sm">
                  Search for restaurants, bars, concerts, fitness classes, and more.
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


/** Single result card — liquid glass. */
function ResultCard({ item, tab, navigate }) {
  const isEvent = tab === 'events' || item.is_event;

  return (
    <div
      className="glass rounded-2xl overflow-hidden glass-hover cursor-pointer"
      onClick={() => navigate(item, tab)}
    >
      {item.cover_photo_url ? (
        <div className="glass-card-img">
          <img
            src={item.cover_photo_url}
            alt={item.name}
            className="w-full h-36 object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center">
          {isEvent
            ? <Calendar className="w-8 h-8 text-stone" />
            : <MapPin className="w-8 h-8 text-stone" />}
        </div>
      )}

      <div className="p-3.5">
        <h3 className="font-serif font-bold text-sm text-primary-text line-clamp-1">{item.name}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs px-2.5 py-0.5 glass-pill rounded-full text-secondary-text font-medium">
            {item.category}
          </span>
          {item.subcategory && item.subcategory !== item.category && (
            <span className="text-xs text-secondary-text">{item.subcategory}</span>
          )}
        </div>

        {item.address && (
          <p className="text-xs text-secondary-text mt-1.5 flex items-center gap-1 line-clamp-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {item.address}
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
