import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, User, Bell, Shield, HelpCircle, ChevronRight, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import PageHeader from '../components/layout/PageHeader';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import LocationPicker from '../components/ui/LocationPicker';

const SECTIONS = [
  {
    label: 'Account',
    items: [
      { key: 'edit-profile', label: 'Edit Profile', icon: User, action: 'edit-profile' },
      { key: 'location', label: 'Location', icon: MapPin, action: 'location' },
      { key: 'notifications', label: 'Notifications', icon: Bell, action: 'notifications' },
      { key: 'privacy', label: 'Privacy', icon: Shield, action: 'privacy' },
    ],
  },
  {
    label: 'Support',
    items: [
      { key: 'help', label: 'Help & FAQ', icon: HelpCircle, action: 'help' },
    ],
  },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { location } = useLocation();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const handleAction = (action) => {
    switch (action) {
      case 'edit-profile':
        navigate('/profile');
        break;
      case 'location':
        setShowLocationPicker(true);
        break;
      default:
        break;
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="pb-20 lg:pb-8">
      {showLocationPicker && <LocationPicker onClose={() => setShowLocationPicker(false)} />}
      <PageHeader title="Settings">
        <button
          onClick={() => navigate(-1)}
          className="text-secondary-text hover:text-primary-text transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
      </PageHeader>

      <div className="px-4 lg:px-8 max-w-2xl mx-auto">
        {/* User card */}
        <div className="flex items-center gap-3 mt-4 p-4 bg-surface rounded-xl border border-divider">
          <Avatar name={user?.display_name || 'User'} src={user?.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-base truncate">{user?.display_name}</h3>
            <p className="text-sm text-terracotta">@{user?.username}</p>
            <p className="text-xs text-secondary-text truncate">{user?.email}</p>
          </div>
        </div>

        {/* Setting sections */}
        {SECTIONS.map((section) => (
          <div key={section.label} className="mt-6">
            <h4 className="text-xs font-semibold text-secondary-text uppercase tracking-wider px-1 mb-2">
              {section.label}
            </h4>
            <div className="bg-surface rounded-xl border border-divider overflow-hidden">
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleAction(item.action)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-deep/50 transition-vouch ${
                      i > 0 ? 'border-t border-divider' : ''
                    }`}
                  >
                    <Icon size={18} className="text-secondary-text shrink-0" />
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium text-primary-text">{item.label}</span>
                      {item.key === 'location' && location && (
                        <p className="text-xs text-secondary-text mt-0.5">{location.city}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-secondary-text shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="mt-8 mb-6">
          {showLogoutConfirm ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-sm text-red-700 font-medium mb-3">Are you sure you want to log out?</p>
              <div className="flex gap-2 justify-center">
                <Button variant="ghost" size="sm" onClick={() => setShowLogoutConfirm(false)}>
                  Cancel
                </Button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-full hover:bg-red-600 transition-colors"
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-200"
            >
              <LogOut size={18} />
              <span className="text-sm font-semibold">Log Out</span>
            </button>
          )}
        </div>

        {/* App info */}
        <p className="text-center text-[10px] text-secondary-text mb-8">
          Vouch v1.0.0 · Made with ♥
        </p>
      </div>
    </div>
  );
}
