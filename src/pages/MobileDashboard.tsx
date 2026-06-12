import React, { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, Calendar, Home as HomeIcon, Loader2, Pin, MapPin, ChevronRight, Settings, User } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export function MobileDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [properties, setProperties] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [viewings, setViewings] = useState<any[]>([]);
  const [savedProperties, setSavedProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    setLoading(true);

    // Data fetching logic (simplified for mobile)
    // ... (This will be similar to Dashboard.tsx)
    setLoading(false);
  }, [user, navigate]);

  if (!user) return null;
  const isLandlord = user.role === 'landlord' || user.role === 'admin';

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-light">Dashboard</h1>
        <button onClick={() => navigate('/settings')} className="p-2 bg-gray-100 rounded-full">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-[10px] uppercase text-gray-400">Total</p>
              <h3 className="text-2xl font-light">{isLandlord ? properties.length : savedProperties.length}</h3>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-[10px] uppercase text-gray-400">Active</p>
              <h3 className="text-2xl font-light">{inquiries.length}</h3>
            </div>
          </div>

          {/* Quick Actions */}
          <section>
            <h2 className="text-sm font-bold mb-3">Quick Actions</h2>
            <div className="space-y-3">
              {isLandlord && (
                <div 
                  onClick={() => navigate(`/landlord/${user.uid}`)}
                  className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Public Profile</p>
                      <p className="text-xs text-gray-400">View and edit your public page</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              )}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-bold mb-3">Upcoming Viewings</h2>
            <div className="space-y-3">
              {viewings.slice(0, 3).map(v => (
                <div key={v.id} className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{v.propertyTitle}</p>
                    <p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
