import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/AuthContext';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AppUser } from '../lib/AuthContext';
import { Property } from '../types';
import { Loader2, User, ShieldAlert, BarChart3, Home, MessageSquare, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserFilters } from '../components/admin/UserFilters';
import { UserTable } from '../components/admin/UserTable';
import { ListingFilters } from '../components/admin/ListingFilters';
import { ListingTable } from '../components/admin/ListingTable';
import { ListingApprovals } from '../components/admin/ListingApprovals';
import { ReportsModeration } from '../components/admin/ReportsModeration';
import { MessagingMonitoring } from '../components/admin/MessagingMonitoring';
import { PaymentsMonitoring } from '../components/admin/PaymentsMonitoring';
import { AnalyticsInsights } from '../components/admin/AnalyticsInsights';
import { NotificationsManagement } from '../components/admin/NotificationsManagement';
import { ReviewsModeration } from '../components/admin/ReviewsModeration';
import { FeaturedListingsControl } from '../components/admin/FeaturedListingsControl';
import { DisputesResolution } from '../components/admin/DisputesResolution';

const MetricCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: any }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'users' | 'listings' | 'approvals' | 'reports' | 'messaging' | 'payments' | 'notifications' | 'reviews' | 'featured' | 'disputes'>('overview');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [listings, setListings] = useState<Property[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [listingSearchQuery, setListingSearchQuery] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState('all');
  const [metrics, setMetrics] = useState({
    totalLandlords: 0,
    totalRenters: 0,
    totalListings: 0,
    pendingInquiries: 0,
    pendingViewings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        const [usersSnapshot, propertiesSnapshot, inquiriesSnapshot, viewingsSnapshot] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'properties')),
          getDocs(collection(db, 'inquiries')),
          getDocs(collection(db, 'viewings'))
        ]);

        const usersData = usersSnapshot.docs.map(doc => doc.data() as AppUser);
        setUsers(usersData);
        setListings(propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property)));

        setMetrics({
          totalLandlords: usersData.filter(u => u.role === 'landlord').length,
          totalRenters: usersData.filter(u => u.role === 'renter').length,
          totalListings: propertiesSnapshot.size,
          pendingInquiries: inquiriesSnapshot.docs.filter(d => d.data().status === 'pending').length,
          pendingViewings: viewingsSnapshot.docs.filter(d => d.data().status === 'pending').length
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const handleAction = async (uid: string, action: 'verify' | 'suspend' | 'ban' | 'resetPassword', email?: string) => {
    try {
      if (action === 'resetPassword' && email) {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent.');
        return;
      }

      const userRef = doc(db, 'users', uid);
      if (action === 'verify') await updateDoc(userRef, { isVerified: true });
      if (action === 'suspend') await updateDoc(userRef, { status: 'suspended' });
      if (action === 'ban') await updateDoc(userRef, { status: 'banned' });
      
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setUsers(usersSnapshot.docs.map(doc => doc.data() as AppUser));
    } catch (error) {
      console.error('Error performing action:', error);
      alert('Error performing action.');
    }
  };

  const handleListingAction = async (id: string, action: 'approve' | 'reject' | 'remove' | 'flag' | 'feature') => {
    try {
      const propRef = doc(db, 'properties', id);
      if (action === 'approve') await updateDoc(propRef, { status: 'active' });
      if (action === 'reject') await updateDoc(propRef, { status: 'removed' });
      if (action === 'remove') await updateDoc(propRef, { status: 'removed' });
      if (action === 'flag') await updateDoc(propRef, { status: 'reported' });
      if (action === 'feature') {
        const prop = listings.find(l => l.id === id);
        const isCurrentlyFeatured = prop?.isFeatured;
        
        if (isCurrentlyFeatured) {
          await updateDoc(propRef, { 
            isFeatured: false,
            promotionType: null,
            priority: 'Normal',
            featuredUntil: null
          });
        } else {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 7); // Default 7 days
          await updateDoc(propRef, { 
            isFeatured: true,
            promotionType: 'Free',
            priority: 'Normal',
            featuredUntil: endDate.toISOString()
          });
        }
      }
      
      const propsSnapshot = await getDocs(collection(db, 'properties'));
      setListings(propsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property)));
    } catch (error) {
      console.error('Error performing action:', error);
      alert('Error performing action.');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.phone && u.phone.includes(searchQuery));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (u.status || 'active') === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredListings = listings.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(listingSearchQuery.toLowerCase()) || 
                          l.location.toLowerCase().includes(listingSearchQuery.toLowerCase());
    const matchesStatus = listingStatusFilter === 'all' || l.status === listingStatusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-red-600" />
          Admin Dashboard
        </h1>

        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'analytics' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Analytics & Insights
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Manage Users
          </button>
          <button 
            onClick={() => setActiveTab('listings')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'listings' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Manage Listings
          </button>
          <button 
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'approvals' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Listing Approvals
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'reports' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Reports & Moderation
          </button>
          <button 
            onClick={() => setActiveTab('messaging')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'messaging' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Messaging Monitoring
          </button>
          <button 
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'payments' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Payments
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'notifications' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Notifications
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'reviews' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Reviews & Ratings
          </button>
          <button 
            onClick={() => setActiveTab('featured')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'featured' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Featured Listings
          </button>
          <button 
            onClick={() => setActiveTab('disputes')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'disputes' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
          >
            Support & Disputes
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard title="Total Landlords" value={metrics.totalLandlords} icon={User} />
            <MetricCard title="Total Renters" value={metrics.totalRenters} icon={User} />
            <MetricCard title="Total Listings" value={metrics.totalListings} icon={Home} />
            <MetricCard title="Pending Inquiries" value={metrics.pendingInquiries} icon={MessageSquare} />
            <MetricCard title="Pending Viewings" value={metrics.pendingViewings} icon={Calendar} />
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsInsights />
        )}

        {activeTab === 'users' && (
          <>
            <UserFilters 
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              roleFilter={roleFilter} setRoleFilter={setRoleFilter}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            />
            <UserTable 
              users={filteredUsers} 
              onAction={handleAction} 
              onViewProfile={(u) => {
                if (u.role === 'landlord') {
                  navigate(`/landlord/${u.uid}`);
                } else {
                  alert(`View profile for ${u.name}`);
                }
              }} 
            />
          </>
        )}

        {activeTab === 'listings' && (
          <>
            <ListingFilters 
              searchQuery={listingSearchQuery} setSearchQuery={setListingSearchQuery}
              statusFilter={listingStatusFilter} setStatusFilter={setListingStatusFilter}
            />
            <ListingTable listings={filteredListings} onAction={handleListingAction} />
          </>
        )}

        {activeTab === 'approvals' && (
          <ListingApprovals />
        )}

        {activeTab === 'reports' && (
          <ReportsModeration />
        )}

        {activeTab === 'messaging' && (
          <MessagingMonitoring />
        )}

        {activeTab === 'payments' && (
          <PaymentsMonitoring />
        )}

        {activeTab === 'notifications' && (
          <NotificationsManagement />
        )}

        {activeTab === 'reviews' && (
          <ReviewsModeration />
        )}

        {activeTab === 'featured' && (
          <FeaturedListingsControl />
        )}

        {activeTab === 'disputes' && (
          <DisputesResolution />
        )}
      </main>
    </div>
  );
}
