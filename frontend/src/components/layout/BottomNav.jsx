import { NavLink, useLocation } from 'react-router-dom';
import { Compass, Search, Map, User, Users } from 'lucide-react';
import { NAV_ITEMS } from '../../lib/constants';

const ICONS = {
  feed: Compass,
  search: Search,
  map: Map,
  friends: Users,
  profile: User,
};

/**
 * BottomNav — Liquid glass mobile bottom navigation.
 */
export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass-solid border-t-0 rounded-t-2xl">
      <div className="max-w-lg mx-auto flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ key, label, path }) => {
          const Icon = ICONS[key];
          const isActive = location.pathname === path || (path === '/' && location.pathname === '/feed');

          return (
            <NavLink
              key={key}
              to={path}
              className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[56px]"
            >
              <div className={`p-1.5 rounded-xl transition-fluid ${isActive ? 'glass-nav-active' : ''}`}>
                <Icon
                  size={20}
                  className={isActive ? 'text-terracotta' : 'text-text-muted'}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </div>
              <span
                className={`text-[10px] font-semibold ${isActive ? 'text-terracotta' : 'text-text-muted'}`}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
      {/* Safe area padding for iPhone notch */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
