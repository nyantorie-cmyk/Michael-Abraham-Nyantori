import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Star, Trophy, Users } from 'lucide-react';
import { RegistrationModal } from '../components/RegistrationModal';
import { NewsModal } from '../components/NewsModal';
import { CommunityModal } from '../components/CommunityModal';
import { WineNews, WineEvent } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<WineNews | null>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [dynamicNews, setDynamicNews] = useState<WineNews[]>([]);
  const [dynamicEvents, setDynamicEvents] = useState<WineEvent[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const isAdmin = dbUser?.role === 'admin';

  const allEvents = useMemo(() => {
    // Remove duplicates by ID if any
    const unique = dynamicEvents.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
    return unique;
  }, [dynamicEvents]);

  const featuredEvent = allEvents.find(e => !e.isPast) || allEvents[0];
  const myFriends = allUsers.filter(m => dbUser?.friends?.includes(m.id));
  const topMembers = allUsers.slice(0, 5);
  const circleMembers = myFriends.length > 0 ? myFriends.slice(0, 5) : topMembers;

  useEffect(() => {
    const newsRef = collection(db, 'news');
    const q = query(newsRef, orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WineNews[];
      setDynamicNews(fetchedNews);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'news');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WineEvent[];
      setDynamicEvents(fetchedEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'events');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setDbUser(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
    });
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;

    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('loyaltyScore', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'User',
        score: doc.data().loyaltyScore || 0,
        avatar: doc.data().photoURL || `https://i.pravatar.cc/150?u=${doc.id}`,
      }));
      setAllUsers(fetchedUsers);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [firebaseUser]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Hero Banner */}
      <section className="px-6 pt-4">
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 bg-wine-red text-white rounded-2xl flex items-center justify-between shadow-lg shadow-wine-red/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Admin Access</h4>
                <p className="text-[10px] opacity-80">You have administrative privileges.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/admin')}
              className="bg-white text-wine-red px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-wine-cream transition-colors"
            >
              Go to Dashboard
            </button>
          </motion.div>
        )}
        {featuredEvent && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative h-64 rounded-3xl overflow-hidden shadow-xl"
          >
            <img 
              src={featuredEvent.image} 
              alt="Hero" 
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-wine-black/80 via-wine-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <span className="inline-block px-3 py-1 bg-wine-gold text-wine-black text-[10px] font-bold uppercase tracking-widest rounded-full mb-2">
                Upcoming Event
              </span>
              <h2 className="text-2xl text-white font-serif font-bold mb-1">{featuredEvent.title}</h2>
              <p className="text-white/80 text-sm mb-4">{featuredEvent.date} • {featuredEvent.location}</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-white text-wine-black px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-wine-gold transition-colors"
              >
                Register Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </section>

      {/* News Highlight */}
      <section className="space-y-4">
        <div className="px-6 flex justify-between items-end">
          <div>
            <h3 className="text-xl font-bold">Wine News</h3>
            <p className="text-wine-black/40 text-xs">Latest updates from the industry</p>
          </div>
          <button className="text-wine-red text-sm font-semibold flex items-center gap-1">
            Read More <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide snap-x snap-mandatory">
          {dynamicNews.length > 0 ? (
            dynamicNews.map((item, i) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedNews(item)}
                className="min-w-[280px] bg-white rounded-3xl overflow-hidden shadow-sm border border-wine-black/5 snap-center cursor-pointer active:scale-95 transition-transform"
              >
                <div className="h-32 relative">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-bold uppercase tracking-widest text-wine-red">
                    {item.category}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-wine-black/40 font-medium">
                    <span>{item.source}</span>
                    <span>{item.date}</span>
                  </div>
                  <h4 className="font-serif font-bold text-wine-black leading-tight line-clamp-2">{item.title}</h4>
                  <p className="text-wine-black/60 text-xs line-clamp-2 leading-relaxed">{item.summary}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="w-full py-12 flex flex-col items-center justify-center text-wine-black/20">
              <ArrowRight className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No news available</p>
            </div>
          )}
        </div>
      </section>

      {/* Community Section */}
      <section className="space-y-4">
        <div className="px-6 flex justify-between items-end">
          <div>
            <h3 className="text-xl font-bold">Community</h3>
            <p className="text-wine-black/40 text-xs">Top members & recent activity</p>
          </div>
          <button 
            onClick={() => setIsCommunityModalOpen(true)}
            className="text-wine-red text-sm font-semibold flex items-center gap-1"
          >
            Leaderboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6">
          <div className="bg-wine-cream rounded-[2rem] p-6 border border-wine-black/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-wine-black">My Circle</p>
                  <p className="text-[10px] text-wine-black/40 font-medium">{myFriends.length} Friends</p>
                </div>
              </div>
              <div className="flex -space-x-3">
                {circleMembers.map((member, i) => (
                  <img 
                    key={member.id}
                    src={member.avatar} 
                    alt={member.name}
                    className="w-8 h-8 rounded-full border-2 border-wine-cream object-cover"
                    referrerPolicy="no-referrer"
                  />
                ))}
                {myFriends.length > 5 && (
                  <div className="w-8 h-8 rounded-full border-2 border-wine-cream bg-wine-black flex items-center justify-center text-[8px] font-bold text-white">
                    +{myFriends.length - 5}
                  </div>
                )}
                {myFriends.length === 0 && (
                  <div className="w-8 h-8 rounded-full border-2 border-wine-cream bg-wine-black/5 flex items-center justify-center text-[8px] font-bold text-wine-black/20">
                    0
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {circleMembers.slice(0, 3).map((member, i) => (
                <div key={member.id} className="bg-white rounded-2xl p-3 flex items-center justify-between border border-wine-black/5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      {myFriends.length === 0 && (
                        <div className="absolute -top-1 -left-1 w-5 h-5 bg-wine-gold rounded-full flex items-center justify-center text-[10px] font-bold text-wine-black border-2 border-white">
                          {i + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-wine-black">{member.name}</p>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-wine-gold fill-wine-gold" />
                        <span className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">{member.tier}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-wine-red">{member.score}</p>
                    <p className="text-[8px] font-bold text-wine-black/20 uppercase tracking-widest">Score</p>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setIsCommunityModalOpen(true)}
              className="w-full py-3 bg-wine-black text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-wine-red transition-colors"
            >
              <Users className="w-4 h-4" /> Join the Conversation
            </button>
          </div>
        </div>
      </section>

      {featuredEvent && (
        <RegistrationModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          event={featuredEvent} 
        />
      )}

      <NewsModal
        isOpen={!!selectedNews}
        onClose={() => setSelectedNews(null)}
        news={selectedNews}
        dbUser={dbUser}
      />

      <CommunityModal
        isOpen={isCommunityModalOpen}
        onClose={() => setIsCommunityModalOpen(false)}
        dbUser={dbUser}
      />
    </div>
  );
}
