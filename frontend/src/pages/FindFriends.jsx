import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Users, Sparkles, Star, Loader2, UserPlus, UserCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import TasteMatchBadge from '../components/ui/TasteMatchBadge';
import FriendBadge from '../components/ui/FriendBadge';
import TastemakerBadge from '../components/ui/TastemakerBadge';

/**
 * Find Friends page — Taste Twins (people with similar ratings) + user search.
 *
 * Solves the cold start problem: even with 0 friends, you see "people with your
 * taste loved..." discovery via the Twins list.
 */
export default function FindFriends() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [twins, setTwins] = useState([]);
  const [twinsLoading, setTwinsLoading] = useState(true);
  const [tastemakers, setTastemakers] = useState([]);
  const [tastemakersLoading, setTastemakersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  // Track follow state per user id (id → { isFollowing, isMutual })
  const [followState, setFollowState] = useState({});
  const [busyId, setBusyId] = useState(null);

  // Load Taste Twins + Tastemakers on mount
  useEffect(() => {
    let alive = true;
    setTwinsLoading(true);
    setTastemakersLoading(true);

    api.tasteMatch.twins(12)
      .then((data) => {
        if (!alive) return;
        setTwins(data || []);
        const initialState = {};
        (data || []).forEach((t) => {
          initialState[t.id] = { isFollowing: t.is_following, isMutual: t.is_mutual };
        });
        setFollowState((s) => ({ ...s, ...initialState }));
      })
      .catch(() => alive && setTwins([]))
      .finally(() => alive && setTwinsLoading(false));

    api.users.getTastemakers(20)
      .then((data) => {
        if (!alive) return;
        setTastemakers(data || []);
        const initialState = {};
        (data || []).forEach((t) => {
          initialState[t.id] = { isFollowing: t.is_following, isMutual: false };
        });
        setFollowState((s) => ({ ...initialState, ...s })); // don't overwrite twin state
      })
      .catch(() => alive && setTastemakers([]))
      .finally(() => alive && setTastemakersLoading(false));

    return () => { alive = false; };
  }, []);

  const doSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await api.users.searchUsers(q);
      // Filter out self
      const filtered = (results || []).filter((u) => u.id !== user?.id);
      setSearchResults(filtered);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, user?.id]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') doSearch();
  };

  const handleFollow = async (targetId) => {
    if (busyId) return;
    setBusyId(targetId);
    const cur = followState[targetId] || {};
    const wasFollowing = cur.isFollowing;
    // Optimistic update
    setFollowState((s) => ({
      ...s,
      [targetId]: { ...cur, isFollowing: !wasFollowing, isMutual: !wasFollowing && cur.isMutual },
    }));
    try {
      if (wasFollowing) {
        await api.users.unfollow(targetId);
        setFollowState((s) => ({ ...s, [targetId]: { isFollowing: false, isMutual: false } }));
      } else {
        await api.users.follow(targetId);
        // Re-check relationship for accurate is_mutual
        const rel = await api.users.getRelationship(targetId).catch(() => null);
        setFollowState((s) => ({
          ...s,
          [targetId]: {
            isFollowing: true,
            isMutual: rel?.is_mutual ?? cur.isMutual ?? false,
          },
        }));
      }
    } catch {
      // Revert on error
      setFollowState((s) => ({ ...s, [targetId]: cur }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-12 px-4 pt-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-charcoal flex items-center gap-2">
          <Users className="w-7 h-7 text-terracotta" />
          Find Your People
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Discover users who actually share your taste, then follow them for better recs.
        </p>
      </div>

      {/* Search bar */}
      <div className="glass-input rounded-full mb-6 px-4 py-3 flex items-center gap-3">
        <SearchIcon className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by username or name…"
          className="flex-1 bg-transparent outline-none text-charcoal placeholder:text-text-muted text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); setSearchResults([]); setSearched(false); }}
            className="text-text-muted text-xs hover:text-charcoal"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search results — only when actively searching */}
      {searched && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel icon={<SearchIcon className="w-3.5 h-3.5" />}>
              Search Results
            </SectionLabel>
          </div>
          {searching ? (
            <Spinner />
          ) : searchResults.length === 0 ? (
            <EmptyHint>No users found for "{searchQuery}".</EmptyHint>
          ) : (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  matchPct={null}
                  overlap={0}
                  state={followState[u.id]}
                  onFollow={() => handleFollow(u.id)}
                  onClick={() => navigate(`/profile/${u.id}`)}
                  busy={busyId === u.id}
                  isTastemaker={u.is_tastemaker}
                  specialty={u.tastemaker_specialty}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tastemakers — curated accounts (cold-start unlock) */}
      {!searched && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel icon={<Star className="w-3.5 h-3.5" fill="currentColor" />}>
              Tastemakers to Follow
            </SectionLabel>
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Vetted picks</span>
          </div>
          {tastemakersLoading ? (
            <Spinner />
          ) : tastemakers.length === 0 ? null : (
            <div className="space-y-2">
              {tastemakers.slice(0, 5).map((t) => (
                <UserRow
                  key={t.id}
                  user={t}
                  matchPct={null}
                  overlap={0}
                  state={followState[t.id]}
                  onFollow={() => handleFollow(t.id)}
                  onClick={() => navigate(`/profile/${t.id}`)}
                  busy={busyId === t.id}
                  isTastemaker={true}
                  specialty={t.tastemaker_specialty}
                  blurb={t.tastemaker_blurb}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Taste Twins */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <SectionLabel icon={<Sparkles className="w-3.5 h-3.5" />}>
            Your Taste Twins
          </SectionLabel>
        </div>

        {twinsLoading ? (
          <Spinner />
        ) : twins.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center">
            <Sparkles className="w-8 h-8 text-terracotta/60 mx-auto mb-2" />
            <p className="text-charcoal font-semibold mb-1">No taste twins yet</p>
            <p className="text-text-muted text-sm">
              Rate a few experiences first — we'll find people with similar taste.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="mt-4 inline-block bg-charcoal text-cream rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 transition-fluid"
            >
              Discover places to rate
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {twins.map((t) => (
              <UserRow
                key={t.id}
                user={t}
                matchPct={t.match_percent}
                overlap={t.overlap_count}
                state={followState[t.id]}
                onFollow={() => handleFollow(t.id)}
                onClick={() => navigate(`/profile/${t.id}`)}
                busy={busyId === t.id}
                isTastemaker={t.is_tastemaker}
                specialty={t.tastemaker_specialty}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Subcomponents ──

function UserRow({ user, matchPct, overlap, state, onFollow, onClick, busy, isTastemaker, specialty, blurb }) {
  const isFollowing = state?.isFollowing;
  const isMutual = state?.isMutual;

  return (
    <div className="glass rounded-2xl glass-hover p-3 flex items-center gap-3 transition-fluid">
      <button
        onClick={onClick}
        className="flex items-center gap-3 flex-1 text-left min-w-0"
      >
        <Avatar src={user.avatar_url} name={user.display_name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-charcoal truncate">{user.display_name}</span>
            <TastemakerBadge isTastemaker={isTastemaker} variant="icon" size="sm" specialty={specialty} />
            <FriendBadge isMutual={isMutual} isFollowing={isFollowing && !isMutual} size="sm" />
          </div>
          <div className="text-text-muted text-xs">@{user.username}</div>
          {isTastemaker && specialty && (
            <div className="mt-1.5">
              <TastemakerBadge isTastemaker={true} specialty={specialty} size="sm" />
            </div>
          )}
          {blurb && (
            <p className="text-text-muted text-xs mt-1 line-clamp-2">{blurb}</p>
          )}
          {matchPct !== null && matchPct !== undefined && (
            <div className="mt-1.5">
              <TasteMatchBadge pct={matchPct} overlap={overlap} size="sm" />
            </div>
          )}
        </div>
      </button>

      <button
        onClick={onFollow}
        disabled={busy}
        className={
          isFollowing
            ? 'glass-pill px-4 py-2 text-xs font-semibold text-charcoal/80 inline-flex items-center gap-1.5 transition-fluid hover:bg-white/50'
            : 'bg-charcoal text-cream rounded-full px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-fluid hover:opacity-90 active:scale-[0.97]'
        }
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isFollowing ? (
          <>
            <UserCheck className="w-3.5 h-3.5" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="w-3.5 h-3.5" />
            Follow
          </>
        )}
      </button>
    </div>
  );
}

function SectionLabel({ icon, children }) {
  return (
    <div className="text-xs uppercase tracking-wider text-terracotta font-bold flex items-center gap-1.5">
      {icon}
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-terracotta" />
    </div>
  );
}

function EmptyHint({ children }) {
  return (
    <div className="glass rounded-2xl p-5 text-center text-text-muted text-sm">
      {children}
    </div>
  );
}
