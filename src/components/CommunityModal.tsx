import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, UserPlus, UserCheck, Image as ImageIcon, Star, Trophy, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { CommunityMember, UserPhoto } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, setDoc, arrayUnion, arrayRemove, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { calculateTier } from '../utils/tier';

interface CommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbUser: any;
}

export const CommunityModal: React.FC<CommunityModalProps> = ({ isOpen, onClose, dbUser }) => {
  const { user: firebaseUser } = useAuth();
  const { sendNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'friends'>('all');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);
  const [viewingGallery, setViewingGallery] = useState<CommunityMember | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!isOpen) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('loyaltyScore', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'User',
        score: doc.data().loyaltyScore || 0,
        avatar: doc.data().photoURL || `https://i.pravatar.cc/150?u=${doc.id}`,
        tier: calculateTier(doc.data().loyaltyScore || 0),
        photos: doc.data().photos || [],
        ...doc.data()
      }));
      setAllUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const friends = useMemo(() => dbUser?.friends || [], [dbUser]);

  const allMembers = useMemo(() => {
    const members = [...allUsers];
    if (dbUser && firebaseUser) {
      const userAsMember: CommunityMember = {
        id: firebaseUser.uid,
        name: dbUser.name || 'You',
        score: dbUser.loyaltyScore || 0,
        avatar: dbUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
        tier: calculateTier(dbUser.loyaltyScore || 0),
        photos: dbUser.photos || []
      };
      
      // Remove any existing entry with the same ID
      const filtered = members.filter(m => m.id !== firebaseUser.uid);
      filtered.push(userAsMember);
      return filtered.sort((a, b) => b.score - a.score);
    }
    return members.sort((a, b) => b.score - a.score);
  }, [dbUser, firebaseUser, allUsers]);

  const filteredMembers = useMemo(() => {
    let list = allMembers;
    if (activeTab === 'friends') {
      list = list.filter(m => friends.includes(m.id) || m.id === firebaseUser?.uid);
    }
    if (searchQuery) {
      list = list.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (selectedTier) {
      list = list.filter(m => m.tier === selectedTier);
    }
    return list;
  }, [activeTab, searchQuery, selectedTier, friends, allMembers, firebaseUser]);

  const myRank = useMemo(() => {
    if (!firebaseUser) return 0;
    const rank = allMembers.findIndex(m => m.id === firebaseUser.uid);
    return rank + 1;
  }, [allMembers, firebaseUser]);

  const myFriendRank = useMemo(() => {
    if (!firebaseUser) return 0;
    const friendList = allMembers.filter(m => friends.includes(m.id) || m.id === firebaseUser.uid);
    const rank = friendList.findIndex(m => m.id === firebaseUser.uid);
    return rank + 1;
  }, [allMembers, friends, firebaseUser]);

  const toggleFriend = async (memberId: string, isFriend: boolean) => {
    if (!firebaseUser) return;
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      await setDoc(userRef, {
        friends: isFriend ? arrayRemove(memberId) : arrayUnion(memberId)
      }, { merge: true });
      sendNotification({
        userId: firebaseUser.uid,
        type: 'FriendUpdate',
        title: isFriend ? 'Friend Removed' : 'Friend Added',
        message: isFriend ? `You are no longer following ${allMembers.find(m => m.id === memberId)?.name}` : `You are now following ${allMembers.find(m => m.id === memberId)?.name}`
      });
    } catch (error) {
      console.error('Error toggling friend:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-wine-cream rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-wine-black/5 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              {viewingGallery ? (
                <button 
                  onClick={() => setViewingGallery(null)}
                  className="p-2 hover:bg-wine-black/5 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-wine-black" />
                </button>
              ) : (
                <div className="w-10 h-10 bg-wine-red/10 rounded-xl flex items-center justify-center text-wine-red">
                  <Users className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-serif font-bold text-wine-black">
                  {viewingGallery ? `${viewingGallery.name}'s Gallery` : 'Savvy Community'}
                </h3>
                {!viewingGallery && <p className="text-wine-black/40 text-[10px] font-bold uppercase tracking-widest">Leaderboard & Friends</p>}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-wine-black/5 rounded-full text-wine-black hover:bg-wine-black/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-wine-red animate-spin" />
                <p className="text-wine-black/40 text-xs font-bold uppercase tracking-widest">Loading Community...</p>
              </div>
            ) : !viewingGallery ? (
              <>
                {/* My Stats Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <motion.div 
                    layout
                    className={`${activeTab === 'all' ? 'bg-wine-black' : 'bg-wine-red'} rounded-3xl p-4 text-white transition-colors duration-500`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {activeTab === 'all' ? <Trophy className="w-3 h-3 text-wine-gold" /> : <Users className="w-3 h-3 text-white/60" />}
                      <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">
                        {activeTab === 'all' ? 'Global Rank' : 'Friend Rank'}
                      </p>
                    </div>
                    <p className="text-2xl font-serif font-bold">#{activeTab === 'all' ? myRank : myFriendRank}</p>
                    <p className="text-[10px] text-white/60">
                      vs {activeTab === 'all' ? allMembers.length : friends.length + 1} {activeTab === 'all' ? 'members' : 'friends'}
                    </p>
                  </motion.div>
                  <motion.div 
                    layout
                    className={`${activeTab === 'all' ? 'bg-wine-red' : 'bg-wine-black'} rounded-3xl p-4 text-white transition-colors duration-500`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {activeTab === 'all' ? <Users className="w-3 h-3 text-white/60" /> : <Star className="w-3 h-3 text-wine-gold" />}
                      <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">
                        {activeTab === 'all' ? 'Friend Rank' : 'Loyalty Score'}
                      </p>
                    </div>
                    <p className="text-2xl font-serif font-bold">
                      {activeTab === 'all' ? `#${myFriendRank}` : (dbUser?.loyaltyScore || 0).toFixed(1)}
                    </p>
                    <p className="text-[10px] text-white/60">
                      {activeTab === 'all' ? `vs ${friends.length} friends` : 'Total points earned'}
                    </p>
                  </motion.div>
                </div>

                {/* Search & Tabs */}
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                    <input 
                      type="text"
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-wine-black/5 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                    />
                  </div>

                  <div className="flex p-1 bg-wine-black/5 rounded-2xl">
                    {(['all', 'friends'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                          activeTab === tab 
                            ? 'bg-white text-wine-black shadow-sm' 
                            : 'text-wine-black/40 hover:text-wine-black'
                        }`}
                      >
                        {tab === 'all' ? 'Leaderboard' : `Friends (${friends.length})`}
                      </button>
                    ))}
                  </div>

                  {/* Tier Filters */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                      onClick={() => setSelectedTier(null)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border ${
                        selectedTier === null 
                          ? 'bg-wine-black text-white border-wine-black' 
                          : 'bg-white text-wine-black/40 border-wine-black/5 hover:border-wine-black/20'
                      }`}
                    >
                      All Tiers
                    </button>
                    {['Novice', 'Connoisseur', 'Master'].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setSelectedTier(tier)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border ${
                          selectedTier === tier 
                            ? 'bg-wine-red text-white border-wine-red shadow-sm' 
                            : 'bg-white text-wine-black/40 border-wine-black/5 hover:border-wine-black/20'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Member List */}
                <div className="space-y-3">
                  {filteredMembers.map((member, i) => {
                    const isFriend = friends.includes(member.id);
                    const isMe = member.id === firebaseUser?.uid;
                    
                    const globalRank = allMembers.findIndex(m => m.id === member.id) + 1;
                    const friendRank = allMembers.filter(m => friends.includes(m.id) || m.id === firebaseUser?.uid).findIndex(m => m.id === member.id) + 1;
                    const displayRank = activeTab === 'all' ? globalRank : friendRank;
                    
                    return (
                      <motion.div
                        key={member.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-3xl p-4 flex items-center justify-between border transition-all group ${
                          isMe 
                            ? 'bg-wine-red/5 border-wine-red/20 shadow-md ring-1 ring-wine-red/10' 
                            : 'bg-white border-wine-black/5 shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                            <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm transition-colors duration-500 ${
                              displayRank === 1 ? 'bg-wine-gold text-wine-black' : 
                              displayRank === 2 ? 'bg-slate-300 text-wine-black' :
                              displayRank === 3 ? 'bg-amber-600 text-white' :
                              'bg-wine-black text-white'
                            }`}>
                              {displayRank}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-wine-black">{member.name}</p>
                              {isMe && (
                                <span className="px-1.5 py-0.5 bg-wine-red text-white text-[8px] font-bold rounded-md uppercase tracking-wider">You</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-wine-gold fill-wine-gold" />
                                <span className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">{member.tier}</span>
                              </div>
                              <span className="text-[10px] font-bold text-wine-red">{member.score} pts</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setViewingGallery(member)}
                            className="p-2 bg-wine-cream rounded-xl text-wine-black hover:bg-wine-red hover:text-white transition-all"
                            title="View Gallery"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                          {!isMe && (
                            <button 
                              onClick={() => toggleFriend(member.id, isFriend)}
                              className={`p-2 rounded-xl transition-all ${
                                isFriend 
                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-red-50 hover:text-red-600' 
                                  : 'bg-wine-black text-white hover:bg-wine-red'
                              }`}
                              title={isFriend ? 'Remove Friend' : 'Add Friend'}
                            >
                              {isFriend ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <div className="text-center py-12 space-y-3">
                      <div className="w-16 h-16 bg-wine-black/5 rounded-full flex items-center justify-center mx-auto text-wine-black/20">
                        <Users className="w-8 h-8" />
                      </div>
                      <p className="text-wine-black/40 text-sm font-medium">No members found</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Gallery View */
              <div className="space-y-6">
                <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-wine-black/5">
                  <img src={viewingGallery.avatar} alt={viewingGallery.name} className="w-16 h-16 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                  <div>
                    <h4 className="text-lg font-bold text-wine-black">{viewingGallery.name}</h4>
                    <p className="text-xs text-wine-black/40 font-medium">{viewingGallery.tier} Member • {viewingGallery.score} Loyalty Score</p>
                  </div>
                </div>

                {viewingGallery.photos && viewingGallery.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {viewingGallery.photos.map((photo, idx) => (
                      <motion.div
                        key={photo.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="group relative aspect-square rounded-3xl overflow-hidden shadow-sm"
                      >
                        <img 
                          src={photo.url} 
                          alt={photo.caption} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-wine-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                          <p className="text-white text-[10px] font-medium line-clamp-2">{photo.caption}</p>
                          <p className="text-white/60 text-[8px] mt-1">{photo.date}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-wine-black/5 rounded-full flex items-center justify-center mx-auto text-wine-black/20">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                    <p className="text-wine-black/40 text-sm font-medium">No photos shared yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
