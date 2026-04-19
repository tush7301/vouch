import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import BottomNav from './components/layout/BottomNav';
import SideNav from './components/layout/SideNav';
import Feed from './pages/Feed';
import Search from './pages/Search';
import MapPage from './pages/Map';
import FindFriends from './pages/FindFriends';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import ExperienceDetail from './pages/ExperienceDetail';
import RateExperience from './pages/RateExperience';
import SettingsPage from './pages/Settings';

/**
 * App shell — responsive layout with auth gating.
 * Desktop (lg+): sidebar nav on left, content offset.
 * Mobile: bottom tab bar.
 * Unauthenticated users → /login.
 * Users who haven't onboarded → /onboarding.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public — auth pages (no nav) */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected — main tabs */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-cream">
                  <SideNav />
                  <div className="lg:ml-60">
                    <Routes>
                      <Route path="/" element={<Feed />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/map" element={<MapPage />} />
                      <Route path="/friends" element={<FindFriends />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/:userId" element={<Profile />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/experience/:id" element={<ExperienceDetail />} />
                      <Route path="/rate/:id" element={<RateExperience />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </div>
                  <BottomNav />
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
