import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Drill, Session } from "@/types/types";

export interface FirestoreDrill extends Drill {
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const DRILLS_COLLECTION = "drills";
const USERS_COLLECTION = "users";
const SHARED_SESSIONS_COLLECTION = "shared_sessions";

export const drillService = {
  async shareSession(session: Session) {
    try {
      const sharedSessionRef = doc(collection(db, SHARED_SESSIONS_COLLECTION));
      const sessionToShare = {
        ...session,
        id: sharedSessionRef.id,
        sharedAt: Timestamp.now(),
      };
      await setDoc(sharedSessionRef, sessionToShare);
      return sharedSessionRef.id;
    } catch (error) {
      console.error("Error sharing session:", error);
      throw error;
    }
  },

  async getSharedSession(id: string) {
    try {
      const sharedSessionRef = doc(db, SHARED_SESSIONS_COLLECTION, id);
      const sharedSessionDoc = await getDoc(sharedSessionRef);
      if (sharedSessionDoc.exists()) {
        return sharedSessionDoc.data() as Session;
      }
      return null;
    } catch (error) {
      console.error("Error fetching shared session:", error);
      throw error;
    }
  },

  async saveDrill(userId: string, drillData: Drill) {
    try {
      // Always generate a new ID for the document to ensure it saves as a new drill
      const newDrillRef = doc(collection(db, DRILLS_COLLECTION));
      const drillToSave = {
        ...drillData,
        id: newDrillRef.id, // Use the newly generated Firestore ID
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await setDoc(newDrillRef, drillToSave);
      return newDrillRef.id;
    } catch (error) {
      console.error("Error saving drill:", error);
      throw error;
    }
  },

  async saveMultipleDrills(userId: string, drills: Drill[]) {
    try {
      const { writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db);
      
      for (const drill of drills) {
        // Always generate a new ID for each drill in the batch
        const drillRef = doc(collection(db, DRILLS_COLLECTION));
        const drillToSave = {
          ...drill,
          id: drillRef.id,
          userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        batch.set(drillRef, drillToSave);
      }
      
      await batch.commit();
    } catch (error) {
      console.error("Error saving multiple drills:", error);
      throw error;
    }
  },

  async getUserDrills(userId: string) {
    try {
      const q = query(
        collection(db, DRILLS_COLLECTION),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FirestoreDrill[];
    } catch (error: any) {
      console.error("Error fetching user drills:", error);
      throw error;
    }
  },

  async ensureUserExists(userId: string, email?: string | null) {
    try {
      const userDocRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: email || "",
          createdAt: Timestamp.now(),
          stripeCustomerId: "",
          credits: 0, 
          pepPoints: 2, // New users start with 2 Pep Points
          tier: "free",
          can_save: false,
          can_export: false
        });
      }
    } catch (error: any) {
      console.error("Error ensuring user exists:", error);
    }
  },

  async deductCurrency(userId: string, type: 'credits' | 'pepPoints', amount: number) {
    try {
      const userDocRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error("User document not found");
      }

      const userData = userDoc.data();
      const currentBalance = userData?.[type] || 0;
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient ${type === 'credits' ? 'credits' : 'Pep Points'}`);
      }

      await updateDoc(userDocRef, {
        [type]: increment(-amount)
      });
      
      return true;
    } catch (error) {
      console.error(`Error deducting ${type}:`, error);
      throw error;
    }
  }
};
