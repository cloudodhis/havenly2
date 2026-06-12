import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Search, Filter, AlertCircle, CheckCircle, Clock, FileText, MessageSquare, ShieldAlert, X, ChevronRight, User, Home, Calendar, Loader2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConversationViewerModal } from './ConversationViewerModal';

export interface Dispute {
  id: string;
  type: 'Payment Issue' | 'Listing Complaint' | 'User Misconduct' | 'Booking Issue';
  status: 'Open' | 'Under Review' | 'Resolved' | 'Escalated';
  priority: 'Low' | 'Medium' | 'High';
  tenantId: string;
  landlordId: string;
  tenantName: string;
  landlordName: string;
  propertyId?: string;
  propertyTitle?: string;
  description: string;
  evidence?: string[];
  conversationId?: string;
  resolutionDecision?: string;
  resolutionReason?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export function DisputesResolution() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionDecision, setResolutionDecision] = useState('');
  const [resolutionReason, setResolutionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isConversationViewerOpen, setIsConversationViewerOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'disputes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const disputesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispute));
      setDisputes(disputesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;

    setIsResolving(true);
    try {
      const disputeRef = doc(db, 'disputes', selectedDispute.id);
      await updateDoc(disputeRef, {
        status: 'Resolved',
        resolutionDecision,
        resolutionReason,
        adminNotes,
        updatedAt: new Date().toISOString()
      });
      
      setSelectedDispute(null);
      setResolutionDecision('');
      setResolutionReason('');
      setAdminNotes('');
    } catch (error) {
      console.error('Error resolving dispute:', error);
      alert('Failed to resolve dispute.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleUpdateStatus = async (status: Dispute['status']) => {
    if (!selectedDispute) return;
    try {
      const disputeRef = doc(db, 'disputes', selectedDispute.id);
      await updateDoc(disputeRef, {
        status,
        updatedAt: new Date().toISOString()
      });
      setSelectedDispute({ ...selectedDispute, status });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status.');
    }
  };

  const filteredDisputes = disputes.filter(d => {
    const matchesSearch = d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.landlordName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (d.propertyTitle && d.propertyTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesType = typeFilter === 'all' || d.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Under Review': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Resolved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Escalated': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Left Panel: Disputes List */}
      <div className={`w-full ${selectedDispute ? 'hidden md:flex md:w-1/3' : 'flex'} flex-col border-r border-gray-200`}>
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Support & Disputes</h2>
          
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search cases, users, properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Under Review">Under Review</option>
                <option value="Escalated">Escalated</option>
                <option value="Resolved">Resolved</option>
              </select>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="Payment Issue">Payment Issue</option>
                <option value="Listing Complaint">Listing Complaint</option>
                <option value="User Misconduct">User Misconduct</option>
                <option value="Booking Issue">Booking Issue</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading disputes...</div>
          ) : filteredDisputes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No disputes found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDisputes.map(dispute => (
                <button
                  key={dispute.id}
                  onClick={() => {
                    setSelectedDispute(dispute);
                    setResolutionDecision(dispute.resolutionDecision || '');
                    setResolutionReason(dispute.resolutionReason || '');
                    setAdminNotes(dispute.adminNotes || '');
                  }}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedDispute?.id === dispute.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-gray-500">#{dispute.id.slice(0, 8)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(dispute.priority)}`}>
                      {dispute.priority}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">{dispute.type}</h3>
                  <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                    {dispute.tenantName} vs {dispute.landlordName}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(dispute.status)}`}>
                      {dispute.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(dispute.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Case Details */}
      {selectedDispute ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
          {/* Header */}
          <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedDispute(null)}
                className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">Case #{selectedDispute.id.slice(0, 8)}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(selectedDispute.status)}`}>
                    {selectedDispute.status}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(selectedDispute.priority)}`}>
                    {selectedDispute.priority} Priority
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Opened on {new Date(selectedDispute.createdAt).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {selectedDispute.status === 'Open' && (
                <button 
                  onClick={() => handleUpdateStatus('Under Review')}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                >
                  Start Review
                </button>
              )}
              {selectedDispute.status !== 'Escalated' && selectedDispute.status !== 'Resolved' && (
                <button 
                  onClick={() => handleUpdateStatus('Escalated')}
                  className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-200 transition-colors"
                >
                  Escalate
                </button>
              )}
            </div>
          </div>

          {/* Content Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Involved Parties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
                  <User className="w-4 h-4" /> Tenant (Reporter)
                </div>
                <p className="font-medium text-gray-900">{selectedDispute.tenantName}</p>
                <p className="text-sm text-gray-500 font-mono mt-1">{selectedDispute.tenantId}</p>
                <button className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-700">View Profile & History</button>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
                  <User className="w-4 h-4" /> Landlord (Reported)
                </div>
                <p className="font-medium text-gray-900">{selectedDispute.landlordName}</p>
                <p className="text-sm text-gray-500 font-mono mt-1">{selectedDispute.landlordId}</p>
                <button className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-700">View Profile & History</button>
              </div>
            </div>

            {/* Context */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" /> Case Details
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Dispute Type</h4>
                  <p className="text-gray-900">{selectedDispute.type}</p>
                </div>
                
                {selectedDispute.propertyTitle && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Related Property</h4>
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-gray-400" />
                      <p className="text-gray-900">{selectedDispute.propertyTitle}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Description of Issue</h4>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-700 whitespace-pre-wrap">
                    {selectedDispute.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence & Conversation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-400" /> Evidence
                </h3>
                {selectedDispute.evidence && selectedDispute.evidence.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedDispute.evidence.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity">
                        <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No evidence provided.</p>
                )}
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gray-400" /> Conversation History
                </h3>
                {selectedDispute.conversationId ? (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-gray-50 rounded-lg border border-gray-100">
                    <MessageSquare className="w-8 h-8 text-indigo-300 mb-3" />
                    <p className="text-gray-600 text-sm mb-4">Review the chat history between these users to verify claims.</p>
                    <button 
                      onClick={() => setIsConversationViewerOpen(true)}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Open Conversation Viewer
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No linked conversation.</p>
                )}
              </div>
            </div>

            {/* Resolution Section */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" /> Resolution & Actions
              </h3>
              
              {selectedDispute.status === 'Resolved' ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-semibold text-emerald-900">Case Resolved</h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-emerald-800">Decision:</span>
                      <p className="text-emerald-900 mt-1">{selectedDispute.resolutionDecision}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-emerald-800">Reasoning:</span>
                      <p className="text-emerald-900 mt-1">{selectedDispute.resolutionReason}</p>
                    </div>
                    {selectedDispute.adminNotes && (
                      <div className="pt-3 mt-3 border-t border-emerald-200/50">
                        <span className="text-sm font-medium text-emerald-800">Internal Notes:</span>
                        <p className="text-emerald-900 mt-1 text-sm">{selectedDispute.adminNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResolve} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Decision</label>
                    <select
                      required
                      value={resolutionDecision}
                      onChange={(e) => setResolutionDecision(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select a decision...</option>
                      <option value="Refund Tenant">Refund Tenant</option>
                      <option value="Release Funds to Landlord">Release Funds to Landlord</option>
                      <option value="Warn Tenant">Warn Tenant</option>
                      <option value="Warn Landlord">Warn Landlord</option>
                      <option value="Suspend Tenant">Suspend Tenant</option>
                      <option value="Suspend Landlord">Suspend Landlord</option>
                      <option value="Remove Listing">Remove Listing</option>
                      <option value="Dismiss Case (No Action)">Dismiss Case (No Action)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reasoning (Visible to users)</label>
                    <textarea
                      required
                      rows={3}
                      value={resolutionReason}
                      onChange={(e) => setResolutionReason(e.target.value)}
                      placeholder="Explain the decision clearly and professionally..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Admin Notes (Private)</label>
                    <textarea
                      rows={2}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Any internal context for other admins..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
                    />
                  </div>
                  
                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('Under Review')}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                    >
                      Save Draft
                    </button>
                    <button
                      type="submit"
                      disabled={isResolving || !resolutionDecision || !resolutionReason}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Resolve Case
                    </button>
                  </div>
                </form>
              )}
            </div>
            
          </div>

          {selectedDispute.conversationId && (
            <ConversationViewerModal
              isOpen={isConversationViewerOpen}
              onClose={() => setIsConversationViewerOpen(false)}
              conversationId={selectedDispute.conversationId}
            />
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 p-8 text-center border-l border-gray-200">
          <div className="max-w-sm">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-indigo-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Select a Case</h3>
            <p className="text-gray-500">
              Choose a dispute from the list to review evidence, read messages, and take moderation action.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
