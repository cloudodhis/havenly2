import React from 'react';
import { Eye, Edit, Check, X, Trash2, Flag, Star } from 'lucide-react';
import { Property } from '../../types';

interface ListingTableProps {
  listings: Property[];
  onAction: (id: string, action: 'approve' | 'reject' | 'remove' | 'flag' | 'feature') => void;
}

export function ListingTable({ listings, onAction }: ListingTableProps) {
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      reported: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
      removed: 'bg-red-900 text-white',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Photo</th>
            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Title</th>
            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Location</th>
            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Price</th>
            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {listings.map((listing) => (
            <tr key={listing.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <img src={listing.imageUrl} alt={listing.title} className="w-16 h-16 rounded-lg object-cover" />
              </td>
              <td className="px-6 py-4 font-medium text-gray-900">{listing.title}</td>
              <td className="px-6 py-4 text-gray-600">{listing.location}</td>
              <td className="px-6 py-4 text-gray-900">${listing.price}</td>
              <td className="px-6 py-4">{getStatusBadge(listing.status)}</td>
              <td className="px-6 py-4 flex gap-2">
                <button onClick={() => alert('View details')} className="p-1 text-gray-400 hover:text-indigo-600"><Eye className="w-4 h-4" /></button>
                <button onClick={() => alert('Edit')} className="p-1 text-gray-400 hover:text-indigo-600"><Edit className="w-4 h-4" /></button>
                {listing.status === 'pending' && <button onClick={() => onAction(listing.id, 'approve')} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>}
                {listing.status === 'pending' && <button onClick={() => onAction(listing.id, 'reject')} className="p-1 text-red-600 hover:text-red-700"><X className="w-4 h-4" /></button>}
                <button onClick={() => onAction(listing.id, 'flag')} className="p-1 text-orange-600 hover:text-orange-700"><Flag className="w-4 h-4" /></button>
                <button onClick={() => onAction(listing.id, 'feature')} className={`p-1 ${listing.isFeatured ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-600`}><Star className="w-4 h-4" /></button>
                <button onClick={() => onAction(listing.id, 'remove')} className="p-1 text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
