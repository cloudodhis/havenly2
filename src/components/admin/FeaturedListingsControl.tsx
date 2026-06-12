import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Property } from '../../types';
import { Star, TrendingUp, Search, Filter, MoreVertical, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function FeaturedListingsControl() {
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [isManagePromosModalOpen, setIsManagePromosModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Property | null>(null);
  
  // Promotion settings state
  const [promoType, setPromoType] = useState<'Free' | 'Paid'>('Free');
  const [promoDuration, setPromoDuration] = useState<number>(7);
  const [promoPriority, setPromoPriority] = useState<'Top' | 'High' | 'Normal'>('Top');
  const [promoPlacement, setPromoPlacement] = useState({ homepage: true, search: true });

  const [selectedListings, setSelectedListings] = useState<string[]>([]);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'properties'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setListings(data);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureListing = async () => {
    if (!selectedListing) return;
    
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + promoDuration);
      
      await updateDoc(doc(db, 'properties', selectedListing.id), {
        isFeatured: true,
        promotionType: promoType,
        priority: promoPriority,
        featuredUntil: endDate.toISOString()
      });
      
      setIsFeatureModalOpen(false);
      setSelectedListing(null);
      fetchListings();
      alert('Listing featured successfully');
    } catch (error) {
      console.error('Error featuring listing:', error);
      alert('Failed to feature listing');
    }
  };

  const handleRemoveFeature = async (id: string) => {
    if (!confirm('Are you sure you want to remove this promotion?')) return;
    try {
      await updateDoc(doc(db, 'properties', id), {
        isFeatured: false,
        promotionType: null,
        priority: 'Normal',
        featuredUntil: null
      });
      fetchListings();
    } catch (error) {
      console.error('Error removing feature:', error);
      alert('Failed to remove feature');
    }
  };

  const handleBulkFeature = async () => {
    if (selectedListings.length === 0) return;
    
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + promoDuration);
      
      await Promise.all(selectedListings.map(id => 
        updateDoc(doc(db, 'properties', id), {
          isFeatured: true,
          promotionType: promoType,
          priority: promoPriority,
          featuredUntil: endDate.toISOString()
        })
      ));
      
      setSelectedListings([]);
      setIsFeatureModalOpen(false);
      fetchListings();
      alert(`Successfully featured ${selectedListings.length} listings`);
    } catch (error) {
      console.error('Error bulk featuring:', error);
      alert('Failed to bulk feature listings');
    }
  };

  const filteredListings = listings.filter(l => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedListings.length === filteredListings.length && filteredListings.length > 0) {
      setSelectedListings([]);
    } else {
      setSelectedListings(filteredListings.map(l => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedListings(prev => 
      prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]
    );
  };

  const featuredListings = listings.filter(l => l.isFeatured);
  const activePromotions = featuredListings.filter(l => l.featuredUntil && new Date(l.featuredUntil) > new Date());
  
  // Mock revenue
  const revenue = activePromotions.filter(l => l.promotionType === 'Paid').length * 50;

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Featured Listings</h2>
          <p className="text-gray-500 text-sm">Manage and promote high-priority property listings</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsManagePromosModalOpen(true)}>
            Manage Promotions
          </Button>
          <Button 
            disabled={selectedListings.length === 0}
            onClick={() => {
              if (selectedListings.length > 0) {
                setSelectedListing(null); // Ensure we're in bulk mode
                setIsFeatureModalOpen(true);
              } else {
                alert('Please select listings to feature, or click "Feature" on a specific listing.');
              }
            }}
          >
            + Feature Selected ({selectedListings.length})
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
              <Star className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-gray-500">Featured Listings</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{featuredListings.length}</p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-gray-500">Active Promotions</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activePromotions.length}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <span className="font-bold text-lg">$</span>
            </div>
            <h3 className="text-sm font-medium text-gray-500">Revenue</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">${revenue}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-gray-500">Top Performing</h3>
          </div>
          <p className="text-sm font-bold text-gray-900 truncate">
            {featuredListings[0]?.title || 'N/A'}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Listings Table */}
        <div className="flex-grow bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">Filter</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="p-4 font-medium">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      checked={selectedListings.length === filteredListings.length && filteredListings.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-4 font-medium">Property</th>
                  <th className="p-4 font-medium">Location</th>
                  <th className="p-4 font-medium">Price</th>
                  <th className="p-4 font-medium">Featured</th>
                  <th className="p-4 font-medium">Priority</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredListings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <Star className="w-8 h-8 text-gray-300 mb-2" />
                        <p>No listings found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredListings.map(listing => {
                    const isExpired = listing.featuredUntil && new Date(listing.featuredUntil) < new Date();
                    
                    return (
                      <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            checked={selectedListings.includes(listing.id)}
                            onChange={() => toggleSelect(listing.id)}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img src={listing.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            <span className="font-medium text-gray-900">{listing.title}</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-500">{listing.location}</td>
                        <td className="p-4 text-gray-900">${listing.price}</td>
                        <td className="p-4">
                          {listing.isFeatured ? (
                            isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-50 text-yellow-700 text-xs font-medium border border-yellow-200">
                                <Star className="w-3 h-3 fill-current" />
                                Yes
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">No</span>
                          )}
                        </td>
                        <td className="p-4">
                          {listing.priority ? (
                            <span className={`text-xs font-medium ${
                              listing.priority === 'Top' ? 'text-purple-600' :
                              listing.priority === 'High' ? 'text-indigo-600' : 'text-gray-500'
                            }`}>
                              {listing.priority}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Normal</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {listing.isFeatured && !isExpired ? (
                            <button 
                              onClick={() => handleRemoveFeature(listing.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Remove
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                setSelectedListing(listing);
                                setIsFeatureModalOpen(true);
                              }}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Feature
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analytics Panel (Right Sidebar) */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">Featured Performance</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Total Views</span>
                  <span className="font-medium text-gray-900">12,450</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Total Clicks</span>
                  <span className="font-medium text-gray-900">2,340</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Conversion Rate</span>
                  <span className="font-medium text-gray-900">18%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '18%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Listing Modal */}
      <Modal isOpen={isFeatureModalOpen} onClose={() => {
        setIsFeatureModalOpen(false);
        setSelectedListing(null);
      }} title={selectedListing ? "Feature Listing" : "Bulk Feature Listings"}>
        <div className="space-y-6">
          {selectedListing && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
              <img src={selectedListing.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
              <div>
                <p className="font-medium text-gray-900">{selectedListing.title}</p>
                <p className="text-xs text-gray-500">{selectedListing.location}</p>
              </div>
            </div>
          )}
          
          {!selectedListing && selectedListings.length > 0 && (
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
              Featuring {selectedListings.length} selected listings.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Promotion Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="promoType" 
                    value="Free" 
                    checked={promoType === 'Free'} 
                    onChange={() => setPromoType('Free')}
                    className="text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-gray-900">Free Feature</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="promoType" 
                    value="Paid" 
                    checked={promoType === 'Paid'} 
                    onChange={() => setPromoType('Paid')}
                    className="text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-gray-900">Paid Promotion</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <select 
                value={promoDuration} 
                onChange={(e) => setPromoDuration(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              >
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
              <select 
                value={promoPriority} 
                onChange={(e) => setPromoPriority(e.target.value as any)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              >
                <option value="Top">Top (Homepage + Top Search)</option>
                <option value="High">High (Top Search Results)</option>
                <option value="Normal">Normal (Standard Listing)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Placement</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={promoPlacement.homepage}
                    onChange={(e) => setPromoPlacement({...promoPlacement, homepage: e.target.checked})}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-gray-900">Homepage</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={promoPlacement.search}
                    onChange={(e) => setPromoPlacement({...promoPlacement, search: e.target.checked})}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-gray-900">Search Results</span>
                </label>
              </div>
            </div>
            
            {/* Preview Section */}
            {selectedListing && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 z-10">
                    <Star className="w-3 h-3 fill-current" /> FEATURED
                  </div>
                  <div className="flex gap-4">
                    <img src={selectedListing.imageUrl} alt="" className="w-24 h-24 rounded-lg object-cover" />
                    <div>
                      <h4 className="font-bold text-gray-900">{selectedListing.title}</h4>
                      <p className="text-sm text-gray-500 mb-1">{selectedListing.location}</p>
                      <p className="font-bold text-indigo-600">${selectedListing.price} <span className="text-xs text-gray-500 font-normal">/ month</span></p>
                      <p className="text-xs text-gray-400 mt-2">
                        {promoPriority === 'Top' ? 'Top placement in search' : 'High visibility in search'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => {
              setIsFeatureModalOpen(false);
              setSelectedListing(null);
            }}>
              Cancel
            </Button>
            <Button onClick={selectedListing ? handleFeatureListing : handleBulkFeature}>
              Confirm Promotion
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage Promotions Modal */}
      <Modal 
        isOpen={isManagePromosModalOpen} 
        onClose={() => setIsManagePromosModalOpen(false)} 
        title="Active Promotions"
      >
        <div className="space-y-4">
          {featuredListings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Star className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p>No active promotions found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {featuredListings.map(listing => {
                const isExpired = listing.featuredUntil && new Date(listing.featuredUntil) < new Date();
                return (
                  <div key={listing.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={listing.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      <div>
                        <p className="font-semibold text-gray-900">{listing.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className={`px-1.5 py-0.5 rounded ${listing.promotionType === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {listing.promotionType || 'Free'}
                          </span>
                          <span>•</span>
                          <span>Priority: {listing.priority || 'Normal'}</span>
                          <span>•</span>
                          <span className={isExpired ? 'text-red-500 font-medium' : ''}>
                            {isExpired ? 'Expired' : `Until ${new Date(listing.featuredUntil!).toLocaleDateString()}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedListing(listing);
                          setPromoType(listing.promotionType || 'Free');
                          setPromoPriority(listing.priority || 'Normal');
                          setIsManagePromosModalOpen(false);
                          setIsFeatureModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-600 hover:bg-red-50 border-red-100"
                        onClick={() => handleRemoveFeature(listing.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-200 flex justify-end">
            <Button onClick={() => setIsManagePromosModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
