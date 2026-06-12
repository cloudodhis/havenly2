import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Bell, Send, Calendar, Users, Mail, Smartphone, AlertTriangle, 
  CheckCircle2, Clock, Info, BarChart2, Edit, Eye, X, ShieldAlert
} from 'lucide-react';

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  audience: 'all' | 'renter' | 'landlord' | 'custom';
  deliveryTypes: string[];
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  scheduledFor?: string;
  sentAt?: string;
  customSegment?: string;
  type: 'announcement' | 'maintenance' | 'payment_reminder' | 'promotion' | 'security_alert';
  priority: 'low' | 'medium' | 'high';
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  createdAt: string;
}

export function NotificationsManagement() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'all' | 'renter' | 'landlord' | 'custom'>('all');
  const [customSegment, setCustomSegment] = useState<'active_last_7_days' | 'no_active_listings' | 'pending_payments'>('active_last_7_days');
  const [deliveryTypes, setDeliveryTypes] = useState<string[]>(['in-app']);
  const [type, setType] = useState<'announcement' | 'maintenance' | 'payment_reminder' | 'promotion' | 'security_alert'>('announcement');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminNotification[];
      setNotifications(notifsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeliveryTypeToggle = (type: string) => {
    if (deliveryTypes.includes(type)) {
      setDeliveryTypes(deliveryTypes.filter(t => t !== type));
    } else {
      setDeliveryTypes([...deliveryTypes, type]);
    }
  };

    const resetForm = () => {
    setTitle('');
    setMessage('');
    setAudience('all');
    setCustomSegment('active_last_7_days');
    setDeliveryTypes(['in-app']);
    setType('announcement');
    setPriority('low');
    setScheduleType('now');
    setScheduledDate('');
    setScheduledTime('');
    setShowCreateForm(false);
    setEditingId(null);
  };

  const handleEditNotification = (notif: AdminNotification) => {
    setTitle(notif.title);
    setMessage(notif.message);
    setAudience(notif.audience);
    if (notif.customSegment) {
      setCustomSegment(notif.customSegment as any);
    }
    setDeliveryTypes(notif.deliveryTypes);
    setType(notif.type);
    setPriority(notif.priority);
    
    if (notif.status === 'scheduled' && notif.scheduledFor) {
      setScheduleType('later');
      const dateObj = new Date(notif.scheduledFor);
      setScheduledDate(dateObj.toISOString().split('T')[0]);
      setScheduledTime(dateObj.toTimeString().split(' ')[0].slice(0, 5));
    } else {
      setScheduleType('now');
    }
    
    setEditingId(notif.id);
    setShowCreateForm(true);
    setSelectedNotification(null);
  };

  const handleSendNotification = async () => {
    if (!title || !message || deliveryTypes.length === 0) {
      alert('Please fill in all required fields and select at least one delivery type.');
      return;
    }

    try {
      const now = new Date().toISOString();
      let scheduledFor = undefined;
      let status = 'sent';
      let sentAt = now;

      if (scheduleType === 'later' && scheduledDate && scheduledTime) {
        scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        status = 'scheduled';
        sentAt = undefined;
      }

      if (editingId) {
        // Update existing notification
        await updateDoc(doc(db, 'adminNotifications', editingId), {
          title,
          message,
          audience,
          customSegment: audience === 'custom' ? customSegment : null,
          deliveryTypes,
          type,
          priority,
          status,
          scheduledFor: scheduledFor || null,
          sentAt: sentAt || null,
        });

        // If it was changed to 'sent' now, we need to process delivery
        if (status === 'sent') {
          // Fetch users based on audience
          let usersQuery = collection(db, 'users');
          const usersSnapshot = await getDocs(usersQuery);
          const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          
          const targetUsers = users.filter(u => {
            if (audience === 'all') return true;
            if (audience === 'custom') {
              if (customSegment === 'active_last_7_days') return true;
              if (customSegment === 'no_active_listings') return u.role === 'landlord';
              if (customSegment === 'pending_payments') return u.role === 'renter';
              return false;
            }
            return u.role === audience;
          });

          const batchSize = 500;
          let processed = 0;
          
          for (const user of targetUsers) {
            if (processed >= batchSize) break;
            
            await addDoc(collection(db, 'notifications'), {
              userId: user.id,
              title,
              message,
              type: type === 'payment_reminder' ? 'payment' : 'system',
              read: false,
              createdAt: new Date().toISOString()
            });
            processed++;
          }

          // Update stats
          await updateDoc(doc(db, 'adminNotifications', editingId), {
            'stats.sent': targetUsers.length,
            'stats.delivered': targetUsers.length
          });
        }
      } else {
        // Create new notification
        const newNotification = {
          title,
          message,
          audience,
          customSegment: audience === 'custom' ? customSegment : null,
          deliveryTypes,
          type,
          priority,
          status,
          scheduledFor: scheduledFor || null,
          sentAt: sentAt || null,
          stats: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0
          },
          createdAt: now
        };

        const docRef = await addDoc(collection(db, 'adminNotifications'), newNotification);

        // If sending now, we should also create actual notifications for users
        if (status === 'sent') {
          // Fetch users based on audience
          let usersQuery = collection(db, 'users');
          const usersSnapshot = await getDocs(usersQuery);
          const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          
          const targetUsers = users.filter(u => {
            if (audience === 'all') return true;
            if (audience === 'custom') {
              // Mock logic for custom segments
              if (customSegment === 'active_last_7_days') return true; // Just mock returning true
              if (customSegment === 'no_active_listings') return u.role === 'landlord';
              if (customSegment === 'pending_payments') return u.role === 'renter';
              return false;
            }
            return u.role === audience;
          });

          // Create notification for each user
          // In a real app, this should be done via a Cloud Function to handle large numbers of users
          const batchSize = 500;
          let processed = 0;
          
          for (const user of targetUsers) {
            if (processed >= batchSize) break; // Limit for client-side demo
            
            await addDoc(collection(db, 'notifications'), {
              userId: user.id,
              title,
              message,
              type: type === 'payment_reminder' ? 'payment' : 'system',
              read: false,
              createdAt: new Date().toISOString()
            });
            processed++;
          }

          // Update stats
          await updateDoc(docRef, {
            'stats.sent': targetUsers.length,
            'stats.delivered': targetUsers.length // Simulating instant delivery for in-app
          });
        }
      }

      resetForm();
    } catch (error) {
      console.error("Error creating notification:", error);
      alert("Failed to create notification.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Sent</span>;
      case 'scheduled': return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Scheduled</span>;
      case 'draft': return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1"><Edit className="w-3 h-3" /> Draft</span>;
      case 'failed': return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Failed</span>;
      default: return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <Bell className="w-4 h-4" />;
      case 'maintenance': return <AlertTriangle className="w-4 h-4" />;
      case 'payment_reminder': return <Calendar className="w-4 h-4" />;
      case 'promotion': return <Send className="w-4 h-4" />;
      case 'security_alert': return <ShieldAlert className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-gray-500 mt-1">Send updates and alerts to users across the platform</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Bell className="w-4 h-4" />
          New Notification
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {showCreateForm ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Notification' : 'Create Notification'}</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., System Maintenance Tonight"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="The platform will be unavailable from 10PM to 12AM..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    ></textarea>
                  </div>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Audience */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="audience" checked={audience === 'all'} onChange={() => setAudience('all')} className="text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700">All Users</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="audience" checked={audience === 'renter'} onChange={() => setAudience('renter')} className="text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700">Tenants Only</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="audience" checked={audience === 'landlord'} onChange={() => setAudience('landlord')} className="text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700">Landlords Only</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="audience" checked={audience === 'custom'} onChange={() => setAudience('custom')} className="text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700">Custom Segment</span>
                      </label>
                    </div>
                    
                    {audience === 'custom' && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <label className="block text-xs font-medium text-gray-700 mb-2">Select Segment</label>
                        <select 
                          value={customSegment}
                          onChange={(e: any) => setCustomSegment(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        >
                          <option value="active_last_7_days">Active in last 7 days</option>
                          <option value="no_active_listings">Landlords with no active listings</option>
                          <option value="pending_payments">Tenants with pending payments</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Delivery Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Channels</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={deliveryTypes.includes('in-app')} onChange={() => handleDeliveryTypeToggle('in-app')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700 flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> In-App Notification</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={deliveryTypes.includes('push')} onChange={() => handleDeliveryTypeToggle('push')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700 flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Push Notification</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={deliveryTypes.includes('email')} onChange={() => handleDeliveryTypeToggle('email')} className="rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</span>
                      </label>
                    </div>
                  </div>

                  {/* Type & Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notification Type</label>
                    <select 
                      value={type}
                      onChange={(e: any) => setType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                      <option value="announcement">Announcement</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="payment_reminder">Payment Reminder</option>
                      <option value="promotion">Promotion</option>
                      <option value="security_alert">Security Alert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select 
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                      <option value="low">Low (Normal Update)</option>
                      <option value="medium">Medium (Important)</option>
                      <option value="high">High (Urgent Alert)</option>
                    </select>
                  </div>
                </div>

                {/* Schedule */}
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
                  <div className="flex items-center gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="schedule" checked={scheduleType === 'now'} onChange={() => setScheduleType('now')} className="text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">Send Now</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="schedule" checked={scheduleType === 'later'} onChange={() => setScheduleType('later')} className="text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">Schedule for Later</span>
                    </label>
                  </div>
                  
                  {scheduleType === 'later' && (
                    <div className="flex gap-3">
                      <input 
                        type="date" 
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                      <input 
                        type="time" 
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 flex justify-end gap-3">
                  <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button 
                    onClick={handleSendNotification}
                    className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {scheduleType === 'now' ? 'Send Notification' : (editingId ? 'Update Schedule' : 'Schedule Notification')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Notification History</h3>
              </div>
              
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications yet</h3>
                  <p className="text-gray-500 mb-6">Start by sending your first update to users.</p>
                  <button 
                    onClick={() => setShowCreateForm(true)}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    Create Notification
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Audience</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {notifications.map((notif) => (
                        <tr key={notif.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedNotification(notif)}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                notif.priority === 'high' ? 'bg-red-50 text-red-600' : 
                                notif.priority === 'medium' ? 'bg-orange-50 text-orange-600' : 
                                'bg-indigo-50 text-indigo-600'
                              }`}>
                                {getTypeIcon(notif.type)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 line-clamp-1">{notif.title}</p>
                                <p className="text-xs text-gray-500 capitalize">{notif.type.replace('_', ' ')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600 capitalize">
                              {notif.audience === 'custom' ? 'Custom Segment' : notif.audience}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(notif.status)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600">
                              {new Date(notif.scheduledFor || notif.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {notif.status === 'scheduled' && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEditNotification(notif); }}
                                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Edit scheduled notification"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedNotification(notif); }}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar / Detail View / Preview */}
        <div className="space-y-6">
          {showCreateForm ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Live Preview
                </h3>
              </div>
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative">
                  {priority === 'high' && (
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
                  )}
                  <div className="flex items-start gap-3 mb-2">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      priority === 'high' ? 'bg-red-100 text-red-600' : 
                      'bg-indigo-100 text-indigo-600'
                    }`}>
                      {getTypeIcon(type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{title || 'Notification Title'}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Just now</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                    {message || 'The notification message will appear here...'}
                  </p>
                </div>
                
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Target Audience:</span>
                    <span className="font-medium text-gray-900 capitalize">
                      {audience === 'custom' ? `Custom: ${customSegment.replace(/_/g, ' ')}` : audience}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Channels:</span>
                    <div className="flex gap-1">
                      {deliveryTypes.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 capitalize">{t}</span>
                      ))}
                      {deliveryTypes.length === 0 && <span className="text-gray-400 italic">None selected</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedNotification ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Notification Details</h3>
                <button onClick={() => setSelectedNotification(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{selectedNotification.title}</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {selectedNotification.message}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Audience</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {selectedNotification.audience === 'custom' 
                        ? `Custom (${selectedNotification.customSegment?.replace(/_/g, ' ') || 'Segment'})` 
                        : selectedNotification.audience}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <div>{getStatusBadge(selectedNotification.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Delivery</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{selectedNotification.deliveryTypes.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedNotification.sentAt || selectedNotification.scheduledFor || selectedNotification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {selectedNotification.stats && (
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" /> Delivery Stats
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Sent</span>
                        <span className="text-sm font-bold text-gray-900">{selectedNotification.stats.sent.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Delivered</span>
                        <span className="text-sm font-bold text-gray-900">{selectedNotification.stats.delivered.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Opened</span>
                        <span className="text-sm font-bold text-gray-900">{selectedNotification.stats.opened.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Clicked</span>
                        <span className="text-sm font-bold text-gray-900">{selectedNotification.stats.clicked.toLocaleString()}</span>
                      </div>
                      
                      {selectedNotification.stats.sent > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500">Open Rate</span>
                            <span className="text-xs font-bold text-indigo-600">
                              {((selectedNotification.stats.opened / selectedNotification.stats.sent) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${(selectedNotification.stats.opened / selectedNotification.stats.sent) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm mb-4">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Communication Hub</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select a notification from the list to view its delivery statistics and performance metrics, or create a new one to reach your users.
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> High deliverability</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Multi-channel support</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Detailed analytics</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
