import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Clock, Bookmark, PenLine, Sparkles, Flame, FolderPlus, Check, Plus, X } from 'lucide-react';
import PhotoCarousel from '../components/ui/PhotoCarousel';
import VouchScore from '../components/ui/VouchScore';
import ScoreLabel from '../components/ui/ScoreLabel';
import CategoryTag from '../components/ui/CategoryTag';
import Avatar from '../components/ui/Avatar';
import TagPill from '../components/ui/TagPill';
import Card from '../components/ui/Card';
import TastemakerBadge from '../components/ui/TastemakerBadge';
import { api } from '../lib/api';

export default function ExperienceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [experience, setExperience] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [myRating, setMyRating] = useState(null);
  const [showListPicker, setShowListPicker] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [exp, rats, wishCheck, mine] = await Promise.all([
          api.experiences.get(id),
          api.ratings.getForExperience(id),
          api.wishlist.check(id).catch(() => ({ wishlisted: false })),
          api.ratings.getMine(id).catch(() => null),
        ]);
        setExperience(exp);
        setRatings(Array.isArray(rats) ? rats : []);
        setSaved(wishCheck?.wishlisted || false);
        setMyRating(mine);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const avgScore = ratings.length
    ? Math.round(ratings.reduce((s, r) => s + r.overall_score, 0) / ratings.length)
    : 0;

  const avgVibe = ratings.length
    ? (ratings.reduce((s, r) => s + r.vibe_score, 0) / ratings.length).toFixed(1)
    : '–';
  const avgValue = ratings.length
    ? (ratings.reduce((s, r) => s + r.value_score, 0) / ratings.length).toFixed(1)
    : '–';
  const avgExp = ratings.length
    ? (ratings.reduce((s, r) => s + r.experience_score, 0) / ratings.length).toFixed(1)
    : '–';

  const parseTags = (str) => {
    if (!str) return [];
    return str.split(',').map((t) => t.trim()).filter(Boolean);
  };

  // ── Review summary (aggregated highlights) ─────────────────────
  const reviewSummary = (() => {
    if (ratings.length === 0) return null;
    const dims = [
      { key: 'vibe', label: 'vibe', avg: parseFloat(avgVibe) || 0 },
      { key: 'value', label: 'value', avg: parseFloat(avgValue) || 0 },
      { key: 'experience', label: 'experience', avg: parseFloat(avgExp) || 0 },
    ];
    const top = dims.reduce((a, b) => (b.avg > a.avg ? b : a));
    const positiveCount = ratings.filter((r) => r.overall_score >= 7).length;
    const pct = Math.round((positiveCount / ratings.length) * 100);

    // Collect descriptive adjectives that recur across reviews.
    const ADJECTIVES = [
      'great', 'amazing', 'incredible', 'delicious', 'cozy', 'lively', 'chill',
      'elegant', 'authentic', 'fresh', 'friendly', 'quiet', 'busy', 'intimate',
      'stylish', 'solid', 'excellent', 'perfect', 'warm', 'fun', 'vibey',
      'legit', 'sneaky-good', 'thoughtful', 'consistent', 'underrated',
    ];
    const freq = {};
    ratings.forEach((r) => {
      const text = (r.review_text || '').toLowerCase();
      ADJECTIVES.forEach((adj) => {
        if (text.includes(adj)) freq[adj] = (freq[adj] || 0) + 1;
      });
    });
    const topAdjs = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w);

    const adjPart = topAdjs.length
      ? `Reviewers describe it as ${topAdjs.join(', ')}.`
      : '';
    const verdict = pct >= 80
      ? 'It earns consistent praise'
      : pct >= 50
        ? 'Reception is generally warm'
        : 'Reviews are mixed';

    return {
      headline: `${verdict} — the ${top.label} stands out (${top.avg}/10).`,
      detail: adjPart,
      pct,
      count: ratings.length,
    };
  })();

  // ── Must Tries — specific things reviewers recommend ordering/doing. ─
  // Intentionally *not* from tags (those are too generic, e.g. "Date-Night").
  // Pull concrete noun phrases from recommendation patterns in review text.
  const mustTries = (() => {
    if (ratings.length === 0) return [];
    const items = new Map(); // key -> { label, count }

    // Words that should NEVER be a must-try on their own. If a captured
    // phrase is just these, skip it.
    const STOP_PHRASES = new Set([
      'there', 'early', 'late', 'here', 'it', 'them', 'that', 'this',
      'right', 'in', 'out', 'up', 'on', 'off', 'a seat', 'a table',
      'a drink', 'a reservation', 'ready', 'going', 'busy', 'home',
    ]);

    const addPhrase = (raw) => {
      if (!raw) return;
      let cleaned = raw.trim().replace(/\s+/g, ' ').replace(/[.,;!?]+$/, '');
      // Trim trailing filler words that aren't part of the thing.
      cleaned = cleaned.replace(/\s+(?:if|when|and|but|or|so|because|before|after)\s.*$/i, '');
      cleaned = cleaned.trim();
      if (cleaned.length < 3 || cleaned.length > 40) return;
      if (STOP_PHRASES.has(cleaned.toLowerCase())) return;
      // Must contain at least one noun-ish word (> 3 chars).
      if (!/[a-z]{4,}/i.test(cleaned)) return;

      const key = cleaned.toLowerCase();
      const entry = items.get(key) || { label: cleaned, count: 0 };
      entry.count += 1;
      items.set(key, entry);
    };

    // Patterns that signal a specific recommended thing (menu item, room, ritual).
    const PATTERNS = [
      // "order the chef's tasting", "try the cocktails", "get the ribeye"
      /\b(?:order|try|get|grab|sample|go for|ask for|have)\s+the\s+([a-z][a-z'’\s-]{2,40}?)(?=[.,;!?]|$)/gi,
      // "don't sleep on the back room"
      /\bdon'?t\s+sleep\s+on\s+the\s+([a-z][a-z'’\s-]{2,40}?)(?=[.,;!?]|$)/gi,
      // "the ribeye is incredible", "the bar program is sneaky-good"
      /\bthe\s+([a-z][a-z'’\s-]{2,40}?)\s+(?:is|are)\s+(?:great|amazing|incredible|legit|sneaky-good|perfect|excellent|the move|a standout|worth it|on point|dialed|unreal|top tier|a-tier)\b/gi,
      // "X is the move" / "X is a must"
      /\b([a-z][a-z'’\s-]{2,40}?)\s+is\s+(?:the move|a must|a standout|worth (?:it|the trip))\b/gi,
      // "stay for the room transitions"
      /\bstay\s+for\s+the\s+([a-z][a-z'’\s-]{2,40}?)(?=[.,;!?]|$)/gi,
    ];

    ratings.forEach((r) => {
      const text = r.review_text || '';
      PATTERNS.forEach((re) => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) addPhrase(m[1]);
      });
    });

    return Array.from(items.values())
      .sort((a, b) => b.count - a.count || a.label.length - b.label.length)
      .slice(0, 6);
  })();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <p className="text-red-600 mb-4">{error || 'Experience not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-terracotta font-semibold"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-8">
      {/* Header bar */}
      <div className="sticky top-0 z-20 bg-cream/90 backdrop-blur-sm border-b border-stone-light">
        <div className="max-w-[600px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-charcoal hover:text-terracotta transition-vouch"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowListPicker(true)}
              title="Save to list"
              className="p-2 rounded-full hover:bg-surface transition-colors"
            >
              <FolderPlus size={20} className="text-text-muted" />
            </button>
            <button
              onClick={async () => {
                try {
                  if (saved) {
                    await api.wishlist.remove(id);
                    setSaved(false);
                  } else {
                    await api.wishlist.add(id);
                    setSaved(true);
                  }
                } catch { /* ignore */ }
              }}
              className="p-2 rounded-full hover:bg-surface transition-colors"
            >
              <Bookmark
                size={20}
                className={saved ? 'fill-terracotta text-terracotta' : 'text-text-muted'}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 lg:px-8 py-6">
        {/* Photo carousel — square, matches feed style */}
        {(experience.cover_photo_url || experience.photo_urls) && (
          <PhotoCarousel
            coverUrl={experience.cover_photo_url}
            photoUrlsStr={experience.photo_urls}
            alt={experience.name}
            rounded="rounded-2xl"
            className="mb-6"
          />
        )}

        {/* Title + score */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold leading-tight">
              {experience.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <CategoryTag category={experience.category} />
              {experience.subcategory && (
                <span className="text-xs text-secondary-text">{experience.subcategory}</span>
              )}
            </div>
            {experience.address && (
              <div className="flex items-center gap-1 mt-2 text-sm text-secondary-text">
                <MapPin size={14} />
                <span>{experience.address}</span>
              </div>
            )}
            {experience.neighborhood && (
              <span className="text-xs text-secondary-text ml-5">{experience.neighborhood}</span>
            )}
          </div>
          {ratings.length > 0 && (
            <div className="flex flex-col items-end gap-1 ml-4">
              <VouchScore score={avgScore} size="lg" />
              <ScoreLabel score={avgScore} />
            </div>
          )}
        </div>

        {/* Description */}
        {experience.description && (
          <p className="text-sm text-primary-text leading-relaxed mb-6">
            {experience.description}
          </p>
        )}

        {/* Tags */}
        {parseTags(experience.tags).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {parseTags(experience.tags).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}

        {/* Score breakdown */}
        {ratings.length > 0 && (
          <Card>
            <h2 className="font-serif text-lg font-bold mb-3">Score Breakdown</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-terracotta">{avgVibe}</div>
                <div className="text-xs text-secondary-text mt-1">Vibe</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-terracotta">{avgValue}</div>
                <div className="text-xs text-secondary-text mt-1">Value</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-terracotta">{avgExp}</div>
                <div className="text-xs text-secondary-text mt-1">Experience</div>
              </div>
            </div>
            <div className="text-center mt-3 text-xs text-secondary-text">
              Based on {ratings.length} rating{ratings.length !== 1 ? 's' : ''}
            </div>
          </Card>
        )}

        {/* Review summary — aggregated highlights */}
        {reviewSummary && (
          <div className="mt-6">
            <Card>
              <h2 className="font-serif text-lg font-bold mb-2 flex items-center gap-2">
                <Sparkles size={18} className="text-terracotta" />
                Review Summary
              </h2>
              <p className="text-sm text-primary-text leading-relaxed">
                {reviewSummary.headline}
                {reviewSummary.detail && (
                  <span className="text-secondary-text"> {reviewSummary.detail}</span>
                )}
              </p>
              <div className="text-xs text-secondary-text mt-2">
                {reviewSummary.pct}% positive · {reviewSummary.count} review{reviewSummary.count !== 1 ? 's' : ''}
              </div>
            </Card>
          </div>
        )}

        {/* Must Tries — things people recommend */}
        {mustTries.length > 0 && (
          <div className="mt-4">
            <Card>
              <h2 className="font-serif text-lg font-bold mb-3 flex items-center gap-2">
                <Flame size={18} className="text-amber" />
                Must Tries
              </h2>
              <ul className="space-y-1.5">
                {mustTries.map((m) => (
                  <li key={m.label} className="flex items-center justify-between text-sm">
                    <span className="text-primary-text capitalize">{m.label}</span>
                    <span className="text-[11px] text-secondary-text">
                      {m.count}× mentioned
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-[11px] text-secondary-text mt-3">
                Pulled from what reviewers specifically recommend ordering or doing here.
              </div>
            </Card>
          </div>
        )}

        {/* Rate CTA button */}
        <div className="mt-6 mb-6">
          <button
            onClick={() => navigate(`/rate/${id}`, { state: { experience } })}
            className="w-full bg-charcoal text-cream py-3.5 rounded-full font-semibold
              flex items-center justify-center gap-2 hover:bg-terracotta transition-vouch"
          >
            <PenLine size={18} />
            {myRating ? 'Edit Your Rating' : 'Rate This Experience'}
          </button>
        </div>

        {/* Ratings / reviews */}
        <div className="mt-6">
          <h2 className="font-serif text-lg font-bold mb-4 flex items-center gap-2">
            <Star size={18} className="text-amber" />
            Reviews ({ratings.length})
          </h2>

          {ratings.length === 0 && (
            <p className="text-sm text-secondary-text text-center py-8">
              No reviews yet. Be the first to rate this experience!
            </p>
          )}

          <div className="space-y-4">
            {ratings.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.user_display_name || r.user_id} size="sm" />
                    <div>
                      {r.user_display_name && (
                        <div className="text-sm font-semibold text-primary-text flex items-center gap-1.5">
                          {r.user_display_name}
                          <TastemakerBadge
                            isTastemaker={r.user_is_tastemaker}
                            specialty={r.user_tastemaker_specialty}
                            variant="icon"
                            size="sm"
                          />
                        </div>
                      )}
                      <div className="text-xs text-secondary-text flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(r.created_at).toLocaleDateString()}
                        {r.user_is_tastemaker && r.user_tastemaker_specialty && (
                          <span className="ml-1 text-amber font-medium">· {r.user_tastemaker_specialty}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <VouchScore score={Math.round(r.overall_score)} size="sm" />
                </div>

                {r.review_text && (
                  <p className="text-sm text-primary-text leading-relaxed mb-2">
                    {r.review_text}
                  </p>
                )}

                <div className="flex gap-4 text-xs text-secondary-text">
                  <span>Vibe: <strong className="text-primary-text">{r.vibe_score}</strong></span>
                  <span>Value: <strong className="text-primary-text">{r.value_score}</strong></span>
                  <span>Exp: <strong className="text-primary-text">{r.experience_score}</strong></span>
                </div>

                {parseTags(r.tags).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {parseTags(r.tags).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {showListPicker && (
        <ListPickerModal
          experienceId={id}
          experienceName={experience.name}
          onClose={() => setShowListPicker(false)}
        />
      )}
    </div>
  );
}

// ── Save-to-list modal ────────────────────────────────────────────
// Shows the current user's lists with a tap-to-toggle affordance, plus
// an inline "Create new list" row so the whole flow happens here without
// leaving the experience detail page.
function ListPickerModal({ experienceId, experienceName, onClose }) {
  const [lists, setLists] = useState(null);     // null = loading
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});   // { [listId]: 'adding' | 'removing' | 'done' }
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const mine = await api.lists.getMine();
        if (ignore) return;
        // Each list from backend carries item_count; we mark which already
        // contain this experience by fetching items for each. For an MVP
        // with few lists per user this is fine; optimise later if needed.
        const withMembership = await Promise.all(
          (Array.isArray(mine) ? mine : []).map(async (l) => {
            try {
              const items = await api.lists.getExperiences(l.id);
              const has = Array.isArray(items) && items.some((i) => i.id === experienceId);
              return { ...l, has };
            } catch {
              return { ...l, has: false };
            }
          })
        );
        setLists(withMembership);
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load lists');
      }
    })();
    return () => { ignore = true; };
  }, [experienceId]);

  const toggle = async (list) => {
    setPending((p) => ({ ...p, [list.id]: list.has ? 'removing' : 'adding' }));
    try {
      if (list.has) {
        await api.lists.removeItem(list.id, experienceId);
      } else {
        await api.lists.addItem(list.id, experienceId);
      }
      setLists((ls) => ls.map((l) => (l.id === list.id ? { ...l, has: !l.has } : l)));
      setPending((p) => ({ ...p, [list.id]: 'done' }));
    } catch (e) {
      setError(e.message || 'Save failed');
      setPending((p) => ({ ...p, [list.id]: undefined }));
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const created = await api.lists.create({ name, description: '', is_public: true });
      await api.lists.addItem(created.id, experienceId);
      setLists((ls) => [{ ...created, has: true }, ...(ls || [])]);
      setShowCreate(false);
      setNewName('');
    } catch (e) {
      setError(e.message || 'Could not create list');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-cream rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-light">
          <div>
            <h2 className="font-serif text-lg font-bold">Save to list</h2>
            <p className="text-xs text-text-muted mt-0.5 truncate max-w-[260px]">{experienceName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-surface">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* Create new list row */}
          {showCreate ? (
            <div className="flex items-center gap-2 p-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createAndAdd(); }}
                placeholder="Name your list"
                className="flex-1 px-3 py-2 rounded-xl bg-white/60 text-sm focus:outline-none"
                maxLength={200}
              />
              <button
                onClick={createAndAdd}
                disabled={creating || !newName.trim()}
                className="px-3 py-2 rounded-xl bg-terracotta text-white text-sm font-semibold disabled:opacity-50"
              >
                {creating ? '…' : 'Create'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-terracotta/15 flex items-center justify-center">
                <Plus size={16} className="text-terracotta" />
              </div>
              <span className="text-sm font-semibold text-terracotta">Create new list</span>
            </button>
          )}

          <div className="h-px bg-stone-light my-1" />

          {lists === null && (
            <p className="p-4 text-sm text-text-muted">Loading your lists…</p>
          )}

          {lists && lists.length === 0 && (
            <p className="p-4 text-sm text-text-muted">
              No lists yet. Create one above to start saving places.
            </p>
          )}

          {lists && lists.map((list) => {
            const state = pending[list.id];
            return (
              <button
                key={list.id}
                onClick={() => toggle(list)}
                disabled={state === 'adding' || state === 'removing'}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  list.has ? 'bg-terracotta border-terracotta' : 'border-stone'
                }`}>
                  {list.has && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary-text truncate">{list.name}</p>
                  <p className="text-xs text-text-muted">
                    {list.item_count || 0} {list.item_count === 1 ? 'place' : 'places'}
                  </p>
                </div>
                {state === 'adding' && <span className="text-xs text-text-muted">Adding…</span>}
                {state === 'removing' && <span className="text-xs text-text-muted">Removing…</span>}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-red-500 px-4 pb-2">{error}</p>
        )}

        <div className="p-3 border-t border-stone-light">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-surface text-sm font-semibold text-primary-text"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
