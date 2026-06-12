import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { BarChart3, MessageSquare, Eye, Calendar, Plus, Settings, Home as HomeIcon, Loader2, Pin, LayoutDashboard, MapPin, User, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../lib/AuthContext';
import { Footer } from '../components/Footer';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType, cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PropertyCard, Property } from '../components/PropertyCard';
import { FilterBar } from '../components/FilterBar';
import { BottomNav } from '../components/BottomNav';
import { motion } from 'motion/react';

import { MessagesView } from '../components/MessagesView';
import { PaymentsView } from '../components/PaymentsView';
import { ApplicationsView } from '../components/ApplicationsView';
import ReviewModal from '../components/ReviewModal';
import { DisputeModal } from '../components/DisputeModal';
import { CreditCard, ArrowRight, FileText } from 'lucide-react';

export function Dashboard() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') as any;

  const [properties, setProperties] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [viewings, setViewings] = useState<any[]>([]);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'message' | 'user'>('message');
  const [reportedItemId, setReportedItemId] = useState('');
  const [reportedItemName, setReportedItemName] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState('');
  const [reviewTargetName, setReviewTargetName] = useState('');
  const [reviewTargetType, setReviewTargetType] = useState<'property' | 'landlord' | 'renter'>('property');

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState<{
    landlordId: string;
    landlordName: string;
    tenantId: string;
    tenantName: string;
    propertyId?: string;
    propertyTitle?: string;
  } | null>(null);

  const activeTab = (initialTab && ['dashboard', 'properties', 'messages', 'viewings', 'payments', 'applications', 'settings'].includes(initialTab)) 
    ? initialTab as 'dashboard' | 'properties' | 'messages' | 'viewings' | 'payments' | 'applications' | 'settings'
    : 'dashboard';

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [filters, setFilters] = useState({
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    currency: undefined as string | undefined,
    type: undefined as string | undefined,
    listingType: undefined as 'rent' | 'sale' | undefined,
    amenities: [] as string[],
    beds: undefined as number | undefined,
    baths: undefined as number | undefined,
    guests: undefined as number | undefined
  });

  const filterItems = (items: any[]) => {
    return items.filter(item => {
      if (filters.minPrice !== undefined && item.price < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && item.price > filters.maxPrice) return false;
      if (filters.currency && item.currency !== filters.currency) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.listingType && item.listingType !== filters.listingType) return false;
      if (filters.beds !== undefined && item.beds < filters.beds) return false;
      if (filters.baths !== undefined && item.baths < filters.baths) return false;
      if (filters.guests !== undefined && (item.guests || 0) < filters.guests) return false;
      if (filters.amenities.length > 0) {
        const itemAmenities = item.amenities || [];
        if (!filters.amenities.every((a: string) => itemAmenities.includes(a))) return false;
      }
      return true;
    });
  };

  const filteredProperties = filterItems(properties);
  const filteredSavedProperties = filterItems(savedProperties);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Real-time listener for properties (if landlord)
    let unsubscribeProperties: (() => void) | undefined;
    if (user.role === 'landlord' || user.role === 'admin') {
      const propsQuery = query(collection(db, 'properties'), where('landlordId', '==', user.uid));
      unsubscribeProperties = onSnapshot(propsQuery, (snapshot) => {
        const propsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProperties(propsData);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'properties');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
 
    // Real-time listener for viewings
    let unsubscribeViewings: (() => void) | undefined;
    const viewQuery = user.role === 'landlord' || user.role === 'admin'
      ? query(collection(db, 'viewings'), where('landlordId', '==', user.uid))
      : query(collection(db, 'viewings'), where('renterId', '==', user.uid));

    unsubscribeViewings = onSnapshot(viewQuery, async (snapshot) => {
      const viewData = await Promise.all(snapshot.docs.map(async (viewDoc) => {
        const data = viewDoc.data();
        const otherUserId = user.role === 'landlord' || user.role === 'admin' ? data.renterId : data.landlordId;
        
        // Fetch other user name
        const userRef = doc(db, 'users', otherUserId);
        const userSnap = await getDoc(userRef);
        const otherUserName = userSnap.exists() ? userSnap.data().name : 'Unknown User';
        
        // Fetch property details
        const propRef = doc(db, 'properties', data.propertyId);
        const propSnap = await getDoc(propRef);
        const propertyTitle = propSnap.exists() ? propSnap.data().title : 'Unknown Property';
        const propertyLocation = propSnap.exists() ? propSnap.data().location : '';
        
        return { 
          id: viewDoc.id, 
          ...data, 
          renterName: user.role === 'landlord' || user.role === 'admin' ? otherUserName : undefined,
          landlordName: user.role === 'landlord' || user.role === 'admin' ? undefined : otherUserName,
          propertyTitle,
          propertyLocation,
          date: data.date
        };
      }));
      
      // Sort in memory to avoid needing a composite index
      viewData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setViewings(viewData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'viewings');
    });

    // Real-time listener for inquiries
    let unsubscribeInquiries: (() => void) | undefined;
    const inqQuery = user.role === 'landlord' || user.role === 'admin' 
      ? query(collection(db, 'inquiries'), where('landlordId', '==', user.uid))
      : query(collection(db, 'inquiries'), where('renterId', '==', user.uid));

    unsubscribeInquiries = onSnapshot(inqQuery, async (snapshot) => {
      const inqData = await Promise.all(snapshot.docs.map(async (inqDoc) => {
        const data = inqDoc.data();
        const otherUserId = user.role === 'landlord' || user.role === 'admin' ? data.renterId : data.landlordId;
        
        // Fetch other user name
        const userRef = doc(db, 'users', otherUserId);
        const userSnap = await getDoc(userRef);
        const otherUserName = userSnap.exists() ? userSnap.data().name : 'Unknown User';
        
        // Fetch property title
        const propRef = doc(db, 'properties', data.propertyId);
        const propSnap = await getDoc(propRef);
        const propertyTitle = propSnap.exists() ? propSnap.data().title : 'Unknown Property';
        
        return { 
          id: inqDoc.id, 
          ...data, 
          renterName: user.role === 'landlord' || user.role === 'admin' ? otherUserName : undefined,
          landlordName: user.role === 'landlord' || user.role === 'admin' ? undefined : otherUserName,
          propertyTitle,
          createdAt: data.createdAt
        };
      }));
      
      // Sort in memory to avoid needing a composite index
      inqData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setInquiries(inqData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inquiries');
    });

    // Real-time listener for saved properties and bookings
    let unsubscribeSaved: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;
    if (user.role === 'renter') {
      const savedQuery = query(collection(db, 'savedProperties'), where('userId', '==', user.uid));
      unsubscribeSaved = onSnapshot(savedQuery, async (snapshot) => {
        const savedProps: Property[] = [];
        const seenIds = new Set<string>();
        for (const savedDoc of snapshot.docs) {
          const propId = savedDoc.data().propertyId;
          if (seenIds.has(propId)) continue;
          
          const propRef = doc(db, 'properties', propId);
          try {
            const propSnap = await getDoc(propRef);
            if (propSnap.exists()) {
              seenIds.add(propId);
              savedProps.push({ id: propSnap.id, ...propSnap.data() } as Property);
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `properties/${propId}`);
          }
        }
        setSavedProperties(savedProps);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'savedProperties');
      });

      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('tenantId', '==', user.uid),
        where('status', '==', 'active')
      );
      unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
        const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBookings(bookingsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      });
    }

    // Real-time listener for applications
    let unsubscribeApplications: (() => void) | undefined;
    const appQuery = user.role === 'landlord' || user.role === 'admin'
      ? query(collection(db, 'applications'), where('landlordId', '==', user.uid))
      : query(collection(db, 'applications'), where('tenantId', '==', user.uid));

    unsubscribeApplications = onSnapshot(appQuery, (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(appsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'applications');
    });

    return () => {
      if (unsubscribeProperties) unsubscribeProperties();
      if (unsubscribeInquiries) unsubscribeInquiries();
      if (unsubscribeViewings) unsubscribeViewings();
      if (unsubscribeSaved) unsubscribeSaved();
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribeApplications) unsubscribeApplications();
    };
  }, [user, navigate]);

  const handleUpdateViewingStatus = async (viewingId: string, status: 'confirmed' | 'cancelled') => {
    try {
      const viewingRef = doc(db, 'viewings', viewingId);
      await updateDoc(viewingRef, { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `viewings/${viewingId}`);
    }
  };

  const handleReport = async () => {
    if (!user) return;
    if (!reportReason.trim()) {
      alert("Please provide a reason for reporting.");
      return;
    }

    setSubmittingReport(true);
    try {
      const { addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, 'reports'), {
        type: reportType,
        reportedItemId,
        reportedItemName,
        reportedBy: user.uid,
        reportedByName: user.name || user.email,
        reason: reportReason,
        status: 'pending',
        priority: 'medium',
        createdAt: new Date().toISOString()
      });
      setIsReportModalOpen(false);
      setReportReason('');
      alert("Report submitted successfully. Our team will review it shortly.");
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Failed to submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-white text-gray-900">
        <Navbar />
        <div className="flex-grow flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600 mb-6">
              <User className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Sign in to view your dashboard</h2>
            <p className="text-gray-500">Access your saved properties, messages, and viewings by signing in to your account.</p>
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-full py-6 text-lg font-medium shadow-xl shadow-purple-600/20"
              onClick={() => openAuthModal('renter')}
            >
              Sign In
            </Button>
          </div>
        </div>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  const isLandlord = user.role === 'landlord' || user.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar />
      
      <div className="flex-grow flex flex-col md:flex-row w-full md:container md:mx-auto md:px-6 gap-6 md:gap-12">
        {/* Sidebar */}
        <aside className="hidden md:block w-72 flex-shrink-0 py-12 sticky top-20 h-[calc(100vh-80px)]">
          <div className="space-y-8">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Menu</h3>
              <nav className="space-y-2 relative">
                {[
                  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
                  ...(user.role === 'admin' ? [{ id: 'admin', icon: ShieldAlert, label: 'Admin Panel', onClick: () => navigate('/admin') }] : []),
                  { id: 'properties', icon: isLandlord ? HomeIcon : Pin, label: isLandlord ? 'My Listings' : 'Saved Homes' },
                  ...(isLandlord ? [{ id: 'public-profile', icon: User, label: 'Public Profile', onClick: () => navigate(`/landlord/${user.uid}`) }] : []),
                  { id: 'messages', icon: MessageSquare, label: isLandlord ? 'Inquiries' : 'My Messages', badge: inquiries.length > 0 ? inquiries.length : null },
                  { id: 'viewings', icon: Calendar, label: 'Viewings' },
                  { id: 'applications', icon: FileText, label: 'Applications' },
                  { id: 'payments', icon: CreditCard, label: 'Payments' }
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => item.onClick ? item.onClick() : setActiveTab(item.id as any)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors relative group"
                  >
                    {activeTab === item.id && (
                      <motion.div
                        layoutId="desktopSidebarIndicator"
                        className="absolute inset-0 bg-gray-200 rounded-xl"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <item.icon className={cn("w-5 h-5 relative z-10 transition-colors", activeTab === item.id ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900")} />
                    <span className={cn("relative z-10 transition-colors", activeTab === item.id ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900")}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="ml-auto relative z-10 bg-gray-200 text-gray-900 text-[10px] px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Account</h3>
              <nav className="space-y-2">
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors relative group"
                >
                  {activeTab === 'settings' && (
                    <motion.div
                      layoutId="desktopSidebarIndicator"
                      className="absolute inset-0 bg-gray-200 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Settings className={cn("w-5 h-5 relative z-10 transition-colors", activeTab === 'settings' ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900")} />
                  <span className={cn("relative z-10 transition-colors", activeTab === 'settings' ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900")}>
                    Settings
                  </span>
                </button>
              </nav>
            </div>
          </div>
        </aside>

        {/* Mobile Dashboard Nav */}
        <div className="md:hidden w-full mb-6 sticky top-16 z-40 bg-white/80 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-gray-100">
          <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              ...(user.role === 'admin' ? [{ id: 'admin', label: 'Admin Panel', onClick: () => navigate('/admin') }] : []),
              { id: 'properties', label: isLandlord ? 'Listings' : 'Saved' },
              { id: 'messages', label: 'Messages' },
              { id: 'viewings', label: 'Viewings' },
              { id: 'applications', label: 'Applications' },
              { id: 'payments', label: 'Payments' },
              { id: 'settings', label: 'Settings' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => tab.onClick ? tab.onClick() : setActiveTab(tab.id as any)} 
                className="relative px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors"
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="mobileTabIndicator"
                    className="absolute inset-0 bg-white rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className={cn("relative z-10", activeTab === tab.id ? "text-black" : "text-gray-500 hover:text-gray-900")}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-grow min-w-0 py-6 sm:py-12 px-4 sm:pr-4 pb-32">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-12">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-3 block">Overview</span>
              <h1 className="text-3xl sm:text-5xl font-light tracking-tight">Welcome, {user.name?.split(' ')[0] || 'User'}</h1>
            </div>
            {isLandlord && (
              <button 
                onClick={() => navigate('/add-property')} 
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-full font-bold text-sm hover:bg-purple-700 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Property
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-12">
              {activeTab === 'dashboard' && (
                <>
                  {/* Current Rental Section for Renters */}
                  {!isLandlord && bookings.length > 0 && (
                    <div className="mb-8">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-3 block">Your Current Rental</span>
                      <div className="bg-indigo-600 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div>
                            <h3 className="text-2xl sm:text-3xl font-bold mb-2">{bookings[0].propertyTitle}</h3>
                            <div className="flex items-center gap-4 text-indigo-100">
                              <p>Monthly Rent: <span className="font-bold text-white">${bookings[0].rentAmount}</span></p>
                              <div className="w-1 h-1 bg-indigo-300 rounded-full"></div>
                              <p>Next Due: <span className="font-bold text-white">{new Date(bookings[0].nextPaymentDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setActiveTab('payments')}
                            className="bg-white text-indigo-600 px-6 py-3 rounded-full font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            Pay Rent Now <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div 
                      onClick={() => setActiveTab('properties')}
                      className="bg-gray-50 p-4 sm:p-8 rounded-3xl border border-gray-100 group hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="p-3 bg-gray-100 text-gray-900 rounded-2xl group-hover:bg-white group-hover:text-black transition-all">
                          {isLandlord ? <HomeIcon className="w-6 h-6" /> : <Pin className="w-6 h-6" />}
                        </div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Total</span>
                      </div>
                      <p className="text-sm text-gray-400 font-medium mb-1">{isLandlord ? 'Properties' : 'Saved Homes'}</p>
                      <h3 className="text-3xl sm:text-4xl font-light tracking-tight">{isLandlord ? properties.length : savedProperties.length}</h3>
                    </div>
                    
                    <div 
                      onClick={() => setActiveTab('messages')}
                      className="bg-gray-50 p-4 sm:p-8 rounded-3xl border border-gray-100 group hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="p-3 bg-gray-100 text-gray-900 rounded-2xl group-hover:bg-white group-hover:text-black transition-all">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Active</span>
                      </div>
                      <p className="text-sm text-gray-400 font-medium mb-1">{isLandlord ? 'Inquiries' : 'Messages'}</p>
                      <h3 className="text-3xl sm:text-4xl font-light tracking-tight">{inquiries.length}</h3>
                    </div>

                    <div 
                      onClick={() => setActiveTab('viewings')}
                      className="bg-gray-50 p-4 sm:p-8 rounded-3xl border border-gray-100 group hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="p-3 bg-gray-100 text-gray-900 rounded-2xl group-hover:bg-white group-hover:text-black transition-all">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Upcoming</span>
                      </div>
                      <p className="text-sm text-gray-400 font-medium mb-1">Viewings</p>
                      <h3 className="text-3xl sm:text-4xl font-light tracking-tight">{viewings.filter(v => new Date(v.date) > new Date()).length}</h3>
                    </div>

                    <div 
                      onClick={() => setActiveTab('applications')}
                      className="bg-gray-50 p-4 sm:p-8 rounded-3xl border border-gray-100 group hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="p-3 bg-gray-100 text-gray-900 rounded-2xl group-hover:bg-white group-hover:text-black transition-all">
                          <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Total</span>
                      </div>
                      <p className="text-sm text-gray-400 font-medium mb-1">Applications</p>
                      <h3 className="text-3xl sm:text-4xl font-light tracking-tight">{applications.length}</h3>
                    </div>
                  </div>

                  {/* Content Sections */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                    {/* Recent Items */}
                    <div className="space-y-4 sm:space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl sm:text-2xl font-light tracking-tight">{isLandlord ? 'My Listings' : 'Saved Homes'}</h2>
                        <button onClick={() => setActiveTab('properties')} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all">View All</button>
                      </div>
                      
                      <div className="space-y-4">
                        {(isLandlord ? properties : savedProperties).slice(0, 2).map((property) => (
                          <div 
                            key={property.id} 
                            className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer group"
                            onClick={() => navigate(`/property/${property.id}`)}
                          >
                            <img src={property.imageUrls?.[0] || property.imageUrl} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover" referrerPolicy="no-referrer" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm truncate group-hover:text-gray-900 transition-all">{property.title}</h4>
                              <p className="text-xs text-gray-400 truncate">{property.location}</p>
                              <p className="text-xs font-bold mt-1">${property.price.toLocaleString()}/mo</p>
                            </div>
                          </div>
                        ))}
                        {(isLandlord ? properties : savedProperties).length === 0 && (
                          <div className="py-8 sm:py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-sm text-gray-400">No items to show yet.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Inquiries */}
                    <div className="space-y-4 sm:space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl sm:text-2xl font-light tracking-tight">Recent Inquiries</h2>
                        <button onClick={() => setActiveTab('messages')} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all">View All</button>
                      </div>
                      
                      <div className="space-y-4">
                        {inquiries.slice(0, 3).map((inquiry) => (
                          <div key={inquiry.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                                inquiry.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'
                              }`}>
                                {inquiry.status}
                              </span>
                              <span className="text-[10px] text-gray-300">{new Date(inquiry.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="mb-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                {isLandlord ? `From: ${inquiry.renterName}` : `To: ${inquiry.landlordName}`}
                              </p>
                              <p className="text-xs font-medium text-gray-900 truncate">{inquiry.propertyTitle}</p>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{inquiry.message || 'No message provided.'}</p>
                            <button 
                              onClick={() => navigate(`/property/${inquiry.propertyId}`)}
                              className="text-[10px] font-bold uppercase tracking-widest text-gray-900 hover:underline"
                            >
                              View Property
                            </button>
                          </div>
                        ))}
                        {inquiries.length === 0 && (
                          <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-sm text-gray-400">No inquiries yet.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upcoming Viewings (New Section) */}
                    <div className="space-y-8 xl:col-span-2">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-light tracking-tight">Upcoming Viewings</h2>
                        <button onClick={() => setActiveTab('viewings')} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all">View All</button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {viewings.filter(v => new Date(v.date) > new Date()).slice(0, 2).map((viewing) => (
                          <div key={viewing.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 hover:border-gray-200 transition-all flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold uppercase text-gray-400">{new Date(viewing.date).toLocaleString('default', { month: 'short' })}</span>
                              <span className="text-lg font-bold">{new Date(viewing.date).getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-bold text-sm text-gray-900 truncate">{viewing.propertyTitle}</h4>
                                <span className="text-[10px] font-bold text-gray-400">{new Date(viewing.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-xs text-gray-400 mb-3">{isLandlord ? `With: ${viewing.renterName}` : `With: ${viewing.landlordName}`}</p>
                              <div className="flex items-center gap-4">
                                <button onClick={() => navigate(`/property/${viewing.propertyId}`)} className="text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all">
                                  Details in {viewing.propertyLocation}
                                </button>
                                {viewing.propertyLocation && (
                                  <button 
                                    onClick={() => navigate(`/property/${viewing.propertyId}?directions=true`)}
                                    className="text-[9px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all flex items-center gap-1"
                                  >
                                    <MapPin className="w-3 h-3" /> Directions to {viewing.propertyLocation}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {viewings.filter(v => new Date(v.date) > new Date()).length === 0 && (
                          <div className="md:col-span-2 py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                            <p className="text-sm text-gray-400">No upcoming viewings scheduled.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'properties' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-3xl font-light tracking-tight">{isLandlord ? 'All My Listings' : 'All Saved Homes'}</h2>
                  </div>
                  
                  <div className="-mx-6">
                    <FilterBar 
                      activeFilters={filters} 
                      onFilterChange={(type, value) => setFilters(prev => ({ ...prev, [type]: value }))} 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {(isLandlord ? filteredProperties : filteredSavedProperties).map((property) => (
                      <PropertyCard 
                        key={property.id} 
                        property={property} 
                        onEdit={isLandlord ? (e) => {
                          e.stopPropagation();
                          navigate(`/add-property?id=${property.id}`);
                        } : undefined}
                      />
                    ))}
                  </div>
                  {(isLandlord ? filteredProperties : filteredSavedProperties).length === 0 && (
                    <div className="py-24 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                      <HomeIcon className="w-12 h-12 text-gray-900/10 mx-auto mb-4" />
                      <h3 className="text-xl font-light mb-2">Nothing here yet</h3>
                      <p className="text-gray-400 mb-8">Start by exploring properties or adding your own.</p>
                      <button 
                        onClick={() => navigate(isLandlord ? '/add-property' : '/')}
                        className="px-8 py-3 bg-purple-600 text-white rounded-full font-bold text-sm"
                      >
                        {isLandlord ? 'Add Property' : 'Explore Homes'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-light tracking-tight">Messages</h2>
                  </div>
                  <MessagesView userId={user.uid} isLandlord={isLandlord} userName={user.name} userPhoto={user.photoUrl} />
                </div>
              )}

              {activeTab === 'viewings' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-light tracking-tight">Scheduled Viewings</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {viewings.length > 0 ? viewings.map((viewing) => (
                      <div key={viewing.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 hover:border-gray-300 transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold uppercase text-gray-400">{new Date(viewing.date).toLocaleString('default', { month: 'short' })}</span>
                            <span className="text-xl font-bold">{new Date(viewing.date).getDate()}</span>
                          </div>
                          
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-gray-900 truncate">
                                {isLandlord ? viewing.renterName : viewing.landlordName}
                              </h4>
                              <span className="text-sm font-bold text-gray-900">
                                {new Date(viewing.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-gray-500 text-sm mb-3 font-medium truncate">{viewing.propertyTitle}</p>
                            
                            <div className="flex items-center gap-4">
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                                viewing.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 
                                viewing.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : 
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {viewing.status}
                              </span>
                              <button onClick={() => navigate(`/property/${viewing.propertyId}`)} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all">
                                View Property in {viewing.propertyLocation}
                              </button>
                              {viewing.propertyLocation && (
                                <button 
                                  onClick={() => navigate(`/property/${viewing.propertyId}?directions=true`)}
                                  className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all flex items-center gap-1"
                                >
                                  <MapPin className="w-3 h-3" /> Directions to {viewing.propertyLocation}
                                </button>
                              )}
                              {viewing.status === 'confirmed' && new Date(viewing.date) < new Date() && (
                                <button
                                  onClick={() => {
                                    setReviewTargetId(isLandlord ? viewing.renterId : viewing.landlordId);
                                    setReviewTargetName(isLandlord ? viewing.renterName : viewing.landlordName);
                                    setReviewTargetType(isLandlord ? 'renter' : 'landlord');
                                    setReviewModalOpen(true);
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-all flex items-center gap-1"
                                >
                                  Review {isLandlord ? 'Renter' : 'Landlord'}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setDisputeTarget({
                                    landlordId: viewing.landlordId,
                                    landlordName: viewing.landlordName || 'Landlord',
                                    tenantId: viewing.renterId,
                                    tenantName: viewing.renterName || 'Tenant',
                                    propertyId: viewing.propertyId,
                                    propertyTitle: viewing.propertyTitle
                                  });
                                  setDisputeModalOpen(true);
                                }}
                                className="text-[10px] font-bold uppercase tracking-widest text-red-600 hover:text-red-800 transition-all flex items-center gap-1"
                              >
                                <ShieldAlert className="w-3 h-3" /> Raise Dispute
                              </button>
                            </div>
                          </div>

                          {isLandlord && viewing.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleUpdateViewingStatus(viewing.id, 'confirmed')}
                                className="bg-purple-600 text-white text-xs py-2 px-4 rounded-full"
                              >
                                Accept
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => handleUpdateViewingStatus(viewing.id, 'cancelled')}
                                className="border-gray-200 text-gray-900 text-xs py-2 px-4 rounded-full"
                              >
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-32 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                        <Calendar className="w-16 h-16 text-gray-900/10 mx-auto mb-6" />
                        <h3 className="text-2xl font-light mb-2">No Viewings Scheduled</h3>
                        <p className="text-gray-400">Your upcoming property tours will appear here.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-light tracking-tight">Payments</h2>
                  </div>
                  <PaymentsView />
                </div>
              )}

              {activeTab === 'applications' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-light tracking-tight">Applications</h2>
                  </div>
                  <ApplicationsView applications={applications} />
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-4xl space-y-8 sm:space-y-12">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-light tracking-tight mb-6 sm:mb-8">Account Settings</h2>
                    <div className="space-y-6 sm:space-y-8 bg-gray-50 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-100">
                      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-3xl sm:text-4xl font-light">
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <div className="text-center sm:text-left">
                          <h3 className="text-xl sm:text-2xl font-light">{user.name || 'User'}</h3>
                          <p className="text-gray-400 text-xs sm:text-sm">{user.email}</p>
                          <span className="inline-block mt-2 px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            {user.role} Account
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">Full Name</label>
                          <input 
                            type="text" 
                            defaultValue={user.name || ''} 
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-purple-600 transition-all"
                            placeholder="Your Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">Email Address</label>
                          <input 
                            type="email" 
                            defaultValue={user.email} 
                            disabled
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">Phone Number</label>
                          <input 
                            type="tel" 
                            placeholder="+1 (555) 000-0000"
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-purple-600 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">Location</label>
                          <input 
                            type="text" 
                            placeholder="City, Country"
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-purple-600 transition-all"
                          />
                        </div>
                      </div>

                      <div className="pt-6 sm:pt-8 border-t border-gray-100 flex justify-end">
                        <Button className="w-full sm:w-auto bg-purple-600 text-white hover:bg-purple-700 px-8 py-3 rounded-full font-bold text-sm">Save Changes</Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    <div className="bg-gray-50 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-100">
                      <h4 className="text-lg font-light mb-6">Security</h4>
                      <div className="space-y-3">
                        <button className="w-full text-left px-4 py-4 rounded-xl border border-gray-100 hover:bg-gray-100 transition-all text-sm">
                          Change Password
                        </button>
                        <button className="w-full text-left px-4 py-4 rounded-xl border border-gray-100 hover:bg-gray-100 transition-all text-sm">
                          Two-Factor Authentication
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-100">
                      <h4 className="text-lg font-light mb-6">Notifications</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Email Notifications</span>
                          <div className="w-12 h-6 bg-purple-600 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Push Notifications</span>
                          <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <Footer />
      <BottomNav />

      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title={`Report ${reportType === 'message' ? 'Message' : 'User'}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Please provide a reason for reporting this {reportType}. Our moderation team will review it.
          </p>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="e.g., Spam, inappropriate content, harassment..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReport} 
              disabled={submittingReport || !reportReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submittingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
            </Button>
          </div>
        </div>
      </Modal>

      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        targetId={reviewTargetId}
        targetName={reviewTargetName}
        targetType={reviewTargetType}
        onSuccess={() => {
          // Optional: show a success toast
        }}
      />

      {disputeTarget && (
        <DisputeModal
          isOpen={disputeModalOpen}
          onClose={() => setDisputeModalOpen(false)}
          landlordId={disputeTarget.landlordId}
          landlordName={disputeTarget.landlordName}
          tenantId={disputeTarget.tenantId}
          tenantName={disputeTarget.tenantName}
          propertyId={disputeTarget.propertyId}
          propertyTitle={disputeTarget.propertyTitle}
          onSuccess={() => {
            alert('Dispute submitted successfully. Our team will review it.');
          }}
        />
      )}
    </div>
  );
}
