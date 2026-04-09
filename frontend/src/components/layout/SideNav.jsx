import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Search, Map, User, LogOut, Settings } from 'lucide-react';
import { NAV_ITEMS } from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';
import VouchLogo from '../ui/VouchLogo';

const ICONS = {
  feed: Compass,
  search: Search,
  map: Map,
  profile: User,
};

/**
 * SideNav — Liquid glass desktop sidebar (visible lg+).
 */
export default function SideNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen glass-solid border-r-0 fixed top-0 left-0 z-50">
      {/* Logo */}
      <div className="px-7 pt-8 pb-6">
        <VouchLogo size="md" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3">
        {NAV_ITEMS.map(({ key, label, path }) => {
          const Icon = ICONS[key];
          const isActive =
            location.pathname === path ||
            (path === '/' && location.pathname === '/feed');

          return (
            <NavLink
              key={key}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-fluid ${
                isActive
                  ? 'glass-nav-active text-terracotta'
                  : 'text-text-muted hover:bg-white/30 hover:text-charcoal'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-4 py-5 border-t border-white/30">
        {user && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-terracotta/10 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-terracotta border border-terracotta/10">
              {user.display_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-charcoal truncate">{user.display_name}</p>
              <p className="text-[10px] text-text-muted truncate">@{user.username}</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="text-text-muted hover:text-charcoal transition-fluid shrink-0"
            >
              <Settings size={16} />
            </button>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-text-muted hover:bg-white/30 hover:text-charcoal transition-fluid w-full text-sm font-medium"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
