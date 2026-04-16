import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search as SearchIcon, X as XIcon, MapPin, Loader2 } from 'lucide-react';
import ChipStrip from '../components/ui/ChipStrip';
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

const SCORE_COLORS = {
  high: COLORS.sage,
  good: COLORS.amber,
  mid: COLORS.stone,
  low: COLORS.terracotta,
  none: '#9B9B9B',
};

function iconForScore(avg) {
  if (avg >= 9) return createIcon(SCORE_COLORS.high);
  if (avg >= 7) return createIcon(SCORE_COLORS.good);
  if (avg >= 5) return createIcon(SCORE_COLORS.mid);
  if (avg > 0) return createIcon(SCORE_COLORS.low);
  return createIcon(SCORE_COLORS.none);
}

// ── Layer definitions ──────────────────────────────────────────
const LAYERS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'My Ratings' },
  { key: 'friends', label: 'Friends' },
  { key: 'wishlist', label: 'Wishlist' },
];

// ── Map controllers ────────────────────────────────────────────
/** Fit bounds to all visible pins (only when no localized area is active). */
function FitBounds({ pins }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [pins, map]);
  return null;
}

/** Pan + zoom to a specific area (for when user searches "Soho"). */
function PanToArea({ area }) {
  const map = useMap();
  useEffect(() => {
    if (!area) return;
    // Roughly: 5km → zoom 13, 1km → zoom 16. Inverse-log feel.
    const zoom = Math.max(13, Math.min(17, Math.round(16 - Math.log2(area.radius_km))));
    map.flyTo([area.latitude, area.longitude], zoom, { duration: 0.8 });
  }, [area, map]);
  return null;
}

