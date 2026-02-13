'use client';

import React from 'react';
import { PricingTable } from '@/components/payments/PricingTable';
import Link from 'next/link';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest text-xs mb-8 hover:translate-x-[-4px] transition-transform">
            ← Back to App
          </Link>
          <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">
            Upgrade Your <span className="text-emerald-600">PepAI</span> Experience
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto font-medium">
            Unlock professional features like saving drills, exporting sessions, and higher AI credit limits.
          </p>
        </div>

        <PricingTable />

        <div className="mt-20 bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tight text-center">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="font-black text-slate-900 mb-2 uppercase tracking-tight">How do credits work?</h3>
              <p className="text-slate-600 font-medium">Each AI-generated drill or voice interaction consumes 10 credits. Your credits refill automatically at the start of each billing cycle.</p>
            </div>
            <div>
              <h3 className="font-black text-slate-900 mb-2 uppercase tracking-tight">Can I cancel anytime?</h3>
              <p className="text-slate-600 font-medium">Yes, you can cancel your subscription at any time through your account settings. You will retain access until the end of your current billing period.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
