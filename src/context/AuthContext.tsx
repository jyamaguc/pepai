"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  User, 
  signOut as firebaseSignOut 
} from "firebase/auth";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface SubscriptionData {
  status: string;
  tier: string;
  credits: number;
  can_save: boolean;
  can_export: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  subscription: SubscriptionData | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  subscription: null,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setSubscription(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Listen to user document for metadata/credits
    const unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSubscription(prev => ({
          status: prev?.status || 'free',
          tier: data.tier || 'free',
          credits: data.credits !== undefined ? data.credits : 10,
          can_save: data.can_save === true || data.can_save === 'true',
          can_export: data.can_export === true || data.can_export === 'true',
        }));
      } else {
        // Default for new users
        setSubscription({
          status: 'free',
          tier: 'free',
          credits: 10,
          can_save: false,
          can_export: false,
        });
      }
      setLoading(false);
    });

    // 2. Listen to active subscriptions from Stripe extension
    const subscriptionsRef = collection(db, "customers", user.uid, "subscriptions");
    const q = query(subscriptionsRef, where("status", "in", ["active", "trialing"]));
    
    const unsubscribeSubs = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // User has an active subscription
        setSubscription(prev => ({
          ...prev!,
          status: 'active',
        }));
      } else {
        setSubscription(prev => ({
          ...prev!,
          status: 'free',
        }));
      }
    });

    return () => {
      unsubscribeUser();
      unsubscribeSubs();
    };
  }, [user]);

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, subscription, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
