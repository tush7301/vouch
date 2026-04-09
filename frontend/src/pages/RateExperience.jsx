import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import VouchScore from '../components/ui/VouchScore';
import ScoreLabel from '../components/ui/ScoreLabel';
import CategoryTag from '../components/ui/CategoryTag';
import TagPill from '../components/ui/TagPill';
import { TAGS } from '../lib/constants';
import { api } from '../lib/api';
import { trackRatingCreated } from '../lib/analytics';

/**
 * Score slider component — draggable 0–10 score input.
 */
function ScoreSlider({ label, value, onChange, color = 'terracotta' }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-primary-text">{label}</span>
        <span className={`text-lg font-bold text-${color}`}>{value}</span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-surface rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6
          [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-terracotta [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-secondary-text mt-1">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

export default function RateExperience() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Experience info can be passed via location.state or fetched
  const [experience, setExperience] = useState(location.state?.experience || null);
  const [existingRating, setExistingRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Rating form state
  const [vibeScore, setVibeScore] = useState(7);
  const [valueScore, setValueScore] = useState(7);
  const [experienceScore, setExperienceScore] = useState(7);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const overallScore = Math.round((vibeScore + valueScore + experienceScore) / 3);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Fetch experience if not passed via state
        const [exp, myRating] = await Promise.all([
          experience ? Promise.resolve(experience) : api.experiences.get(id),
          api.ratings.getMine(id).catch(() => null),
        ]);
        setExperience(exp);

        // If user already rated, prefill form for editing
        if (myRating) {
          setExistingRating(myRating);
          setVibeScore(myRating.vibe_score);
          setValueScore(myRating.value_score);
          setExperienceScore(myRating.experience_score);
          setReviewText(myRating.review_text || '');
          setSelectedTags(
            (myRating.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
          );
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!experience) return;
    setSubmitting(true);
    setError(null);

    try {
      const data = {
        vibe_score: vibeScore,
        value_score: valueScore,
        experience_score: experienceScore,
        review_text: reviewText,
        tags: selectedTags.join(','),
      };

      if (existingRating) {
        // Update existing
        await api.ratings.update(existingRating.id, data);
      } else {
        // Create new
        await api.ratings.create({
          experience_id: id,
          ...data,
        });
        trackRatingCreated(id, data.overall_score);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(`/experience/${id}`, { replace: true });
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!experience) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <p className="text-red-600 mb-4">Experience not found</p>
        <button onClick={() => navigate(-1)} className="text-terracotta font-semibold">Go back</button>
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream/90 backdrop-blur-sm border-b border-stone-light">
        <div className="max-w-2xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-charcoal hover:text-terracotta transition-vouch"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="font-serif font-bold text-sm">
            {existingRating ? 'Edit Rating' : 'Rate Experience'}
          </h1>
          <div className="w-16" /> {/* spacer */}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6">
        {/* Experience card */}
        <div className="bg-surface rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold leading-tight">{experience.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <CategoryTag category={experience.category} />
                {experience.neighborhood && (
                  <span className="text-xs text-secondary-text">{experience.neighborhood}</span>
                )}
              </div>
            </div>
            {experience.cover_photo_url && (
              <img
                src={experience.cover_photo_url}
                alt=""
                className="w-16 h-16 rounded-lg object-cover ml-3 shrink-0"
              />
            )}
          </div>
        </div>

        {/* Overall score preview */}
        <div className="text-center mb-8">
          <p className="text-xs text-secondary-text mb-2 uppercase tracking-wider">Your Vouch Score</p>
          <VouchScore score={overallScore} size="lg" />
          <div className="mt-1">
            <ScoreLabel score={overallScore} />
          </div>
        </div>

        {/* Score sliders */}
        <div className="mb-8">
          <ScoreSlider label="Vibe" value={vibeScore} onChange={setVibeScore} />
          <ScoreSlider label="Value" value={valueScore} onChange={setValueScore} />
          <ScoreSlider label="Experience" value={experienceScore} onChange={setExperienceScore} />
        </div>

        {/* Review text */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-primary-text mb-2">
            Your Review
          </label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="What should people know about this place?"
            rows={4}
            maxLength={500}
            className="w-full bg-surface border border-divider rounded-xl px-4 py-3 text-sm
              text-primary-text placeholder:text-text-muted resize-none outline-none
              focus:border-terracotta transition-vouch"
          />
          <p className="text-right text-xs text-secondary-text mt-1">
            {reviewText.length}/500
          </p>
        </div>

        {/* Tag selection */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-primary-text mb-2">
            Tags <span className="font-normal text-secondary-text">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-vouch ${
                  selectedTags.includes(tag)
                    ? 'bg-charcoal text-cream shadow-sm'
                    : 'bg-warm-white border border-stone text-text-muted hover:text-charcoal hover:border-terracotta'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm text-center mb-4">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-green-50 text-green-700 rounded-xl p-3 text-sm text-center mb-4">
            {existingRating ? 'Rating updated!' : 'Rating submitted!'} Redirecting…
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || success}
          className="w-full bg-charcoal text-cream py-3.5 rounded-full font-semibold
            flex items-center justify-center gap-2 hover:bg-terracotta transition-vouch
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send size={18} />
              {existingRating ? 'Update Rating' : 'Submit Rating'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
