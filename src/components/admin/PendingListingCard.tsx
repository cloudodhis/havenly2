import React from 'react';
import { Property } from '../../types';

interface PendingListingCardProps {
  property: Property;
  onReview: (property: Property) => void;
}

export const PendingListingCard: React.FC<PendingListingCardProps> = ({ property, onReview }) => {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
      <img src={property.imageUrl} alt={property.title} className="w-full h-32 object-cover rounded-lg mb-3" />
      <h3 className="font-bold text-gray-900">{property.title}</h3>
      <p className="text-sm text-gray-500">{property.location}</p>
      <p className="text-lg font-semibold text-indigo-600">${property.price} / month</p>
      <p className="text-xs text-gray-400 mt-2">Submitted: {new Date(property.createdAt).toLocaleDateString()}</p>
      <button 
        onClick={() => onReview(property)}
        className="w-full mt-3 bg-indigo-50 text-indigo-600 py-2 rounded-lg font-medium hover:bg-indigo-100"
      >
        Review
      </button>
    </div>
  );
};
