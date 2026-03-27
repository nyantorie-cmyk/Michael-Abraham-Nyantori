import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Award, History, Star, Mail, Lock, ArrowRight, X, Phone, User, ShieldCheck, Camera, Plus, Image as ImageIcon, MapPin, Tag, Trophy, Medal, CheckCircle2, Ticket as TicketIcon, Download, QrCode, Trash2, Loader2, Share2, Calendar, ShoppingBag, Hash, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { UserPhoto, Ticket } from '../types';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, setDoc, deleteDoc, increment, arrayUnion, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MOCK_USER } from '../constants';
import { QRCodeSVG } from 'qrcode.react';
import { calculateTier } from '../utils/tier';
import { ImageEditor } from '../components/ImageEditor';

export default function Profile() {
  const navigate = useNavigate();
  const { 
    user: firebaseUser, 
    loading: authLoading, 
    signIn, 
    signInWithEmail, 
    signUpWithEmail, 
    resetPassword, 
    signInWithPhone,
    updateUserProfile,
    logout 
  } = useAuth();
  const { sendNotification, requestPermission } = useNotifications();

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'phone'>('login');
  const [authFormData, setAuthFormData] = useState({ email: '', password: '', name: '', phone: '', otp: '' });
  const [resetStep, setResetStep] = useState<'form' | 'success'>('form');
  const [phoneStep, setPhoneStep] = useState<'number' | 'otp'>('number');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [user, setUser] = useState(MOCK_USER);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [dbUser, setDbUser] = useState<any>(null);
  const [dynamicEvents, setDynamicEvents] = useState<any[]>([]);
  const [dynamicStores, setDynamicStores] = useState<any[]>([]);
  const isAdmin = dbUser?.role === 'admin';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [claimStatus, setClaimStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isMembershipDetailsOpen, setIsMembershipDetailsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const momentFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingMoment, setIsUploadingMoment] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editingImageType, setEditingImageType] = useState<'profile' | 'moment' | null>(null);

  const handleCropComplete = async (croppedImage: string) => {
    const type = editingImageType;
    setEditingImage(null);
    setEditingImageType(null);

    if (type === 'moment') {
      setPhotoFormData({ 
        ...photoFormData, 
        imagePreview: croppedImage
      });
    } else if (type === 'profile') {
      if (!firebaseUser) return;
      setIsUploading(true);
      try {
        // Update Firebase Auth
        await updateUserProfile({ photoURL: croppedImage });
        
        // Update Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userRef, { photoURL: croppedImage });
        
        // Notify friends about profile picture change
        const friends = dbUser?.friends || [];
        friends.forEach((friendId: string) => {
          sendNotification({
            userId: friendId,
            type: 'FriendUpdate',
            title: 'Friend Updated Profile',
            message: `${displayUser.name} updated their profile picture!`,
            link: `/profile/${firebaseUser.uid}`
          });
        });
      } catch (error) {
        console.error('Error updating profile picture:', error);
        setUploadError('Failed to update profile picture.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      // Real-time user data listener
      const userRef = doc(db, 'users', firebaseUser.uid);
      const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setDbUser(userData);
          setPhotos(userData.photos || []);
        } else {
          // If user doc doesn't exist, create it with mock data
          const initialUser = {
            ...MOCK_USER,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            referralCode: firebaseUser.uid.slice(-4).toUpperCase(),
            createdAt: new Date().toISOString(),
            photos: [] // New users start with no photos
          };
          setDoc(userRef, initialUser);
          setDbUser(initialUser);
          setPhotos([]);
        }
      });

      // Real-time tickets listener
      const q = query(collection(db, 'tickets'), where('userId', '==', firebaseUser.uid));
      const unsubscribeTickets = onSnapshot(q, (snapshot) => {
        const ticketData = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.data().id || doc.id, // Ensure id is present
          _firestoreId: doc.id // Store Firestore ID for easier deletion
        } as Ticket & { _firestoreId: string }));
        setTickets(ticketData);
      });

      return () => {
        unsubscribeUser();
        unsubscribeTickets();
      };
    }
  }, [firebaseUser]);

  useEffect(() => {
    // Fetch events for tagging
    const unsubscribeEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      setDynamicEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch stores for tagging
    const unsubscribeStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setDynamicStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeEvents();
      unsubscribeStores();
    };
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);
    try {
      if (authMode === 'login') {
        await signInWithEmail(authFormData.email, authFormData.password);
      } else if (authMode === 'signup') {
        await signUpWithEmail(authFormData.email, authFormData.password, authFormData.name);
      } else if (authMode === 'forgot') {
        await resetPassword(authFormData.email);
        setResetStep('success');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);
    try {
      if (phoneStep === 'number') {
        const result = await signInWithPhone(authFormData.phone, 'recaptcha-container');
        setConfirmationResult(result);
        setPhoneStep('otp');
      } else {
        await confirmationResult.confirm(authFormData.otp);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during phone authentication');
    } finally {
      setIsProcessing(false);
    }
  };
  const [photos, setPhotos] = useState<UserPhoto[]>(user.photos || [
    {
      id: '1',
      url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800',
      caption: 'Amazing wine tasting at the vineyard!',
      date: '2024-03-10',
      tag: { type: 'Event', name: 'Sunset Vineyard Tasting' }
    },
    {
      id: '2',
      url: 'https://images.unsplash.com/photo-1506377247377-2a5b3b0ca7df?auto=format&fit=crop&q=80&w=800',
      caption: 'The selection here is incredible.',
      date: '2024-03-08',
      tag: { type: 'Shop', name: 'The Wine Cellar' }
    }
  ]);

  const [photoFormData, setPhotoFormData] = useState({
    caption: '',
    tagType: 'Shop' as 'Shop' | 'Hotel' | 'Event',
    tagName: '',
    imageUrl: '',
    imageFile: null as File | null,
    imagePreview: ''
  });

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    setIsUploadingMoment(true);

    try {
      let finalImageUrl = photoFormData.imageUrl;

      if (photoFormData.imageFile) {
        // Handle file upload (base64 for now as per project pattern)
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(photoFormData.imageFile!);
        });
        finalImageUrl = await base64Promise;
      }

      const newPhoto: UserPhoto = {
        id: Date.now().toString(),
        url: finalImageUrl || `https://picsum.photos/seed/${Date.now()}/800/800`,
        caption: photoFormData.caption,
        date: new Date().toISOString().split('T')[0],
        tag: photoFormData.tagName ? {
          type: photoFormData.tagType,
          name: photoFormData.tagName
        } : undefined
      };

      // Update Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        photos: arrayUnion(newPhoto)
      });

      // Update local state
      setPhotos([newPhoto, ...photos]);
      setIsAddingPhoto(false);
      setPhotoFormData({ 
        caption: '', 
        tagType: 'Shop', 
        tagName: '', 
        imageUrl: '', 
        imageFile: null, 
        imagePreview: '' 
      });

      // Notify friends about photo upload
      const friends = dbUser?.friends || [];
      friends.forEach((friendId: string) => {
        sendNotification({
          userId: friendId,
          type: 'FriendUpdate',
          title: 'New Photo Shared',
          message: `${displayUser.name} shared a new wine moment!`,
          link: `/community/member/${firebaseUser.uid}`
        });
      });

      sendNotification({
        userId: firebaseUser.uid,
        type: 'General',
        title: 'Moment Shared!',
        message: 'Your wine moment has been shared to your profile.'
      });
    } catch (err) {
      console.error("Error sharing moment:", err);
      alert("Failed to share moment. Please try again.");
    } finally {
      setIsUploadingMoment(false);
    }
  };
  const [editFormData, setEditFormData] = useState({
    name: user.name,
    phone: user.phone,
    type: user.type,
    city: user.city || '',
    businessName: '',
    businessLocation: ''
  });

  const handlePayment = async () => {
    if (!selectedTicket || !phoneNumber || !firebaseUser) return;

    setIsPaying(true);
    setPaymentMessage(null);

    try {
      const response = await fetch('/api/payment/ussd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          amount: selectedTicket.price || 45,
          ticketId: selectedTicket.id
        })
      });

      const data = await response.json();

      if (response.ok) {
        setPaymentMessage({ type: 'success', text: data.message });
        
        // Simulate waiting for user to confirm on phone
        setTimeout(async () => {
          try {
            // Find the ticket document in Firestore to update status
            const ticketsRef = collection(db, 'tickets');
            const q = query(
              ticketsRef, 
              where('id', '==', selectedTicket.id),
              where('userId', '==', firebaseUser.uid)
            );
            
            // We'll use getDocs to find the doc ID
            const snap = await getDocs(q);
            if (!snap.empty) {
              const docId = snap.docs[0].id;
              const docRef = doc(db, 'tickets', docId);
              try {
                await updateDoc(docRef, { paymentStatus: 'paid' });
                setSelectedTicket(prev => prev ? { ...prev, paymentStatus: 'paid' } : null);
                setShowPaymentForm(false);

                // Send confirmation email after payment
                if (firebaseUser.email) {
                  fetch('/api/email/send-ticket', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: firebaseUser.email,
                      userName: firebaseUser.displayName || 'Anonymous',
                      eventTitle: selectedTicket.eventTitle,
                      eventDate: selectedTicket.eventDate,
                      eventTime: selectedTicket.eventTime || '',
                      eventLocation: selectedTicket.eventLocation,
                      ticketId: selectedTicket.id,
                      qrCode: selectedTicket.qrCode
                    })
                  }).catch(err => console.error('Error sending confirmation email:', err));
                }
              } catch (updateErr: any) {
                console.error('Error updating ticket status in Firestore:', updateErr);
                setPaymentMessage({ type: 'error', text: 'Failed to update ticket status.' });
                handleFirestoreError(updateErr, OperationType.WRITE, `tickets/${docId}`);
              }
            } else {
              setPaymentMessage({ type: 'error', text: 'Ticket not found in database.' });
            }
          } catch (e: any) {
            console.error('Error finding ticket:', e);
            setPaymentMessage({ type: 'error', text: 'Failed to access ticket information.' });
            handleFirestoreError(e, OperationType.GET, 'tickets');
          }
        }, 3000);
      } else {
        setPaymentMessage({ type: 'error', text: data.error || 'Payment failed' });
      }
    } catch (error) {
      setPaymentMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsPaying(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicket || !firebaseUser) return;
    setIsDeleting(true);
    try {
      // Use the stored Firestore ID if available, otherwise fallback to query
      const firestoreId = (selectedTicket as any)._firestoreId;
      
      if (firestoreId) {
        await deleteDoc(doc(db, 'tickets', firestoreId));
      } else {
        const ticketsRef = collection(db, 'tickets');
        // Add userId filter to the query to satisfy security rules
        const q = query(ticketsRef, where('id', '==', selectedTicket.id), where('userId', '==', firebaseUser.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docRef = doc(db, 'tickets', snap.docs[0].id);
          await deleteDoc(docRef);
        }
      }
      
      setSelectedTicket(null);
      setShowDeleteConfirm(false);
    } catch (e) {
      console.error('Error deleting ticket:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const checkTierChange = (oldScore: number, newScore: number) => {
    const oldTier = calculateTier(oldScore);
    const newTier = calculateTier(newScore);

    if (oldTier !== newTier) {
      // Notify user
      sendNotification({
        userId: firebaseUser!.uid,
        type: 'LoyaltyUpdate',
        title: 'New Loyalty Tier Achieved!',
        message: `Congratulations! You've reached the ${newTier} tier.`,
        link: '/profile'
      });

      // Notify friends
      const friends = dbUser?.friends || [];
      friends.forEach((friendId: string) => {
        sendNotification({
          userId: friendId,
          type: 'FriendUpdate',
          title: 'Friend Achieved New Tier',
          message: `${displayUser.name} just reached the ${newTier} tier!`,
          link: `/community/member/${firebaseUser!.uid}`
        });
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firebaseUser) {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const hasEarnedReward = dbUser?.hasEarnedProfileReward || false;
        
        const updateData: any = {
          name: editFormData.name,
          phone: editFormData.phone,
          type: editFormData.type,
          city: editFormData.city,
          businessName: editFormData.type === 'Business' ? editFormData.businessName : null,
          businessLocation: editFormData.type === 'Business' ? editFormData.businessLocation : null,
        };

        if (!hasEarnedReward) {
          const oldScore = dbUser?.loyaltyScore || 0;
          const newScore = oldScore + 0.1;
          updateData.loyaltyScore = increment(0.1);
          updateData.hasEarnedProfileReward = true;
          
          sendNotification({
            userId: firebaseUser.uid,
            type: 'LoyaltyUpdate',
            title: 'Loyalty Score Boost!',
            message: 'You earned +0.1 points for updating your profile!',
            metadata: { newScore: newScore.toFixed(1) }
          });

          checkTierChange(oldScore, newScore);
        }

        await updateDoc(userRef, updateData);
        
        // Notify friends about profile update
        const friends = dbUser?.friends || [];
        friends.forEach((friendId: string) => {
          sendNotification({
            userId: friendId,
            type: 'FriendUpdate',
            title: 'Friend Updated Profile',
            message: `${displayUser.name} updated their profile information!`,
            link: `/community/member/${firebaseUser.uid}`
          });
        });

        setDbUser({
          ...dbUser,
          ...updateData,
          loyaltyScore: !hasEarnedReward ? (dbUser?.loyaltyScore || 0) + 0.1 : (dbUser?.loyaltyScore || 0)
        });
      } catch (err: any) {
        console.error('Error saving profile:', err);
        if (err.message?.includes('insufficient permissions')) {
          const errInfo = {
            error: err.message,
            userId: firebaseUser.uid,
            path: `users/${firebaseUser.uid}`,
            operation: 'update'
          };
          console.error('Firestore Permission Error Details:', JSON.stringify(errInfo));
        }
      }
    }
    setIsEditing(false);
  };

  const handleClaimPoints = async (e?: React.FormEvent, scannedCode?: string) => {
    if (e) e.preventDefault();
    const codeToClaim = scannedCode || claimCode;
    if (!firebaseUser || !codeToClaim) return;

    setIsProcessing(true);
    setClaimStatus(null);

    try {
      const normalizedCode = codeToClaim.toUpperCase();
      
      // 1. Check if it's a legacy referral code (4 chars)
      const isReferralCode = normalizedCode.length === 4 && /^[A-Z0-9]{4}$/.test(normalizedCode);
      
      if (isReferralCode) {
        if (normalizedCode === dbUser?.referralCode) {
          setClaimStatus({ type: 'error', message: "You cannot claim your own referral code." });
          setIsProcessing(false);
          return;
        }

        // Check if user already claimed this specific referral code
        const referralClaimId = `${firebaseUser.uid}_${normalizedCode}`;
        const referralClaimRef = doc(db, 'referralclaims', referralClaimId);
        const referralClaimSnap = await getDoc(referralClaimRef);

        if (referralClaimSnap.exists()) {
          setClaimStatus({ type: 'error', message: 'You have already claimed this referral code.' });
          setIsProcessing(false);
          return;
        }
        
        // Handle referral points (simplified for now, just add 0.5 points)
        const points = 0.5;
        const oldScore = dbUser?.loyaltyScore || 0;
        const newScore = oldScore + points;
        
        // Create referral claim record
        await setDoc(referralClaimRef, {
          referralCode: normalizedCode,
          userId: firebaseUser.uid,
          claimedAt: serverTimestamp(),
          pointsAwarded: points
        });

        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          loyaltyScore: increment(points)
        });

        sendNotification({
          userId: firebaseUser.uid,
          type: 'LoyaltyUpdate',
          title: 'Referral Points Claimed!',
          message: `You've successfully claimed ${points} points!`,
          metadata: { code: normalizedCode }
        });

        checkTierChange(oldScore, newScore);
        setClaimStatus({ type: 'success', message: `Successfully claimed ${points} points!` });
        setClaimCode('');
        setTimeout(() => { setIsClaiming(false); setClaimStatus(null); }, 2000);
        setIsProcessing(false);
        return;
      }

      // 2. Check for real QR codes in Firestore
      const qrcodesRef = collection(db, 'qrcodes');
      const q = query(qrcodesRef, where('code', '==', normalizedCode), where('isActive', '==', true));
      const snap = await getDocs(q);

      if (snap.empty) {
        setClaimStatus({ type: 'error', message: 'Invalid or inactive claim code.' });
        setIsProcessing(false);
        return;
      }

      const qrDoc = snap.docs[0];
      const qrData = qrDoc.data() as any;

      // Check expiry
      if (qrData.expiryDate && qrData.expiryDate.toDate() < new Date()) {
        setClaimStatus({ type: 'error', message: 'This code has expired.' });
        setIsProcessing(false);
        return;
      }

      // Check usage limit
      if (qrData.usageLimit && (qrData.usageCount || 0) >= qrData.usageLimit) {
        setClaimStatus({ type: 'error', message: 'This code has reached its usage limit.' });
        setIsProcessing(false);
        return;
      }

      // Check if user already claimed this specific QR code
      const claimsRef = collection(db, 'qrclaims');
      const claimQuery = query(claimsRef, where('qrId', '==', qrDoc.id), where('userId', '==', firebaseUser.uid));
      const claimSnap = await getDocs(claimQuery);

      if (!claimSnap.empty) {
        setClaimStatus({ type: 'error', message: 'You have already claimed this offer.' });
        setIsProcessing(false);
        return;
      }

      // All checks passed, process the claim
      const points = qrData.type === 'Points' ? (qrData.value || 0) : 0;
      const oldScore = dbUser?.loyaltyScore || 0;
      const newScore = oldScore + points;

      // Create claim record with deterministic ID to prevent double claims
      const claimId = `${firebaseUser.uid}_${qrDoc.id}`;
      await setDoc(doc(db, 'qrclaims', claimId), {
        qrId: qrDoc.id,
        userId: firebaseUser.uid,
        claimedAt: serverTimestamp(),
        pointsAwarded: points
      });

      // Update QR code usage count
      await updateDoc(doc(db, 'qrcodes', qrDoc.id), {
        usageCount: increment(1)
      });

      // Update user loyalty score if points were awarded
      if (points > 0) {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          loyaltyScore: increment(points)
        });
        checkTierChange(oldScore, newScore);
      }

      sendNotification({
        userId: firebaseUser.uid,
        type: 'LoyaltyUpdate',
        title: `${qrData.title} Claimed!`,
        message: points > 0 ? `You've earned ${points} points!` : `You've successfully claimed this ${qrData.type.toLowerCase()}.`,
        metadata: { qrId: qrDoc.id, type: qrData.type }
      });

      setClaimStatus({ 
        type: 'success', 
        message: points > 0 ? `Successfully claimed ${points} points!` : `Successfully claimed ${qrData.title}!` 
      });
      setClaimCode('');
      
      setTimeout(() => {
        setIsClaiming(false);
        setClaimStatus(null);
      }, 2000);

    } catch (err: any) {
      console.error("Error claiming points:", err);
      setClaimStatus({ type: 'error', message: 'Failed to process claim. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    setClaimStatus(null);
    
    // Give DOM time to render the reader div
    setTimeout(() => {
      if (!scannerRef.current) {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        
        scannerRef.current.render(
          (decodedText) => {
            // Success
            if (scannerRef.current) {
              scannerRef.current.clear().catch(console.error);
              scannerRef.current = null;
            }
            setIsScanning(false);
            handleClaimPoints(undefined, decodedText);
          },
          (error) => {
            // Silently ignore scan errors (they happen constantly during search)
          }
        );
      }
    }, 100);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    // Check file size (limit to 10MB for initial selection, we will compress it)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Please select an image smaller than 10MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditingImage(event.target?.result as string);
        setEditingImageType('profile');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error reading profile photo:", err);
      setUploadError("Failed to read image file.");
      setIsUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-wine-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await signIn();
    } catch (error: any) {
      console.error('Error signing in with Google', error);
      if (error.code === 'auth/popup-blocked') {
        setError('The sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else {
        setError(error.message || 'Error signing in with Google. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-12 animate-in fade-in zoom-in duration-500">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-6">
              <img 
                src="https://storage.googleapis.com/static.aistudio.google.com/content/file-2-savvy-new-logo.png" 
                alt="Savvy Logo" 
                className="h-20 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-3xl font-serif font-bold text-wine-black">
              {authMode === 'login' ? 'Welcome Back' : authMode === 'signup' ? 'Join Savvy' : authMode === 'forgot' ? 'Reset Password' : 'Phone Sign In'}
            </h2>
            <p className="text-wine-black/40 text-sm">
              {authMode === 'login' ? 'Sign in to access your exclusive benefits' : authMode === 'signup' ? 'Create an account to start your journey' : 'Enter your details to continue'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-medium border border-red-100 animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {uploadError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-medium border border-red-100 mb-4 animate-in slide-in-from-top-2">
              {uploadError}
            </div>
          )}

          <div className="space-y-6">
            {authMode === 'forgot' && resetStep === 'success' ? (
              <div className="text-center space-y-4 bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100">
                <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-serif font-bold text-wine-black">Check your email</h3>
                <p className="text-wine-black/60 text-xs">We've sent a password reset link to {authFormData.email}.</p>
                <button 
                  onClick={() => { setAuthMode('login'); setResetStep('form'); }}
                  className="text-wine-red text-sm font-bold hover:underline"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <div className="flex bg-wine-black/5 p-1 rounded-2xl">
                  <button 
                    onClick={() => { setAuthMode('login'); setError(null); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${authMode === 'login' ? 'bg-white text-wine-black shadow-sm' : 'text-wine-black/40'}`}
                  >
                    Login
                  </button>
                  <button 
                    onClick={() => { setAuthMode('signup'); setError(null); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${authMode === 'signup' ? 'bg-white text-wine-black shadow-sm' : 'text-wine-black/40'}`}
                  >
                    Sign Up
                  </button>
                  <button 
                    onClick={() => { setAuthMode('phone'); setError(null); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${authMode === 'phone' ? 'bg-white text-wine-black shadow-sm' : 'text-wine-black/40'}`}
                  >
                    Phone
                  </button>
                </div>

                {authMode === 'phone' ? (
                  <form onSubmit={handlePhoneAuth} className="space-y-4">
                    <div id="recaptcha-container"></div>
                    {phoneStep === 'number' ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Mobile Number</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                          <input
                            type="tel"
                            placeholder="+1234567890"
                            className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                            value={authFormData.phone}
                            onChange={(e) => setAuthFormData({ ...authFormData, phone: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Verification Code</label>
                        <div className="relative">
                          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                          <input
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                            value={authFormData.otp}
                            onChange={(e) => setAuthFormData({ ...authFormData, otp: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-wine-red/20 hover:bg-wine-red/90 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : phoneStep === 'number' ? 'Send OTP' : 'Verify & Sign In'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {authMode === 'signup' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                          <input
                            type="text"
                            placeholder="Your Name"
                            className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                            value={authFormData.name}
                            onChange={(e) => setAuthFormData({ ...authFormData, name: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                        <input
                          type="email"
                          placeholder="your@email.com"
                          className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                          value={authFormData.email}
                          onChange={(e) => setAuthFormData({ ...authFormData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    {authMode !== 'forgot' && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center ml-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40">Password</label>
                          {authMode === 'login' && (
                            <button 
                              type="button"
                              onClick={() => setAuthMode('forgot')}
                              className="text-[10px] font-bold text-wine-red uppercase tracking-widest hover:underline"
                            >
                              Forgot?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                          <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                            value={authFormData.password}
                            onChange={(e) => setAuthFormData({ ...authFormData, password: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-wine-red/20 hover:bg-wine-red/90 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                    </button>
                  </form>
                )}

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-wine-black/5"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-wine-cream px-2 text-wine-black/30 font-bold">Or continue with</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={isProcessing}
                  className="w-full bg-white border border-wine-black/10 text-wine-black py-4 rounded-2xl font-bold text-sm shadow-sm hover:bg-wine-cream transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
                  Google Account
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const displayUser = {
    ...user,
    name: dbUser?.name || firebaseUser.displayName || 'User',
    email: firebaseUser.email || '',
    photoURL: dbUser?.photoURL || firebaseUser.photoURL,
    phone: dbUser?.phone || 'No phone set',
    type: dbUser?.type || 'Individual',
    city: dbUser?.city || 'Not set',
    loyaltyScore: dbUser?.loyaltyScore || 0,
    businessName: dbUser?.businessName,
    businessLocation: dbUser?.businessLocation,
    membershipId: dbUser?.membershipId,
    attendedEvents: dbUser?.attendedEvents || 0
  };

  const score = isNaN(Number(displayUser.loyaltyScore)) ? 0 : Number(displayUser.loyaltyScore);

  const LOYALTY_TIERS = [
    { 
      name: 'Novice', 
      min: 0, 
      max: 6.9, 
      color: 'bg-slate-400', 
      icon: <Award className="w-4 h-4" />,
      benefits: ['Early event access', 'Monthly newsletter', 'Member-only shop access']
    },
    { 
      name: 'Connoisseur', 
      min: 7, 
      max: 8.9, 
      color: 'bg-wine-gold', 
      icon: <Medal className="w-4 h-4" />,
      benefits: ['Free shipping on all orders', '10% discount on events', 'Priority support']
    },
    { 
      name: 'Master', 
      min: 9, 
      max: 10, 
      color: 'bg-emerald-500', 
      icon: <Trophy className="w-4 h-4" />,
      benefits: ['Exclusive vintage invites', 'Personal wine concierge', '20% discount on events', 'VIP lounge access']
    },
  ];

  const getCurrentTier = (s: number) => {
    return LOYALTY_TIERS.find(t => s >= t.min && s <= t.max) || LOYALTY_TIERS[0];
  };

  const getNextTier = (s: number) => {
    const currentIndex = LOYALTY_TIERS.findIndex(t => s >= t.min && s <= t.max);
    return LOYALTY_TIERS[currentIndex + 1] || null;
  };

  const currentTier = getCurrentTier(score);
  const nextTier = getNextTier(score);
  const pointsToNext = nextTier ? (nextTier.min - score).toFixed(1) : 0;
  const progressToNext = nextTier 
    ? ((score - currentTier.min) / (nextTier.min - currentTier.min)) * 100 
    : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {uploadError && (
        <div className="mx-6 bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-medium border border-red-100 animate-in slide-in-from-top-2">
          {uploadError}
        </div>
      )}
      {/* Profile Header */}
      <section className="px-6 pt-6 flex flex-col items-center text-center space-y-4">
        <div className="relative">
          <div className="w-28 h-28 rounded-full border-4 border-wine-gold p-1 relative overflow-hidden">
            {isUploading && (
              <div className="absolute inset-0 bg-wine-black/40 backdrop-blur-sm z-10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            <img 
              src={displayUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`} 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute bottom-0 right-0 translate-x-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-wine-red text-white p-2 rounded-full shadow-lg border-2 border-white hover:bg-wine-black transition-colors"
              title="Change Photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-serif font-bold">{displayUser.name}</h2>
          {isAdmin && (
            <span className="px-2 py-0.5 bg-wine-red text-white text-[8px] font-bold uppercase tracking-widest rounded-full">
              Admin
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => {
              setEditFormData({ 
                name: displayUser.name, 
                phone: displayUser.phone, 
                type: displayUser.type as any,
                city: dbUser?.city || '',
                businessName: dbUser?.businessName || '',
                businessLocation: dbUser?.businessLocation || ''
              });
              setIsEditing(true);
            }}
            className="px-6 py-2 bg-wine-black/5 rounded-full text-xs font-bold text-wine-black hover:bg-wine-black/10 transition-colors"
          >
            Edit Profile
          </button>
          <button 
            onClick={() => setIsClaiming(true)}
            className="px-6 py-2 bg-wine-red text-white rounded-full text-xs font-bold shadow-lg shadow-wine-red/20 hover:bg-wine-red/90 transition-all flex items-center gap-2"
          >
            <Tag className="w-3 h-3" /> Claim
          </button>
        </div>
      </section>

      {/* Claim Modal */}
      <AnimatePresence>
        {isClaiming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClaiming(false)}
              className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-wine-cream rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button 
                  onClick={() => setIsClaiming(false)}
                  className="p-2 bg-wine-black/5 rounded-full text-wine-black hover:bg-wine-black/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif font-bold text-wine-black">Claim Points</h3>
                  <p className="text-wine-black/40 text-xs text-center">Scan a Savvy QR code or enter your claim code manually.</p>
                </div>

                {claimStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl text-xs font-bold text-center ${
                      claimStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}
                  >
                    {claimStatus.message}
                  </motion.div>
                )}

                <div className="space-y-4">
                  {isScanning ? (
                    <div className="space-y-4">
                      <div id="qr-reader" className="w-full aspect-square rounded-3xl overflow-hidden border-2 border-wine-red/20"></div>
                      <button 
                        onClick={stopScanning}
                        className="w-full py-3 bg-wine-black/5 text-wine-black rounded-xl font-bold text-xs"
                      >
                        Cancel Scan
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={startScanning}
                      disabled={isProcessing}
                      className="w-full aspect-square bg-white border-2 border-dashed border-wine-black/10 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-wine-red/40 transition-all group relative overflow-hidden"
                    >
                      <div className="w-16 h-16 bg-wine-black/5 rounded-2xl flex items-center justify-center text-wine-black/20 group-hover:text-wine-red group-hover:bg-wine-red/10 transition-all">
                        <QrCode className="w-10 h-10" />
                      </div>
                      <p className="text-xs font-bold text-wine-black/40 group-hover:text-wine-black transition-colors">Tap to Scan QR Code</p>
                    </button>
                  )}

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-wine-black/5"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-wine-cream px-2 text-wine-black/30 font-bold">Or enter manually</span>
                    </div>
                  </div>

                  <form onSubmit={handleClaimPoints} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Claim Code</label>
                      <input
                        type="text"
                        placeholder="e.g. SAVVY-1234"
                        className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all font-mono uppercase"
                        value={claimCode}
                        onChange={(e) => setClaimCode(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isProcessing || isScanning || !claimCode}
                      className="w-full bg-wine-black text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-wine-red transition-all disabled:opacity-50"
                    >
                      {isProcessing ? 'Verifying...' : 'Claim Points'}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-wine-cream rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-2 bg-wine-black/5 rounded-full text-wine-black hover:bg-wine-black/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif font-bold text-wine-black">Edit Profile</h3>
                  <p className="text-wine-black/40 text-xs">Update your personal information below.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                      <input
                        type="text"
                        className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                      <input
                        type="tel"
                        className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">City</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                      <input
                        type="text"
                        placeholder="e.g. Nairobi"
                        className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                        value={editFormData.city}
                        onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Profile Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Individual', 'Business'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEditFormData({ ...editFormData, type: type as 'Individual' | 'Business' })}
                          className={`py-3 rounded-2xl border text-xs font-bold transition-all ${
                            editFormData.type === type
                              ? 'bg-wine-red border-wine-red text-white shadow-lg shadow-wine-red/20'
                              : 'bg-white border-wine-black/5 text-wine-black hover:bg-wine-cream'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {editFormData.type === 'Business' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-2"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Business Name</label>
                        <div className="relative">
                          <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                          <input
                            type="text"
                            placeholder="e.g. Savvy Wines Ltd"
                            className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                            value={editFormData.businessName}
                            onChange={(e) => setEditFormData({ ...editFormData, businessName: e.target.value })}
                            required={editFormData.type === 'Business'}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Business Location</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                          <input
                            type="text"
                            placeholder="e.g. 123 Wine St, Nairobi"
                            className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                            value={editFormData.businessLocation}
                            onChange={(e) => setEditFormData({ ...editFormData, businessLocation: e.target.value })}
                            required={editFormData.type === 'Business'}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-wine-black text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-wine-red transition-all mt-4"
                  >
                    Save Changes
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loyalty Score Card */}
      <section className="px-6">
        <div className="wine-gradient rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy className="w-32 h-32" />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">Savvy Loyalty Score</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-serif font-bold">{score}</span>
                  <span className="text-white/40 text-lg">/ 10</span>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/20 backdrop-blur-md ${currentTier.color}`}>
                {currentTier.icon}
                {currentTier.name} Tier
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Current Progress</p>
                  <p className="text-xs font-medium">
                    {nextTier 
                      ? `${pointsToNext} points to reach ${nextTier.name}`
                      : 'You have reached the highest tier!'}
                  </p>
                </div>
                {nextTier && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Next Tier</p>
                    <p className="text-xs font-bold text-wine-gold">{nextTier.name}</p>
                  </div>
                )}
              </div>

              <div className="h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(score / 10) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-wine-gold rounded-full shadow-[0_0_15px_rgba(212,175,55,0.6)] relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </motion.div>
              </div>

              <div className="flex justify-between px-1">
                {LOYALTY_TIERS.map((tier, i) => (
                  <div key={tier.name} className="flex flex-col items-center gap-1">
                    <div className={`w-1 h-1 rounded-full ${score >= tier.min ? 'bg-wine-gold' : 'bg-white/20'}`} />
                    <span className={`text-[8px] font-bold uppercase tracking-tighter ${score >= tier.min ? 'text-white' : 'text-white/30'}`}>
                      {tier.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {LOYALTY_TIERS.map((tier) => {
                const isUnlocked = score >= tier.min;
                return (
                  <div 
                    key={tier.name}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                      isUnlocked 
                        ? 'bg-white/10 border-white/20' 
                        : 'bg-black/20 border-white/5 opacity-40'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${isUnlocked ? tier.color : 'bg-white/10'}`}>
                      {React.cloneElement(tier.icon as React.ReactElement, { className: "w-5 h-5" })}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center">{tier.name}</span>
                    {isUnlocked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Simulation Section (For Demo) */}
      <section className="px-6 space-y-4">
        <h3 className="text-sm font-bold text-wine-black/40 uppercase tracking-widest ml-1">Simulate Notifications</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => sendNotification({
              userId: firebaseUser.uid,
              type: 'SpecialOffer',
              title: 'Exclusive 20% Off!',
              message: 'Get 20% off your next wine purchase at The Wine Cellar.',
              link: '/shops'
            })}
            className="p-4 bg-white rounded-2xl border border-wine-black/5 shadow-sm text-left hover:bg-wine-cream transition-colors"
          >
            <Tag className="w-5 h-5 text-wine-red mb-2" />
            <p className="text-xs font-bold text-wine-black">Special Offer</p>
            <p className="text-[10px] text-wine-black/40">Simulate a discount</p>
          </button>
          <button 
            onClick={() => sendNotification({
              userId: firebaseUser.uid,
              type: 'EventAnnouncement',
              title: 'New Tasting Event!',
              message: 'Join us for the Summer Solstice Wine Gala next month.',
              link: '/events'
            })}
            className="p-4 bg-white rounded-2xl border border-wine-black/5 shadow-sm text-left hover:bg-wine-cream transition-colors"
          >
            <Medal className="w-5 h-5 text-wine-gold mb-2" />
            <p className="text-xs font-bold text-wine-black">New Event</p>
            <p className="text-[10px] text-wine-black/40">Simulate announcement</p>
          </button>
        </div>
      </section>

      {/* Digital Tickets Section */}
      {tickets.length > 0 && (
        <section className="px-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-wine-red" />
              <h3 className="text-lg font-bold">My Digital Tickets</h3>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {tickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedTicket(ticket)}
                className="flex-shrink-0 w-64 bg-white rounded-3xl border border-wine-black/5 shadow-md overflow-hidden cursor-pointer"
              >
                <div className="bg-wine-red p-4 text-white relative">
                  <h4 className="font-serif font-bold text-sm truncate">{ticket.eventTitle}</h4>
                  <p className="text-[10px] opacity-80">{ticket.eventDate}</p>
                  <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${ticket.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    {ticket.paymentStatus}
                  </div>
                </div>
                <div className="p-4 flex flex-col items-center gap-3">
                  <div className="p-2 bg-wine-cream rounded-xl">
                    <QRCodeSVG value={ticket.qrCode} size={80} />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Ticket ID</p>
                    <p className="text-xs font-mono text-wine-black">{ticket.id}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Ticket Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-wine-cream rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 bg-wine-black/5 rounded-full text-wine-black hover:bg-wine-black/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6 text-center">
                <div className="w-16 h-16 bg-wine-red/10 rounded-2xl flex items-center justify-center text-wine-red mx-auto">
                  <TicketIcon className="w-8 h-8" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-bold text-wine-black">{selectedTicket.eventTitle}</h3>
                  <p className="text-wine-red font-bold text-sm">{selectedTicket.eventDate} • {selectedTicket.eventTime}</p>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-wine-black/5 flex flex-col items-center gap-4 shadow-inner relative">
                  <div className={`ticket-qr ${selectedTicket.paymentStatus === 'pending' ? 'blur-sm grayscale opacity-50' : ''}`}>
                    <QRCodeSVG value={selectedTicket.qrCode} size={180} />
                  </div>
                  {selectedTicket.paymentStatus === 'pending' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-wine-black/80 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                        <Lock className="w-3 h-3" /> Payment Required
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Entry Code</p>
                    <p className="text-sm font-mono font-bold text-wine-black">{selectedTicket.qrCode}</p>
                  </div>
                </div>

                <div className="space-y-4 text-left">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-wine-red mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Venue</p>
                        <p className="text-xs font-medium text-wine-black">{selectedTicket.eventVenue}</p>
                        <p className="text-[10px] text-wine-black/40">{selectedTicket.eventLocation}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Status</p>
                      <p className={`text-xs font-bold ${(selectedTicket.paymentStatus || 'pending') === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {(selectedTicket.paymentStatus || 'pending').toUpperCase()}
                      </p>
                      {selectedTicket.price !== undefined && (
                        <p className="text-sm font-bold text-wine-black mt-1">
                          {typeof selectedTicket.price === 'number' ? `$${selectedTicket.price}` : selectedTicket.price}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {selectedTicket.paymentStatus === 'pending' ? (
                  <div className="space-y-4 pt-2">
                    {!showPaymentForm ? (
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowPaymentForm(true)}
                          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Phone className="w-4 h-4" /> Pay Now (USSD Push)
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full bg-wine-red/10 text-wine-red py-4 rounded-2xl font-bold text-sm hover:bg-wine-red/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Cancel Registration
                        </button>
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 bg-white p-4 rounded-2xl border border-wine-black/5"
                      >
                        <p className="text-[10px] font-bold text-wine-black/40 uppercase text-center">Enter Phone Number for USSD Push</p>
                        <input 
                          type="tel"
                          placeholder="+254 700 000 000"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-wine-black/5 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-wine-red transition-all"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowPaymentForm(false)}
                            className="flex-1 bg-wine-black/5 text-wine-black py-3 rounded-xl font-bold text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePayment}
                            disabled={isPaying || !phoneNumber}
                            className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isPaying ? 'Processing...' : 'Confirm & Pay'}
                          </button>
                        </div>
                        {paymentMessage && (
                          <p className={`text-[10px] text-center font-bold ${paymentMessage.type === 'success' ? 'text-emerald-600' : 'text-wine-red'}`}>
                            {paymentMessage.text}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;

                        // Set canvas size
                        canvas.width = 400;
                        canvas.height = 650;

                        // Background
                        ctx.fillStyle = '#F5F5F0'; // wine-cream
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Header
                        ctx.fillStyle = '#722F37'; // wine-red
                        ctx.fillRect(0, 0, canvas.width, 100);

                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = 'bold 20px serif';
                        ctx.fillText('SAVVY WINE EVENT TICKET', 20, 40);
                        
                        ctx.font = '14px sans-serif';
                        ctx.fillText(selectedTicket.eventTitle, 20, 70);

                        // Event Details
                        ctx.fillStyle = '#141414'; // wine-black
                        ctx.font = 'bold 12px sans-serif';
                        ctx.fillText('EVENT DETAILS', 20, 130);
                        
                        ctx.font = '16px sans-serif';
                        ctx.fillText(selectedTicket.eventDate, 20, 155);
                        ctx.fillText(selectedTicket.eventTime, 20, 180);
                        
                        ctx.font = '12px sans-serif';
                        ctx.fillText(selectedTicket.eventVenue, 20, 205);
                        ctx.fillStyle = '#14141466';
                        ctx.fillText(selectedTicket.eventLocation, 20, 225);

                        // Amount Paid
                        if (selectedTicket.price !== undefined) {
                          ctx.fillStyle = '#141414';
                          ctx.font = 'bold 12px sans-serif';
                          ctx.fillText('AMOUNT PAID', 280, 130);
                          ctx.font = 'bold 20px sans-serif';
                          ctx.fillStyle = '#722F37';
                          const priceText = typeof selectedTicket.price === 'number' ? `$${selectedTicket.price}` : selectedTicket.price;
                          ctx.fillText(priceText, 280, 155);
                        }

                        // Divider
                        ctx.strokeStyle = '#1414141A';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(20, 245);
                        ctx.lineTo(380, 245);
                        ctx.stroke();

                        // Membership Info
                        ctx.fillStyle = '#141414';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.fillText('MEMBER INFORMATION', 20, 275);
                        
                        ctx.font = '16px sans-serif';
                        ctx.fillText(displayUser.name, 20, 300);
                        
                        ctx.font = '12px sans-serif';
                        ctx.fillStyle = '#14141466';
                        ctx.fillText(`ID: ${firebaseUser.uid.slice(0, 8).toUpperCase()}`, 20, 320);

                        // Loyalty Score
                        ctx.fillStyle = '#722F37';
                        ctx.font = 'bold 14px sans-serif';
                        ctx.fillText(`Loyalty Score: ${displayUser.loyaltyScore.toFixed(1)} / 10`, 20, 350);

                        // QR Code
                        const svg = document.querySelector('.ticket-qr svg');
                        if (svg) {
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const img = new Image();
                          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                          const url = URL.createObjectURL(svgBlob);
                          
                          img.onload = () => {
                            ctx.drawImage(img, 100, 380, 200, 200);
                            URL.revokeObjectURL(url);
                            
                            // Footer
                            ctx.fillStyle = '#14141466';
                            ctx.font = '10px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.fillText(`Ticket ID: ${selectedTicket.id}`, 200, 610);
                            ctx.fillText('Generated by Savvy Wine App', 200, 630);

                            // Download
                            const pngFile = canvas.toDataURL('image/png');
                            const downloadLink = document.createElement('a');
                            downloadLink.download = `Savvy-Ticket-${selectedTicket.id}.png`;
                            downloadLink.href = pngFile;
                            downloadLink.click();
                          };
                          img.src = url;
                        }
                      }}
                      className="w-full bg-wine-black text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-wine-red transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download Ticket
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full bg-wine-red/10 text-wine-red py-4 rounded-2xl font-bold text-sm hover:bg-wine-red/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Ticket
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xs bg-white rounded-[2rem] p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-wine-red/10 rounded-2xl flex items-center justify-center text-wine-red mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold text-wine-black">Delete Ticket?</h3>
                <p className="text-xs text-wine-black/60 leading-relaxed">
                  This action cannot be undone. You will lose access to this digital ticket.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleDeleteTicket}
                  disabled={isDeleting}
                  className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-wine-red/90 transition-all disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full bg-wine-black/5 text-wine-black py-4 rounded-2xl font-bold text-sm hover:bg-wine-black/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Photo Gallery */}
      <section className="px-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-wine-red" />
            <h3 className="text-lg font-bold">My Wine Moments</h3>
          </div>
          <button 
            onClick={() => setIsAddingPhoto(true)}
            className="flex items-center gap-1 text-wine-red text-xs font-bold bg-wine-red/5 px-3 py-1.5 rounded-full hover:bg-wine-red/10 transition-colors"
          >
            <Plus className="w-3 h-3" /> Share Photo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {photos.slice().reverse().map((photo) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative aspect-square rounded-3xl overflow-hidden shadow-md border border-wine-black/5"
            >
              <img 
                src={photo.url} 
                alt={photo.caption} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-wine-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-white text-[10px] font-medium line-clamp-2 mb-1">{photo.caption}</p>
                {photo.tag && (
                  <div className="flex items-center gap-1 text-wine-gold text-[8px] font-bold uppercase tracking-widest">
                    <MapPin className="w-2 h-2" /> {photo.tag.name}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Add Photo Modal */}
      <AnimatePresence>
        {isAddingPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingPhoto(false)}
              className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-wine-cream rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button 
                  onClick={() => setIsAddingPhoto(false)}
                  className="p-2 bg-wine-black/5 rounded-full text-wine-black hover:bg-wine-black/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <div className="w-16 h-16 bg-wine-red/10 rounded-2xl flex items-center justify-center text-wine-red mx-auto mb-2">
                    <Camera className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-wine-black">Share a Moment</h3>
                  <p className="text-wine-black/40 text-xs">Capture and tag your wine experiences.</p>
                </div>

                <form onSubmit={handleAddPhoto} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Caption</label>
                    <textarea
                      placeholder="Tell us about this experience..."
                      className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all resize-none h-24"
                      value={photoFormData.caption}
                      onChange={(e) => setPhotoFormData({ ...photoFormData, caption: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Tag Location</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {['Shop', 'Hotel', 'Event'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setPhotoFormData({ ...photoFormData, tagType: type as any })}
                          className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${
                            photoFormData.tagType === type
                              ? 'bg-wine-black border-wine-black text-white'
                              : 'bg-white border-wine-black/5 text-wine-black'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                      <select
                        className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all appearance-none"
                        value={photoFormData.tagName}
                        onChange={(e) => setPhotoFormData({ ...photoFormData, tagName: e.target.value })}
                        required
                      >
                        <option value="">Select {photoFormData.tagType}</option>
                        {photoFormData.tagType === 'Event' ? (
                          dynamicEvents.map(e => <option key={e.id} value={e.title}>{e.title}</option>)
                        ) : (
                          dynamicStores.filter(s => s.type === (photoFormData.tagType === 'Shop' ? 'Wine Shop' : 'Hotel')).map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Photo</label>
                    <div 
                      onClick={() => momentFileInputRef.current?.click()}
                      className="w-full aspect-video bg-white border-2 border-dashed border-wine-black/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-wine-black/5 transition-all overflow-hidden relative"
                    >
                      {photoFormData.imagePreview ? (
                        <>
                          <img src={photoFormData.imagePreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-bold">Change Photo</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 text-wine-black/20 mb-2" />
                          <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Upload from Gallery</p>
                        </>
                      )}
                    </div>
                    <input 
                      type="file"
                      ref={momentFileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            setUploadError("Please select an image smaller than 10MB.");
                            return;
                          }
                          try {
                            setIsUploadingMoment(true);
                            setUploadError(null);
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setEditingImage(event.target?.result as string);
                              setEditingImageType('moment');
                              setIsUploadingMoment(false);
                            };
                            reader.readAsDataURL(file);
                          } catch (err) {
                            console.error("Error reading file:", err);
                            setUploadError("Failed to read image file.");
                            setIsUploadingMoment(false);
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Or Photo URL (Optional)</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                      <input
                        type="url"
                        placeholder="https://..."
                        className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all"
                        value={photoFormData.imageUrl}
                        onChange={(e) => setPhotoFormData({ ...photoFormData, imageUrl: e.target.value, imageFile: null, imagePreview: e.target.value })}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploadingMoment}
                    className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-wine-red/20 hover:bg-wine-red/90 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUploadingMoment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sharing...
                      </>
                    ) : (
                      'Share Moment'
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity History */}
      <section className="px-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">Activity History</h3>
          <button className="text-wine-red text-xs font-bold">View All</button>
        </div>
        
        <div className="space-y-3">
          {user.activityHistory.map((activity, i) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl p-4 flex justify-between items-center border border-wine-black/5 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-wine-cream rounded-xl flex items-center justify-center text-wine-red">
                  {activity.type === 'Event' ? <Award className="w-5 h-5" /> : activity.type === 'Purchase' ? <History className="w-5 h-5" /> : <Star className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-wine-black">{activity.title}</p>
                  <p className="text-[10px] text-wine-black/40 font-medium">{activity.date}</p>
                </div>
              </div>
              <div className="text-emerald-500 font-bold text-sm">
                +{activity.points} pts
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Menu Options */}
      <section className="px-6 pb-12 space-y-2">
        {[
          { label: 'Membership Details', icon: <Award className="w-5 h-5" />, action: () => setIsMembershipDetailsOpen(true) },
          { label: 'Enable Push Notifications', icon: <Bell className="w-5 h-5" />, action: requestPermission },
          { label: 'Payment Methods', icon: <History className="w-5 h-5" /> },
          { label: 'Sign Out', icon: <Lock className="w-5 h-5" />, action: logout },
        ].map(item => (
          <button 
            key={item.label} 
            onClick={item.action}
            className="w-full bg-white rounded-2xl p-4 flex justify-between items-center border border-wine-black/5 shadow-sm hover:bg-wine-cream transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="text-wine-black/40">{item.icon}</div>
              <span className="text-sm font-bold text-wine-black">{item.label}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-wine-black/20" />
          </button>
        ))}
      </section>

      {/* Membership Details Modal */}
      <AnimatePresence>
        {isMembershipDetailsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMembershipDetailsOpen(false)}
              className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-wine-cream rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button 
                  onClick={() => setIsMembershipDetailsOpen(false)}
                  className="p-2 bg-wine-black/5 rounded-full text-wine-black hover:bg-wine-black/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif font-bold text-wine-black">Membership Details</h3>
                  <p className="text-wine-black/40 text-xs">Your official Savvy Wine membership information.</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 border border-wine-black/5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-wine-cream rounded-xl flex items-center justify-center text-wine-red">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Member ID</p>
                      <p className="text-sm font-mono font-bold text-wine-black">{displayUser.membershipId || firebaseUser.uid.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-wine-black/5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-wine-cream rounded-xl flex items-center justify-center text-wine-red">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Date Joined</p>
                      <p className="text-sm font-bold text-wine-black">{new Date(firebaseUser.metadata.creationTime || '').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-wine-black/5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-wine-cream rounded-xl flex items-center justify-center text-wine-red">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Events Attended</p>
                      <p className="text-sm font-bold text-wine-black">{user.activityHistory.filter(a => a.type === 'Event').length} Events</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-wine-black/5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-wine-cream rounded-xl flex items-center justify-center text-wine-red">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Total Products Bought</p>
                      <p className="text-sm font-bold text-wine-black">{user.activityHistory.filter(a => a.type === 'Purchase').length} Products</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-wine-black/5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-wine-cream rounded-xl flex items-center justify-center text-wine-red">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">City</p>
                      <p className="text-sm font-bold text-wine-black">{displayUser.city}</p>
                    </div>
                  </div>

                  <div className="bg-wine-black rounded-2xl p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-wine-gold">
                        <Star className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Loyalty Score</p>
                        <p className="text-sm font-bold">{(dbUser?.loyaltyScore || score).toFixed(1)} / 10</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-wine-gold/20 border border-wine-gold/30 rounded-full text-[10px] font-bold text-wine-gold uppercase">
                      {currentTier.name}
                    </div>
                  </div>

                  {/* Tier Benefits */}
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest px-1">Tier Benefits</p>
                    <div className="grid grid-cols-1 gap-2">
                      {(currentTier as any).benefits.map((benefit: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-wine-black/5">
                          <div className="w-5 h-5 bg-wine-cream rounded-full flex items-center justify-center text-wine-red">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                          <span className="text-xs font-medium text-wine-black">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Editor Modal */}
      <AnimatePresence>
        {editingImage && (
          <ImageEditor
            image={editingImage}
            onCropComplete={handleCropComplete}
            onCancel={() => setEditingImage(null)}
            aspect={1}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
