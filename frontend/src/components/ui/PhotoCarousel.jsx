import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

/**
 * PhotoCarousel
 *
 * Props:
 *   coverUrl      – primary cover photo URL (already included as first item in photo_urls, used as fallback only)
 *   photoUrlsStr  – comma-separated photo URLs from DB (already contains cover as first item)
 *   alt           – img alt text
 *   square        – if true, renders as 1:1 aspect ratio (default true)
 *   height        – Tailwind height class used when square=false, e.g. "h-72"
 *   className     – extra classes on the wrapper
 *   rounded       – Tailwind rounded class e.g. "rounded-2xl"
 */
export default function PhotoCarousel({
  coverUrl,
  photoUrlsStr,
  alt = '',
  square = true,
  height = 'h-64',
  className = '',
  rounded = '',
}) {
  // photo_urls already contains cover_photo_url as its first entry.
  // Use photo_urls as the source of truth; fall back to coverUrl only if empty.
  const allPhotos = useMemo(() => {
    const fromStr = (photoUrlsStr || '').split(',').map((u) => u.trim()).filter(Boolean);
    if (fromStr.length > 0) return fromStr;
    if (coverUrl) return [coverUrl];
    return [];
  }, [photoUrlsStr, coverUrl]);

  const [failed, setFailed] = useState(() => new Set());
  const photos = useMemo(
    () => allPhotos.filter((u) => !failed.has(u)),
    [allPhotos, failed],
  );

  const [idx, setIdx] = useState(0);
  const safeIdx = photos.length > 0 ? Math.min(idx, photos.length - 1) : 0;

  // Touch + pointer swipe support (mobile + mouse drag).
  // NB: hooks must be declared before any early return.
  const startX = useRef(null);
  const startY = useRef(null);
  const swiped = useRef(false);
  const SWIPE_THRESHOLD = 40;

  const sizeClassEmpty = square ? 'aspect-square w-full' : `w-full ${height}`;
  if (photos.length === 0) {
    return (
      <div className={`relative overflow-hidden ${sizeClassEmpty} ${rounded} ${className} bg-gradient-to-br from-stone-light/50 to-cream-deep/50 flex items-center justify-center`}>
        <ImageOff size={32} className="text-stone" />
      </div>
    );
  }

  const prev = (e) => {
    e.stopPropagation();
    setIdx((i) => (i - 1 + photos.length) % photos.length);
  };
  const next = (e) => {
    e.stopPropagation();
    setIdx((i) => (i + 1) % photos.length);
  };

  const sizeClass = square ? 'aspect-square w-full' : `w-full ${height}`;

  const onPointerDown = (e) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    swiped.current = false;
  };
  const onPointerUp = (e) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      e.stopPropagation();
      swiped.current = true;
      setIdx((i) => (dx < 0 ? (i + 1) % photos.length : (i - 1 + photos.length) % photos.length));
    }
    startX.current = null;
    startY.current = null;
  };
  const onClickCapture = (e) => {
    if (swiped.current) {
      e.stopPropagation();
      e.preventDefault();
      swiped.current = false;
    }
  };

  return (
    <div
      className={`relative overflow-hidden ${sizeClass} ${rounded} ${className} select-none touch-pan-y`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <img
        src={photos[safeIdx]}
        alt={alt}
        draggable={false}
        onError={() => {
          const bad = photos[safeIdx];
          setFailed((prev) => {
            const next = new Set(prev);
            next.add(bad);
            return next;
          });
          setIdx(0);
        }}
        className="w-full h-full object-cover transition-opacity duration-300"
      />

      {photos.length > 1 && (
        <>
          {/* Prev / Next arrows */}
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ChevronRight size={16} />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === safeIdx ? 'bg-white w-4' : 'bg-white/60 w-1.5'
                }`}
              />
            ))}
          </div>

          {/* Counter pill */}
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full">
            {safeIdx + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
