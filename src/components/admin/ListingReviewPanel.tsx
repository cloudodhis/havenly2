import React, { useState } from 'react';
import { Property } from '../../types';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { AlertTriangle, Check, X, Edit2, MessageSquare } from 'lucide-react';

interface ListingReviewPanelProps {
  property: Property;
  onAction: () => void;
}

export const ListingReviewPanel: React.FC<ListingReviewPanelProps> = ({ property, onAction }) => {
  console.log('ListingReviewPanel property:', property);
  const [notes, setNotes] = useState(property.moderationNotes || '');

  const handleAction = async (status: 'active' | 'removed' | 'reported' | 'changes_requested') => {
    try {
      await updateDoc(doc(db, 'properties', property.id), { status, moderationNotes: notes });
      
      // Send message to landlord
      await addDoc(collection(db, 'inquiries'), {
        propertyId: property.id,
        renterId: 'admin', // Or a special admin ID
        landlordId: property.landlordId,
        message: `Your property "${property.title}" status has been updated to: ${status}. Notes: ${notes}`,
        status: 'closed',
        createdAt: new Date().toISOString()
      });

      onAction();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + (error as Error).message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      {property.fraudIndicators && property.fraudIndicators.length > 0 && (
        <div className="bg-red-50 p-4 rounded-lg mb-6 flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-6 h-6" />
          <div>
            <h4 className="font-bold">Fraud Indicators Detected</h4>
            <ul className="list-disc list-inside text-sm">
              {property.fraudIndicators.map((indicator, i) => <li key={i}>{indicator}</li>)}
            </ul>
          </div>
        </div>
      )}

      <img src={property.imageUrl} alt={property.title} className="w-full h-64 object-cover rounded-lg mb-6" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{property.title}</h2>
      <p className="text-gray-600 mb-4">{property.location}</p>
      <p className="text-3xl font-bold text-indigo-600 mb-6">${property.price} / month</p>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg text-center"><p className="text-xs text-gray-500">Beds</p><p className="font-bold">{property.beds}</p></div>
        <div className="bg-gray-50 p-3 rounded-lg text-center"><p className="text-xs text-gray-500">Baths</p><p className="font-bold">{property.baths}</p></div>
        <div className="bg-gray-50 p-3 rounded-lg text-center"><p className="text-xs text-gray-500">Sqft</p><p className="font-bold">{property.sqft}</p></div>
      </div>

      <h3 className="font-bold mb-2">Description</h3>
      <p className="text-gray-600 mb-6">{property.title} - {property.type}</p>

      <h3 className="font-bold mb-2">Admin Notes</h3>
      <textarea 
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg mb-6"
        rows={3}
        placeholder="Add internal notes..."
      />

      <div className="flex gap-4">
        <button onClick={() => handleAction('active')} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Check className="w-5 h-5" /> Approve</button>
        <button onClick={() => handleAction('changes_requested')} className="flex-1 bg-yellow-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> Request Changes</button>
        <button onClick={() => handleAction('removed')} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><X className="w-5 h-5" /> Reject</button>
      </div>
    </div>
  );
};
