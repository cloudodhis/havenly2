import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { CheckCircle, XCircle, Clock, FileText, Loader2, CreditCard, Landmark, ArrowRight, Star } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { motion } from 'motion/react';
import ReviewModal from './ReviewModal';

interface Application {
  id: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  moveInDate: string;
  occupants: number;
  employmentStatus: string;
  monthlyIncome: number;
  message: string;
  createdAt: string;
  propertyTitle: string;
  tenantName: string;
  landlordName: string;
}

interface ApplicationsViewProps {
  applications?: Application[];
}

export function ApplicationsView({ applications: propApplications }: ApplicationsViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>(propApplications || []);
  const [loading, setLoading] = useState(!propApplications);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Payment state
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState('');
  const [reviewTargetName, setReviewTargetName] = useState('');
  const [reviewTargetType, setReviewTargetType] = useState<'property' | 'landlord' | 'renter'>('property');

  useEffect(() => {
    if (propApplications) {
      setApplications(propApplications);
      setLoading(false);
      return;
    }

    if (!user) return;

    const roleField = user.role === 'landlord' ? 'landlordId' : 'tenantId';
    const q = query(
      collection(db, 'applications'),
      where(roleField, '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Application));
      setApplications(appsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'applications');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, propApplications]);

  const handleStatusUpdate = async (applicationId: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(applicationId);
    try {
      await updateDoc(doc(db, 'applications', applicationId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'applications');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePaymentSuccess = async (transactionId: string, method: string) => {
    if (!selectedApplication || !user) return;
    
    setProcessingId(selectedApplication.id);
    try {
      const { getDoc } = await import('firebase/firestore');
      const propRef = doc(db, 'properties', selectedApplication.propertyId);
      const propSnap = await getDoc(propRef);
      
      let rentAmount = 1000;
      let depositAmount = 1000;
      
      if (propSnap.exists()) {
        const propData = propSnap.data();
        rentAmount = propData.price || 1000;
        depositAmount = propData.securityDeposit || propData.price || 1000;
      }
      
      const totalAmount = rentAmount + depositAmount;
      
      // 1. Create Payment
      const paymentData = {
        transactionId,
        bookingId: `BKG${Math.floor(Math.random() * 1000000)}`,
        tenantId: user.uid,
        landlordId: selectedApplication.landlordId,
        propertyId: selectedApplication.propertyId,
        amount: totalAmount,
        serviceFee: totalAmount * 0.03,
        status: 'Completed',
        type: 'Booking Fee',
        method,
        createdAt: new Date().toISOString(),
        propertyTitle: selectedApplication.propertyTitle,
        landlordName: selectedApplication.landlordName,
        tenantName: user.name || user.email
      };
      await addDoc(collection(db, 'payments'), paymentData);

      // 2. Create Booking
      await addDoc(collection(db, 'bookings'), {
        propertyId: selectedApplication.propertyId,
        tenantId: user.uid,
        landlordId: selectedApplication.landlordId,
        startDate: selectedApplication.moveInDate,
        endDate: new Date(new Date(selectedApplication.moveInDate).setFullYear(new Date(selectedApplication.moveInDate).getFullYear() + 1)).toISOString(),
        rentAmount: rentAmount,
        depositAmount: depositAmount,
        status: 'active',
        nextPaymentDue: selectedApplication.moveInDate,
        propertyTitle: selectedApplication.propertyTitle,
        landlordName: selectedApplication.landlordName
      });

      // 3. Update Application Status
      await updateDoc(doc(db, 'applications', selectedApplication.id), {
        status: 'completed',
        updatedAt: new Date().toISOString()
      });

      setPaymentSuccess(true);
      setTimeout(() => {
        setSelectedApplication(null);
        setPaymentSuccess(false);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments/bookings');
    } finally {
      setProcessingId(null);
    }
  };

  const processPayment = async () => {
    const method = paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'paypal' ? 'PayPal' : paymentMethod === 'card' ? 'Credit Card' : 'Bank Transfer';
    const transactionId = `TX${Math.floor(Math.random() * 1000000)}`;
    await handlePaymentSuccess(transactionId, method);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"><CheckCircle className="w-3 h-3 mr-1" /> Booked</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={{ "clientId": import.meta.env.VITE_PAYPAL_CLIENT_ID || "test", currency: "USD" }}>
      <div className="space-y-6 pb-24">
        {applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No applications yet</h3>
            <p className="text-gray-500">
              {user?.role === 'landlord' 
                ? "When tenants apply for your properties, they'll appear here."
                : "Properties you apply for will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {applications.map((app) => (
              <motion.div 
                key={app.id} 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                onClick={() => navigate(`/property/${app.propertyId}`)}
              >
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{app.propertyTitle}</h3>
                      {getStatusBadge(app.status)}
                    </div>
                    <p className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1">
                      {user?.role === 'landlord' ? `Applicant: ${app.tenantName}` : `Landlord: ${app.landlordName}`} • Applied on {new Date(app.createdAt).toLocaleDateString()}
                      <span className="inline-flex items-center text-indigo-600 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-2 text-xs font-bold">
                        View Property <ArrowRight className="w-3 h-3 ml-1" />
                      </span>
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gray-50 p-3 rounded-xl">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Move-in Date</p>
                        <p className="font-medium text-gray-900">{new Date(app.moveInDate).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Occupants</p>
                        <p className="font-medium text-gray-900">{app.occupants}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Employment</p>
                        <p className="font-medium text-gray-900">{app.employmentStatus}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Income</p>
                        <p className="font-medium text-gray-900">${app.monthlyIncome}/mo</p>
                      </div>
                    </div>
                    
                    {app.message && (
                      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        <p className="text-sm text-gray-700 italic">"{app.message}"</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col justify-center gap-3 min-w-[140px]">
                    {user?.role === 'landlord' && app.status === 'pending' && (
                      <>
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusUpdate(app.id, 'approved');
                          }}
                          disabled={processingId === app.id}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          {processingId === app.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Approve'}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusUpdate(app.id, 'rejected');
                          }}
                          disabled={processingId === app.id}
                          className="w-full border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    
                    {user?.role === 'renter' && app.status === 'approved' && (
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedApplication(app);
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Pay to Book
                      </Button>
                    )}
                    
                    {app.status === 'completed' && (
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewTargetId(user?.role === 'landlord' ? app.tenantId : app.landlordId);
                          setReviewTargetName(user?.role === 'landlord' ? (app.tenantName || 'Renter') : (app.landlordName || 'Landlord'));
                          setReviewTargetType(user?.role === 'landlord' ? 'renter' : 'landlord');
                          setReviewModalOpen(true);
                        }}
                        className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2"
                      >
                        <Star className="w-4 h-4" /> Review {user?.role === 'landlord' ? 'Renter' : 'Landlord'}
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/property/${app.propertyId}`);
                      }}
                      className="w-full border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      View Property
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Payment Modal */}
        <Modal
          isOpen={!!selectedApplication}
          onClose={() => !processingId && setSelectedApplication(null)}
          title="Complete Booking"
        >
          {paymentSuccess ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-gray-500">Your booking is now confirmed.</p>
            </div>
          ) : selectedApplication ? (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 mb-2">Booking Summary</h4>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Property</span>
                  <span className="font-medium">{selectedApplication.propertyTitle}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Move-in Date</span>
                  <span className="font-medium">{new Date(selectedApplication.moveInDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-4 pt-4 border-t border-gray-200">
                  <span>Total Due Now</span>
                  <span>$1,000.00</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Payment Method</label>
                
                <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                  <CreditCard className="w-6 h-6 ml-3 mr-3 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Credit / Debit Card</p>
                  </div>
                </label>

                <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'paypal' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="paymentMethod" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                  <div className="ml-3 mr-3 font-bold text-blue-800 italic text-xl tracking-tighter">PayPal</div>
                  <div>
                    <p className="font-medium text-gray-900">PayPal</p>
                  </div>
                </label>
              </div>

              {paymentMethod === 'paypal' ? (
                <div className="mt-4">
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        intent: "CAPTURE",
                        purchase_units: [{ amount: { currency_code: "USD", value: "1000.00" }, description: `Booking for ${selectedApplication.propertyTitle}` }],
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
                  />
                </div>
              ) : (
                <Button className="w-full" onClick={processPayment} disabled={processingId !== null}>
                  {processingId !== null ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Pay $1,000.00'}
                </Button>
              )}
            </div>
          ) : null}
        </Modal>

        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          targetId={reviewTargetId}
          targetName={reviewTargetName}
          targetType={reviewTargetType}
          onSuccess={() => {
            // Optional: show a success toast
          }}
        />
      </div>
    </PayPalScriptProvider>
  );
}
