import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Search, DollarSign, AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, Filter, X, ChevronRight, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface Payment {
  id: string;
  transactionId: string;
  renterId: string;
  landlordId: string;
  propertyId: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed' | 'Refunded' | 'Held';
  type: 'Rent' | 'Security Deposit' | 'Booking Fee';
  method: string;
  createdAt: string;
  refundReason?: string;
  fraudAlerts?: string[];
  timeline: { status: string; timestamp: string }[];
  // Joined data
  renterName?: string;
  landlordName?: string;
  propertyTitle?: string;
}

// Mock data removed for real data fetching

export function PaymentsMonitoring() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(paymentsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching payments:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.renterName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.landlordName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.propertyTitle?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesType = typeFilter === 'all' || payment.type.toLowerCase() === typeFilter.toLowerCase();
    
    let matchesDate = true;
    const paymentDate = new Date(payment.createdAt);
    const now = new Date();
    if (dateFilter === '24h') {
      matchesDate = (now.getTime() - paymentDate.getTime()) <= 24 * 60 * 60 * 1000;
    } else if (dateFilter === '7d') {
      matchesDate = (now.getTime() - paymentDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    } else if (dateFilter === '30d') {
      matchesDate = (now.getTime() - paymentDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'Refunded': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Held': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="w-4 h-4" />;
      case 'Pending': return <Clock className="w-4 h-4" />;
      case 'Failed': return <XCircle className="w-4 h-4" />;
      case 'Refunded': return <RefreshCw className="w-4 h-4" />;
      case 'Held': return <ShieldAlert className="w-4 h-4" />;
      default: return null;
    }
  };

  const handleRefundAction = (action: 'approve' | 'reject' | 'escalate') => {
    if (!selectedPayment) return;
    
    // In a real app, update Firestore
    const updatedPayments = payments.map(p => {
      if (p.id === selectedPayment.id) {
        if (action === 'approve') return { ...p, status: 'Refunded' as const };
        // Handle other actions...
        return p;
      }
      return p;
    });
    
    setPayments(updatedPayments);
    setSelectedPayment(null);
    alert(`Refund ${action}d successfully.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Calculate metrics
  const totalToday = payments
    .filter(p => (new Date().getTime() - new Date(p.createdAt).getTime()) <= 24 * 60 * 60 * 1000)
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0);
  const completedAmount = payments.filter(p => p.status === 'Completed').reduce((sum, p) => sum + p.amount, 0);
  const refundRequests = payments.filter(p => p.refundReason && p.status !== 'Refunded').length;

  return (
    <div className="space-y-6">
      {/* 3. Payment Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Transactions Today</p>
          <p className="text-2xl font-bold text-gray-900">${totalToday.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Pending Payments</p>
          <p className="text-2xl font-bold text-yellow-600">${pendingAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Completed Payments</p>
          <p className="text-2xl font-bold text-green-600">${completedAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Refund Requests</p>
          <p className="text-2xl font-bold text-blue-600">{refundRequests}</p>
        </div>
      </div>

      {/* 4. Transaction Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">Transaction Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="held">Held</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">Payment Type</option>
            <option value="rent">Rent</option>
            <option value="security deposit">Security Deposit</option>
            <option value="booking fee">Booking Fee</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">Date Range</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* 5. Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                <th className="p-4 font-medium">Transaction ID</th>
                <th className="p-4 font-medium">Tenant</th>
                <th className="p-4 font-medium">Landlord</th>
                <th className="p-4 font-medium">Property</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPayments.map((payment) => (
                <tr 
                  key={payment.id} 
                  onClick={() => setSelectedPayment(payment)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="p-4 font-mono text-sm text-gray-900">{payment.transactionId}</td>
                  <td className="p-4 text-sm text-gray-900">{payment.renterName}</td>
                  <td className="p-4 text-sm text-gray-900">{payment.landlordName}</td>
                  <td className="p-4 text-sm text-gray-500 max-w-[200px] truncate">{payment.propertyTitle}</td>
                  <td className="p-4 text-sm font-medium text-gray-900">${payment.amount}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
                      {getStatusIcon(payment.status)}
                      {payment.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Payment Detail Panel (Modal) */}
      <Modal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title="Transaction Details"
      >
        {selectedPayment && (
          <div className="space-y-6">
            {/* 11. Fraud Detection Indicators */}
            {selectedPayment.fraudAlerts && selectedPayment.fraudAlerts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-red-900">Suspicious Activity Detected</h4>
                  <ul className="mt-1 space-y-1">
                    {selectedPayment.fraudAlerts.map((alert, idx) => (
                      <li key={idx} className="text-sm text-red-700">• {alert}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                <p className="font-mono text-gray-900">{selectedPayment.transactionId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Transaction Date</p>
                <p className="text-gray-900">
                  {new Date(selectedPayment.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Tenant</p>
                <p className="text-gray-900 font-medium">{selectedPayment.renterName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Landlord</p>
                <p className="text-gray-900 font-medium">{selectedPayment.landlordName}</p>
              </div>

              <div className="col-span-2">
                <p className="text-sm text-gray-500 mb-1">Property</p>
                <p className="text-gray-900">{selectedPayment.propertyTitle}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Type</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900">{selectedPayment.type}</span>
                  {/* 8. Deposit Tracking Tag */}
                  {selectedPayment.type === 'Security Deposit' && (
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Status: {selectedPayment.status}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Method</p>
                <p className="text-gray-900">{selectedPayment.method}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Amount</p>
                <p className="text-2xl font-bold text-gray-900">${selectedPayment.amount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedPayment.status)}`}>
                  {getStatusIcon(selectedPayment.status)}
                  {selectedPayment.status}
                </span>
              </div>
            </div>

            {/* 10. Payment Timeline */}
            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-sm font-bold text-gray-900 mb-4">Payment Timeline</h4>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                {selectedPayment.timeline.map((event, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-indigo-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-gray-100 bg-gray-50 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm text-gray-900">{event.status}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 9. Refund Management */}
            {selectedPayment.refundReason && selectedPayment.status !== 'Refunded' && (
              <div className="border-t border-gray-100 pt-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refund Request
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Requested by</p>
                      <p className="text-sm font-medium text-blue-900">Tenant</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Amount</p>
                      <p className="text-sm font-medium text-blue-900">${selectedPayment.amount}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-blue-700 mb-1">Reason</p>
                      <p className="text-sm text-blue-900 bg-white/50 p-2 rounded border border-blue-100">{selectedPayment.refundReason}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handleRefundAction('approve')} className="bg-blue-600 hover:bg-blue-700 text-white">
                      Approve Refund
                    </Button>
                    <Button onClick={() => handleRefundAction('reject')} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100">
                      Reject Refund
                    </Button>
                    <Button onClick={() => handleRefundAction('escalate')} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 ml-auto">
                      Escalate Dispute
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
