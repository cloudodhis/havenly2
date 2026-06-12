import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Compass, Bell, User, LogOut, Menu, X, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'payment' | 'booking' | 'system' | 'message';
  read: boolean;
  createdAt: string;
  link?: string;
}

const libraries: any[] = ['places', 'geometry'];

export function Navbar() {
  const { user, openAuthModal, signOut, switchRole } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() } as Notification);
      });
      // Sort client-side to avoid requiring a composite index
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);
    }, (error) => {
      console.error("Error fetching notifications:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const onLoadAutocomplete = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      const query = place.formatted_address || place.name;
      if (query) {
        setSearchQuery(query);
        navigate(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  }, [autocomplete, navigate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname, location.search]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/60 backdrop-blur-xl">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-8 flex-1">
          <button 
            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="bg-gray-200 p-1.5 rounded-lg group-hover:bg-gray-300 transition-colors">
              <Compass className="w-5 h-5 text-gray-900" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900 hidden sm:block">Explore</span>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex items-center flex-1 max-w-md relative group">
            <Search className="absolute left-3 w-4 h-4 text-gray-500 group-focus-within:text-gray-900 transition-colors z-10" />
            {isLoaded ? (
              <Autocomplete
                onLoad={onLoadAutocomplete}
                onPlaceChanged={onPlaceChanged}
                className="w-full"
              >
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery) {
                      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
                    }
                  }}
                  placeholder="Where do you want to move to?" 
                  className="w-full bg-gray-100 border border-gray-200 rounded-full py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-gray-300 focus:bg-gray-200 transition-all"
                />
              </Autocomplete>
            ) : (
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
                  }
                }}
                placeholder="Where do you want to move to?" 
                className="w-full bg-gray-100 border border-gray-200 rounded-full py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-gray-300 focus:bg-gray-200 transition-all"
              />
            )}
          </div>

          {/* Search Bar (Mobile - Prominent) */}
          <div className="md:hidden flex-1 relative group ml-1">
            <Search className="absolute left-3 w-4 h-4 text-gray-500 z-10 top-1/2 -translate-y-1/2" />
            {isLoaded ? (
              <Autocomplete
                onLoad={onLoadAutocomplete}
                onPlaceChanged={onPlaceChanged}
                className="w-full"
              >
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery) {
                      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
                    }
                  }}
                  placeholder="Where to?" 
                  className="w-full bg-gray-100 border border-gray-200 rounded-full py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-gray-100 transition-all shadow-sm"
                />
              </Autocomplete>
            ) : (
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
                  }
                }}
                placeholder="Where to?" 
                className="w-full bg-gray-100 border border-gray-200 rounded-full py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-gray-100 transition-all shadow-sm"
              />
            )}
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 mx-8 relative">
          {[
            { id: 'map', label: 'Map', path: '/', isActive: location.pathname === '/' || location.pathname === '/search' || location.pathname.startsWith('/property/') },
            { id: 'dashboard', label: 'Dashboard', path: '/dashboard', isActive: location.pathname === '/dashboard' && !location.search.includes('properties') },
            ...(user ? [
              { id: 'saved', label: 'Saved', path: '/dashboard?tab=properties', isActive: location.pathname === '/dashboard' && location.search.includes('properties') },
            ] : [])
          ].map((item) => (
            <Link 
              key={item.id}
              to={item.path} 
              className="relative px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              {item.isActive && (
                <motion.div
                  layoutId="navbarIndicator"
                  className="absolute inset-0 bg-gray-200 rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className={cn("relative z-10", item.isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-900")}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4 relative" ref={dropdownRef}>
          {user && (
            <button 
              onClick={() => {
                const roles: ('renter' | 'landlord' | 'admin')[] = ['renter', 'landlord', 'admin'];
                const currentIndex = roles.indexOf(user.role);
                const nextIndex = (currentIndex + 1) % roles.length;
                switchRole(roles[nextIndex]);
              }}
              className="hidden md:block text-[10px] font-bold uppercase tracking-widest px-4 py-2 border border-gray-200 rounded-full hover:bg-purple-600 hover:text-white transition-all"
            >
              Switch to {user.role === 'renter' ? 'Landlord' : user.role === 'landlord' ? 'Admin' : 'Renter'}
            </button>
          )}
          <div className="relative" ref={notificationsRef}>
            <button 
              className="p-2 text-gray-500 hover:text-gray-900 transition-colors hidden sm:block rounded-full hover:bg-gray-100 relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div 
                          key={notification.id}
                          className={cn(
                            "px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0",
                            !notification.read ? "bg-purple-50/50" : ""
                          )}
                          onClick={() => {
                            if (!notification.read) markAsRead(notification.id);
                            if (notification.link) {
                              navigate(notification.link);
                              setShowNotifications(false);
                            }
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="mt-1">
                              {notification.type === 'payment' ? (
                                <CheckCircle className={cn("w-5 h-5", !notification.read ? "text-purple-600" : "text-gray-400")} />
                              ) : (
                                <AlertCircle className={cn("w-5 h-5", !notification.read ? "text-purple-600" : "text-gray-400")} />
                              )}
                            </div>
                            <div>
                              <p className={cn("text-sm", !notification.read ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notification.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button 
            className="flex items-center gap-1 focus:outline-none group"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-900 overflow-hidden cursor-pointer border border-gray-200 group-hover:border-purple-600/30 transition-all group-focus:ring-2 group-focus:ring-purple-600/20">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-900 transition-colors" />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full right-0 mt-3 w-56 bg-gray-50/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 overflow-hidden"
              >
                {user ? (
                  <>
                    <div className="px-4 py-3 border-b border-gray-100 mb-2 bg-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="px-2">
                      <Link to="/dashboard" className="block px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" onClick={() => setShowDropdown(false)}>
                        Dashboard
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" className="block px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" onClick={() => setShowDropdown(false)}>
                          Admin Dashboard
                        </Link>
                      )}
                      <Link to="/dashboard?tab=settings" className="block px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" onClick={() => setShowDropdown(false)}>
                        Settings
                      </Link>
                      <div className="h-px bg-gray-100 my-2 mx-2" />
                      <button 
                        onClick={() => { signOut(); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="px-2">
                    <button 
                      onClick={() => { openAuthModal('renter'); setShowDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-purple-50 hover:text-purple-600 rounded-lg font-medium transition-colors"
                    >
                      Log in
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-white/95 backdrop-blur-xl border-b border-gray-100"
          >
            <div className="py-4 px-4 flex flex-col gap-2 relative">
              {[
                { id: 'map', label: 'Map', path: '/', isActive: location.pathname === '/' || location.pathname === '/search' || location.pathname.startsWith('/property/') },
                { id: 'dashboard', label: 'Dashboard', path: '/dashboard', isActive: location.pathname === '/dashboard' && !location.search.includes('properties') },
                ...(user ? [
                  { id: 'saved', label: 'Saved', path: '/dashboard?tab=properties', isActive: location.pathname === '/dashboard' && location.search.includes('properties') },
                ] : [])
              ].map((item) => (
                <Link 
                  key={item.id}
                  to={item.path} 
                  className="relative px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  {item.isActive && (
                    <motion.div
                      layoutId="mobileMenuIndicator"
                      className="absolute inset-0 bg-gray-200 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={cn("relative z-10", item.isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-900")}>
                    {item.label}
                  </span>
                </Link>
              ))}
              {user && (
                <>
                  <div className="h-px bg-gray-100 my-2 mx-4" />
                  <button 
                    onClick={() => {
                      const roles: ('renter' | 'landlord' | 'admin')[] = ['renter', 'landlord', 'admin'];
                      const currentIndex = roles.indexOf(user.role);
                      const nextIndex = (currentIndex + 1) % roles.length;
                      switchRole(roles[nextIndex]);
                    }}
                    className="text-left px-4 py-3 rounded-xl text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 transition-colors"
                  >
                    Switch to {user.role === 'renter' ? 'Landlord' : user.role === 'landlord' ? 'Admin' : 'Renter'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
