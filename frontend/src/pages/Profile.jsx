import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut, Settings, Edit3, MapPin, Star, Bookmark, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import VouchScore from '../components/ui/VouchScore';
import ScoreLabel from '../components/ui/ScoreLabel';
import ScoreBreakdown from '../components/ui/ScoreBreakdown';
import CategoryTag from '../components/ui/CategoryTag';
import SectionLabel from '../components/ui/SectionLabel';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FriendBadge from '../components/ui/FriendBadge';
import TasteMatchBadge from '../components/ui/TasteMatchBadge';
import TastemakerBadge from '../components/ui/TastemakerBadge';
import { CATEGORIES, COLORS } from '../lib/constants';
import { api } from '../lib/api';

const TABS = [
  { key: 'ratings', label: 'Ratings', icon: Star },
  { key: 'wishlist', label: 'Wishlist', icon: Bookmark },
  { key: 'lists', label: 'Lists', icon: Users },
];

// ── Rating Card ────────────────────────────────────────────────
function RatingCard({ rating, onClick }) {
  return (
    <Card className="!p-0 overflow-hidden cursor-pointer" onClick={onClick}>
      {rating.experience_cover_photo ? (
        <div className="glass-card-img">
          <img
            src={rating.experience_cover_photo}
            alt={rating.experience_name}
            className="w-full h-28 object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-28 bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center">
          <MapPin size={24} className="text-stone" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <CategoryTag category={rating.experience_category} variant="gray" />
          <VouchScore score={rating.overall_score} size="sm" />
        </div>
        <h4 className="font-serif text-sm font-bold mt-2 leading-tight line-clamp-2">
          {rating.experience_name}
        </h4>
        <div className="mt-1.5">
          <ScoreLabel score={rating.overall_score} />
        </div>
        {rating.review_text && (
          <p className="text-xs text-secondary-text mt-1.5 line-clamp-2">{rating.review_text}</p>
        )}
      </div>
    </Card>
  );
}

// ── Wishlist Card ──────────────────────────────────────────────
function WishlistCard({ experience, onClick }) {
  return (
    <Card className="!p-0 overflow-hidden cursor-pointer" onClick={onClick}>
      {experience.cover_photo_url ? (
        <div className="glass-card-img">
          <img
            src={experience.cover_photo_url}
            alt={experience.name}
            className="w-full h-28 object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-28 bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center">
          <Bookmark size={24} className="text-stone" />
        </div>
      )}
      <div className="p-3">
        <CategoryTag category={experience.category} variant="gray" />
        <h4 className="font-serif text-sm font-bold mt-2 leading-tight line-clamp-2">
          {experience.name}
        </h4>
        {experience.neighborhood && (
          <p className="text-xs text-secondary-text mt-1 flex items-center gap-1">
            <MapPin size={10} /> {experience.neighborhood}
          </p>
        )}
      </div>
    </Card>
  );
}

// ── Edit Profile Modal — glass overlay ─────────────────────────
function EditProfileModal({ user, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ display_name: displayName, bio });
      onClose();
    } catch {
      // keep modal open
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4">
      <div className="glass-solid rounded-2xl shadow-xl w-full max-w-md animate-fade-up">
        <div className="flex items-center justify-between p-4 border-b border-white/30">
          <h2 className="font-serif text-lg font-bold">Edit Profile</h2>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text text-xl transition-fluid">×</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              className="mt-1 w-full px-3 py-2 glass-input rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              className="mt-1 w-full px-3 py-2 glass-input rounded-xl text-sm resize-none"
              placeholder="Tell people about yourself..."
            />
            <p className="text-right text-[10px] text-secondary-text mt-0.5">{bio.length}/300</p>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-white/30">
          <Button variant="ghost" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Followers/Following Modal — glass overlay ──────────────────
function PeopleModal({ title, people, onClose, onViewProfile }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4">
      <div className="glass-solid rounded-2xl shadow-xl w-full max-w-sm max-h-[70vh] flex flex-col animate-fade-up">
        <div className="flex items-center justify-between p-4 border-b border-white/30">
          <h2 className="font-serif text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text text-xl transition-fluid">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {people.length === 0 ? (
            <p className="text-sm text-secondary-text text-center py-8">No one yet</p>
          ) : (
            people.map((p) => (
              <button
                key={p.id}
                onClick={() => { onClose(); onViewProfile(p.id); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 transition-fluid"
              >
                <Avatar name={p.display_name} src={p.avatar_url} size="md" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary-text truncate">{p.display_name}</p>
                  <p className="text-xs text-terracotta">@{p.username}</p>
                </div>
                <ChevronRight size={16} className="text-secondary-text shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Profile Component ─────────────────────────────────────
export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams();

  const isOwnProfile = !userId || userId === String(user?.id);
  const profileUserId = isOwnProfile ? user?.id : userId;

  const [profileUser, setProfileUser] = useState(isOwnProfile ? user : null);
  const [stats, setStats] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [activeTab, setActiveTab] = useState('ratings');
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [peopleModal, setPeopleModal] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [isFollower, setIsFollower] = useState(false);
  const [tasteMatch, setTasteMatch] = useState(null); // { match_percent, overlap_count }

  const loadProfile = useCallback(async () => {
    if (!profileUserId) return;
    setLoading(true);
    try {
      const promises = [
        api.users.getStats(profileUserId),
        api.users.getRatings(profileUserId),
      ];

      if (!isOwnProfile) {
        promises.push(api.users.getProfile(profileUserId));
      }
      if (isOwnProfile) {
        promises.push(api.wishlist.getExperiences());
      }

      const results = await Promise.all(promises);
      setStats(results[0]);
      setRatings(results[1] || []);

      if (!isOwnProfile) {
        setProfileUser(results[2]);
      } else {
        setProfileUser(user);
        setWishlistItems(results[2] || []);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [profileUserId, isOwnProfile, user]);

  useEffect(() => {
    if (!isOwnProfile && user?.id && profileUserId) {
      // Get relationship + taste match in parallel
      Promise.all([
        api.users.getRelationship(profileUserId).catch(() => null),
        api.tasteMatch.with(profileUserId).catch(() => null),
      ]).then(([rel, match]) => {
        if (rel) {
          setIsFollowing(rel.is_following);
          setIsMutual(rel.is_mutual);
          setIsFollower(rel.is_follower);
        }
        if (match) {
          setTasteMatch(match);
        }
      });
    }
  }, [isOwnProfile, user?.id, profileUserId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (isOwnProfile && user) setProfileUser(user);
  }, [user, isOwnProfile]);

  const handleEditSave = async (data) => {
    await api.users.updateProfile(data);
    if (refreshUser) await refreshUser();
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.users.unfollow(profileUserId);
        setIsFollowing(false);
        setIsMutual(false);
        setStats((s) => s ? { ...s, follower_count: Math.max(0, s.follower_count - 1) } : s);
      } else {
        await api.users.follow(profileUserId);
        setIsFollowing(true);
        // Re-check relationship — if they already follow us, this becomes mutual
        const rel = await api.users.getRelationship(profileUserId).catch(() => null);
        if (rel) setIsMutual(rel.is_mutual);
        setStats((s) => s ? { ...s, follower_count: s.follower_count + 1 } : s);
      }
    } catch (err) {
      console.error('Follow/unfollow failed:', err);
    }
  };

  const showPeople = async (type) => {
    try {
      const people = type === 'followers'
        ? await api.users.getFollowers(profileUserId)
        : await api.users.getFollowing(profileUserId);
      setPeopleModal({
        title: type === 'followers' ? 'Followers' : 'Following',
        people,
      });
    } catch {
      // silent fail
    }
  };

  const viewUserProfile = (uid) => {
    navigate(`/profile/${uid}`);
  };

  const categories = profileUser?.selected_categories
    ? profileUser.selected_categories.split(',').filter(Boolean)
    : [];

  return (
    <div className="pb-20 lg:pb-8">
      {/* Mobile-only action buttons */}
      {isOwnProfile && (
        <div className="sticky top-0 z-40 flex items-center justify-end gap-3 px-4 lg:hidden py-3">
          <button
            onClick={() => navigate('/settings')}
            className="text-text-muted hover:text-charcoal transition-fluid"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-text-muted hover:text-charcoal transition-fluid"
          >
            <LogOut size={18} />
          </button>
        </div>
      )}

      {loading && !profileUser ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 lg:px-8 max-w-6xl mx-auto">
          {/* User header — glass card */}
          <div className="glass rounded-2xl p-5 mt-4">
            <div className="flex items-center gap-4">
              <Avatar name={profileUser?.display_name || 'User'} src={profileUser?.avatar_url} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-serif text-xl font-bold truncate">{profileUser?.display_name}</h2>
                  <TastemakerBadge
                    isTastemaker={profileUser?.is_tastemaker}
                    variant="icon"
                    size="md"
                    specialty={profileUser?.tastemaker_specialty}
                  />
                  {isOwnProfile && (
                    <button
                      onClick={() => setShowEdit(true)}
                      className="text-text-muted hover:text-terracotta transition-fluid shrink-0"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}
                  {!isOwnProfile && (
                    <FriendBadge
                      isMutual={isMutual}
                      isFollowing={isFollowing && !isMutual}
                      isFollower={isFollower && !isFollowing}
                      size="sm"
                    />
                  )}
                </div>
                <p className="text-sm text-terracotta font-medium">@{profileUser?.username}</p>
                {profileUser?.is_tastemaker && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <TastemakerBadge
                      isTastemaker={true}
                      specialty={profileUser?.tastemaker_specialty}
                      size="sm"
                    />
                  </div>
                )}
                {profileUser?.tastemaker_blurb && (
                  <p className="text-sm text-secondary-text mt-1 line-clamp-2 italic">
                    "{profileUser.tastemaker_blurb}"
                  </p>
                )}
                {profileUser?.bio && !profileUser?.tastemaker_blurb && (
                  <p className="text-sm text-secondary-text mt-0.5 line-clamp-2">{profileUser.bio}</p>
                )}
                {!isOwnProfile && tasteMatch && (
                  <div className="mt-2">
                    <TasteMatchBadge
                      pct={tasteMatch.match_percent}
                      overlap={tasteMatch.overlap_count}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* Average score badge — glass circle */}
              {stats?.avg_overall_score && (
                <div className="text-center shrink-0">
                  <div className="w-14 h-14 rounded-full glass-subtle border-2 border-amber/30 flex items-center justify-center">
                    <span className="font-serif font-bold text-lg text-charcoal">
                      {stats.avg_overall_score}
                    </span>
                  </div>
                  <span className="text-[9px] text-secondary-text mt-0.5 block">Avg Score</span>
                </div>
              )}
            </div>

            {/* Follow button (other user) */}
            {!isOwnProfile && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant={isFollowing ? 'ghost' : 'primary'}
                  className="w-full"
                  onClick={handleFollow}
                >
                  {isMutual ? 'Friends ✓' : isFollowing ? 'Following' : isFollower ? 'Follow back' : 'Follow'}
                </Button>
              </div>
            )}
          </div>

          {/* Stats bar — glass surface */}
          <div className="flex items-center justify-between mt-4 py-3 px-4 glass rounded-2xl">
            <div className="text-center flex-1">
              <p className="font-serif font-bold text-lg">{stats?.rating_count ?? 0}</p>
              <p className="text-[10px] text-secondary-text uppercase font-semibold tracking-wide">Rated</p>
            </div>
            <div className="w-px h-8 bg-white/40" />
            <button className="text-center flex-1" onClick={() => showPeople('followers')}>
              <p className="font-serif font-bold text-lg">{stats?.follower_count ?? 0}</p>
              <p className="text-[10px] text-secondary-text uppercase font-semibold tracking-wide">Followers</p>
            </button>
            <div className="w-px h-8 bg-white/40" />
            <button className="text-center flex-1" onClick={() => showPeople('following')}>
              <p className="font-serif font-bold text-lg">{stats?.following_count ?? 0}</p>
              <p className="text-[10px] text-secondary-text uppercase font-semibold tracking-wide">Following</p>
            </button>
            {isOwnProfile && (
              <>
                <div className="w-px h-8 bg-white/40" />
                <div className="text-center flex-1">
                  <p className="font-serif font-bold text-lg">{stats?.wishlist_count ?? 0}</p>
                  <p className="text-[10px] text-secondary-text uppercase font-semibold tracking-wide">Saved</p>
                </div>
              </>
            )}
          </div>

          {/* Streak */}
          {isOwnProfile && (
            <div className="flex items-center gap-2 mt-4 glass-pill rounded-full px-4 py-2 w-fit">
              <span className="text-lg">🔥</span>
              <span className="text-sm font-semibold text-primary-text">
                {profileUser?.streak_weeks || 0} week streak
              </span>
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="mt-5">
              <SectionLabel text={isOwnProfile ? 'Your Categories' : 'Categories'} />
              <div className="flex flex-wrap gap-2 mt-2">
                {categories.map((cat) => (
                  <CategoryTag key={cat} category={cat} />
                ))}
              </div>
            </div>
          )}

          {/* Tabs — glass pills */}
          <div className="mt-6">
            <div className="flex gap-2">
              {TABS.filter((t) => isOwnProfile || t.key === 'ratings').map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const count = tab.key === 'ratings' ? stats?.rating_count
                  : tab.key === 'wishlist' ? stats?.wishlist_count
                  : 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-fluid ${
                      isActive
                        ? 'bg-charcoal text-cream shadow-[0_2px_10px_rgba(26,23,20,0.15)]'
                        : 'glass-pill text-text-muted hover:text-charcoal'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-cream' : 'bg-white/50 text-text-muted'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="mt-4 mb-6">
            {/* Ratings tab */}
            {activeTab === 'ratings' && (
              <div>
                {ratings.length === 0 ? (
                  <div className="py-12 text-center glass rounded-2xl">
                    <Star size={28} className="mx-auto text-stone mb-2" />
                    <p className="text-sm text-secondary-text">
                      {isOwnProfile ? 'No ratings yet — go explore!' : 'No ratings yet'}
                    </p>
                    {isOwnProfile && (
                      <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate('/search')}>
                        Find experiences
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                    {ratings.map((r) => (
                      <RatingCard
                        key={r.id}
                        rating={r}
                        onClick={() => navigate(`/experience/${r.experience_id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Wishlist tab */}
            {activeTab === 'wishlist' && isOwnProfile && (
              <div>
                {wishlistItems.length === 0 ? (
                  <div className="py-12 text-center glass rounded-2xl">
                    <Bookmark size={28} className="mx-auto text-stone mb-2" />
                    <p className="text-sm text-secondary-text">Save experiences you want to try</p>
                    <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate('/search')}>
                      Discover places
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                    {wishlistItems.map((exp) => (
                      <WishlistCard
                        key={exp.id}
                        experience={exp}
                        onClick={() => navigate(`/experience/${exp.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Lists tab */}
            {activeTab === 'lists' && isOwnProfile && (
              <div className="py-12 text-center glass rounded-2xl">
                <Users size={28} className="mx-auto text-stone mb-2" />
                <p className="text-sm text-secondary-text">No lists yet</p>
                <Button variant="ghost" size="sm" className="mt-3">Create your first list</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit profile modal */}
      {showEdit && (
        <EditProfileModal
          user={profileUser}
          onClose={() => setShowEdit(false)}
          onSave={handleEditSave}
        />
      )}

      {/* Followers/Following modal */}
      {peopleModal && (
        <PeopleModal
          title={peopleModal.title}
          people={peopleModal.people}
          onClose={() => setPeopleModal(null)}
          onViewProfile={viewUserProfile}
        />
      )}
    </div>
  );
}
