import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ChipStrip from '../components/ui/ChipStrip';
import LocationPicker from '../components/ui/LocationPicker';
import { useLocation } from '../context/LocationContext';
import { LocateFixed, MapPin as MapPinIcon, Navigation, Crosshair } from 'lucide-react';
import VouchScore from '../components/ui/VouchScore';
import ScoreLabel from '../components/ui/ScoreLabel';
import CategoryTag from '../components/ui/CategoryTag';
import PhotoCarousel from '../components/ui/PhotoCarousel';
import { CATEGORIES, COLORS } from '../lib/constants';
import { api } from '../lib/api';

// ── Custom marker icons by score band ──────────────────────────
function createIcon(color, size = 28) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
    <path d="M${size / 2} ${size + 6} C${size / 2} ${size + 6} ${size} ${size * 0.65} ${size} ${size / 2}
      A${size / 2} ${size / 2} 0 0 0 0 ${size / 2}
      C0 ${size * 0.65} ${size / 2} ${size + 6} ${size / 2} ${size + 6}Z"
      fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 4)],
  });
}

// Rated pins glow brighter the higher the score; unrated pins recede to a
// muted stone tint so rated places naturally pop against the seeded sea of
// Google-Places pins.
function iconForScore(avg) {
  if (avg <= 0) {
    // Seeded place with no Vouch ratings yet — small + muted
    return createIcon('#A8988A', 22);
  }
  if (avg >= 8.5) return createIcon(COLORS.terracotta, 34);
  if (avg >= 7.0) return createIcon(COLORS.terracotta, 30);
  return createIcon(COLORS.terracotta + 'CC', 28);
}

// ── "Recenter to my location" helper ──────────────────────────
function RecenterControl({ lat, lng, onClick }) {
  const map = useMap();
  const handleClick = () => {
    map.setView([lat, lng], 13);
    onClick?.();
  };
  return (
    <button
      onClick={handleClick}
      title="Recenter to your location"
      className="absolute bottom-4 right-3 z-[1000] w-10 h-10 rounded-full bg-warm-white/95 backdrop-blur-sm shadow-md border border-stone-light flex items-center justify-center hover:bg-warm-white hover:border-terracotta transition-fluid"
    >
      <Crosshair size={16} className="text-charcoal" />
    </button>
  );
}

// ── "Find me" — browser geolocation, falls back to set location on error ──
function GeolocateControl({ onLocated }) {
  const map = useMap();
  const [busy, setBusy] = useState(false);
  const handleClick = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        onLocated?.(latitude, longitude);
        setBusy(false);
      },
      () => { setBusy(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };
  return (
    <button
      onClick={handleClick}
      title="Find me"
      className="absolute bottom-[60px] right-3 z-[1000] w-10 h-10 rounded-full bg-warm-white/95 backdrop-blur-sm shadow-md border border-stone-light flex items-center justify-center hover:bg-warm-white hover:border-terracotta transition-fluid"
    >
      <Navigation size={16} className={busy ? 'text-terracotta animate-pulse' : 'text-charcoal'} />
    </button>
  );
}

// ── Layer definitions ──────────────────────────────────────────
const LAYERS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'My Ratings' },
  { key: 'friends', label: 'Friends' },
  { key: 'wishlist', label: 'Wishlist' },
];

// ── Set map center imperatively (stable: only re-runs when lat/lng values change) ──
function SetCenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, map]);
  return null;
}

// ── Fit map to bounding box of pins. Fires whenever `trigger` changes,
// so filtered layers (mine/friends/wishlist) re-pan the map to their pins. ──
function FitBounds({ pins, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].latitude, pins[0].longitude], 14);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, map]);
  return null;
}

