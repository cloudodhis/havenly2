import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Modal } from '../ui/Modal';
import { MessageSquare, User, Home, Clock, ShieldAlert } from 'lucide-react';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isFlagged?: boolean;
  flagReason?: string;
  createdAt: string;
}

interface ConversationViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

export function ConversationViewerModal({ isOpen, onClose, conversationId }: ConversationViewerModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Record<string, { name: string; photoUrl?: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    setLoading(true);
    
    // Fetch conversation to get participants
    const fetchConversation = async () => {
      try {
        const convDoc = await getDoc(doc(db, 'conversations', conversationId));
        if (convDoc.exists()) {
          const data = convDoc.data();
          const renterId = data.renterId;
          const landlordId = data.landlordId;
          
          const [renterDoc, landlordDoc] = await Promise.all([
            getDoc(doc(db, 'users', renterId)),
            getDoc(doc(db, 'users', landlordId))
          ]);
          
          const newParticipants: Record<string, { name: string; photoUrl?: string }> = {};
          if (renterDoc.exists()) {
            newParticipants[renterId] = { 
              name: renterDoc.data().name || 'Renter', 
              photoUrl: renterDoc.data().photoUrl 
            };
          }
          if (landlordDoc.exists()) {
            newParticipants[landlordId] = { 
              name: landlordDoc.data().name || 'Landlord', 
              photoUrl: landlordDoc.data().photoUrl 
            };
          }
          setParticipants(newParticipants);
        }
      } catch (err) {
        console.error('Error fetching conversation details:', err);
      }
    };

    fetchConversation();

    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      msgsData.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(msgsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conversation History"
    >
      <div className="flex flex-col h-[600px]">
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            You are viewing this conversation as an administrator. This is for dispute resolution and moderation purposes only.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-xl border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
              <p>No messages in this conversation.</p>
            </div>
          ) : (
            messages.map((message) => {
              const participant = participants[message.senderId];
              return (
                <div key={message.id} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {participant?.photoUrl ? (
                      <img src={participant.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-3 h-3 text-gray-500" />
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {participant?.name || 'Unknown User'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${message.isFlagged ? 'bg-red-50 border border-red-100 text-red-900' : 'bg-white border border-gray-100 text-gray-700 shadow-sm'}`}>
                    {message.isFlagged && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">
                        <ShieldAlert className="w-3 h-3" /> Flagged: {message.flagReason}
                      </div>
                    )}
                    {message.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </Modal>
  );
}