// ── Neighborhood list panel ────────────────────────────────────
function NeighborhoodPanel({ neighborhoods, onSelect }) {
  if (!neighborhoods.length) return null;
  return (
    <div className="bg-warm-white/95 backdrop-blur-sm rounded-xl border border-stone-light shadow-lg p-3 max-h-64 overflow-y-auto">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        Neighborhoods
      </h3>
      <div className="space-y-1">
        {neighborhoods.map((n) => (
          <button
            key={n.name}
            onClick={() => onSelect(n.name)}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-cream-deep transition-vouch flex items-center justify-between"
          >
            <span className="text-sm font-medium text-charcoal">{n.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{n.experience_count} places</span>
              {n.avg_score > 0 && (
                <span className="text-xs font-bold text-terracotta">{n.avg_score}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main map component ─────────────────────────────────────────
export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeLayer, setActiveLayer] = useState('all');
  const [pins, setPins] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  // Localized area: { label, latitude, longitude, radius_km, source, experience_count }
  const [area, setArea] = useState(null);
  const [areaInput, setAreaInput] = useState('');
  const [areaSearching, setAreaSearching] = useState(false);
  const [areaError, setAreaError] = useState('');

  // Default center: Manhattan, NYC
  const defaultCenter = [40.7580, -73.9855];

  // ── Restore area from URL on mount ───────────────────────────
  const initialNear = searchParams.get('near');
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (initialNear) {
      setAreaInput(initialNear);
      doLocate(initialNear, { skipUrlUpdate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loaders ──────────────────────────────────────────────────
  const loadPins = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (activeLayer !== 'all') params.layer = activeLayer;
      if (area) {
        params.near_lat = area.latitude;
        params.near_lng = area.longitude;
        params.radius_km = area.radius_km;
      }
      const data = await api.map.getPins(params);
      setPins(data || []);
    } catch {
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, activeLayer, area]);

  const loadNeighborhoods = useCallback(async () => {
    try {
      const data = await api.map.getNeighborhoods(selectedCategory || undefined);
      setNeighborhoods(data || []);
    } catch {
      setNeighborhoods([]);
    }
  }, [selectedCategory]);

  useEffect(() => { loadPins(); }, [loadPins]);
  useEffect(() => { loadNeighborhoods(); }, [loadNeighborhoods]);

  // ── Locate (search-bar + neighborhood-panel both use this) ──
  const doLocate = useCallback(
    async (query, opts = {}) => {
      const q = (query || '').trim();
      if (!q) return;
      setAreaSearching(true);
      setAreaError('');
      try {
        const result = await api.map.locate(q);
        setArea(result);
        setAreaInput(result.label);
        if (!opts.skipUrlUpdate) {
          const next = new URLSearchParams(searchParams);
          next.set('near', q);
          setSearchParams(next, { replace: true });
        }
      } catch (err) {
        setAreaError(err.message || `Could not find "${q}"`);
        setArea(null);
      } finally {
        setAreaSearching(false);
      }
    },
    [searchParams, setSearchParams],
  );

  const clearArea = () => {
    setArea(null);
    setAreaInput('');
    setAreaError('');
    const next = new URLSearchParams(searchParams);
    next.delete('near');
    setSearchParams(next, { replace: true });
  };

  const handleAreaKeyDown = (e) => {
    if (e.key === 'Enter') doLocate(areaInput);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat === selectedCategory ? null : cat);
  };

  return (
    <div className="pb-20 lg:pb-0 h-[100dvh] flex flex-col">

      {/* Location search bar — the main new piece */}
      <div className="px-4 lg:px-8 pt-3 pb-2">
        <div className="glass-input rounded-full px-4 py-2.5 flex items-center gap-2 max-w-2xl">
          {areaSearching ? (
            <Loader2 className="w-4 h-4 text-terracotta animate-spin shrink-0" />
          ) : (
            <SearchIcon className="w-4 h-4 text-text-muted shrink-0" />
          )}
          <input
            type="text"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onKeyDown={handleAreaKeyDown}
            placeholder="Where to explore? (Soho, Williamsburg, Lower East Side…)"
            className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-text-muted"
          />
          {area ? (
            <button
              onClick={clearArea}
              title="Show all places"
              className="text-text-muted hover:text-charcoal text-xs flex items-center gap-1"
            >
              <XIcon className="w-3.5 h-3.5" /> Clear
            </button>
          ) : areaInput ? (
            <button
              onClick={() => doLocate(areaInput)}
              className="text-terracotta font-semibold text-xs"
            >
              Go
            </button>
          ) : null}
        </div>
        {area && (
          <div className="mt-1.5 ml-1 flex items-center gap-2 text-[11px] text-text-muted">
            <MapPin className="w-3 h-3 text-terracotta" />
            <span>
              Near <strong className="text-charcoal">{area.label}</strong> · {area.radius_km} km radius · {area.experience_count} places nearby
              {area.source === 'geocode' && ' · geocoded'}
            </span>
          </div>
        )}
        {areaError && (
          <div className="mt-1.5 ml-1 text-[11px] text-red-500">{areaError}</div>
        )}
      </div>

      {/* Category filter */}
      <div className="px-4 lg:px-8 py-1">
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

        <button
          onClick={() => setShowPanel((s) => !s)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-vouch ml-auto ${
            showPanel
              ? 'bg-charcoal text-cream'
              : 'bg-warm-white border border-stone text-text-muted hover:border-terracotta'
          }`}
        >
          Neighborhoods
        </button>
      </div>

      {/* Map + overlays */}
      <div className="flex-1 relative mx-4 lg:mx-8 mb-4 rounded-xl overflow-hidden border border-divider">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-cream/60">
            <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Neighborhood panel — clicks now route through doLocate */}
        {showPanel && (
          <div className="absolute top-3 right-3 z-[1000] w-64">
            <NeighborhoodPanel
              neighborhoods={neighborhoods}
              onSelect={(name) => {
                setShowPanel(false);
                doLocate(name);
              }}
            />
          </div>
        )}

        {/* Pin count badge */}
        <div className="absolute top-3 left-3 z-[1000] bg-warm-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm border border-stone-light">
          <span className="text-xs font-semibold text-primary-text">
            {pins.length} {pins.length === 1 ? 'place' : 'places'}
            {area ? ` near ${area.label}` : ''}
          </span>
        </div>

        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* When localized, prefer flying to the area; otherwise auto-fit pins. */}
          {area
            ? <PanToArea area={area} />
            : pins.length > 0 && <FitBounds pins={pins} />}

          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.latitude, pin.longitude]}
              icon={iconForScore(pin.avg_score)}
            >
              <Popup>
                <div className="min-w-[200px]">
                  {pin.cover_photo_url && (
                    <img
                      src={pin.cover_photo_url}
                      alt={pin.name}
                      className="w-full h-24 object-cover rounded-t-lg -mt-3 -mx-3 mb-2"
                      style={{ width: 'calc(100% + 24px)' }}
                    />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3
                        className="font-bold text-sm cursor-pointer hover:text-terracotta transition-vouch"
                        onClick={() => navigate(`/experience/${pin.id}`)}
                      >
                        {pin.name}
                      </h3>
                      <span className="text-[10px] px-1.5 py-0.5 bg-stone-light rounded text-text-muted inline-block mt-1">
                        {pin.category}
                      </span>
                    </div>
                    {pin.avg_score > 0 && (
                      <div className="text-center shrink-0">
                        <div className="w-9 h-9 rounded-full bg-terracotta text-white font-bold flex items-center justify-center text-sm">
                          {pin.avg_score}
                        </div>
                        <span className="text-[9px] text-text-muted">{pin.num_ratings}r</span>
                      </div>
                    )}
                  </div>

                  {pin.address && (
                    <p className="text-[11px] text-text-muted mt-1">{pin.address}</p>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => navigate(`/experience/${pin.id}`)}
                      className="flex-1 bg-charcoal text-cream text-[11px] font-semibold py-1.5 rounded-full hover:bg-terracotta transition-vouch"
                    >
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/rate/${pin.id}`)}
                      className="flex-1 border border-terracotta text-terracotta text-[11px] font-semibold py-1.5 rounded-full hover:bg-terracotta/5 transition-vouch"
                    >
                      Rate
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Empty state for localized search with no pins */}
        {!loading && area && pins.length === 0 && (
          <div className="absolute inset-x-0 bottom-12 z-[1000] flex justify-center pointer-events-none">
            <div className="bg-warm-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-stone-light text-center max-w-xs pointer-events-auto">
              <p className="text-sm font-semibold text-charcoal">No vouches near {area.label} yet</p>
              <p className="text-xs text-text-muted mt-1">Be the first — search for a place and rate it.</p>
              <button
                onClick={() => navigate('/search')}
                className="mt-2 inline-block bg-charcoal text-cream rounded-full px-4 py-1.5 text-xs font-semibold hover:bg-terracotta transition-vouch"
              >
                Discover places
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-warm-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-stone-light">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SCORE_COLORS.high }} />
              9-10
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SCORE_COLORS.good }} />
              7-8
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SCORE_COLORS.mid }} />
              5-6
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SCORE_COLORS.low }} />
              0-4
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SCORE_COLORS.none }} />
              N/A
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
