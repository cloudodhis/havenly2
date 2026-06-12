import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, User, Home, Clock, MessageSquare, ChevronLeft, ShieldAlert } from 'lucide-react';
import { moderateMessage } from '../lib/moderation';
import { DisputeModal } from './DisputeModal';

interface Conversation {
  id: string;
  propertyId: string;
  renterId: string;
  landlordId: string;
  lastMessage: string;
  lastMessageAt: string;
  isFlagged?: boolean;
  flagReason?: string;
  moderatorNotes?: string;
  createdAt: string;
  // Joined fields
  propertyTitle?: string;
  otherUserName?: string;
  otherUserPhoto?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isFlagged?: boolean;
  flagReason?: string;
  createdAt: string;
}

interface MessagesViewProps {
  userId: string;
  isLandlord: boolean;
  userName?: string;
  userPhoto?: string;
}

export function MessagesView({ userId, isLandlord, userName, userPhoto }: MessagesViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'conversations'),
      where(isLandlord ? 'landlordId' : 'renterId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      
      // Sort in memory to avoid needing a composite index
      convsData.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      
      // Fetch related property and user info
      const enrichedConvs = await Promise.all(convsData.map(async (conv) => {
        try {
          const propertyDoc = await getDoc(doc(db, 'properties', conv.propertyId));
          const propertyTitle = propertyDoc.exists() ? propertyDoc.data().title : 'Unknown Property';
          
          const otherUserId = isLandlord ? conv.renterId : conv.landlordId;
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          const otherUserName = userDoc.exists() ? userDoc.data().name : 'Unknown User';
          const otherUserPhoto = userDoc.exists() ? userDoc.data().photoUrl : undefined;

          return { ...conv, propertyTitle, otherUserName, otherUserPhoto };
        } catch (error) {
          console.error('Error fetching enriched data:', error);
          return conv;
        }
      }));

      setConversations(enrichedConvs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, isLandlord]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConversationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      // Sort in memory to avoid needing a composite index
      msgsData.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      setMessages(msgsData);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedConversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversationId) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      const now = new Date().toISOString();
      
      // Add message
      const messageRef = await addDoc(collection(db, 'messages'), {
        conversationId: selectedConversationId,
        senderId: userId,
        text,
        createdAt: now
      });

      // Update conversation lastMessage
      await updateDoc(doc(db, 'conversations', selectedConversationId), {
        lastMessage: text,
        lastMessageAt: now
      });

      // Run AI moderation asynchronously
      moderateMessage(text).then(async (moderationResult) => {
        if (moderationResult.isFlagged) {
          await updateDoc(doc(db, 'messages', messageRef.id), {
            isFlagged: true,
            flagReason: moderationResult.reason
          });
          await updateDoc(doc(db, 'conversations', selectedConversationId), {
            isFlagged: true,
            flagReason: moderationResult.reason
          });
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[500px] bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Sidebar: Conversation List */}
      <div className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-gray-200 flex-col bg-gray-50/50`}>
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-bold text-gray-900">Conversations</h3>
        </div>
        <div className="flex-grow overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>No conversations yet.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`w-full text-left p-4 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                  selectedConversationId === conv.id ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  {conv.otherUserPhoto ? (
                    <img src={conv.otherUserPhoto} alt={conv.otherUserName} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      {conv.otherUserName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-semibold text-gray-900 truncate pr-2">{conv.otherUserName}</h4>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(conv.lastMessageAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-600 font-medium truncate mb-1">{conv.propertyTitle}</p>
                    <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`${!selectedConversationId ? 'hidden md:flex' : 'flex'} flex-grow flex-col bg-white w-full md:w-2/3`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedConversationId(null)}
                  className="md:hidden mr-2 p-2 -ml-2 text-gray-500 hover:bg-gray-200 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {selectedConversation.otherUserPhoto ? (
                  <img src={selectedConversation.otherUserPhoto} alt={selectedConversation.otherUserName} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold">
                    {selectedConversation.otherUserName?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <h3 className="font-medium text-gray-900 leading-tight">{selectedConversation.otherUserName}</h3>
                  <p className="text-xs text-gray-500">{selectedConversation.propertyTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setDisputeModalOpen(true)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                title="Raise a Dispute"
              >
                <ShieldAlert className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-[#efeae2]">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="bg-white/80 px-4 py-2 rounded-lg text-sm shadow-sm">
                    No messages yet. Send a message to start the conversation!
                  </div>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.senderId === userId;
                  const isSenderLandlord = isMine ? isLandlord : !isLandlord;
                  
                  const messageColors = isMine 
                    ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none shadow-sm' 
                    : 'bg-white text-gray-900 rounded-tl-none shadow-sm';

                  const senderName = isMine ? 'You' : (selectedConversation.otherUserName || 'User');
                  // Distinct colors for the communicating parties (like WhatsApp group chat names)
                  const nameColor = isSenderLandlord ? 'text-[#027eb5]' : 'text-[#e542a3]';

                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[75%] rounded-lg px-3 pt-2 pb-1 ${messageColors}`}>
                        {!isMine && (
                          <div className={`text-xs font-bold mb-0.5 ${nameColor}`}>
                            {senderName}
                          </div>
                        )}
                        <p className="text-[15px] leading-snug break-words">{msg.text}</p>
                        <div className="text-[10px] mt-0.5 text-right text-gray-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 bg-[#f0f2f5]">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message"
                  className="flex-grow px-4 py-2.5 bg-white border-none focus:outline-none focus:ring-0 rounded-full text-[15px] shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2.5 text-[#54656f] hover:text-[#00a884] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-gray-300" />
            </div>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>

      {selectedConversationId && (
        <DisputeModal
          isOpen={disputeModalOpen}
          onClose={() => setDisputeModalOpen(false)}
          landlordId={isLandlord ? userId : (conversations.find(c => c.id === selectedConversationId)?.landlordId || '')}
          landlordName={isLandlord ? (userName || 'Landlord') : 'Landlord'}
          tenantId={isLandlord ? (conversations.find(c => c.id === selectedConversationId)?.renterId || '') : userId}
          tenantName={isLandlord ? 'Tenant' : (userName || 'Tenant')}
          propertyId={conversations.find(c => c.id === selectedConversationId)?.propertyId}
          propertyTitle={conversations.find(c => c.id === selectedConversationId)?.propertyTitle}
          conversationId={selectedConversationId}
          onSuccess={() => {
            alert('Dispute submitted successfully. Our team will review it.');
          }}
        />
      )}
    </div>
  );
}
