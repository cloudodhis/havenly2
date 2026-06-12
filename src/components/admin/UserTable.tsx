import React from 'react';
import { User, CheckCircle, Ban, AlertTriangle, Key, Eye, Edit } from 'lucide-react';
import { AppUser } from '../../lib/AuthContext';

interface UserTableProps {
  users: AppUser[];
  onAction: (uid: string, action: 'verify' | 'suspend' | 'ban' | 'resetPassword', email?: string) => void;
  onViewProfile: (user: AppUser) => void;
}

export const UserTable: React.FC<UserTableProps> = ({ users, onAction, onViewProfile }) => {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((u) => (
            <tr key={u.uid}>
              <td className="px-6 py-4 whitespace-nowrap flex items-center gap-2">
                {u.photoUrl ? <img src={u.photoUrl} alt={u.name} className="w-8 h-8 rounded-full" /> : <User className="w-8 h-8 text-gray-400" />}
                {u.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.phone || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{u.role}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.status === 'banned' ? 'bg-red-100 text-red-800' : u.status === 'suspended' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                  {u.status || 'active'}
                </span>
                {u.isVerified && <CheckCircle className="w-4 h-4 text-green-500 inline ml-1" />}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2">
                <button onClick={() => onViewProfile(u)} className="text-gray-600"><Eye className="w-5 h-5" /></button>
                {u.role === 'landlord' && !u.isVerified && <button onClick={() => onAction(u.uid, 'verify')} className="text-green-600"><CheckCircle className="w-5 h-5" /></button>}
                {u.status !== 'suspended' && <button onClick={() => onAction(u.uid, 'suspend')} className="text-yellow-600"><AlertTriangle className="w-5 h-5" /></button>}
                {u.status !== 'banned' && <button onClick={() => onAction(u.uid, 'ban')} className="text-red-600"><Ban className="w-5 h-5" /></button>}
                <button onClick={() => onAction(u.uid, 'resetPassword', u.email)} className="text-indigo-600"><Key className="w-5 h-5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
