import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, orderBy, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Search, AlertTriangle, MessageSquare, ShieldAlert, Trash2, UserX, UserMinus, Clock, Filter, X, Bot } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { analyzeConversation } from '../../services/geminiService';

interface Conversation {
  id: string;
  propertyId: string;
  renterId: string;
  landlordId: string;
  lastMessage: string;
  lastMessageAt: string;
  isFlagged: boolean;
  flagReason?: string;
  moderatorNotes?: string;
  createdAt: string;
  // Joined data
  renterName?: string;
  landlordName?: string;
  propertyTitle?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isFlagged: boolean;
  flagReason?: string;
  createdAt: string;
}

export function MessagingMonitoring() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'flagged' | 'high_risk'>('all');
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const convQuery = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
        const snapshot = await getDocs(convQuery);
        
        const convsData = await Promise.all(snapshot.docs.map(async (convDoc) => {
          const data = convDoc.data();
          
          // Fetch names
          const renterSnap = await getDocs(query(collection(db, 'users')));
          const users = renterSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
          
          const renter = users.find(u => u.id === data.renterId);
          const landlord = users.find(u => u.id === data.landlordId);
          
          // Fetch property
          const propSnap = await getDocs(query(collection(db, 'properties')));
          const properties = propSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
          const property = properties.find(p => p.id === data.propertyId);

          return {
            id: convDoc.id,
            ...data,
            renterName: renter?.name || 'Unknown Renter',
            landlordName: landlord?.name || 'Unknown Landlord',
            propertyTitle: property?.title || 'Unknown Property'
          } as Conversation;
        }));
        
        setConversations(convsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      // where('conversationId', '==', selectedConversationId), // Needs index, filtering client side for now
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(m => m.conversationId === selectedConversationId);
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedConversationId]);

  const handleRemoveMessage = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to remove this message?')) return;
    try {
      await deleteDoc(doc(db, 'messages', messageId));
      // Optionally add a system message or update the conversation
    } catch (error) {
      console.error('Error removing message:', error);
    }
  };

  const handleWarnUser = async (userId: string) => {
    try {
      // In a real app, this would send an email or in-app notification
      alert(`Warning sent to user ${userId}`);
    } catch (error) {
      console.error('Error warning user:', error);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to suspend this user?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'suspended' });
      alert('User suspended successfully');
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  };

  const handleResolveDispute = async (conversationId: string) => {
    try {
      await updateDoc(doc(db, 'conversations', conversationId), { 
        isFlagged: false,
        flagReason: ''
      });
      // Update local state
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, isFlagged: false, flagReason: '' } : c));
      alert('Dispute resolved');
    } catch (error) {
      console.error('Error resolving dispute:', error);
    }
  };

  const handleDismissDispute = async (conversationId: string) => {
    try {
      await updateDoc(doc(db, 'conversations', conversationId), { 
        isFlagged: false,
        flagReason: ''
      });
      // Update local state
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, isFlagged: false, flagReason: '' } : c));
      alert('Dispute dismissed');
    } catch (error) {
      console.error('Error dismissing dispute:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedConversationId) return;
    try {
      await updateDoc(doc(db, 'conversations', selectedConversationId), { 
        moderatorNotes: moderatorNotes
      });
      // Update local state
      setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, moderatorNotes } : c));
      setIsNoteModalOpen(false);
      alert('Note saved successfully');
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleFlagConversation = async (conversationId: string) => {
    const reason = window.prompt('Enter reason for flagging this conversation:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'conversations', conversationId), { 
        isFlagged: true,
        flagReason: reason
      });
      // Update local state
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, isFlagged: true, flagReason: reason } : c));
      alert('Conversation flagged');
    } catch (error) {
      console.error('Error flagging conversation:', error);
    }
  };

  const handleFlagMessage = async (messageId: string) => {
    const reason = window.prompt('Enter reason for flagging this message:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'messages', messageId), { 
        isFlagged: true,
        flagReason: reason
      });
      alert('Message flagged');
    } catch (error) {
      console.error('Error flagging message:', error);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = 
      (conv.renterName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (conv.landlordName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (conv.propertyTitle?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
      
    const matchesFilter = 
      filter === 'all' ? true :
      filter === 'flagged' ? conv.isFlagged :
      filter === 'high_risk' ? conv.isFlagged && conv.flagReason?.includes('payment') : true;

    return matchesSearch && matchesFilter;
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const openNoteModal = () => {
    if (selectedConversation) {
      setModeratorNotes(selectedConversation.moderatorNotes || '');
      setIsNoteModalOpen(true);
    }
  };

  const handleAnalyzeConversation = async () => {
    if (!selectedConversation || messages.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      const formattedMessages = messages.map(m => ({
        sender: m.senderId === selectedConversation.landlordId ? 'Landlord' : 'Renter',
        text: m.text
      }));

      const result = await analyzeConversation(formattedMessages);
      
      if (result.isFlagged) {
        await updateDoc(doc(db, 'conversations', selectedConversation.id), { 
          isFlagged: true,
          flagReason: `AI Flagged (${Math.round(result.confidence * 100)}% confidence): ${result.reason}`
        });
        
        setConversations(prev => prev.map(c => 
          c.id === selectedConversation.id 
            ? { ...c, isFlagged: true, flagReason: `AI Flagged (${Math.round(result.confidence * 100)}% confidence): ${result.reason}` } 
            : c
        ));
        alert(`AI Analysis Complete: Conversation flagged.\nReason: ${result.reason}`);
      } else {
        alert('AI Analysis Complete: No issues detected.');
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      alert('Failed to analyze conversation with AI.');
    } finally {
      setIsAnalyzing(false);
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
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messaging Monitoring</h1>
        <p className="text-gray-500 mt-1">Monitor conversations, detect risks, and moderate abusive messages.</p>
      </div>

      <div className="flex-grow flex gap-6 overflow-hidden">
        {/* Left Column: Conversation List */}
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages, users, or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button 
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All Conversations
              </button>
              <button 
                onClick={() => setFilter('flagged')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${filter === 'flagged' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Flagged
              </button>
              <button 
                onClick={() => setFilter('high_risk')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${filter === 'high_risk' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                High Risk
              </button>
            </div>
          </div>
          <div className="flex-grow overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                <p>No conversations found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredConversations.map(conv => (
                  <div 
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`p-4 cursor-pointer transition-colors ${selectedConversationId === conv.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm text-gray-900 truncate pr-2">
                        {conv.landlordName} ↔ {conv.renterName}
                      </h4>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(conv.lastMessageAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-600 mb-2 truncate">{conv.propertyTitle}</p>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">"{conv.lastMessage}"</p>
                    {conv.isFlagged && (
                      <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md w-fit">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{conv.flagReason || 'Suspicious activity'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Chat Viewer */}
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-900">{selectedConversation.landlordName} (Landlord)</h3>
                <h3 className="font-medium text-gray-900">{selectedConversation.renterName} (Renter)</h3>
                <p className="text-sm text-indigo-600 mt-1">Property: {selectedConversation.propertyTitle}</p>
              </div>
              <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No messages in this conversation yet.</div>
                ) : (
                  messages.map(msg => {
                    const isLandlord = msg.senderId === selectedConversation.landlordId;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isLandlord ? 'items-end' : 'items-start'}`}>
                        <span className="text-xs text-gray-500 mb-1">
                          {isLandlord ? selectedConversation.landlordName : selectedConversation.renterName}
                        </span>
                        <div className="group relative max-w-[85%]">
                          <div className={`p-3 rounded-2xl ${
                            msg.isFlagged 
                              ? 'bg-red-100 text-red-900 border border-red-200' 
                              : isLandlord 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-white border border-gray-200 text-gray-900'
                          }`}>
                            <p className="text-sm">{msg.text}</p>
                          </div>
                          {msg.isFlagged && (
                            <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Warning: {msg.flagReason}</span>
                            </div>
                          )}
                          <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ${isLandlord ? '-left-16' : '-right-16'}`}>
                            <button 
                              onClick={() => handleFlagMessage(msg.id)}
                              className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-400 hover:text-orange-600"
                              title="Flag Message"
                            >
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => handleRemoveMessage(msg.id)}
                              className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-400 hover:text-red-600"
                              title="Remove Message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-grow flex items-center justify-center text-gray-400">
              <p>Select a conversation to view messages</p>
            </div>
          )}
        </div>

        {/* Right Column: Moderation Actions */}
        <div className="w-1/3 flex flex-col gap-6 overflow-y-auto">
          {selectedConversation ? (
            <>
              {/* Context Panel */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Conversation Details</h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleAnalyzeConversation}
                      disabled={isAnalyzing || messages.length === 0}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div>
                      ) : (
                        <Bot className="w-3 h-3" />
                      )}
                      AI Scan
                    </button>
                    {!selectedConversation.isFlagged && (
                      <button 
                        onClick={() => handleFlagConversation(selectedConversation.id)}
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Flag
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Property:</span>
                    <span className="font-medium text-gray-900 text-right">{selectedConversation.propertyTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Renter:</span>
                    <span className="font-medium text-gray-900">{selectedConversation.renterName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Landlord:</span>
                    <span className="font-medium text-gray-900">{selectedConversation.landlordName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started:</span>
                    <span className="font-medium text-gray-900">{new Date(selectedConversation.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total messages:</span>
                    <span className="font-medium text-gray-900">{messages.length}</span>
                  </div>
                </div>
              </div>

              {/* Moderation Actions */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4">Moderation Actions</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Renter ({selectedConversation.renterName})</h4>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-yellow-600 border-yellow-200 hover:bg-yellow-50 hover:text-yellow-700"
                        onClick={() => handleWarnUser(selectedConversation.renterId)}
                      >
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Warn Renter
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => alert(`Muted renter ${selectedConversation.renterName}`)}
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        Mute Renter
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleSuspendUser(selectedConversation.renterId)}
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        Suspend Renter
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-red-800 border-red-300 hover:bg-red-100 hover:text-red-900"
                        onClick={() => alert(`Blocked renter ${selectedConversation.renterName}`)}
                      >
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Block Renter
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Landlord ({selectedConversation.landlordName})</h4>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-yellow-600 border-yellow-200 hover:bg-yellow-50 hover:text-yellow-700"
                        onClick={() => handleWarnUser(selectedConversation.landlordId)}
                      >
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Warn Landlord
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => alert(`Muted landlord ${selectedConversation.landlordName}`)}
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        Mute Landlord
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleSuspendUser(selectedConversation.landlordId)}
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        Suspend Landlord
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-red-800 border-red-300 hover:bg-red-100 hover:text-red-900"
                        onClick={() => alert(`Blocked landlord ${selectedConversation.landlordName}`)}
                      >
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Block Landlord
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispute Resolution Tool */}
              {selectedConversation.isFlagged && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-orange-200">
                  <div className="flex items-center gap-2 mb-4 text-orange-600">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-bold">Dispute / Flagged</h3>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg text-sm text-orange-800 mb-4">
                    <span className="font-semibold">Reason:</span> {selectedConversation.flagReason}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                      onClick={() => handleResolveDispute(selectedConversation.id)}
                    >
                      Resolve
                    </Button>
                    <Button 
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs"
                      onClick={() => handleDismissDispute(selectedConversation.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {/* Moderator Notes */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Moderator Notes</h3>
                  <button 
                    onClick={openNoteModal}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {selectedConversation.moderatorNotes ? 'Edit Note' : '+ Add Note'}
                  </button>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm text-gray-700">
                  {selectedConversation.moderatorNotes ? (
                    <p className="whitespace-pre-wrap">{selectedConversation.moderatorNotes}</p>
                  ) : (
                    <p className="italic">No notes added yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center text-gray-400 h-full flex flex-col items-center justify-center">
              <ShieldAlert className="w-12 h-12 mb-4 text-gray-200" />
              <p>Select a conversation to view context and moderation tools</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Moderator Note"
      >
        <div className="space-y-4">
          <textarea
            value={moderatorNotes}
            onChange={(e) => setModeratorNotes(e.target.value)}
            placeholder="E.g., User has requested off-platform payment twice. Possible scam attempt."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent resize-none"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsNoteModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNote}>Save Note</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
