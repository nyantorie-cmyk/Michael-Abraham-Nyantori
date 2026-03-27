import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Calendar, MapPin, ChevronRight, History, Share2, Facebook, Twitter, MessageCircle, X, Link as LinkIcon, Clock, Users, Star, Loader2, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RegistrationModal } from '../components/RegistrationModal';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { WineEvent, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WineEvent;
}

function ShareModal({ isOpen, onClose, event }: ShareModalProps) {
  const shareUrl = window.location.href;
  const shareText = `Check out this event: ${event.title} at ${event.location}`;

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: <MessageCircle className="w-5 h-5" />,
      color: 'bg-[#25D366]',
      url: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`
    },
    {
      name: 'Facebook',
      icon: <Facebook className="w-5 h-5" />,
      color: 'bg-[#1877F2]',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'Twitter',
      icon: <Twitter className="w-5 h-5" />,
      color: 'bg-[#1DA1F2]',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'Copy Link',
      icon: <LinkIcon className="w-5 h-5" />,
      color: 'bg-wine-black',
      onClick: () => {
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    }
  ];

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
            className="relative w-full max-w-sm bg-wine-cream rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold text-wine-black">Share Event</h3>
              <button 
                onClick={onClose}
                className="p-2 bg-wine-black/5 rounded-full text-wine-black hover:bg-wine-black/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {shareLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (link.onClick) {
                      e.preventDefault();
                      link.onClick();
                    }
                  }}
                  className="flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-wine-black/5 hover:border-wine-red/20 hover:shadow-md transition-all group"
                >
                  <div className={`${link.color} text-white p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
                    {link.icon}
                  </div>
                  <span className="text-xs font-bold text-wine-black">{link.name}</span>
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface EventCardProps {
  event: WineEvent;
  index: number;
  activeTab: 'upcoming' | 'past';
  onRegister: (event: WineEvent) => void;
  onShare: (event: WineEvent) => void;
  isSaved: boolean;
  onToggleSave: (eventId: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, index, activeTab, onRegister, onShare, isSaved, onToggleSave }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -12, scale: 1.01 }}
      transition={{ 
        delay: index * 0.05,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1]
      }}
      className="group relative h-[520px] rounded-[3.5rem] overflow-hidden shadow-xl hover:shadow-3xl transition-all duration-700 border border-wine-black/5"
    >
      <div className="absolute inset-0 overflow-hidden">
        <motion.img 
          style={{ y }}
          src={event.image} 
          alt={event.title} 
          className="absolute inset-0 w-full h-[120%] object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-wine-black via-wine-black/60 to-transparent opacity-85 group-hover:opacity-95 transition-opacity duration-700" />
        <div className="absolute inset-0 bg-wine-red/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      </div>
      
      <div className="relative h-full p-10 flex flex-col justify-end">
        <div className="absolute top-10 left-10 right-10 flex justify-between items-start">
          <div className="flex flex-col gap-3">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white/95 backdrop-blur-2xl px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl border border-white/30"
            >
              <Calendar className="w-4 h-4 text-wine-red" />
              <span className="text-xs font-bold text-wine-black tracking-tight">{event.date}</span>
            </motion.div>
            {event.price !== undefined && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-wine-red text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 shadow-2xl w-fit border border-wine-red/20"
              >
                <span className="text-xs font-bold tracking-tight">
                  {typeof event.price === 'number' ? `$${event.price}` : event.price}
                </span>
              </motion.div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(event.id);
            }}
            className={`p-4 rounded-2xl backdrop-blur-2xl transition-all duration-500 shadow-2xl border border-white/30 active:scale-90 ${
              isSaved ? 'bg-wine-red text-white' : 'bg-white/90 text-wine-black hover:bg-wine-red hover:text-white'
            }`}
          >
            <Heart className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="space-y-6 mb-10 transform group-hover:translate-y-[-8px] transition-transform duration-700 ease-out">
          <div className="space-y-4">
            <h3 className="text-4xl sm:text-5xl font-serif font-bold text-white leading-tight drop-shadow-2xl tracking-tight">{event.title}</h3>
            <div className="flex items-center gap-3 text-white/90 text-sm font-semibold">
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-xl border border-white/10 shadow-lg">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="drop-shadow-md">{event.location}</span>
            </div>
          </div>

          {(event.hosts && event.hosts.length > 0 || event.specialGuest) && (
            <div className="flex flex-wrap gap-3 py-1">
              {event.hosts && event.hosts.length > 0 && (
                <div className="flex items-center gap-2.5 bg-white/15 backdrop-blur-2xl px-4 py-2.5 rounded-xl border border-white/10 shadow-lg">
                  <Users className="w-4 h-4 text-wine-gold" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                    {event.hosts.join(' • ')}
                  </span>
                </div>
              )}
              {event.specialGuest && (
                <div className="flex items-center gap-2.5 bg-wine-red/50 backdrop-blur-2xl px-4 py-2.5 rounded-xl border border-wine-red/30 shadow-lg">
                  <Star className="w-4 h-4 text-wine-gold fill-wine-gold" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                    Guest: {event.specialGuest}
                  </span>
                </div>
              )}
            </div>
          )}

          <p className="text-white/80 text-base line-clamp-2 leading-relaxed font-medium max-w-[90%] drop-shadow-md">
            {event.description}
          </p>
        </div>
        
        <div className="flex gap-5 items-center">
          {activeTab === 'upcoming' ? (
            <button 
              onClick={() => onRegister(event)}
              className="flex-1 bg-wine-gold text-wine-black py-5 rounded-[1.75rem] font-bold hover:bg-white transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl shadow-wine-gold/30 active:scale-95 group/btn"
            >
              Register Now 
              <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button className="flex-1 bg-white/15 backdrop-blur-xl text-white py-5 rounded-[1.75rem] font-bold hover:bg-white/25 transition-all duration-500 flex items-center justify-center gap-3 border border-white/10 active:scale-95">
              View Highlights <History className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => onShare(event)}
            className="p-5 bg-white/15 backdrop-blur-xl rounded-[1.75rem] text-white hover:bg-wine-red hover:scale-110 transition-all duration-500 border border-white/10 active:scale-95 shadow-xl"
            title="Share Event"
          >
            <Share2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default function Events() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [dynamicEvents, setDynamicEvents] = useState<WineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<WineEvent | null>(null);
  const [registeringEvent, setRegisteringEvent] = useState<WineEvent | null>(null);

  const savedEvents = (user as any)?.savedEvents || [];

  const handleToggleSave = async (eventId: string) => {
    if (!user) {
      alert('Please sign in to save events');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const isSaved = savedEvents.includes(eventId);

    try {
      await updateDoc(userRef, {
        savedEvents: isSaved ? arrayRemove(eventId) : arrayUnion(eventId)
      });
    } catch (error) {
      console.error('Error toggling save event:', error);
    }
  };

  useEffect(() => {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WineEvent[];
      setDynamicEvents(fetchedEvents);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'events');
    });
    return () => unsubscribe();
  }, []);

  const allEvents = useMemo(() => {
    // Remove duplicates by ID if any
    const unique = dynamicEvents.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
    return unique;
  }, [dynamicEvents]);
  
  const filteredEvents = allEvents.filter(e => activeTab === 'upcoming' ? !e.isPast : e.isPast);

  if (loading && dynamicEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-wine-red" />
        <p className="text-wine-black/40 text-sm font-bold uppercase tracking-widest">Loading Events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 pt-6 pb-20 overflow-hidden">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-4xl font-serif font-bold text-wine-black tracking-tight">Events</h2>
          <p className="text-xs font-bold text-wine-black/30 uppercase tracking-[0.2em]">Discover Experiences</p>
        </div>
        <div className="flex bg-wine-black/5 p-1.5 rounded-2xl backdrop-blur-sm">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-2 rounded-xl text-[11px] font-bold transition-all duration-500 ${activeTab === 'upcoming' ? 'bg-white shadow-xl text-wine-red' : 'text-wine-black/40 hover:text-wine-black'}`}
          >
            Upcoming
          </button>
          <button 
            onClick={() => setActiveTab('past')}
            className={`px-6 py-2 rounded-xl text-[11px] font-bold transition-all duration-500 ${activeTab === 'past' ? 'bg-white shadow-xl text-wine-red' : 'text-wine-black/40 hover:text-wine-black'}`}
          >
            Past
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {filteredEvents.map((event, i) => (
          <EventCard 
            key={event.id}
            event={event}
            index={i}
            activeTab={activeTab}
            onRegister={(ev) => setRegisteringEvent(ev)}
            onShare={(ev) => setSelectedEvent(ev)}
            isSaved={savedEvents.includes(event.id)}
            onToggleSave={handleToggleSave}
          />
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-24 text-center space-y-8 bg-wine-cream/50 rounded-[4rem] border-2 border-dashed border-wine-black/5 mx-2"
        >
          <div className="w-24 h-24 bg-wine-red/5 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Calendar className="w-12 h-12 text-wine-red/20" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-serif font-bold text-wine-black">No {activeTab} events found</h3>
            <p className="text-wine-black/40 text-sm max-w-[240px] mx-auto font-medium leading-relaxed">
              We don't have any events in this category right now. Check back soon for new experiences!
            </p>
          </div>
          <button 
            onClick={() => setActiveTab(activeTab === 'upcoming' ? 'past' : 'upcoming')}
            className="px-10 py-4 bg-wine-black text-white rounded-[1.5rem] text-xs font-bold hover:bg-wine-red transition-all duration-500 shadow-2xl shadow-wine-black/20 active:scale-95"
          >
            View {activeTab === 'upcoming' ? 'Past' : 'Upcoming'} Events
          </button>
        </motion.div>
      )}

      {selectedEvent && (
        <ShareModal 
          isOpen={!!selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
          event={selectedEvent} 
        />
      )}

      {registeringEvent && (
        <RegistrationModal 
          isOpen={!!registeringEvent} 
          onClose={() => setRegisteringEvent(null)} 
          event={registeringEvent} 
        />
      )}
    </div>
  );
}
