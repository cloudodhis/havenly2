import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Property } from '../../types';
import { PendingListingCard } from './PendingListingCard';
import { ListingReviewPanel } from './ListingReviewPanel';
import { Loader2 } from 'lucide-react';

export const ListingApprovals: React.FC = () => {
  const [pendingListings, setPendingListings] = useState<Property[]>([]);
  const [selectedListing, setSelectedListing] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    setLoading(true);
    const q = query(collection(db, 'properties'), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    setPendingListings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property)));
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <h2 className="text-xl font-bold mb-4">Pending Listings ({pendingListings.length})</h2>
        {pendingListings.map(p => <PendingListingCard key={p.id} property={p} onReview={setSelectedListing} />)}
        {pendingListings.length === 0 && <p className="text-gray-500">No pending listings.</p>}
      </div>
      <div className="md:col-span-2">
        {selectedListing ? (
          <ListingReviewPanel property={selectedListing} onAction={() => { setSelectedListing(null); fetchPending(); }} />
        ) : (
          <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
            Select a listing to review
          </div>
        )}
      </div>
    </div>
  );
};
