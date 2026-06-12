import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { Report } from '../../types';
import { Search, Filter, AlertTriangle, CheckCircle, Clock, XCircle, ShieldAlert, Image as ImageIcon, MessageSquare, User, Home, MoreVertical, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';

export function ReportsModeration() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [selectedEvidenceImage, setSelectedEvidenceImage] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'reports'));
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      
      // Sort by priority (high first) and then by date
      reportsData.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
          return priorityWeight[b.priority] - priorityWeight[a.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setReports(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId: string, newStatus: Report['status']) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: newStatus });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
      if (selectedReportId === reportId) {
        setSelectedReportId(null);
      }
    } catch (error) {
      console.error('Error updating report status:', error);
    }
  };

  const handleBulkAction = async (action: 'resolve' | 'dismiss') => {
    if (selectedReports.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';
      
      selectedReports.forEach(id => {
        const reportRef = doc(db, 'reports', id);
        batch.update(reportRef, { status: newStatus });
      });
      
      await batch.commit();
      
      setReports(reports.map(r => selectedReports.includes(r.id) ? { ...r, status: newStatus } : r));
      setSelectedReports([]);
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  const handleSaveNotes = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { notes: moderatorNotes });
      setReports(reports.map(r => r.id === reportId ? { ...r, notes: moderatorNotes } : r));
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleAction = async (report: Report, action: 'remove_listing' | 'warn_user' | 'suspend_account') => {
    try {
      if (action === 'remove_listing' && report.type === 'listing') {
        await updateDoc(doc(db, 'properties', report.reportedItemId), { status: 'removed' });
      } else if (action === 'warn_user' || action === 'suspend_account') {
        // For listings, we need the landlord's ID. We can get it from the report if we saved it, or fetch the property.
        // Assuming we saved landlordId in the report when it was created, or we can fetch it.
        // Let's assume we add landlordId to the report when reporting a listing.
        let userId = report.reportedItemId; // Default if it's a user report
        if (report.type === 'listing') {
          // If we didn't save landlordId in the report, we'd need to fetch the property here.
          // For now, let's assume we'll add landlordId to the report object.
          // If it's not there, we might need to fetch the property document.
          if ((report as any).landlordId) {
             userId = (report as any).landlordId;
          } else {
             // Fallback: fetch property to get landlordId
             const { getDoc } = await import('firebase/firestore');
             const propDoc = await getDoc(doc(db, 'properties', report.reportedItemId));
             if (propDoc.exists()) {
               userId = propDoc.data().landlordId;
             }
          }
        }
        
        if (action === 'suspend_account' && userId) {
          await updateDoc(doc(db, 'users', userId), { status: 'suspended' });
        }
      }
      
      await handleStatusChange(report.id, 'resolved');
    } catch (error) {
      console.error('Error performing action:', error);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.reportedItemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          report.reportedByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          report.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || report.priority === priorityFilter;
    
    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const resolvedTodayCount = reports.filter(r => r.status === 'resolved' && new Date(r.createdAt).toDateString() === new Date().toDateString()).length;
  const highPriorityCount = reports.filter(r => r.priority === 'high' && r.status !== 'resolved' && r.status !== 'dismissed').length;

  const selectedReport = reports.find(r => r.id === selectedReportId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'review': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'dismissed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'listing': return <Home className="w-4 h-4" />;
      case 'landlord': return <User className="w-4 h-4" />;
      case 'renter': return <User className="w-4 h-4" />;
      case 'message': return <MessageSquare className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Moderation</h1>
        <p className="text-gray-500 mt-1">Review and resolve user reports across the platform</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Reports</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingCount}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Resolved Today</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{resolvedTodayCount}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">High Priority</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{highPriorityCount}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Report Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Types</option>
            <option value="listing">Reported Listings</option>
            <option value="landlord">Reported Landlords</option>
            <option value="renter">Reported Renters</option>
            <option value="message">Reported Messages</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedReports.length > 0 && (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">{selectedReports.length}</span>
            <span className="text-indigo-900 font-medium">reports selected</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('resolve')}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Resolve Selected
            </button>
            <button
              onClick={() => handleBulkAction('dismiss')}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Dismiss Selected
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Reports Table */}
        <div className={cn("bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all duration-300", selectedReportId ? "w-2/3" : "w-full")}>
          {filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No reports to review</h3>
              <p className="text-gray-500">Your platform is running smoothly.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedReports.length === filteredReports.length && filteredReports.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReports(filteredReports.map(r => r.id));
                          } else {
                            setSelectedReports([]);
                          }
                        }}
                      />
                    </th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Report ID</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reported Item</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reported By</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReports.map((report) => (
                    <tr 
                      key={report.id} 
                      className={cn(
                        "hover:bg-gray-50 cursor-pointer transition-colors",
                        selectedReportId === report.id ? "bg-indigo-50/50" : ""
                      )}
                      onClick={() => {
                        setSelectedReportId(report.id);
                        setModeratorNotes(report.notes || '');
                        if (report.status === 'pending') {
                          handleStatusChange(report.id, 'review');
                        }
                      }}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedReports.includes(report.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReports([...selectedReports, report.id]);
                            } else {
                              setSelectedReports(selectedReports.filter(id => id !== report.id));
                            }
                          }}
                        />
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-900">#{report.id.slice(0, 6).toUpperCase()}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          {getTypeIcon(report.type)}
                          <span className="text-sm capitalize">{report.type}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-900 font-medium">{report.reportedItemName}</td>
                      <td className="p-4 text-sm text-gray-500">{report.reportedByName}</td>
                      <td className="p-4 text-sm text-gray-500 max-w-[200px] truncate" title={report.reason}>{report.reason}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColor(report.status))}>
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </span>
                          {report.priority === 'high' && (
                            <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", getPriorityColor(report.priority))}>
                              High
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Report Detail Panel */}
        {selectedReport && (
          <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-in slide-in-from-right-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="font-bold text-gray-900">Report Details</h2>
              <button 
                onClick={() => setSelectedReportId(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-gray-500">Report ID</p>
                  <p className="font-mono font-medium text-gray-900">#{selectedReport.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Date Submitted</p>
                  <p className="font-medium text-gray-900">{new Date(selectedReport.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Reported By</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {selectedReport.reportedByName.charAt(0)}
                  </div>
                  <span className="font-medium text-gray-900">{selectedReport.reportedByName}</span>
                </div>
              </div>

              <div className="mb-8 bg-red-50 border border-red-100 p-4 rounded-xl">
                <p className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Reason for Report
                </p>
                <p className="text-gray-800 text-sm leading-relaxed">"{selectedReport.reason}"</p>
              </div>

              <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Reported Item</h3>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {getTypeIcon(selectedReport.type)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{selectedReport.reportedItemName}</p>
                      <p className="text-xs text-gray-500 capitalize">{selectedReport.type}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (selectedReport.type === 'listing') {
                        window.open(`/property/${selectedReport.reportedItemId}`, '_blank');
                      } else {
                        alert(`User details for ${selectedReport.reportedItemName} (${selectedReport.reportedItemId})`);
                      }
                    }}
                    className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    View {selectedReport.type} details &rarr;
                  </button>
                </div>
              </div>

              {selectedReport.evidence && selectedReport.evidence.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Evidence</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReport.evidence.map((url, i) => (
                      <div 
                        key={i} 
                        className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative group cursor-pointer"
                        onClick={() => setSelectedEvidenceImage(url)}
                      >
                        <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Moderator Notes</h3>
                <textarea
                  value={moderatorNotes}
                  onChange={(e) => setModeratorNotes(e.target.value)}
                  placeholder="Add internal notes about this report..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[100px] resize-y"
                />
                <div className="flex justify-end mt-2">
                  <button 
                    onClick={() => handleSaveNotes(selectedReport.id)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    Save Notes
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Actions</h3>
                <div className="flex flex-col gap-2">
                  {selectedReport.type === 'listing' && (
                    <button 
                      onClick={() => handleAction(selectedReport, 'remove_listing')}
                      className="w-full py-2.5 px-4 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors text-left flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Remove Listing
                    </button>
                  )}
                  <button 
                    onClick={() => handleAction(selectedReport, 'warn_user')}
                    className="w-full py-2.5 px-4 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 text-sm font-medium transition-colors text-left flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Warn User
                  </button>
                  <button 
                    onClick={() => handleAction(selectedReport, 'suspend_account')}
                    className="w-full py-2.5 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors text-left flex items-center gap-2"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Suspend Account
                  </button>
                  <div className="h-px bg-gray-100 my-2"></div>
                  <button 
                    onClick={() => handleStatusChange(selectedReport.id, 'dismissed')}
                    className="w-full py-2.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors text-left"
                  >
                    Dismiss Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedEvidenceImage}
        onClose={() => setSelectedEvidenceImage(null)}
        title="Evidence Image"
      >
        <div className="flex justify-center items-center">
          {selectedEvidenceImage && (
            <img 
              src={selectedEvidenceImage} 
              alt="Evidence" 
              className="max-w-full max-h-[80vh] object-contain rounded-lg" 
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
