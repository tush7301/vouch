import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VouchLogo from '../components/ui/VouchLogo';

/**
 * Landing — Public marketing page shown before login/signup.
 * Adapted from the static HTML landing page design.
 */
export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const revealRefs = useRef([]);
  const observerRef = useRef(null);

  // If user is already authenticated, skip the landing page entirely.
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const showEl = (el) => {
    el.classList.add('opacity-100', 'translate-y-0');
    el.classList.remove('opacity-0', 'translate-y-6');
  };

  // Scroll-reveal observer — set up once, observes elements as they register.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            showEl(e.target);
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    observerRef.current = observer;
    revealRefs.current.forEach((el) => el && observer.observe(el));

    // Safety fallback: if IntersectionObserver misses anything (e.g. initial
    // above-the-fold elements in some browsers), force-reveal after 1.2s.
    const fallback = setTimeout(() => {
      revealRefs.current.forEach((el) => el && showEl(el));
    }, 1200);

    return () => {
      clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  // Stable callback ref: registers every element with the observer as it mounts.
  const reveal = useCallback((el) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
      if (observerRef.current) observerRef.current.observe(el);
    }
  }, []);

  // Nav scroll effect
  const navRef = useRef(null);
  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current) {
        navRef.current.classList.toggle('bg-cream/90', window.scrollY > 60);
        navRef.current.classList.toggle('backdrop-blur-xl', window.scrollY > 60);
        navRef.current.classList.toggle('shadow-sm', window.scrollY > 60);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-cream overflow-x-hidden">
      {/* ── NAV ── */}
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-3.5 transition-all duration-400"
      >
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <VouchLogo size="sm" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login', { state: { mode: 'register' } })}
              className="px-5 py-2.5 rounded-full bg-charcoal text-cream text-sm font-semibold hover:bg-terracotta transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Sign Up
            </button>
            <button
              onClick={() => navigate('/login', { state: { mode: 'login' } })}
              className="px-4 py-2 rounded-full text-charcoal text-sm font-semibold hover:text-terracotta transition-all duration-300"
            >
              Log in
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-screen flex items-center pt-[72px] bg-[radial-gradient(ellipse_80%_60%_at_20%_80%,rgba(194,101,58,0.04)_0%,transparent_60%),radial-gradient(ellipse_60%_50%_at_80%_20%,rgba(122,140,114,0.05)_0%,transparent_60%)] bg-cream">
        <div className="max-w-[1100px] mx-auto px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Left — content */}
            <div className="max-w-[520px]">
              {/* <p
                ref={reveal}
                className="opacity-0 translate-y-6 transition-all duration-700 text-xs font-semibold tracking-[0.14em] uppercase text-terracotta mb-4"
              >
                Your taste profile
              </p> */}
              <h1
                ref={reveal}
                className="opacity-0 translate-y-6 transition-all duration-700 delay-100 font-serif text-[clamp(2.4rem,5.5vw,4rem)] font-normal leading-[1.15] text-charcoal tracking-tight mb-5"
              >
                Your social life, <em className="italic text-terracotta">ranked.</em>
              </h1>
              <p
                ref={reveal}
                className="opacity-0 translate-y-6 transition-all duration-700 delay-200 text-[clamp(0.98rem,1.7vw,1.1rem)] text-text-body leading-[1.75] mb-7 max-w-[640px]"
              >
                Vouch helps you remember the great places you've been — and discover what's next through the people you trust. 
                Rate restaurants, bars, trips, and experiences in seconds, and your social life becomes searchable, ranked, and easy to share.              </p>
              <div ref={reveal} className="opacity-0 translate-y-6 transition-all duration-700 delay-300">
                <div className="flex gap-2 max-w-[420px] flex-col sm:flex-row">
                  <button
                    onClick={() => navigate('/login', { state: { mode: 'register' } })}
                    className="flex-1 px-6 py-3.5 rounded-full bg-charcoal text-cream font-semibold text-[0.92rem] hover:bg-terracotta transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={() => navigate('/login', { state: { mode: 'login' } })}
                    className="flex-1 px-6 py-3.5 rounded-full border border-charcoal text-charcoal font-semibold text-[0.92rem] hover:bg-charcoal hover:text-cream transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    Log in
                  </button>
                </div>
                <p className="text-[0.78rem] text-text-muted mt-2.5">
                  Free forever. No spam. Unsubscribe anytime.
                </p>
                {/* <p className="font-serif text-[clamp(0.95rem,1.6vw,1.1rem)] italic text-charcoal mt-4">
                  Like <strong className="font-bold">Beli</strong>, but for everything.
                </p> */}
              </div>
            </div>

            {/* Right — phone mockup */}
            <div
              ref={reveal}
              className="opacity-0 translate-y-6 transition-all duration-700 delay-200 flex justify-center items-center relative"
            >
              <div className="w-[270px] h-[560px] bg-charcoal rounded-[38px] p-[11px] shadow-[0_20px_60px_rgba(26,23,20,0.16),0_0_0_1px_rgba(255,255,255,0.1)_inset] relative rotate-2 lg:rotate-2 max-lg:rotate-0 max-lg:w-[230px] max-lg:h-[480px]">
                {/* Notch */}
                <div className="w-[110px] h-[26px] bg-charcoal rounded-b-[14px] absolute top-[11px] left-1/2 -translate-x-1/2 z-10" />
                {/* Screen */}
                <div className="w-full h-full bg-warm-white rounded-[28px] overflow-hidden">
                  <div className="pt-9 px-4 pb-3 text-center">
                    <div className="font-serif text-[13px] font-bold text-charcoal">Your experiences, ranked</div>
                    <div className="text-[10px] text-text-muted">47 experiences · 12 categories</div>
                  </div>
                  <div className="flex px-3.5 gap-[3px] mb-2.5">
                    <div className="flex-1 text-center py-1 text-[9px] font-semibold bg-charcoal text-cream rounded-[5px]">All</div>
                    <div className="flex-1 text-center py-1 text-[9px] font-semibold text-text-muted rounded-[5px]">Food</div>
                    <div className="flex-1 text-center py-1 text-[9px] font-semibold text-text-muted rounded-[5px]">Drinks</div>
                    <div className="flex-1 text-center py-1 text-[9px] font-semibold text-text-muted rounded-[5px]">Activities</div>
                  </div>
                  <div className="px-3.5 space-y-1.5">
                    {[
                      { emoji: '🍜', name: 'Siam Garden', meta: 'Thai · East Village · Oct 4', score: '8', color: 'text-sage', bg: 'bg-amber-100' },
                      { emoji: '🍸', name: 'The Violet Hour', meta: 'Speakeasy · Wicker Park · Sep 28', score: '10', color: 'text-emerald-600', bg: 'bg-blue-100' },
                      { emoji: '📸', name: 'Times Square Wax', meta: 'Attraction · Midtown · Sep 15', score: '4', color: 'text-terracotta', bg: 'bg-red-100' },
                      { emoji: '🥾', name: 'Breakneck Ridge', meta: 'Hike · Hudson Valley · Sep 8', score: '9', color: 'text-sage', bg: 'bg-emerald-100' },
                      { emoji: '🎭', name: 'Sleep No More', meta: 'Show · Chelsea · Aug 30', score: '7', color: 'text-amber', bg: 'bg-violet-100' },
                      { emoji: '🍕', name: 'Lucali', meta: 'Pizza · Carroll Gdns · Aug 22', score: '9', color: 'text-sage', bg: 'bg-amber-100' },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center justify-between p-2 bg-cream rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs ${item.bg}`}>
                            {item.emoji}
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-charcoal">{item.name}</div>
                            <div className="text-[8px] text-text-muted">{item.meta}</div>
                          </div>
                        </div>
                        <div className={`font-sans text-[15px] font-bold ${item.color}`}>{item.score}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Floating cards — hidden on mobile */}
              <div className="hidden lg:block absolute -left-1 top-[150px] bg-warm-white rounded-xl px-4 py-3 shadow-lg z-10 -rotate-3 animate-[floaty_6s_ease-in-out_infinite]">
                <div className="text-[9px] text-text-muted font-medium mb-0.5">Top neighborhood</div>
                <div className="font-serif text-base text-charcoal">East Village</div>
                <div className="text-[9px] text-terracotta font-semibold mt-0.5">avg 8.2 · 12 places</div>
              </div>
              <div className="hidden lg:block absolute -right-4 bottom-[130px] bg-warm-white rounded-xl px-4 py-3 shadow-lg z-10 rotate-2 animate-[floaty_6s_ease-in-out_infinite_3s]">
                <div className="text-[9px] text-text-muted font-medium mb-0.5">Friend activity</div>
                <div className="font-serif text-base text-charcoal">Priya rated 9</div>
                <div className="text-[9px] text-terracotta font-semibold mt-0.5">Café Integral · near you</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section className="py-[72px] bg-cream-deep">
        <div className="max-w-[700px] mx-auto px-6">
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-[clamp(1.3rem,2.8vw,1.85rem)] text-charcoal leading-[1.4] mb-5"
          >
            You've been to hundreds of places. You remember maybe <em className="italic text-terracotta">twenty.</em>
          </p>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-[clamp(0.95rem,1.8vw,1.08rem)] text-text-body leading-[1.75] mb-4 max-w-[640px]"
          >
            Someone texts "where should we eat?" and your mind goes blank. Your Notes app is a
            graveyard. Your Google Maps saves are a wall of pins with no context. Meanwhile, you
            keep ending up at the same three places — or scrolling "best of" lists and ending up on
            the couch.
          </p>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-lg italic text-charcoal mt-6 pl-5 border-l-[3px] border-terracotta"
          >
            Your taste deserves better than this.
          </p>
        </div>
      </section>

      {/* ── SOLUTION ── */}
      <section className="py-[72px] bg-charcoal">
        <div className="max-w-[700px] mx-auto px-6">
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-[clamp(1.8rem,3.5vw,2.6rem)] text-cream leading-[1.2] mb-1.5"
          >
            One tap. That's it.
          </div>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-base text-terracotta-light mb-7"
          >
            No review. No paragraph. No photo required.
          </p>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-stone leading-[1.75] mb-4"
          >
            After any experience — dinner, a hike, a bar you stumbled into at midnight — rate it with one tap.
                    
            Vouch builds a living record of your experiences over time.  
            Not a list. Not a journal.

            Searchable. Sortable. Yours.
          </p>
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 flex gap-3.5 flex-wrap mt-7"
          >
            {[
              { score: '8/10', label: 'Your Thai place', tag: 'RELIABLE', color: 'text-emerald-300', tagBg: 'bg-emerald-300/12', tagColor: 'text-emerald-300' },
              { score: '4/10', label: 'Tourist trap', tag: 'AVOID', color: 'text-terracotta-light', tagBg: 'bg-terracotta-light/12', tagColor: 'text-terracotta-light' },
              { score: '10/10', label: 'The speakeasy', tag: 'TELL EVERYONE', color: 'text-emerald-300', tagBg: 'bg-emerald-300/12', tagColor: 'text-emerald-300' },
            ].map((card) => (
              <div
                key={card.label}
                className="flex-1 min-w-[160px] bg-white/[0.06] border border-white/[0.08] rounded-[14px] px-5 py-4 hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className={`font-sans text-[2.2rem] font-bold leading-none mb-1 ${card.color}`}>
                  {card.score}
                </div>
                <div className="text-[0.82rem] text-stone">{card.label}</div>
                <span
                  className={`inline-block mt-1.5 px-2 py-0.5 rounded-2xl text-[0.65rem] font-semibold ${card.tagBg} ${card.tagColor}`}
                >
                  {card.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NETWORK ── */}
      <section className="py-[72px] bg-cream">
        <div className="max-w-[700px] mx-auto px-6">
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-xs font-semibold tracking-[0.14em] uppercase text-terracotta mb-2"
          >
            Network discovery
          </p>
          <h2
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-[clamp(1.5rem,3vw,2.2rem)] font-normal text-charcoal leading-[1.25]"
          >
            Your friends are rating too.
          </h2>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-[clamp(0.95rem,1.8vw,1.08rem)] text-text-body leading-[1.75] mt-4 max-w-[640px]"
          >
            Their ratings shape what you discover next — not through algorithms guessing from strangers, but through the people you actually trust.
          </p>
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6"
          >
            {[
              { icon: '🍺', title: 'Dive bar finder', desc: 'Their top-rated spots in your neighborhood.' },
              { icon: '🍝', title: 'Restaurant expert', desc: 'Their 9s and 10s when you need somewhere new.' },
              { icon: '🗺️', title: 'New-city explorer', desc: 'Their discoveries become yours.' },
            ].map((s) => (
              <div key={s.title} className="p-4 rounded-[14px] bg-cream-deep">
                <div className="text-[0.85rem] font-semibold text-charcoal mb-0.5">{s.icon} {s.title}</div>
                <div className="text-[0.82rem] text-text-muted leading-[1.5]">{s.desc}</div>
              </div>
            ))}
          </div>
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 bg-sage-light rounded-[14px] p-5 mt-6"
          >
            <p className="text-[0.92rem] text-charcoal-soft leading-[1.7]">
              <strong className="text-charcoal">Before your friends join?</strong> Your experience history works solo from day one. 
                First it's your personal map of everywhere you've been. 
                Then it becomes a network of recommendations from the people you trust.
            </p>
          </div>
          {/* <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-base italic text-charcoal mt-6"
          >
            Like Beli — but for everything. Bars, hikes, day trips, shows, classes, pop-ups.
          </p> */}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-[72px] bg-cream-deep">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center">
            <p
              ref={reveal}
              className="opacity-0 translate-y-6 transition-all duration-700 text-xs font-semibold tracking-[0.14em] uppercase text-terracotta mb-2"
            >
              How it works
            </p>
            <h2
              ref={reveal}
              className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-[clamp(1.5rem,3vw,2.2rem)] font-normal text-charcoal"
            >
              Three steps. Two seconds each.
            </h2>
          </div>
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 grid grid-cols-1 md:grid-cols-3 gap-5 mt-9"
          >
            {[
              { num: '01', title: 'Rate', desc: 'Tap to rate any experience. One number. Two seconds. Done.' },
              { num: '02', title: 'Build', desc: "Your history grows with every rating. Over time it becomes a clear record of what you love — and what you'd recommend." },
              { num: '03', title: 'Discover', desc: "See what's highly rated by people you trust. No strangers. No sponsored posts." },
            ].map((step) => (
              <div
                key={step.num}
                className="p-6 bg-warm-white rounded-[20px] border border-stone-light hover:-translate-y-1 hover:shadow-md transition-all duration-300"
              >
                <div className="font-serif text-[2.4rem] font-bold text-stone leading-none mb-2.5">{step.num}</div>
                <div className="text-base font-bold text-charcoal mb-1.5">{step.title}</div>
                <div className="text-[0.85rem] text-text-body leading-[1.6]">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RETENTION ── */}
      <section className="py-16 bg-cream">
        <div className="max-w-[700px] mx-auto px-6">
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-[clamp(1.2rem,2.5vw,1.6rem)] text-charcoal mb-1.5"
          >
            Most apps like this die after a week.
          </div>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-[0.95rem] text-terracotta font-medium mb-5"
          >
            We know that.
          </p>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-[clamp(0.95rem,1.8vw,1.08rem)] text-text-body leading-[1.75] max-w-[640px]"
          >
            That's why Vouch is built around momentum, not effort. Every rating makes the app smarter — and your history more useful.
          </p>
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6"
          >
            {[
              { title: 'Weekly taste recaps', desc: "Patterns you didn't notice." },
              { title: 'Friend nudges', desc: "When someone you trust rates something nearby." },
              { title: 'Compounding profile', desc: "Gets sharper with every rating." },
            ].map((f) => (
              <div key={f.title} className="p-4 rounded-[14px] bg-cream-deep">
                <div className="font-semibold text-[0.85rem] text-charcoal mb-0.5">{f.title}</div>
                <div className="text-[0.8rem] text-text-muted leading-[1.45]">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="py-16 bg-charcoal-soft overflow-hidden">
        <div className="max-w-[1100px] mx-auto px-6">
          <h2
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-[clamp(1.5rem,3vw,2.2rem)] font-normal text-cream text-center"
          >
            What early users say
          </h2>
          <div
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8"
          >
            {[
              { quote: '"I used to keep a Google Sheet of every restaurant. This replaced it in a day."', author: 'Mika', city: 'Brooklyn' },
              { quote: '"My friends already ask for recs. Now I just send them my profile."', author: 'Jordan', city: 'Austin' },
              { quote: '"I moved to Chicago and my friends\' ratings have been better than any \'best of\' list."', author: 'Priya', city: 'Chicago' },
              { quote: '"I\'ve tried five apps like this. This is the only one I opened a second time."', author: 'Dante', city: 'LA' },
              { quote: '"Three months in and I still rate everything. It takes two seconds."', author: 'Reese', city: 'Denver' },
            ].map((t) => (
              <div
                key={t.author}
                className="bg-white/[0.04] border border-white/[0.06] rounded-[14px] p-6 hover:bg-white/[0.07] transition-all duration-300"
              >
                <p className="font-serif text-[0.9rem] italic text-cream leading-[1.55] mb-3">
                  {t.quote}
                </p>
                <div className="text-[0.78rem] text-text-muted">
                  <strong className="text-terracotta-light font-semibold">{t.author}</strong> · {t.city}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="text-center py-20 bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgba(194,101,58,0.06)_0%,transparent_60%)] bg-cream-deep">
        <div className="max-w-[700px] mx-auto px-6">
          <h2
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 font-serif text-[clamp(1.8rem,4vw,2.8rem)] font-normal text-charcoal mb-4"
          >
            Less mediocre. <em className="italic text-terracotta">More you.</em>
          </h2>
          <p
            ref={reveal}
            className="opacity-0 translate-y-6 transition-all duration-700 text-base text-text-body mx-auto mb-7 max-w-[640px]"
          >
            Your best experiences already exist — scattered across memory, notes apps, and group chats. 
            Vouch just puts them in one place.
          </p>
          <div ref={reveal} className="opacity-0 translate-y-6 transition-all duration-700 flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => navigate('/login', { state: { mode: 'register' } })}
              className="px-7 py-3.5 rounded-full bg-charcoal text-cream font-semibold text-[0.92rem] hover:bg-terracotta transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Sign Up
            </button>
            <button
              onClick={() => navigate('/login', { state: { mode: 'login' } })}
              className="px-7 py-3.5 rounded-full border border-charcoal text-charcoal font-semibold text-[0.92rem] hover:bg-charcoal hover:text-cream transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Log in
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 text-center bg-charcoal">
        <div className="max-w-[1100px] mx-auto px-6">
          <p className="text-[0.78rem] text-text-muted mb-1">Vouch · Your social life, ranked.</p>
          <p className="text-[0.78rem] text-text-muted">
            <span className="text-terracotta-light cursor-pointer">Privacy</span> ·{' '}
            <span className="text-terracotta-light cursor-pointer">Terms</span> ·{' '}
            <span className="text-terracotta-light cursor-pointer">Support</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
