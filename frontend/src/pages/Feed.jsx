import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Star, Search, Loader2, Flame, Award } from 'lucide-react';
import BookmarkIcon from '../components/ui/BookmarkIcon';
import { CATEGORIES } from '../lib/constants';
import { api } from '../lib/api';
import { trackWishlistAdd } from '../lib/analytics';

const TABS = [
  { key: 'all', label: 'For You' },
  { key: 'vouch_picks', label: 'Vouch Picks' },
  ...CATEGORIES.map((c) => ({ key: c, label: c })),
];

export default function Feed() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [experiencesByCategory, setExperiencesByCategory] = useState({});
  const [loading, setLoading] = useState({});
  const [savedState, setSavedState] = useState({});
  const [feedTags, setFeedTags] = useState({});

  useEffect(() => {
    api.wishlist.get()
      .then((items) => {
        const map = {};
        (items || []).forEach((w) => { map[w.experience_id] = true; });
        setSavedState(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.feed.get(null, null)
      .then((data) => {
        const tags = {};
        (data?.items || []).forEach((item) => {
          if (item.experience?.id && (item.type === 'vouch_pick' || item.type === 'trending')) {
            if (!tags[item.experience.id]) {
              tags[item.experience.id] = item.type;
            }
          }
        });
        setFeedTags(tags);
      })
      .catch(() => {});
  }, []);

  const toggleWishlist = async (e, expId) => {
    e.stopPropagation();
    const wasSaved = savedState[expId];
    setSavedState((s) => ({ ...s, [expId]: !wasSaved }));
    try {
      if (wasSaved) {
        await api.wishlist.remove(expId);
      } else {
        await api.wishlist.add(expId);
        trackWishlistAdd(expId);
      }
    } catch {
      setSavedState((s) => ({ ...s, [expId]: wasSaved }));
    }
  };

  const loadedRef = useRef(new Set());

  const fetchCategory = useCallback(async (cat) => {
    const cacheKey = cat || 'all';
    if (loadedRef.current.has(cacheKey)) return;
    loadedRef.current.add(cacheKey);
    setLoading((l) => ({ ...l, [cacheKey]: true }));
    try {
      const params = cat ? { category: cat, limit: 50 } : { limit: 50 };
      const data = await api.experiences.list(params);
      const seen = new Set();
      const unique = (data || []).filter((exp) => {
        if (seen.has(exp.id)) return false;
        seen.add(exp.id);
        return true;
      });
      setExperiencesByCategory((prev) => ({ ...prev, [cacheKey]: unique }));
    } catch {
      loadedRef.current.delete(cacheKey);
      setExperiencesByCategory((prev) => ({ ...prev, [cacheKey]: [] }));
    } finally {
      setLoading((l) => ({ ...l, [cacheKey]: false }));
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'vouch_picks') {
      fetchCategory(null);
    } else {
      const cat = activeTab === 'all' ? null : activeTab;
      fetchCategory(cat);
    }
  }, [activeTab, fetchCategory]);

  const cacheKey = (activeTab === 'vouch_picks') ? 'all' : (activeTab === 'all' ? 'all' : activeTab);
  const rawExperiences = experiencesByCategory[cacheKey] || [];
  const isLoading = loading[cacheKey];

  const experiences = activeTab === 'vouch_picks'
    ? rawExperiences.filter((exp) => feedTags[exp.id] === 'vouch_pick')
    : activeTab === 'trending'
      ? rawExperiences.filter((exp) => feedTags[exp.id] === 'trending')
      : rawExperiences;

  const gridRef = useRef(null);
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.children;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('opacity-100', 'translate-y-0');
            e.target.classList.remove('opacity-0', 'translate-y-5');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    );
    Array.from(cards).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activeTab, experiences]);

  return (
    <div className="pb-20 lg:pb-8">
      {/* Search bar — glass input */}
      <div className="px-4 lg:px-8 pt-4 pb-1 max-w-6xl mx-auto">
        <div
          className="glass-input rounded-full px-4 py-3 flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/search')}
        >
          <Search className="w-4 h-4 text-secondary-text" />
          <span className="text-secondary-text text-sm">What do you want to do today?</span>
        </div>
      </div>

      {/* Category tabs — glass pills */}
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

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-terracotta animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && experiences.length === 0 && (
        <div className="px-4 lg:px-8 max-w-6xl mx-auto text-center py-16">
          <div className="glass rounded-2xl p-8 max-w-sm mx-auto">
            <Search className="w-10 h-10 text-stone mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold mb-1">
              No experiences yet
            </h3>
            <p className="text-sm text-secondary-text mb-4">
              {activeTab === 'all'
                ? 'Discover and add places to see them here.'
                : `No ${activeTab} experiences found yet.`}
            </p>
            <button
              onClick={() => navigate('/search')}
              className="bg-charcoal text-cream px-6 py-2 rounded-full font-semibold text-sm hover:bg-terracotta hover:shadow-[0_4px_20px_rgba(194,101,58,0.25)] transition-fluid"
            >
              Discover experiences
            </button>
          </div>
        </div>
      )}

      {/* Experience grid */}
      {!isLoading && experiences.length > 0 && (
        <div className="px-4 lg:px-8 max-w-6xl mx-auto mt-4">
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
            {experiences.map((exp, i) => (
              <div
                key={exp.id}
                className="opacity-0 translate-y-5 transition-all duration-500 ease-out"
                style={{ transitionDelay: `${Math.min(i % 6, 5) * 60}ms` }}
              >
                <ExperienceCard
                  exp={exp}
                  tag={feedTags[exp.id]}
                  saved={savedState[exp.id] || false}
                  onToggleSave={toggleWishlist}
                  onClick={() => navigate(`/experience/${exp.id}`)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Experience card — liquid glass with image overlay. */
function ExperienceCard({ exp, tag, saved, onToggleSave, onClick }) {
  const isEvent = exp.is_event;

  return (
    <div
      className="glass rounded-2xl overflow-hidden glass-hover cursor-pointer group"
      onClick={onClick}
    >
      {/* Cover image */}
      <div className="relative glass-card-img">
        {exp.cover_photo_url ? (
          <img
            src={exp.cover_photo_url}
            alt={exp.name}
            className="w-full h-40 object-cover"
          />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center">
            {isEvent
              ? <Calendar className="w-8 h-8 text-stone" />
              : <MapPin className="w-8 h-8 text-stone" />}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <BookmarkIcon
            saved={saved}
            onToggle={(e) => onToggleSave(e, exp.id)}
          />
        </div>
        {/* Feed tag badge — glass pill style */}
        {tag === 'vouch_pick' && (
          <div className="absolute top-2 left-2 bg-terracotta/90 backdrop-blur-sm text-cream text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Award className="w-3 h-3" />
            Vouch Pick
          </div>
        )}
        {tag === 'trending' && (
          <div className="absolute top-2 left-2 bg-amber/90 backdrop-blur-sm text-cream text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Flame className="w-3 h-3" />
            Trending
          </div>
        )}
        {exp.is_event && exp.event_date && (
          <div className="absolute bottom-2 left-2 glass-pill text-charcoal text-xs px-2.5 py-1 rounded-full font-medium">
            {new Date(exp.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-serif font-bold text-sm text-primary-text line-clamp-1 group-hover:text-terracotta transition-fluid">
          {exp.name}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs px-2.5 py-0.5 glass-pill rounded-full text-secondary-text font-medium">
            {exp.category}
          </span>
          {exp.subcategory && exp.subcategory !== exp.category && (
            <span className="text-xs text-secondary-text">{exp.subcategory}</span>
          )}
        </div>
        {exp.neighborhood && (
          <p className="text-xs text-secondary-text mt-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {exp.neighborhood}
          </p>
        )}
        {!exp.neighborhood && exp.address && (
          <p className="text-xs text-secondary-text mt-1.5 flex items-center gap-1 line-clamp-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {exp.address}
          </p>
        )}
        {exp.description && (
          <p className="text-xs text-secondary-text/80 mt-1.5 line-clamp-2">{exp.description}</p>
        )}
      </div>
    </div>
  );
}
