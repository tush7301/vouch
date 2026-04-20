import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import Button from '../components/ui/Button';
import SectionLabel from '../components/ui/SectionLabel';
import VouchLogo from '../components/ui/VouchLogo';
import { CATEGORIES } from '../lib/constants';
import { trackOnboardingStarted, trackOnboardingCategoriesSelected, trackOnboardingCompleted } from '../lib/analytics';

const NYC_DEFAULT = { city: 'New York', latitude: 40.7128, longitude: -74.006 };

/**
 * Onboarding — multi-step survey (welcome → category selection → friend connect → done).
 * Persists selected categories via the API and marks onboarding complete.
 */

const STEPS = ['Welcome', 'Categories', 'Ready'];

export default function Onboarding() {
  const { completeOnboarding, user } = useAuth();
  const { location, setLocation } = useLocation();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { trackOnboardingStarted(); }, []);

  const toggleCategory = (cat) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const next = () => {
    if (step === 1 && selectedCategories.length > 0) {
      trackOnboardingCategoriesSelected(selectedCategories);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      await completeOnboarding(selectedCategories.join(','));
      // Default to New York if the user hasn't chosen a location yet
      if (!location) {
        setLocation(NYC_DEFAULT);
      }
      trackOnboardingCompleted();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to save preferences');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-vouch ${
              i <= step ? 'bg-terracotta' : 'bg-stone'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="text-center max-w-sm lg:max-w-lg">
            <VouchLogo size="lg" />
            <p className="mt-4 text-lg font-serif font-semibold">Welcome!</p>
            <p className="mt-2 text-sm text-secondary-text leading-relaxed">
              Let&apos;s personalise your experience. <br></br> We&apos;ll ask a few quick questions so we can
              show you the stuff you actually care about.
            </p>
            <Button variant="primary" size="lg" className="mt-8 w-full" onClick={next}>
              Let&apos;s go
            </Button>
          </div>
        )}

        {/* Step 1 — Category selection */}
        {step === 1 && (
          <div className="w-full max-w-sm lg:max-w-lg text-center">
            <SectionLabel text="Pick Your Interests" />
            <p className="mt-2 text-sm text-secondary-text">
              Choose at least 2 categories you care about.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-vouch ${
                    selectedCategories.includes(cat)
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-warm-white text-charcoal border-stone hover:border-terracotta'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-8 w-full"
              disabled={selectedCategories.length < 2}
              onClick={next}
            >
              Continue ({selectedCategories.length} selected)
            </Button>
          </div>
        )}

        {/* Step 2 — Ready */}
        {step === 2 && (
          <div className="w-full max-w-sm lg:max-w-md text-center">
            <span className="text-5xl">🎉</span>
            <h2 className="mt-4 font-serif text-2xl font-bold">You&apos;re all set!</h2>
            <p className="mt-2 text-sm text-secondary-text leading-relaxed">
              Start exploring your city through the eyes of people you trust.
            </p>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <Button
              variant="primary"
              size="lg"
              className="mt-8 w-full"
              disabled={saving}
              onClick={handleFinish}
            >
              {saving ? 'Saving...' : 'Go to feed'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
