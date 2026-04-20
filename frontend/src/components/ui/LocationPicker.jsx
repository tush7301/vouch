import { useState } from 'react';
import { MapPin, LocateFixed, Search, X, Loader2 } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';

/**
 * LocationPicker modal — centred card on all screen sizes.
 */
export default function LocationPicker({ onClose }) {
  const { location, detectLocation, geocodeCity, clearLocation } = useLocation();
  const [cityInput, setCityInput] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const handleDetect = async () => {
    setError('');
    setDetecting(true);
    try {
      await detectLocation();
      onClose();
    } catch (err) {
      setError(
        err.code === 1
          ? 'Location access denied. Allow it in your browser settings.'
          : 'Could not detect location. Try entering a city manually.',
      );
    } finally {
      setDetecting(false);
    }
  };

  const handleSearch = async () => {
    if (!cityInput.trim()) return;
    setError('');
    setSearching(true);
    try {
      const loc = await geocodeCity(cityInput.trim());
      if (!loc) {
        setError('City not found. Try a different name (e.g. "Chicago, IL").');
      } else {
        onClose();
      }
    } catch {
      setError('Could not look up that city. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    clearLocation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center glass-overlay p-4">
      <div className="glass-solid rounded-2xl shadow-xl w-full max-w-md animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/30">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-terracotta" />
            <h2 className="font-serif text-lg font-bold">Set Your Location</h2>
          </div>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text transition-fluid">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current location display */}
          {location && (
            <div className="flex items-center justify-between bg-sage/10 border border-sage/30 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-sage shrink-0" />
                <span className="text-sm font-medium text-primary-text">{location.city}</span>
              </div>
              <button
                onClick={handleClear}
                className="text-xs text-secondary-text hover:text-terracotta transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* GPS detect */}
          <button
            onClick={handleDetect}
            disabled={detecting || searching}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-stone hover:border-terracotta hover:bg-terracotta/5 transition-vouch disabled:opacity-50"
          >
            {detecting
              ? <Loader2 size={16} className="animate-spin text-terracotta" />
              : <LocateFixed size={16} className="text-terracotta" />}
            <span className="text-sm font-semibold text-primary-text">
              {detecting ? 'Detecting…' : 'Use my current location'}
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-divider" />
            <span className="text-xs text-secondary-text">or</span>
            <div className="flex-1 h-px bg-divider" />
          </div>

          {/* City search */}
          <div>
            <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider">
              Enter a city
            </label>
            <div className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. San Francisco, CA"
                className="flex-1 px-3 py-2 glass-input rounded-xl text-sm"
                disabled={detecting || searching}
              />
              <button
                onClick={handleSearch}
                disabled={!cityInput.trim() || detecting || searching}
                className="px-3 py-2 bg-charcoal text-cream rounded-xl hover:bg-terracotta transition-vouch disabled:opacity-40"
              >
                {searching
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Search size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-terracotta bg-terracotta/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
