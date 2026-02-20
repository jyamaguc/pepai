"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { decompressSession } from '@/services/compressionService';
import { Session } from '@/types/types';
import { drillService } from '@/services/drillService';
import DrillCard from '@/components/DrillCard';

const ShareContent: React.FC = () => {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const id = searchParams.get('id');
      const data = searchParams.get('data');

      if (id) {
        try {
          const sharedSession = await drillService.getSharedSession(id);
          if (sharedSession) {
            setSession(sharedSession);
          } else {
            setError("Shared session not found.");
          }
        } catch (err) {
          console.error("Failed to fetch shared session:", err);
          setError("Failed to load the shared session.");
        }
      } else if (data) {
        try {
          // Backward compatibility for old compressed links
          const decodedSession = decompressSession(data);
          if (!decodedSession) throw new Error("Decompression failed");
          setSession(decodedSession);
        } catch (err) {
          console.error("Failed to decode session data:", err);
          setError("Invalid share link. The session data could not be loaded.");
        }
      } else {
        setError("No session data found in the link.");
      }
    };

    fetchSession();
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white p-12 rounded-[3rem] shadow-xl text-center space-y-6 max-w-md border border-slate-100">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto">⚠️</div>
          <h1 className="text-2xl font-black text-slate-900">Oops!</h1>
          <p className="text-slate-600 font-medium leading-relaxed">{error}</p>
          <a href="/" className="inline-block bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg">
            Go to PepAI
          </a>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-emerald-600 uppercase tracking-widest text-sm">Loading Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-40 text-slate-900">
      <header className="h-24 bg-white border-b border-slate-200 sticky top-0 z-50 px-8 lg:px-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg font-black text-xl">P</div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pep<span className="text-emerald-600">AI</span> <span className="text-slate-400 font-medium ml-2">Shared Plan</span></h1>
        </div>
        <a href="/" className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
          Create Your Own
        </a>
      </header>

      <main className="max-w-[1500px] mx-auto p-12 space-y-12">
        <section className="bg-white p-12 rounded-[3rem] shadow-xl space-y-8 border border-slate-100">
          <h1 className="text-5xl font-black tracking-tight text-slate-900">{session.title}</h1>
          <div className="flex gap-8">
            <div className="flex flex-col gap-2 flex-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session Date</label>
               <p className="bg-slate-50 px-6 py-4 rounded-xl font-bold text-slate-700">{session.date}</p>
            </div>
            <div className="flex flex-col gap-2 flex-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Squad / Team</label>
               <p className="bg-slate-50 px-6 py-4 rounded-xl font-bold text-slate-700">{session.team}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session Objectives & Notes</label>
             <div className="bg-slate-50 px-8 py-6 rounded-[2rem] font-medium text-slate-600 min-h-[120px] whitespace-pre-wrap leading-relaxed">
               {session.notes || "No focus notes provided for this session."}
             </div>
          </div>
        </section>

        <div className="space-y-24">
          <div className="flex items-center justify-between px-4">
             <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Drills <span className="text-emerald-500 ml-2">{session.drills.length}</span></h2>
          </div>
          
          {session.drills.map(d => (
            <DrillCard 
              key={d.id} 
              drill={d} 
              onRemove={() => {}} 
              onUpdateDrill={() => {}}
              readOnly={true}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-emerald-600 uppercase tracking-widest text-sm">Loading...</p>
        </div>
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
