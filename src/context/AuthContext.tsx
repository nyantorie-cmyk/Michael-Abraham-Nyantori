import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, sanitizeData } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithPhone: (phone: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  updateUserProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        let userSnap = await getDoc(userRef);
        const isAdminEmail = firebaseUser.email?.toLowerCase() === 'nyantorie@gmail.com';

        if (!userSnap.exists()) {
          console.log("Creating new user document...");
          const newUser = sanitizeData({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            photoURL: firebaseUser.photoURL || '',
            type: 'Individual',
            role: isAdminEmail ? 'admin' : 'user',
            loyaltyScore: 0,
            createdAt: serverTimestamp(),
          });
          await setDoc(userRef, newUser);
          userSnap = await getDoc(userRef); // Refresh snapshot
        }
        
        // Merge Firestore data with Firebase User object
        const userData = userSnap.data();
        setUser({ ...firebaseUser, ...userData } as any);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Error signing in with email', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const userRef = doc(db, 'users', res.user.uid);
      const isAdmin = email.toLowerCase() === 'nyantorie@gmail.com';
      await setDoc(userRef, sanitizeData({
        uid: res.user.uid,
        name: name,
        email: email,
        type: 'Individual',
        role: isAdmin ? 'admin' : 'user',
        loyaltyScore: 0,
        createdAt: serverTimestamp(),
      }));
    } catch (error) {
      console.error('Error signing up', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error resetting password', error);
      throw error;
    }
  };

  const signInWithPhone = async (phone: string, recaptchaContainerId: string) => {
    try {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: 'invisible'
      });
      return await signInWithPhoneNumber(auth, phone, verifier);
    } catch (error) {
      console.error('Error signing in with phone', error);
      throw error;
    }
  };

  const updateUserProfile = async (data: { displayName?: string; photoURL?: string }) => {
    if (!auth.currentUser) return;
    try {
      // Firebase Auth has a limit on photoURL length (approx 2048 characters).
      // Base64 strings are often much longer and will cause an error: auth/invalid-profile-attribute.
      const authData: any = { ...data };
      if (authData.photoURL && authData.photoURL.startsWith('data:') && authData.photoURL.length > 2000) {
        // Skip updating photoURL in Auth if it's a long data URL.
        // It will still be saved in Firestore in the calling component.
        delete authData.photoURL;
      }
      
      if (Object.keys(authData).length > 0) {
        await updateProfile(auth.currentUser, authData);
      }
      setUser({ ...auth.currentUser }); // Trigger re-render
    } catch (error) {
      console.error('Error updating profile', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signInWithEmail, 
      signUpWithEmail, 
      resetPassword, 
      signInWithPhone,
      updateUserProfile,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
