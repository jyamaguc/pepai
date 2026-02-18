import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  onSnapshot,
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Product {
  id: string;
  active: boolean;
  name: string;
  description?: string;
  images: string[];
  metadata: Record<string, any>;
  prices: Price[];
}

export interface Price {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number;
  description?: string;
  type: 'one_time' | 'recurring';
  interval?: 'day' | 'week' | 'month' | 'year';
  interval_count?: number;
  metadata: Record<string, any>;
}

const productConverter: FirestoreDataConverter<Product> = {
  toFirestore: (data) => data,
  fromFirestore: (snapshot: QueryDocumentSnapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      active: data.active,
      name: data.name,
      description: data.description,
      images: data.images || [],
      metadata: data.metadata || {},
      prices: [], // Prices are in a subcollection
    } as Product;
  }
};

const priceConverter: FirestoreDataConverter<Price> = {
  toFirestore: (data) => data,
  fromFirestore: (snapshot: QueryDocumentSnapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      active: data.active,
      currency: data.currency,
      unit_amount: data.unit_amount,
      description: data.description,
      type: data.type,
      interval: data.interval,
      interval_count: data.interval_count,
      metadata: data.metadata || {},
    } as Price;
  }
};

/**
 * Fetches all active products and their prices from Firestore.
 * This assumes the Stripe Firebase Extension is syncing products to the 'products' collection.
 */
export const getActiveProductsWithPrices = async (): Promise<Product[]> => {
  const productsQuery = query(collection(db, 'products'), where('active', '==', true));
  const productSnaps = await getDocs(productsQuery.withConverter(productConverter));
  
  const products = await Promise.all(
    productSnaps.docs.map(async (doc) => {
      const product = doc.data();
      const pricesQuery = query(collection(db, 'products', product.id, 'prices'), where('active', '==', true));
      const priceSnaps = await getDocs(pricesQuery.withConverter(priceConverter));
      
      return {
        ...product,
        prices: priceSnaps.docs.map(d => d.data())
      };
    })
  );

  return products;
};

/**
 * Creates a checkout session for a user.
 * The Stripe Firebase Extension listens to the 'checkout_sessions' subcollection under 'customers'.
 */
export const createCheckoutSession = async (
  uid: string, 
  priceId: string, 
  mode: 'subscription' | 'payment' = 'subscription',
  metadata: Record<string, any> = {}
) => {
  const checkoutSessionsRef = collection(db, 'customers', uid, 'checkout_sessions');
  
  const docRef = await addDoc(checkoutSessionsRef, {
    price: priceId,
    mode: mode,
    metadata: metadata,
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });

  // Wait for the extension to create the session and update the document with the URL
  return new Promise<string>((resolve, reject) => {
    const unsubscribe = onSnapshot(docRef, (snap) => {
      const data = snap.data();
      if (data?.url) {
        unsubscribe();
        resolve(data.url);
      }
      if (data?.error) {
        unsubscribe();
        reject(new Error(data.error.message));
      }
    });
  });
};