// ── Main map component ─────────────────────────────────────────
export default function MapPage() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeLayer, setActiveLayer] = useState('all');
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Center: user's saved location, or fall back to Manhattan
  const defaultCenter = location
    ? [location.latitude, location.longitude]
    : [40.7580, -73.9855];

  const loadPins = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (activeLayer !== 'all') params.layer = activeLayer;
      // Scope pins to the user's city (default ~50 km radius). For the "Mine"
      // / "Friends" / "Wishlist" layers we drop the proximity filter so users
      // can see their places anywhere in the country.
      if (location && activeLayer === 'all') {
        params.lat = location.latitude;
        params.lng = location.longitude;
        params.radius_km = 50;
      }
      const data = await api.map.getPins(params);
      setPins(data || []);
    } catch {
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, activeLayer, location]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat === selectedCategory ? null : cat);
  };

  // Split rated vs. unrated so we can surface a "X vouched · Y to discover"
  // breakdown — makes the map feel less like a directory and more like a
  // social map where some pins are glowing recommendations.
  const { ratedCount, unratedCount } = useMemo(() => {
    let rated = 0; let unrated = 0;
    for (const p of pins) {
      if (p.avg_score > 0) rated += 1;
      else unrated += 1;
    }
    return { ratedCount: rated, unratedCount: unrated };
  }, [pins]);

  return (
    <div className="pb-20 lg:pb-0 h-[100dvh] flex flex-col">
      {showLocationPicker && <LocationPicker onClose={() => setShowLocationPicker(false)} />}

      {/* Category filter */}
      <div className="px-4 lg:px-8 py-2">
        <ChipStrip
          chips={CATEGORIES}
          selected={selectedCategory}
          onSelect={handleCategoryChange}
        />
      </div>

      {/* Layer toggles */}
      <div className="px-4 lg:px-8 flex gap-2 mb-2">
        {LAYERS.map((layer) => (
          <button
            key={layer.key}
            onClick={() => setActiveLayer(layer.key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-vouch ${
              activeLayer === layer.key
                ? 'bg-charcoal text-cream shadow-sm'
                : 'bg-warm-white border border-stone text-text-muted hover:border-terracotta'
            }`}
          >
            {layer.label}
          </button>
        ))}

        {/* Location display — read-only. Edit from the sidebar. */}
        <div
          title="Change your location from the sidebar"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium bg-warm-white border border-stone text-text-muted ml-auto select-none cursor-default"
        >
          <LocateFixed size={12} className={location ? 'text-terracotta' : 'text-text-muted'} />
          {location ? location.city.split(',')[0] : 'Set location'}
        </div>
      </div>

      {/* Map + overlays */}
      <div className="flex-1 relative mx-4 lg:mx-8 mb-4 rounded-xl overflow-hidden border border-divider">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-cream/60">
            <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Pin count badge — scoped to current city + category filter.
            Shows "X vouched · Y to discover" when the layer mixes rated and
            un-rated places, so users see the social signal at a glance. */}
        <div className="absolute top-3 left-3 z-[1000] bg-warm-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-stone-light">
          <div className="flex items-center gap-2 text-xs">
            {ratedCount > 0 && unratedCount > 0 ? (
              <>
                <span className="flex items-center gap-1 font-semibold text-terracotta">
                  <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />
                  {ratedCount} vouched
                </span>
                <span className="text-stone">·</span>
                <span className="flex items-center gap-1 text-secondary-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone" />
                  {unratedCount} to discover
                </span>
              </>
            ) : (
              <span className="font-semibold text-primary-text">
                {pins.length} {selectedCategory ? selectedCategory : 'places'}
                {location && activeLayer === 'all' && (
                  <span className="text-secondary-text font-normal"> in {location.city.split(',')[0]}</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Empty state for filtered layers */}
        {!loading && pins.length === 0 && activeLayer !== 'all' && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-warm-white/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-sm border border-stone-light text-center max-w-[280px]">
            <p className="text-xs text-primary-text font-semibold">
              {activeLayer === 'mine' && 'You haven\u2019t rated any places yet.'}
              {activeLayer === 'friends' && 'No ratings from friends yet.'}
              {activeLayer === 'wishlist' && 'Your wishlist is empty.'}
            </p>
            <p className="text-[10px] text-secondary-text mt-1">
              {activeLayer === 'mine' && 'Rate an experience and it\u2019ll show up here.'}
              {activeLayer === 'friends' && 'Follow friends to see their picks on the map.'}
              {activeLayer === 'wishlist' && 'Bookmark places and they\u2019ll appear here.'}
            </p>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          {/* Custom-positioned zoom control (top-right, below the pin count) */}
          <ZoomControl position="topright" />

          {/* Find-me + recenter overlay buttons (positioned absolutely) */}
          <GeolocateControl />
          {location && <RecenterControl lat={location.latitude} lng={location.longitude} />}

          {/* CartoDB Positron, warm-tinted via CSS to match the cream palette. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
            className="vouch-map-tiles"
          />

          {/* Only center on user location when viewing ALL pins with no category.
              When a layer/category filter is active, fit to the filtered pins instead. */}
          {activeLayer === 'all' && !selectedCategory && (
            <SetCenter lat={defaultCenter[0]} lng={defaultCenter[1]} />
          )}
          {(activeLayer !== 'all' || selectedCategory || !location) && pins.length > 0 && (
            <FitBounds pins={pins} trigger={`${activeLayer}-${selectedCategory || ''}-${pins.length}`} />
          )}

          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.latitude, pin.longitude]}
              icon={iconForScore(pin.avg_score)}
            >
              <Popup>
                <div className="w-[240px]">
                  {/* Square cover photo — matches feed/detail */}
                  {pin.cover_photo_url ? (
                    <div className="-mt-3 -mx-3 mb-3">
                      <PhotoCarousel
                        coverUrl={pin.cover_photo_url}
                        photoUrlsStr={pin.photo_urls}
                        alt={pin.name}
                      />
                    </div>
                  ) : (
                    <div className="-mt-3 -mx-3 mb-3 aspect-square w-[calc(100%+24px)] bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center">
                      <MapPinIcon size={32} className="text-stone" />
                    </div>
                  )}

                  {/* Title + score */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-serif font-bold text-sm text-primary-text cursor-pointer hover:text-terracotta transition-fluid line-clamp-1"
                        onClick={() => navigate(`/experience/${pin.id}`)}
                      >
                        {pin.name}
                      </h3>
                      <div className="mt-1.5">
                        <CategoryTag category={pin.category} />
                      </div>
                    </div>
                    {pin.avg_score > 0 && (
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        <VouchScore score={pin.avg_score} size="sm" />
                        <ScoreLabel score={pin.avg_score} />
                      </div>
                    )}
                  </div>

                  {/* Neighborhood / address */}
                  {(pin.neighborhood || pin.address) && (
                    <p className="text-xs text-secondary-text mt-2 flex items-center gap-1 line-clamp-1">
                      <MapPinIcon size={10} className="shrink-0" />
                      {pin.neighborhood || pin.address}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => navigate(`/experience/${pin.id}`)}
                      className="flex-1 bg-charcoal text-cream text-xs font-semibold py-2 rounded-full hover:bg-terracotta transition-fluid"
                    >
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/rate/${pin.id}`)}
                      className="flex-1 border border-terracotta text-terracotta text-xs font-semibold py-2 rounded-full hover:bg-terracotta/5 transition-fluid"
                    >
                      Rate
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

      </div>
    </div>
  );
}
