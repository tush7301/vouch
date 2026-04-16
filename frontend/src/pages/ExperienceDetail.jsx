import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Clock, Bookmark, PenLine } from 'lucide-react';
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
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-charcoal hover:text-terracotta transition-vouch"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
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

      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6">
        {/* Cover photo */}
        {experience.cover_photo_url && (
          <div className="rounded-xl overflow-hidden mb-6 aspect-[2/1]">
            <img
              src={experience.cover_photo_url}
              alt={experience.name}
              className="w-full h-full object-cover"
            />
          </div>
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
    </div>
  );
}
