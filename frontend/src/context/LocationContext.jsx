import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const LocationContext = createContext(null);

// ── Helpers ───────────────────────────────────────────────────────
function storageKey(userId) {
  return userId ? `vouch_location_${userId}` : null;
}

function readFromStorage(userId) {
  const key = storageKey(userId);
  if (!key) return null;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Always coerce to numbers in case old data stored strings
    if (parsed.latitude  != null) parsed.latitude  = parseFloat(parsed.latitude);
    if (parsed.longitude != null) parsed.longitude = parseFloat(parsed.longitude);
    return parsed;
  } catch {
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────────────
export function LocationProvider({ children }) {
  const { user } = useAuth();

  // Initialise from storage for the current user (may be null on first render
  // while auth is still loading — the effect below corrects it once user loads).
  const [location, setLocationState] = useState(() => readFromStorage(user?.id));

  // Whenever the logged-in user changes (login / logout / account switch),
  // reload the location that belongs to that user.
  useEffect(() => {
    setLocationState(readFromStorage(user?.id));
  }, [user?.id]);

  const setLocation = useCallback((loc) => {
    const key = storageKey(user?.id);
    if (key) localStorage.setItem(key, JSON.stringify(loc));
    setLocationState(loc);
  }, [user?.id]);

  const clearLocation = useCallback(() => {
    const key = storageKey(user?.id);
    if (key) localStorage.removeItem(key);
    setLocationState(null);
  }, [user?.id]);

  /**
   * Ask the browser for GPS coordinates, then reverse-geocode to a city name
   * via OpenStreetMap Nominatim (free, no API key needed).
   */
  const detectLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async ({ coords: { latitude, longitude } }) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { headers: { 'Accept-Language': 'en' } },
            );
            const data = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.village || addr.county || 'My Location';
            const loc = { city, latitude, longitude };
            setLocation(loc);
            resolve(loc);
          } catch {
            const loc = { city: 'My Location', latitude, longitude };
            setLocation(loc);
            resolve(loc);
          }
        },
        (err) => reject(err),
        { timeout: 10000 },
      );
    });
  }, [setLocation]);

  /**
   * Forward-geocode a typed city name to lat/lng via Nominatim.
   */
  const geocodeCity = useCallback(async (cityQuery) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityQuery)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    if (!data.length) return null;
    const { lat, lon, display_name } = data[0];
    const city = display_name.split(',')[0].trim();
    const loc = { city, latitude: parseFloat(lat), longitude: parseFloat(lon) };
    setLocation(loc);
    return loc;
  }, [setLocation]);

  return (
    <LocationContext.Provider value={{ location, setLocation, clearLocation, detectLocation, geocodeCity }}>
      {children}
    </LocationContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────
export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within a LocationProvider');
  return ctx;
}
