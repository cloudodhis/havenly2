import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Loader2, AlertCircle, ShieldAlert, Upload, X } from 'lucide-react';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  landlordId: string;
  landlordName: string;
  tenantId: string;
  tenantName: string;
  propertyId?: string;
  propertyTitle?: string;
  conversationId?: string;
  onSuccess?: () => void;
}

export function DisputeModal({
  isOpen,
  onClose,
  landlordId,
  landlordName,
  tenantId,
  tenantName,
  propertyId,
  propertyTitle,
  conversationId,
  onSuccess
}: DisputeModalProps) {
  const { user } = useAuth();
  const [type, setType] = useState<'Payment Issue' | 'Listing Complaint' | 'User Misconduct' | 'Booking Issue'>('Payment Issue');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddEvidence = () => {
    if (newEvidenceUrl && !evidence.includes(newEvidenceUrl)) {
      setEvidence([...evidence, newEvidenceUrl]);
      setNewEvidenceUrl('');
    }
  };

  const handleRemoveEvidence = (url: string) => {
    setEvidence(evidence.filter(e => e !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!description.trim()) {
      setError('Please provide a description of the issue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const disputeData = {
        type,
        status: 'Open',
        priority,
        tenantId,
        landlordId,
        tenantName,
        landlordName,
        propertyId: propertyId || null,
        propertyTitle: propertyTitle || null,
        description,
        evidence,
        conversationId: conversationId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'disputes'), disputeData);
      
      if (onSuccess) onSuccess();
      onClose();
      // Reset form
      setDescription('');
      setEvidence([]);
      setType('Payment Issue');
      setPriority('Medium');
    } catch (err) {
      console.error('Error raising dispute:', err);
      setError('Failed to submit dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raise a Dispute"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Disputes are reviewed by our moderation team. Please provide as much detail and evidence as possible to help us resolve the issue fairly.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Issue Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-purple-600 transition-all"
            >
              <option value="Payment Issue">Payment Issue</option>
              <option value="Listing Complaint">Listing Complaint</option>
              <option value="User Misconduct">User Misconduct</option>
              <option value="Booking Issue">Booking Issue</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-purple-600 transition-all"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Description</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            className="w-full h-32 bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-purple-600 transition-all resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Evidence (Image URLs)</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={newEvidenceUrl}
              onChange={(e) => setNewEvidenceUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-purple-600 transition-all"
            />
            <Button 
              type="button" 
              onClick={handleAddEvidence}
              className="bg-gray-100 text-gray-900 hover:bg-gray-200 px-4 rounded-xl"
            >
              Add
            </Button>
          </div>
          
          {evidence.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {evidence.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img src={url} alt="Evidence" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => handleRemoveEvidence(url)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={submitting}
            className="bg-purple-600 text-white hover:bg-purple-700 px-8"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Dispute'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
