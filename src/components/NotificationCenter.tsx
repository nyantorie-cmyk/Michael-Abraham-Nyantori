import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, Trash2, Calendar, UserPlus, Star, Tag, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'EventAnnouncement': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'FriendRequest': return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case 'LoyaltyUpdate': return <Star className="w-4 h-4 text-amber-500" />;
      case 'SpecialOffer': return <Tag className="w-4 h-4 text-purple-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-wine-black hover:bg-wine-black/5 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-wine-red text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-wine-black/5 z-50 overflow-hidden"
          >
            <div className="p-4 border-bottom border-wine-black/5 flex items-center justify-between bg-wine-cream/30">
              <h3 className="font-serif font-bold text-wine-black">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-wine-red uppercase tracking-widest hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-wine-black/5 rounded-full">
                  <X className="w-4 h-4 text-wine-black/40" />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-wine-black/5 rounded-2xl flex items-center justify-center mx-auto">
                    <Bell className="w-6 h-6 text-wine-black/20" />
                  </div>
                  <p className="text-sm text-wine-black/40 font-medium">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-wine-black/5">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 flex gap-4 transition-colors hover:bg-wine-black/5 ${!notification.isRead ? 'bg-wine-red/5' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${!notification.isRead ? 'bg-white shadow-sm' : 'bg-wine-black/5'}`}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-xs font-bold truncate ${!notification.isRead ? 'text-wine-black' : 'text-wine-black/60'}`}>
                            {notification.title}
                          </h4>
                          <span className="text-[9px] text-wine-black/40 whitespace-nowrap">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-[11px] text-wine-black/60 leading-relaxed line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                            >
                              <Check className="w-2 h-2" /> Mark read
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="text-[9px] font-bold text-wine-red/40 uppercase tracking-widest flex items-center gap-1 hover:text-wine-red transition-colors"
                          >
                            <Trash2 className="w-2 h-2" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 bg-wine-black/5 text-center">
                <button className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest hover:text-wine-black transition-colors">
                  View all activity
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
