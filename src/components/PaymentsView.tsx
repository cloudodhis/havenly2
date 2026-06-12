import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { CheckCircle, Clock, XCircle, RefreshCw, ShieldAlert, CreditCard, Wallet, Smartphone, Download, ArrowRight, Landmark, AlertTriangle } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { DisputeModal } from './DisputeModal';

interface Payment {
  id: string;
  transactionId: string;
  bookingId: string;
  tenantId: string;
  landlordId: string;
  propertyId: string;
  amount: number;
  serviceFee: number;
  status: 'Completed' | 'Pending' | 'Failed' | 'Refunded' | 'Held';
  type: 'Rent' | 'Security Deposit' | 'Booking Fee';
  method: string;
  createdAt: string;
  // Joined
  propertyTitle?: string;
  tenantName?: string;
  landlordName?: string;
}

interface Booking {
  id: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
  status: string;
  nextPaymentDue: string;
  propertyTitle?: string;
  landlordName?: string;
}

export function PaymentsView() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [paymentSuccess, setPaymentSuccess] = useState<Payment | null>(null);

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState<{
    landlordId: string;
    landlordName: string;
    tenantId: string;
    tenantName: string;
    propertyId?: string;
    propertyTitle?: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    let unsubscribePayments: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;

    try {
      // Fetch payments
      const paymentsQuery = query(
        collection(db, 'payments'),
        where(user.role === 'landlord' ? 'landlordId' : 'tenantId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
        const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setPayments(paymentsData);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'payments');
        setLoading(false);
      });

      // Fetch bookings for tenant to show upcoming payments
      if (user.role === 'renter') {
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('tenantId', '==', user.uid),
          where('status', '==', 'active')
        );
        
        unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
          const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
          setBookings(bookingsData);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        });
      }
    } catch (error) {
      console.error('Error setting up payment listeners:', error);
      setLoading(false);
    }

    return () => {
      if (unsubscribePayments) unsubscribePayments();
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, [user]);

  const handlePayNow = (booking: Booking) => {
    setSelectedBooking(booking);
    setPaymentModalOpen(true);
    setPaymentSuccess(null);
  };

  const handlePaymentSuccess = async (transactionId: string, method: string) => {
    if (!selectedBooking || !user) return;
    
    setLoading(true);
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      
      const isOverdue = new Date(selectedBooking.nextPaymentDue) < new Date();
      const lateFee = isOverdue ? 25 : 0;
      const totalAmount = selectedBooking.rentAmount + lateFee;
      
      const paymentData = {
        transactionId,
        bookingId: selectedBooking.id,
        tenantId: user.uid,
        landlordId: selectedBooking.landlordId,
        propertyId: selectedBooking.propertyId,
        amount: totalAmount,
        serviceFee: totalAmount * 0.03, // 3% fee
        status: 'Completed' as const,
        type: 'Rent' as const,
        method,
        createdAt: new Date().toISOString(),
        propertyTitle: selectedBooking.propertyTitle,
        landlordName: selectedBooking.landlordName,
        tenantName: user.name || user.email
      };

      const docRef = await addDoc(collection(db, 'payments'), paymentData);
      
      const newPayment: Payment = {
        id: docRef.id,
        ...paymentData
      };

      // Create notification for landlord
      await addDoc(collection(db, 'notifications'), {
        userId: selectedBooking.landlordId,
        title: 'Rent Payment Received',
        message: `${user.name || user.email} has paid $${totalAmount} for ${selectedBooking.propertyTitle}.`,
        type: 'payment',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/dashboard?tab=payments'
      });

      // Create notification for tenant
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: 'Payment Successful',
        message: `Your payment of $${totalAmount} for ${selectedBooking.propertyTitle} was successful.`,
        type: 'payment',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/dashboard?tab=payments'
      });
      
      setPayments([newPayment, ...payments]);
      setPaymentSuccess(newPayment);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    const method = paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'paypal' ? 'PayPal' : paymentMethod === 'card' ? 'Credit Card' : 'Bank Transfer';
    const transactionId = `TX${Math.floor(Math.random() * 1000000)}`;
    await handlePaymentSuccess(transactionId, method);
  };

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

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={{ "clientId": import.meta.env.VITE_PAYPAL_CLIENT_ID || "test", currency: "USD" }}>
      <div className="space-y-8">
      {/* RENTER VIEW */}
      {user?.role === 'renter' && (
        <>
          {/* Upcoming Payments */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Payments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookings.map(booking => {
                const isOverdue = new Date(booking.nextPaymentDue) < new Date();
                return (
                  <div key={booking.id} className={`bg-white rounded-2xl border ${isOverdue ? 'border-red-300 shadow-red-100' : 'border-gray-200'} p-6 shadow-sm relative overflow-hidden`}>
                    {isOverdue && (
                      <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-xs font-bold text-center py-1 uppercase tracking-wider">
                        Payment Overdue
                      </div>
                    )}
                    <div className={`flex justify-between items-start mb-4 ${isOverdue ? 'mt-4' : ''}`}>
                      <div>
                        <h3 className="font-bold text-gray-900">{booking.propertyTitle}</h3>
                        <p className="text-sm text-gray-500">Landlord: {booking.landlordName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Next Payment Due</p>
                        <p className={`font-bold ${isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>
                          {new Date(booking.nextPaymentDue).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Rent</span>
                        <span className="font-medium">${booking.rentAmount}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Service Fee (3%)</span>
                        <span className="font-medium">${((booking.rentAmount + (isOverdue ? 25 : 0)) * 0.03).toFixed(2)}</span>
                      </div>
                      {isOverdue && (
                        <div className="flex justify-between text-sm mb-2 text-red-600">
                          <span>Late Fee</span>
                          <span className="font-medium">$25.00</span>
                        </div>
                      )}
                      <div className="h-px bg-gray-200 my-2"></div>
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>${((booking.rentAmount + (isOverdue ? 25 : 0)) * 1.03).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <Button onClick={() => handlePayNow(booking)} className={`w-full flex items-center justify-center gap-2 ${isOverdue ? 'bg-red-600 hover:bg-red-700' : ''}`}>
                      Pay Now <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment History */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment History</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Property</th>
                      <th className="p-4 font-medium">Amount</th>
                      <th className="p-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map(payment => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="p-4 text-sm text-gray-900">
                          {new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="p-4 text-sm text-gray-900">{payment.propertyTitle}</td>
                        <td className="p-4 text-sm font-medium text-gray-900">${payment.amount}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDisputeTarget({
                                landlordId: payment.landlordId,
                                landlordName: payment.landlordName || 'Landlord',
                                tenantId: payment.tenantId,
                                tenantName: payment.tenantName || 'Tenant',
                                propertyId: payment.propertyId,
                                propertyTitle: payment.propertyTitle
                              });
                              setDisputeModalOpen(true);
                            }}
                            className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-widest"
                          >
                            Dispute
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* LANDLORD VIEW */}
      {user?.role === 'landlord' && (
        <>
          {/* Earnings Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Total Earnings This Month</p>
              <p className="text-3xl font-bold text-gray-900">
                ${payments.filter(p => p.status === 'Completed').reduce((sum, p) => sum + (p.amount - p.serviceFee), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Pending Payouts</p>
              <p className="text-3xl font-bold text-yellow-600">
                ${payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + (p.amount - p.serviceFee), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Completed Payouts</p>
              <p className="text-3xl font-bold text-green-600">
                ${payments.filter(p => p.status === 'Completed').reduce((sum, p) => sum + (p.amount - p.serviceFee), 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Property Payment List */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Payments</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">Tenant</th>
                      <th className="p-4 font-medium">Property</th>
                      <th className="p-4 font-medium">Amount</th>
                      <th className="p-4 font-medium">Net Received</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map(payment => (
                      <tr 
                        key={payment.id} 
                        onClick={() => setSelectedPayment(payment)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="p-4 text-sm text-gray-900">{payment.tenantName}</td>
                        <td className="p-4 text-sm text-gray-900">{payment.propertyTitle}</td>
                        <td className="p-4 text-sm text-gray-500">${payment.amount}</td>
                        <td className="p-4 text-sm font-medium text-gray-900">${payment.amount - payment.serviceFee}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDisputeTarget({
                                landlordId: payment.landlordId,
                                landlordName: payment.landlordName || 'Landlord',
                                tenantId: payment.tenantId,
                                tenantName: payment.tenantName || 'Tenant',
                                propertyId: payment.propertyId,
                                propertyTitle: payment.propertyTitle
                              });
                              setDisputeModalOpen(true);
                            }}
                            className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-widest"
                          >
                            Dispute
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Payment Modal (Renter) */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setPaymentSuccess(null);
        }}
        title={paymentSuccess ? "Payment Successful" : "Select Payment Method"}
      >
        {paymentSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful</h3>
            <p className="text-gray-500 mb-6">Your payment has been processed successfully.</p>
            
            <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-bold text-gray-900">${paymentSuccess.amount + paymentSuccess.serviceFee}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Property</span>
                <span className="font-medium text-gray-900">{paymentSuccess.propertyTitle}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Transaction ID</span>
                <span className="font-mono text-gray-900">{paymentSuccess.transactionId}</span>
              </div>
            </div>
            
            <Button 
              className="w-full flex items-center justify-center gap-2" 
              variant="outline" 
              onClick={() => {
                alert('Receipt downloaded successfully!');
                setPaymentModalOpen(false);
              }}
            >
              <Download className="w-4 h-4" />
              Download Receipt
            </Button>
          </div>
        ) : selectedBooking ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <label 
                className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'mpesa' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="mpesa" 
                  checked={paymentMethod === 'mpesa'}
                  onChange={() => setPaymentMethod('mpesa')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <Smartphone className="w-6 h-6 ml-3 mr-3 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">M-Pesa</p>
                  <p className="text-xs text-gray-500">Pay via Safaricom M-Pesa</p>
                </div>
              </label>

              <label 
                className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'paypal' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="paypal" 
                  checked={paymentMethod === 'paypal'}
                  onChange={() => setPaymentMethod('paypal')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <Wallet className="w-6 h-6 ml-3 mr-3 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">PayPal</p>
                  <p className="text-xs text-gray-500">Pay with your PayPal account</p>
                </div>
              </label>
              
              <label 
                className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="card" 
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <CreditCard className="w-6 h-6 ml-3 mr-3 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Credit / Debit Card</p>
                  <p className="text-xs text-gray-500">Visa, Mastercard</p>
                </div>
              </label>
              
              <label 
                className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'bank_transfer' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="bank_transfer" 
                  checked={paymentMethod === 'bank_transfer'}
                  onChange={() => setPaymentMethod('bank_transfer')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <Landmark className="w-6 h-6 ml-3 mr-3 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Bank Transfer</p>
                  <p className="text-xs text-gray-500">Direct deposit to landlord's account</p>
                </div>
              </label>
            </div>
            
            {paymentMethod === 'paypal' ? (
              <div className="mt-4">
                <PayPalButtons
                  style={{ layout: "vertical" }}
                  createOrder={(data, actions) => {
                    const isOverdue = new Date(selectedBooking.nextPaymentDue) < new Date();
                    const lateFee = isOverdue ? 25 : 0;
                    const totalAmount = ((selectedBooking.rentAmount + lateFee) * 1.03).toFixed(2);
                    
                    return actions.order.create({
                      intent: "CAPTURE",
                      purchase_units: [
                        {
                          amount: {
                            currency_code: "USD",
                            value: totalAmount,
                          },
                          description: `Rent for ${selectedBooking.propertyTitle}`,
                        },
                      ],
                    });
                  }}
                  onApprove={async (data, actions) => {
                    if (!actions.order) return;
                    try {
                      const details = await actions.order.capture();
                      await handlePaymentSuccess(details.id || `TX${Math.floor(Math.random() * 1000000)}`, 'PayPal');
                    } catch (error) {
                      console.error("PayPal Capture Error:", error);
                      alert("Payment failed. Please try again.");
                    }
                  }}
                  onError={(err) => {
                    console.error("PayPal Error:", err);
                    alert("An error occurred with PayPal. Please try again.");
                  }}
                />
              </div>
            ) : (
              <Button 
                className="w-full" 
                onClick={processPayment}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Pay $${((selectedBooking.rentAmount + (new Date(selectedBooking.nextPaymentDue) < new Date() ? 25 : 0)) * 1.03).toFixed(2)}`}
              </Button>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Payment Details Modal (Landlord) */}
      <Modal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title="Payment Details"
      >
        {selectedPayment && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Tenant</p>
                <p className="font-medium text-gray-900">{selectedPayment.tenantName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Type</p>
                <p className="font-medium text-gray-900">{selectedPayment.type}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500 mb-1">Property</p>
                <p className="font-medium text-gray-900">{selectedPayment.propertyTitle}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(selectedPayment.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedPayment.status)}`}>
                  {selectedPayment.status}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Amount Paid by Tenant</span>
                <span className="font-medium text-gray-900">${selectedPayment.amount}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Service Fee Deducted</span>
                <span className="font-medium text-red-600">-${selectedPayment.serviceFee}</span>
              </div>
              <div className="flex justify-between py-2 mt-2">
                <span className="font-bold text-gray-900">Net Amount Received</span>
                <span className="font-bold text-green-600">${selectedPayment.amount - selectedPayment.serviceFee}</span>
              </div>
            </div>
            
            <div className="text-center space-y-3">
              <p className="text-xs text-gray-500">Transaction ID: {selectedPayment.transactionId}</p>
              <button
                onClick={() => {
                  setDisputeTarget({
                    landlordId: selectedPayment.landlordId,
                    landlordName: selectedPayment.landlordName || 'Landlord',
                    tenantId: selectedPayment.tenantId,
                    tenantName: selectedPayment.tenantName || 'Tenant',
                    propertyId: selectedPayment.propertyId,
                    propertyTitle: selectedPayment.propertyTitle
                  });
                  setDisputeModalOpen(true);
                }}
                className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all border border-red-100"
              >
                <AlertTriangle className="w-4 h-4" /> Raise a Dispute
              </button>
            </div>
          </div>
        )}
      </Modal>

      {disputeTarget && (
        <DisputeModal
          isOpen={disputeModalOpen}
          onClose={() => setDisputeModalOpen(false)}
          landlordId={disputeTarget.landlordId}
          landlordName={disputeTarget.landlordName}
          tenantId={disputeTarget.tenantId}
          tenantName={disputeTarget.tenantName}
          propertyId={disputeTarget.propertyId}
          propertyTitle={disputeTarget.propertyTitle}
          onSuccess={() => {
            alert('Dispute submitted successfully. Our team will review it.');
            setSelectedPayment(null);
          }}
        />
      )}
    </div>
    </PayPalScriptProvider>
  );
}
