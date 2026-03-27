import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, addDoc, deleteDoc, orderBy, limit, arrayUnion } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, messaging } from '../firebase';
import { useAuth } from './AuthContext';
import { Notification } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  sendNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => Promise<void>;
  requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Request permission and get token
    const setupMessaging = async () => {
      if (!messaging) return;
      try {
        const permission = await window.Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: 'BC0DaWCzDQFQ7oFxDuiP0e1ibOaYF2-6rB0EdC6w-d68ZKJW5mXDeM8MA3rUTMhOyM4ldfNPIW2gsFKNY_dRWas' // Real VAPID key
          });
          if (token) {
            console.log('FCM Token:', token);
            // Save token to user profile
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              fcmTokens: arrayUnion(token)
            });
          }
        }
      } catch (error) {
        console.error('Error setting up messaging:', error);
      }
    };

    setupMessaging();

    // Listen for foreground messages
    let unsubscribeMessaging = () => {};
    if (messaging) {
      unsubscribeMessaging = onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        // You could show a toast or update local state here
        if (payload.notification) {
          // The notification is already handled by the browser if the app is in background
          // In foreground, we might want to show a custom UI
        }
      });
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, { isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.isRead);
      const promises = unreadNotifs.map(n => 
        updateDoc(doc(db, 'notifications', n.id), { isRead: true })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const sendNotification = async (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
    if (!notification.userId || !notification.type || !notification.title || !notification.message) {
      console.error('Incomplete notification data:', notification);
      return;
    }

    try {
      // 1. Save to Firestore (for in-app history)
      const notificationsRef = collection(db, 'notifications');
      const newDocRef = doc(notificationsRef);
      const id = newDocRef.id;

      await setDoc(newDocRef, {
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link || '',
        metadata: notification.metadata || {},
        id,
        timestamp: new Date().toISOString(),
        isRead: false
      });

      // 2. Send Push Notification via Backend
      // We'll implement this endpoint in server.ts
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: notification.userId,
          title: notification.title,
          body: notification.message,
          data: {
            link: notification.link || '',
            type: notification.type
          }
        }),
      }).catch(err => console.error('Error sending push notification:', err));

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const requestPermission = async () => {
    if (!messaging) return;
    try {
      const permission = await window.Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: 'BC0DaWCzDQFQ7oFxDuiP0e1ibOaYF2-6rB0EdC6w-d68ZKJW5mXDeM8MA3rUTMhOyM4ldfNPIW2gsFKNY_dRWas'
        });
        if (token && user) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(token)
          });
        }
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      deleteNotification,
      sendNotification,
      requestPermission
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
