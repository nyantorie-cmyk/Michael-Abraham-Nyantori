import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageCircle, User } from 'lucide-react';
import { WineNews, Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  doc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  news: WineNews | null;
  dbUser?: any;
}

export function NewsModal({ isOpen, onClose, news, dbUser }: NewsModalProps) {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!news || !isOpen) return;

    // Increment view count
    const newsRef = doc(db, 'news', news.id);
    updateDoc(newsRef, {
      views: increment(1)
    }).catch(err => console.error('Error incrementing views:', err));

    const commentsRef = collection(db, 'news', news.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().createdAt?.toDate().toLocaleDateString() || 'Just now'
      })) as Comment[];
      setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, [news, isOpen]);

  if (!news) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;

    try {
      const commentsRef = collection(db, 'news', news.id, 'comments');
      await addDoc(commentsRef, {
        newsId: news.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
        text: commentText,
        createdAt: serverTimestamp()
      });

      // Increment comment count in news document
      const newsRef = doc(db, 'news', news.id);
      await updateDoc(newsRef, {
        commentCount: increment(1)
      });

      setCommentText('');

      // Notify friends about the comment
      const friends = dbUser?.friends || [];
      friends.forEach((friendId: string) => {
        sendNotification({
          userId: friendId,
          type: 'FriendUpdate',
          title: 'Friend Commented on News',
          message: `${user.displayName || 'A friend'} commented on: ${news.title}`,
          link: `/events` // News are shown on home/events
        });
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-md bg-wine-cream rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header Image */}
            <div className="relative h-64 shrink-0">
              <img src={news.image} alt={news.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-wine-black/80 via-transparent to-transparent" />
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="absolute bottom-6 left-6 right-6">
                <span className="inline-block px-3 py-1 bg-wine-red text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-2">
                  {news.category}
                </span>
                <h2 className="text-2xl text-white font-serif font-bold leading-tight">{news.title}</h2>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="flex justify-between items-center text-xs text-wine-black/40 font-medium">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {news.source}
                </span>
                <span>{news.date}</span>
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="text-wine-black/70 leading-relaxed text-base">
                  {news.content}
                </p>
              </div>

              {/* Comment Section */}
              <div className="space-y-6 pt-6 border-t border-wine-black/5">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-wine-red" />
                  <h3 className="font-bold text-lg">Comments ({comments.length})</h3>
                </div>

                {/* Comment Input */}
                {user ? (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-wine-black/5">
                    <form onSubmit={handleAddComment} className="space-y-3">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Share your thoughts..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none min-h-[80px]"
                      />
                      <div className="flex justify-between items-center pt-2 border-t border-wine-black/5">
                        <div className="flex items-center gap-2">
                          <img src={user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`} alt="Me" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                          <span className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">{user.displayName}</span>
                        </div>
                        <button 
                          type="submit"
                          disabled={!commentText.trim()}
                          className="bg-wine-red text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 disabled:grayscale transition-all"
                        >
                          Post <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="bg-wine-black/5 rounded-2xl p-6 text-center">
                    <p className="text-sm text-wine-black/60 mb-3">Sign in to join the conversation</p>
                  </div>
                )}

                {/* Comment List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-center py-8 text-wine-black/30 text-sm italic">No comments yet. Be the first to join the conversation!</p>
                  ) : (
                    comments.map((comment) => (
                      <motion.div 
                        key={comment.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-3"
                      >
                        <img src={comment.userAvatar} alt={comment.userName} className="w-8 h-8 rounded-full shrink-0" referrerPolicy="no-referrer" />
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-wine-black">{comment.userName}</span>
                            <span className="text-[10px] text-wine-black/30">{comment.date}</span>
                          </div>
                          <p className="text-xs text-wine-black/70 leading-relaxed bg-white/50 p-3 rounded-2xl rounded-tl-none">
                            {comment.text}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
