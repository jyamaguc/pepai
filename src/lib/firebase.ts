import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDM9HMxcipe2a3YK0zkcNRQzttzDRdAVd0",
  authDomain: "gen-lang-client-0420071219.firebaseapp.com",
  projectId: "gen-lang-client-0420071219",
  storageBucket: "gen-lang-client-0420071219.firebasestorage.app",
  messagingSenderId: "1007551555459",
  appId: "1:1007551555459:web:b82ee49b7c188758cf78b6",
  measurementId: "G-MKQBEGJH24"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with persistent cache for better offline handling in Next.js
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export { app, auth, db };
