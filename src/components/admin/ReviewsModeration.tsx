import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Review } from '../../types';
import { Loader2, Search, AlertTriangle, CheckCircle, XCircle, Star, Edit, Trash2, Ban, Flag } from 'lucide-react';

export function ReviewsModeration() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(reviewsData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'remove' | 'flag' | 'edit', newComment?: string) => {
    try {
      const reviewRef = doc(db, 'reviews', id);
      if (action === 'approve') {
        await updateDoc(reviewRef, { status: 'approved' });
      } else if (action === 'remove') {
        await updateDoc(reviewRef, { status: 'removed' });
      } else if (action === 'flag') {
        await updateDoc(reviewRef, { status: 'flagged' });
      } else if (action === 'edit' && newComment) {
        await updateDoc(reviewRef, { comment: newComment });
      }
      
      await fetchReviews();
      if (selectedReview && selectedReview.id === id) {
        const updated = await getDocs(query(collection(db, 'reviews')));
        const updatedReview = updated.docs.find(d => d.id === id);
        if (updatedReview) {
          setSelectedReview({ id: updatedReview.id, ...updatedReview.data() } as Review);
        }
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error performing action:', error);
      alert('Error updating review status.');
    }
  };

  const handleBulkAction = async (action: 'approve' | 'remove' | 'flag') => {
    if (!window.confirm(`Are you sure you want to ${action} ${selectedReviews.length} reviews?`)) return;
    
    try {
      for (const id of selectedReviews) {
        const reviewRef = doc(db, 'reviews', id);
        if (action === 'approve') await updateDoc(reviewRef, { status: 'approved' });
        if (action === 'remove') await updateDoc(reviewRef, { status: 'removed' });
        if (action === 'flag') await updateDoc(reviewRef, { status: 'flagged' });
      }
      setSelectedReviews([]);
      await fetchReviews();
    } catch (error) {
      console.error('Error performing bulk action:', error);
      alert('Error updating reviews.');
    }
  };

  const toggleSelectAll = () => {
    if (selectedReviews.length === filteredReviews.length) {
      setSelectedReviews([]);
    } else {
      setSelectedReviews(filteredReviews.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedReviews.includes(id)) {
      setSelectedReviews(selectedReviews.filter(rId => rId !== id));
    } else {
      setSelectedReviews([...selectedReviews, id]);
    }
  };

  const filteredReviews = reviews.filter(r => {
    const matchesSearch = r.reviewerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.comment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesType = typeFilter === 'all' || r.targetType === typeFilter;
    const matchesRating = ratingFilter === 'all' || r.rating.toString() === ratingFilter;
    return matchesSearch && matchesStatus && matchesType && matchesRating;
  });

  const stats = {
    pending: reviews.filter(r => r.status === 'pending').length,
    flagged: reviews.filter(r => r.status === 'flagged').length,
    resolvedToday: reviews.filter(r => (r.status === 'approved' || r.status === 'removed') && new Date(r.createdAt).toDateString() === new Date().toDateString()).length,
    avgRating: reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '0',
    oneStar: reviews.length > 0 ? Math.round((reviews.filter(r => r.rating === 1).length / reviews.length) * 100) : 0
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'flagged': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Flagged</span>;
      case 'pending': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
      case 'approved': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Approved</span>;
      case 'removed': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Removed</span>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Pending Reviews</p>
          <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Flagged Reviews</p>
          <p className="text-2xl font-bold text-red-600">{stats.flagged}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Resolved Today</p>
          <p className="text-2xl font-bold text-green-600">{stats.resolvedToday}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Average Rating</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-gray-900">{stats.avgRating}</p>
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
          </div>
          <p className="text-xs text-gray-500 mt-1">{stats.oneStar}% 1-star reviews</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="property">Property</option>
            <option value="landlord">Landlord</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="flagged">Flagged</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="removed">Removed</option>
          </select>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedReviews.length > 0 && (
        <div className="bg-indigo-50 p-3 rounded-lg flex items-center justify-between border border-indigo-100">
          <span className="text-indigo-800 font-medium">{selectedReviews.length} reviews selected</span>
          <div className="flex gap-2">
            <button onClick={() => handleBulkAction('approve')} className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">Approve</button>
            <button onClick={() => handleBulkAction('flag')} className="px-3 py-1.5 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700">Flag</button>
            <button onClick={() => handleBulkAction('remove')} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">Remove</button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Reviews Table */}
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${selectedReview ? 'lg:w-2/3' : 'w-full'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-4 w-12 text-center">
                    <input type="checkbox" checked={selectedReviews.length === filteredReviews.length && filteredReviews.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="p-4 font-medium text-gray-600">Reviewer</th>
                  <th className="p-4 font-medium text-gray-600">Target</th>
                  <th className="p-4 font-medium text-gray-600">Rating</th>
                  <th className="p-4 font-medium text-gray-600">Comment</th>
                  <th className="p-4 font-medium text-gray-600">Status</th>
                  <th className="p-4 font-medium text-gray-600">Date</th>
                  <th className="p-4 font-medium text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-lg font-medium text-gray-900">No reviews found</p>
                      <p>All reviews are clean and approved.</p>
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((review) => (
                    <tr key={review.id} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${selectedReview?.id === review.id ? 'bg-indigo-50/50' : ''}`} onClick={() => { setSelectedReview(review); setIsEditing(false); setEditComment(review.comment); }}>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedReviews.includes(review.id)} onChange={() => toggleSelect(review.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{review.reviewerName}</div>
                        <div className="text-xs text-gray-500 truncate w-24">{review.reviewerId}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{review.targetName}</div>
                        <div className="text-xs text-gray-500 capitalize">{review.targetType}</div>
                      </td>
                      <td className="p-4">{renderStars(review.rating)}</td>
                      <td className="p-4">
                        <div className="text-sm text-gray-600 truncate max-w-xs">"{review.comment}"</div>
                      </td>
                      <td className="p-4">{getStatusBadge(review.status)}</td>
                      <td className="p-4 text-sm text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedReview(review); setIsEditing(false); setEditComment(review.comment); }} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Detail Panel */}
        {selectedReview && (
          <div className="lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-fit sticky top-6">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">Review Details</h3>
              <button onClick={() => setSelectedReview(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
              {/* Core Info */}
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Reviewer</p>
                    <p className="font-medium text-gray-900">{selectedReview.reviewerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">{new Date(selectedReview.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Target ({selectedReview.targetType})</p>
                  <p className="font-medium text-indigo-600 hover:underline cursor-pointer">{selectedReview.targetName}</p>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Rating</p>
                  {renderStars(selectedReview.rating)}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-gray-500">Comment</p>
                    {!isEditing && (
                      <button onClick={() => setIsEditing(true)} className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                        <Edit className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        rows={4}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setIsEditing(false)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button onClick={() => handleAction(selectedReview.id, 'edit', editComment)} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg text-gray-800 text-sm italic">
                      "{selectedReview.comment}"
                    </div>
                  )}
                </div>
              </div>

              {/* Context Section */}
              <div className="border-t border-gray-100 pt-6">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" /> Context
                </h4>
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  <p className="mb-2"><strong>Target History:</strong> This {selectedReview.targetType} has an average rating of 4.2 from 15 reviews.</p>
                  <p><strong>Reviewer History:</strong> This user has left 3 reviews previously, all 5-stars.</p>
                </div>
              </div>

              {/* Report Details (if flagged) */}
              {selectedReview.status === 'flagged' && (
                <div className="border-t border-gray-100 pt-6">
                  <h4 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" /> Report Details
                  </h4>
                  <div className="bg-red-50 p-3 rounded-lg text-sm text-red-800">
                    <p><strong>Reason:</strong> {selectedReview.flagReason || 'Spam / Misleading'}</p>
                    <p className="mt-1"><strong>Reported By:</strong> {selectedReview.flaggedBy || 'System/User'}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-gray-100 pt-6">
                <h4 className="font-medium text-gray-900 mb-3">Actions</h4>
                <div className="space-y-2">
                  <button 
                    onClick={() => handleAction(selectedReview.id, 'approve')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve Review
                  </button>
                  <button 
                    onClick={() => {
                      if(window.confirm('Are you sure you want to remove this review?')) {
                        handleAction(selectedReview.id, 'remove');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Remove Review
                  </button>
                  {selectedReview.status !== 'flagged' && (
                    <button 
                      onClick={() => handleAction(selectedReview.id, 'flag')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 font-medium transition-colors"
                    >
                      <Flag className="w-4 h-4" /> Mark as Flagged
                    </button>
                  )}
                  <div className="pt-2 flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                      <AlertTriangle className="w-4 h-4" /> Warn User
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 text-sm font-medium">
                      <Ban className="w-4 h-4" /> Suspend
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
