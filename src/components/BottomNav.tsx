import React from 'react';
import { Compass, Pin, MessageSquare, User, Home, LayoutDashboard, Map as MapIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { motion } from 'motion/react';

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  
  const isLandlord = user?.role === 'landlord' || user?.role === 'admin';

  const navItems = isLandlord ? [
    { icon: LayoutDashboard, label: 'DASHBOARD', path: '/dashboard', query: '?tab=dashboard' },
    { icon: Home, label: 'LISTINGS', path: '/dashboard', query: '?tab=properties' },
    { icon: MessageSquare, label: 'INQUIRIES', path: '/dashboard', query: '?tab=messages' },
    { icon: User, label: 'PROFILE', path: '/dashboard', query: '?tab=settings' },
  ] : [
    { icon: MapIcon, label: 'MAP', path: '/', query: '' },
    { icon: LayoutDashboard, label: 'DASHBOARD', path: '/dashboard', query: '?tab=dashboard' },
    { icon: Pin, label: 'SAVED', path: '/dashboard', query: '?tab=properties' },
    { icon: User, label: 'PROFILE', path: '/dashboard', query: '?tab=settings' },
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 md:hidden z-[60]">
      <div className="bg-white/80 backdrop-blur-xl px-2 py-2 flex items-center justify-between rounded-3xl shadow-2xl border border-gray-200">
        {navItems.map((item) => {
          const isDashboard = location.pathname === '/dashboard';
          const currentTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
          const itemTab = new URLSearchParams(item.query).get('tab');
          
          let isActive = false;
          if (isDashboard && item.path === '/dashboard') {
            isActive = currentTab === itemTab;
          } else if (!isDashboard) {
            if (item.path === '/') {
              isActive = location.pathname === '/' || location.pathname === '/search' || location.pathname.startsWith('/property/');
            } else {
              isActive = location.pathname === item.path;
            }
          }
            
          return (
            <Link 
              key={item.label} 
              to={`${item.path}${item.query}`}
              className="relative flex flex-col items-center justify-center w-full py-2"
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute inset-0 bg-purple-100 rounded-2xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className={cn(
                "relative z-10 flex flex-col items-center gap-1 transition-colors duration-300",
                isActive ? "text-purple-600" : "text-gray-500 hover:text-gray-700"
              )}>
                <item.icon className={cn("w-5 h-5", isActive && "fill-purple-600/20")} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
