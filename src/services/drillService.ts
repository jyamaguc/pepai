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
  setDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Drill } from "@/types/types";

export interface FirestoreDrill extends Drill {
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const DRILLS_COLLECTION = "drills";
const USERS_COLLECTION = "users";

export const drillService = {
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
        await updateDoc(userDocRef, {
          email: email || "",
          createdAt: Timestamp.now(),
          stripeCustomerId: "", // Placeholder for future Stripe integration
        });
      }
    } catch (error: any) {
      // If document doesn't exist, updateDoc fails, so we use setDoc (via updateDoc with upsert logic or just setDoc)
      // Actually, let's use setDoc for simplicity if it doesn't exist.
      if (error.code === 'not-found' || error.code === 'permission-denied') {
        const { setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, USERS_COLLECTION, userId), {
          email: email || "",
          createdAt: Timestamp.now(),
          stripeCustomerId: "",
        });
      } else {
        console.error("Error ensuring user exists:", error);
      }
    }
  }
};
