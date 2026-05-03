import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Calendar, Search, Loader2, Flame, Award, Star, Users,
} from 'lucide-react';
import BookmarkIcon from '../components/ui/BookmarkIcon';
import Avatar from '../components/ui/Avatar';
import PhotoCarousel from '../components/ui/PhotoCarousel';
import { CATEGORIES } from '../lib/constants';
import { api } from '../lib/api';
import { trackWishlistAdd } from '../lib/analytics';
import { useLocation } from '../context/LocationContext';

const NYC_DEFAULT = { city: 'New York', latitude: 40.7128, longitude: -74.006 };

const TABS = [
  { key: 'for_you', label: 'For You' },
  { key: 'vouch_picks', label: 'Vouch Picks' },
  ...CATEGORIES.map((c) => ({ key: c, label: c })),
];

const CATEGORY_QUERIES = {
  'Food & Drink': 'restaurants cafes bars food',
  'Live Events': 'concerts events shows live music',
  'Sports': 'sports stadium gym fitness',
  'Wellness & Fitness': 'spa gym yoga wellness fitness',
  'Arts & Culture': 'museums art galleries theaters',
  'Social Scenes': 'bars clubs lounges nightlife',
};

// ── Feed card — handles friend_activity, vouch_pick, and trending items ──
function FriendActivityCard({ item, saved, onToggleSave, onClick }) {
  const { experience: exp, rating, user, time_ago, type } = item;
  if (!exp) return null;

  const isFriendActivity = type === 'friend_activity';
  const isPick = type === 'vouch_pick';
  const isTrending = type === 'trending';

  return (
    <div className="glass rounded-2xl overflow-hidden cursor-pointer group" onClick={onClick}>
      {/* Header — user attribution for friend activity, badge for picks/trending */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        {isFriendActivity && user ? (
          <>
            <Avatar name={user.display_name} src={user.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-text leading-tight truncate">
                {user.display_name}
                <span className="font-normal text-secondary-text"> vouched for</span>
              </p>
              <p className="text-xs text-secondary-text">{time_ago}</p>
            </div>
          </>
        ) : (
          <>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPick ? 'bg-amber/15' : 'bg-terracotta/15'}`}>
              {isPick ? (
                <Award size={14} className="text-amber" />
              ) : (
                <Flame size={14} className="text-terracotta" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-text leading-tight truncate">
                {isPick ? 'Vouch Pick' : 'Trending now'}
                <span className="font-normal text-secondary-text"> · {exp.category}</span>
              </p>
              <p className="text-xs text-secondary-text truncate">{time_ago}</p>
            </div>
          </>
        )}
        {rating?.overall_score > 0 && (
          <div className="shrink-0 flex items-center gap-1 bg-amber/10 px-2 py-0.5 rounded-full">
            <Star size={11} className="text-amber fill-amber" />
            <span className="text-xs font-bold text-amber">{rating.overall_score?.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Photo carousel — square like Instagram */}
      <PhotoCarousel
        coverUrl={exp.cover_photo_url}
        photoUrlsStr={exp.photo_urls}
        alt={exp.name}
      />

      {/* Info */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-base text-primary-text group-hover:text-terracotta transition-fluid line-clamp-1">
              {exp.name}
            </h3>
            {(exp.neighborhood || exp.address) && (
              <p className="text-xs text-secondary-text mt-0.5 flex items-center gap-1">
                <MapPin size={10} className="shrink-0" />
                {exp.neighborhood || exp.address}
              </p>
            )}
          </div>
          {exp.id && (
            <div className="shrink-0 -mt-1">
              <BookmarkIcon saved={saved} onToggle={(e) => onToggleSave(e, exp.id)} />
            </div>
          )}
        </div>
        {rating?.review_text && (
          <p className="text-sm text-secondary-text mt-2 line-clamp-2 leading-relaxed">
            &ldquo;{rating.review_text}&rdquo;
          </p>
        )}
        {rating?.tags && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {rating.tags.split(',').filter(Boolean).slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] glass-pill px-2 py-0.5 rounded-full text-secondary-text">
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vouch Pick horizontal card (Spotify style) ─────────────────
function VouchPickCard({ item, onClick }) {
  const { experience: exp, time_ago } = item;
  if (!exp) return null;

  return (
    <div
      className="shrink-0 w-40 cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative w-40 h-40 rounded-2xl overflow-hidden">
        {exp.cover_photo_url ? (
          <img src={exp.cover_photo_url} alt={exp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-terracotta/20 to-amber/20 flex items-center justify-center">
            <MapPin size={28} className="text-terracotta/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <div className="flex items-center gap-1">
            <Award size={10} className="text-amber" />
            <span className="text-[10px] text-amber font-bold">Vouch Pick</span>
          </div>
        </div>
      </div>
      <h4 className="text-sm font-bold mt-2 text-primary-text line-clamp-1 group-hover:text-terracotta transition-fluid">
        {exp.name}
      </h4>
      <p className="text-xs text-secondary-text mt-0.5 line-clamp-1">{exp.neighborhood || exp.category}</p>
      <p className="text-xs text-terracotta font-medium mt-0.5">{time_ago}</p>
    </div>
  );
}

// ── Discover card (Google Places) ──────────────────────────────
function DiscoverCard({ exp, saved, onToggleSave, onClick }) {
  return (
    <div
      className="glass rounded-2xl overflow-hidden glass-hover cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative">
        {(exp.cover_photo_url || exp.photo_urls) ? (
          <PhotoCarousel
            coverUrl={exp.cover_photo_url}
            photoUrlsStr={exp.photo_urls}
            alt={exp.name}
          />
        ) : (
          <div className="aspect-square w-full bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center">
            {exp.is_event ? <Calendar size={32} className="text-stone" /> : <MapPin size={32} className="text-stone" />}
          </div>
        )}
        {exp.id && (
          <div className="absolute top-2 right-2">
            <BookmarkIcon saved={saved} onToggle={(e) => onToggleSave(e, exp.id)} />
          </div>
        )}
        {exp.is_event && exp.event_date && (
          <div className="absolute bottom-2 left-2 glass-pill text-charcoal text-xs px-2.5 py-1 rounded-full font-medium">
            {new Date(exp.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="font-serif font-bold text-sm text-primary-text line-clamp-1 group-hover:text-terracotta transition-fluid">
          {exp.name}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs px-2.5 py-0.5 glass-pill rounded-full text-secondary-text font-medium">
            {exp.category}
          </span>
        </div>
        {(exp.neighborhood || exp.address) && (
          <p className="text-xs text-secondary-text mt-1.5 flex items-center gap-1 line-clamp-1">
            <MapPin size={10} className="shrink-0" />
            {exp.neighborhood || exp.address}
          </p>
        )}
        {exp.description && (
          <p className="text-xs text-secondary-text/80 mt-1.5 line-clamp-2">{exp.description}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Feed ──────────────────────────────────────────────────
export default function Feed() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const effectiveLocation = location || NYC_DEFAULT;
  const displayCity = (location?.city || 'New York').split(',')[0];

  const [activeTab, setActiveTab] = useState('for_you');

  // Social feed state
  const [feedItems, setFeedItems] = useState([]);
  const [vouchPicks, setVouchPicks] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);

  // Discover (Google Places) state
  const [discoverResults, setDiscoverResults] = useState({});
  const [discoverLoading, setDiscoverLoading] = useState({});

  const [savedState, setSavedState] = useState({});
  const loadedRef = useRef(new Set());
  const prevLocationKeyRef = useRef(null);

  // Wishlist state
  useEffect(() => {
    api.wishlist.get()
      .then((items) => {
        const map = {};
        (items || []).forEach((w) => { map[w.experience_id] = true; });
        setSavedState(map);
      })
      .catch(() => {});
  }, []);

  // Clear discover cache on location change
  const locationKey = `${effectiveLocation.latitude},${effectiveLocation.longitude}`;
  useEffect(() => {
    if (prevLocationKeyRef.current === locationKey) return;
    prevLocationKeyRef.current = locationKey;
    setDiscoverResults({});
    loadedRef.current.clear();
  }, [locationKey]);

  // Load social feed + vouch picks
  useEffect(() => {
    setFeedLoading(true);
    api.feed.get(null, null, effectiveLocation.latitude, effectiveLocation.longitude)
      .then((data) => {
        const items = data?.items || [];
        // For You = friend activity + vouch picks + trending (all already
        // scoped to the user's categories + city by the backend). This way
        // a brand-new user with 0 follows still sees category-matched
        // highly-rated places in their city, not a "follow people" empty state.
        setFeedItems(items);
        setVouchPicks(items.filter((i) => i.type === 'vouch_pick'));
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, [locationKey]);

  // Load Google Places for category tabs
  const fetchDiscover = useCallback(async (cat) => {
    if (loadedRef.current.has(cat)) return;
    loadedRef.current.add(cat);
    setDiscoverLoading((l) => ({ ...l, [cat]: true }));
    try {
      const q = CATEGORY_QUERIES[cat] || cat;
      const data = await api.experiences.searchPlaces(
        q, effectiveLocation.latitude, effectiveLocation.longitude, 50000,
      );
      setDiscoverResults((prev) => ({ ...prev, [cat]: data.results || [] }));
    } catch {
      loadedRef.current.delete(cat);
      setDiscoverResults((prev) => ({ ...prev, [cat]: [] }));
    } finally {
      setDiscoverLoading((l) => ({ ...l, [cat]: false }));
    }
  }, [effectiveLocation]);

  useEffect(() => {
    if (activeTab !== 'for_you' && activeTab !== 'vouch_picks') {
      fetchDiscover(activeTab);
    }
  }, [activeTab, fetchDiscover]);

  const toggleWishlist = async (e, expId) => {
    e?.stopPropagation?.();
    const wasSaved = savedState[expId];
    setSavedState((s) => ({ ...s, [expId]: !wasSaved }));
    try {
      if (wasSaved) { await api.wishlist.remove(expId); }
      else { await api.wishlist.add(expId); trackWishlistAdd(expId); }
    } catch {
      setSavedState((s) => ({ ...s, [expId]: wasSaved }));
    }
  };

  const goToExp = (item) => {
    if (item.experience?.id) navigate(`/experience/${item.experience.id}`);
  };

  const isCategoryTab = activeTab !== 'for_you' && activeTab !== 'vouch_picks';
  const discoverItems = discoverResults[activeTab] || [];
  const isDiscoverLoading = discoverLoading[activeTab];

  return (
    <div className="pb-20 lg:pb-8">
      {/* Search bar */}
      <div className="px-4 lg:px-8 pt-4 pb-1 max-w-6xl mx-auto">
        <div
          className="glass-input rounded-full px-4 py-3 flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/search')}
        >
          <Search className="w-4 h-4 text-secondary-text" />
          <span className="text-secondary-text text-sm">
            {`What do you want to do in ${displayCity}?`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 lg:px-8 mt-3 max-w-6xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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
      </div>

      {/* ── FOR YOU tab ───────────────────────────────────────── */}
      {activeTab === 'for_you' && (
        <div className="max-w-6xl mx-auto">
          {feedLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 text-terracotta animate-spin" />
            </div>
          ) : (
            <div className="mt-6 px-4 lg:px-8">
              {feedItems.length > 0 ? (
                <div className="max-w-[600px] mx-auto space-y-5">
                  {(() => {
                    // Group items by type, preserving backend order within each group.
                    const friendItems = feedItems.filter((i) => i.type === 'friend_activity');
                    const pickItems = feedItems.filter((i) => i.type === 'vouch_pick');
                    const trendingItems = feedItems.filter((i) => i.type === 'trending');
                    const sections = [];

                    if (friendItems.length > 0) {
                      sections.push(
                        <section key="friends">
                          <h2 className="font-serif text-base font-bold flex items-center gap-2 mb-3">
                            <Users size={16} className="text-terracotta" />
                            From people you follow
                          </h2>
                          <div className="space-y-4">
                            {friendItems.map((item, i) => (
                              <FriendActivityCard
                                key={item.rating?.id || `f${i}`}
                                item={item}
                                saved={savedState[item.experience?.id] || false}
                                onToggleSave={toggleWishlist}
                                onClick={() => goToExp(item)}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    }

                    if (pickItems.length > 0) {
                      sections.push(
                        <section key="picks">
                          <h2 className="font-serif text-base font-bold flex items-center gap-2 mb-3">
                            <Award size={16} className="text-terracotta" />
                            Picks for you in {displayCity}
                          </h2>
                          <div className="space-y-4">
                            {pickItems.map((item, i) => (
                              <FriendActivityCard
                                key={item.experience?.id || `p${i}`}
                                item={item}
                                saved={savedState[item.experience?.id] || false}
                                onToggleSave={toggleWishlist}
                                onClick={() => goToExp(item)}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    }

                    if (trendingItems.length > 0) {
                      sections.push(
                        <section key="trending">
                          <h2 className="font-serif text-base font-bold flex items-center gap-2 mb-3">
                            <Flame size={16} className="text-terracotta" />
                            Trending in {displayCity}
                          </h2>
                          <div className="space-y-4">
                            {trendingItems.map((item, i) => (
                              <FriendActivityCard
                                key={item.experience?.id || `t${i}`}
                                item={item}
                                saved={savedState[item.experience?.id] || false}
                                onToggleSave={toggleWishlist}
                                onClick={() => goToExp(item)}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    }

                    return sections;
                  })()}
                </div>
              ) : (
                <div className="py-12 text-center glass rounded-2xl max-w-[600px] mx-auto">
                  <Users size={32} className="mx-auto text-stone mb-3" />
                  <h3 className="font-serif font-bold">Your feed is empty</h3>
                  <p className="text-sm text-secondary-text mt-1 mb-4">
                    Follow friends and tastemakers to fill it up.
                  </p>
                  <button
                    onClick={() => navigate('/friends')}
                    className="bg-charcoal text-cream px-6 py-2 rounded-full font-semibold text-sm hover:bg-terracotta transition-fluid"
                  >
                    Find friends
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VOUCH PICKS tab ───────────────────────────────────── */}
      {activeTab === 'vouch_picks' && (
        <div className="max-w-6xl mx-auto px-4 lg:px-8 mt-5">
          {feedLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 text-terracotta animate-spin" />
            </div>
          ) : vouchPicks.length > 0 ? (
            <>
              <div className="mb-4">
                <h2 className="font-serif text-lg font-bold">Vouch Picks in {displayCity}</h2>
                <p className="text-xs text-secondary-text mt-0.5">Community's highest-rated experiences</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {vouchPicks.map((item, i) => (
                  <div
                    key={item.experience?.id || i}
                    className="glass rounded-2xl overflow-hidden cursor-pointer group"
                    onClick={() => goToExp(item)}
                  >
                    <div className="relative">
                      <PhotoCarousel
                        coverUrl={item.experience?.cover_photo_url}
                        photoUrlsStr={item.experience?.photo_urls}
                        alt={item.experience?.name}
                        height="h-44"
                      />
                      {!item.experience?.cover_photo_url && (
                        <div className="w-full h-44 bg-gradient-to-br from-terracotta/10 to-amber/10 flex items-center justify-center">
                          <MapPin size={32} className="text-stone" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-terracotta/90 backdrop-blur-sm text-cream text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Award size={10} /> Vouch Pick
                      </div>
                    </div>
                    <div className="p-3.5">
                      <h3 className="font-serif font-bold text-sm group-hover:text-terracotta transition-fluid line-clamp-1">
                        {item.experience?.name}
                      </h3>
                      <p className="text-xs text-secondary-text mt-0.5">{item.experience?.neighborhood || item.experience?.category}</p>
                      <p className="text-xs text-terracotta font-semibold mt-1">{item.time_ago}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center glass rounded-2xl">
              <Award size={32} className="mx-auto text-stone mb-3" />
              <h3 className="font-serif font-bold">No Vouch Picks yet in {displayCity}</h3>
              <p className="text-sm text-secondary-text mt-1">Rate experiences to create picks for your city.</p>
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORY tabs (Google Places) ─────────────────────── */}
      {isCategoryTab && (
        <div className="max-w-6xl mx-auto px-4 lg:px-8 mt-4">
          {isDiscoverLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 text-terracotta animate-spin" />
            </div>
          ) : discoverItems.length === 0 ? (
            <div className="py-16 text-center glass rounded-2xl">
              <Search size={32} className="mx-auto text-stone mb-3" />
              <h3 className="font-serif font-bold">Nothing found in {displayCity}</h3>
              <p className="text-sm text-secondary-text mt-1">Try a different category or change your location.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {discoverItems.map((exp, i) => (
                <DiscoverCard
                  key={exp.id || exp.google_place_id || i}
                  exp={exp}
                  saved={savedState[exp.id] || false}
                  onToggleSave={toggleWishlist}
                  onClick={() => {
                    if (exp.id) navigate(`/experience/${exp.id}`);
                    else navigate('/search');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
