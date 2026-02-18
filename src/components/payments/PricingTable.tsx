'use client';

import { useState, useEffect } from 'react';
import { getActiveProductsWithPrices, createCheckoutSession, Product } from '@/services/stripeService';
import { useAuth } from '@/context/AuthContext';

export const PricingTable = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'pepPoints'>('subscriptions');
  const { user } = useAuth();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const activeProducts = await getActiveProductsWithPrices();
        // Sort prices within each product: yearly (recurring & interval === 'year') first, then others
        const sortedProducts = activeProducts.map(product => ({
          ...product,
          prices: [...product.prices].sort((a, b) => {
            const aIsYearly = a.type === 'recurring' && a.interval === 'year';
            const bIsYearly = b.type === 'recurring' && b.interval === 'year';
            if (aIsYearly && !bIsYearly) return -1;
            if (!aIsYearly && bIsYearly) return 1;
            return 0;
          })
        }));
        setProducts(sortedProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleCheckout = async (priceId: string, isRecurring: boolean, metadata: Record<string, any> = {}) => {
    if (!user) {
      alert('Please sign in to subscribe');
      return;
    }

    setCheckoutLoading(priceId);
    try {
      const mode = isRecurring ? 'subscription' : 'payment';
      const url = await createCheckoutSession(user.uid, priceId, mode, metadata);
      window.location.assign(url);
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No products available at the moment.
      </div>
    );
  }

  const subscriptionProducts = products.filter(p => p.metadata.credits);
  const pepPointProducts = products.filter(p => p.metadata.pepPoints);

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex justify-center">
        <div className="bg-slate-100 p-1.5 rounded-[2rem] flex gap-2 border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'subscriptions'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Subscriptions ⚽
          </button>
          <button
            onClick={() => setActiveTab('pepPoints')}
            className={`px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'pepPoints'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Pep Points ⚡
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
        {activeTab === 'subscriptions' ? (
          <>
            {/* Free Tier Card */}
            <div className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <p className="text-gray-600 text-sm mb-4 flex-grow">
                Perfect for trying out PepAI and seeing what it can do.
              </p>
              <div className="mt-4">
                <div className="text-3xl font-bold mb-4">
                  $0.00
                  <span className="text-sm font-normal text-gray-500">
                    /forever
                  </span>
                </div>
                <div className="space-y-2 mb-6 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 10 AI Credits
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>✕</span> Save Drills
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>✕</span> Export Sessions
                  </div>
                </div>
                <button
                  disabled
                  className="w-full py-2 px-4 rounded-lg font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                >
                  Current Plan
                </button>
              </div>
            </div>

            {subscriptionProducts.map((product) => (
              <div key={product.id} className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
                <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                <p className="text-gray-600 text-sm mb-4 flex-grow">{product.description}</p>
                
                <div className="space-y-2 mb-6 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> {product.metadata.credits} AI Credits / Month
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Save Drills
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Export Sessions
                  </div>
                </div>

                {product.prices.map((price) => (
                  <div key={price.id} className="mt-4">
                    <div className="text-3xl font-bold mb-4">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: price.currency,
                      }).format(price.unit_amount / 100)}
                      <span className="text-sm font-normal text-gray-500">
                        /{price.interval || 'one-time'}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleCheckout(price.id, price.type === 'recurring', { credits: product.metadata.credits })}
                      disabled={checkoutLoading !== null}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                        checkoutLoading === price.id
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {checkoutLoading === price.id ? 'Processing...' : 'Subscribe'}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            {pepPointProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-400 font-medium">
                No Pep Point packages available.
              </div>
            ) : (
              pepPointProducts.map((product) => (
                <div key={product.id} className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
                  <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 flex-grow">{product.description}</p>
                  
                  <div className="space-y-2 mb-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500">✓</span> {product.metadata.pepPoints} Pep Points (One-time)
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>✕</span> Save Drills
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>✕</span> Export Sessions
                    </div>
                  </div>

                  {product.prices.map((price) => (
                    <div key={price.id} className="mt-4">
                      <div className="text-3xl font-bold mb-4">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: price.currency,
                        }).format(price.unit_amount / 100)}
                        <span className="text-sm font-normal text-gray-500">
                          /{price.interval || 'one-time'}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleCheckout(price.id, price.type === 'recurring', { pepPoints: product.metadata.pepPoints })}
                        disabled={checkoutLoading !== null}
                        className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                          checkoutLoading === price.id
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {checkoutLoading === price.id ? 'Processing...' : 'Buy Points'}
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};
