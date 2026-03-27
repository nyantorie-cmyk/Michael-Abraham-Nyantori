import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, MapPin, ChevronRight, X, Clock, Users, Star, DollarSign, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WineEvent } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { collection, addDoc, serverTimestamp, doc, getDoc, increment, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeData } from '../firebase';
import { Check } from 'lucide-react';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WineEvent;
}

export function RegistrationModal({ isOpen, onClose, event }: RegistrationModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);
  const [hasTicket, setHasTicket] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && user) {
      const checkExistingTicket = async () => {
        setIsChecking(true);
        try {
          const q = query(
            collection(db, 'tickets'),
            where('userId', '==', user.uid),
            where('eventId', '==', event.id)
          );
          const querySnapshot = await getDocs(q);
          setHasTicket(!querySnapshot.empty);
        } catch (error) {
          console.error('Error checking existing ticket:', error);
          handleFirestoreError(error, OperationType.GET, 'tickets');
        } finally {
          setIsChecking(false);
        }
      };
      checkExistingTicket();
    }
  }, [isOpen, user, event.id]);

  const handleRegister = async () => {
    if (!user) {
      navigate('/profile');
      onClose();
      return;
    }

    if (hasTicket) return;

    try {
      // Get or create membership ID
      let membershipId = '';
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && userSnap.data().membershipId) {
        membershipId = userSnap.data().membershipId;
      } else {
        // Generate new sequential ID
        const counterRef = doc(db, 'counters', 'membership');
        const { runTransaction } = await import('firebase/firestore');
        
        membershipId = await runTransaction(db, async (transaction) => {
          const counterSnap = await transaction.get(counterRef);
          let nextSeq = 1;
          
          if (counterSnap.exists()) {
            nextSeq = (counterSnap.data().seq || 0) + 1;
          }
          
          transaction.set(counterRef, { seq: nextSeq }, { merge: true });
          const formattedId = `SV${nextSeq.toString().padStart(4, '0')}`;
          
          // Also update user profile in the same transaction
          transaction.update(userRef, { membershipId: formattedId });
          
          return formattedId;
        });
      }

      // Create registration
      await addDoc(collection(db, 'registrations'), sanitizeData({
        eventId: event.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userEmail: user.email,
        membershipId: membershipId,
        createdAt: serverTimestamp()
      }));

      // Update user profile with attended events count
      await updateDoc(userRef, sanitizeData({
        attendedEvents: increment(1)
      }));

      // Increment attendee count in event document
      const eventRef = doc(db, 'events', event.id);
      await updateDoc(eventRef, sanitizeData({
        attendeeCount: increment(1)
      })).catch(err => console.error('Error incrementing attendeeCount:', err));

      // Create ticket
      const ticketId = Math.random().toString(36).substring(2, 15);
      await addDoc(collection(db, 'tickets'), sanitizeData({
        id: ticketId,
        userId: user.uid,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time || '',
        eventLocation: event.location,
        eventVenue: event.venue || event.location,
        qrCode: `SAVVY-${event.id}-${user.uid}-${ticketId}`,
        purchaseDate: new Date().toISOString(),
        paymentStatus: 'pending',
        price: event.price || 0,
        membershipId: membershipId
      }));

      // Send notification
      await sendNotification({
        userId: user.uid,
        type: 'EventAnnouncement',
        title: 'Booking Confirmed',
        message: `Your booking for "${event.title}" is confirmed! You can find your ticket and payment status in your profile.`,
        link: '/profile'
      });

      // Notify friends
      if (userSnap.exists()) {
        const friends = userSnap.data().friends || [];
        friends.forEach((friendId: string) => {
          sendNotification({
            userId: friendId,
            type: 'FriendUpdate',
            title: 'Friend Booked an Event',
            message: `${user.displayName || 'A friend'} booked ${event.title}!`,
            link: `/community/member/${user.uid}`
          });
        });
      }

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        navigate('/profile');
      }, 1500);
    } catch (error) {
      console.error('Error registering:', error);
      handleFirestoreError(error, OperationType.WRITE, 'registrations');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 100 }}
            className="relative w-full max-w-md bg-wine-cream rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header Image */}
            <div className="h-40 relative">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-wine-cream to-transparent" />
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"
                  >
                    <Check className="w-10 h-10" />
                  </motion.div>
                  <h3 className="text-xl font-serif font-bold text-wine-black text-center">Booking Confirmed!</h3>
                  <p className="text-wine-black/40 text-sm text-center">Redirecting to your profile for payment...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-serif font-bold text-wine-black">{event.title}</h3>
                    <p className="text-wine-black/60 text-sm leading-relaxed">{event.description}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-wine-black/5">
                      <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40">Date</p>
                        <p className="text-sm font-bold text-wine-black">{event.date}</p>
                      </div>
                    </div>

                    {event.time && (
                      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-wine-black/5">
                        <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40">Time</p>
                          <p className="text-sm font-bold text-wine-black">{event.time}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-wine-black/5">
                      <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40">Venue</p>
                        <p className="text-sm font-bold text-wine-black">{event.venue || event.location}</p>
                        <p className="text-[10px] text-wine-black/40">{event.location}</p>
                      </div>
                    </div>

                    {event.hosts && event.hosts.length > 0 && (
                      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-wine-black/5">
                        <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40">Hosts</p>
                          <p className="text-sm font-bold text-wine-black">{event.hosts.join(', ')}</p>
                        </div>
                      </div>
                    )}

                    {event.specialGuest && (
                      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-wine-black/5">
                        <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                          <Star className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40">Special Guest</p>
                          <p className="text-sm font-bold text-wine-black">{event.specialGuest}</p>
                        </div>
                      </div>
                    )}

                    {event.price !== undefined && (
                      <div className="flex items-center gap-4 p-4 bg-wine-red/5 rounded-2xl border border-wine-red/10">
                        <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-wine-red/60">Ticket Price</p>
                          <p className="text-xl font-bold text-wine-red">
                            {typeof event.price === 'number' ? `$${event.price}` : event.price}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleRegister}
                    disabled={isChecking || hasTicket}
                    className={`w-full py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                      hasTicket 
                        ? 'bg-wine-black/5 text-wine-black/40 cursor-not-allowed'
                        : 'bg-wine-black text-white shadow-wine-black/20 hover:bg-wine-red'
                    }`}
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking...
                      </>
                    ) : hasTicket ? (
                      'Already Booked'
                    ) : (
                      <>
                        {user ? 'Book Ticket' : 'Sign in to Register'} <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
