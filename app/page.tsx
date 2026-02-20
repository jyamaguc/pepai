"use client";

import React, { useState, useEffect, useRef } from 'react';
import { compressSession } from '@/services/compressionService';
import { generateDrillStream, refineDrillStream, processDrillJson } from '@/services/geminiService';
import { Drill, Session, PitchLayout, PositionType, createEmptyDrill, DrillType, DRILL_TYPE_CONFIGS } from '@/types/types';
import DrillCard from '@/components/DrillCard';
import VoiceAssistant from '@/components/VoiceAssistant';
import PitchVisualizer from '@/components/PitchVisualizer';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { PricingTable } from '@/components/payments/PricingTable';
import { CurrencySelectionModal } from '@/components/payments/CurrencySelectionModal';
import { drillService, FirestoreDrill } from '@/services/drillService';
import { Timestamp } from 'firebase/firestore';
import * as LucideIcons from 'lucide-react';

const DrillTypeBadge: React.FC<{ type: DrillType }> = ({ type }) => {
  const config = DRILL_TYPE_CONFIGS[type];
  if (!config) return null;
  const Icon = (LucideIcons as any)[config.icon];

  return (
    <div className={`flex items-center gap-1 ${config.color} ${config.textColor} border ${config.borderColor} px-1.5 py-0.5 rounded shadow-sm`}>
      {Icon && <Icon size={8} strokeWidth={3} />}
      <span className="text-[8px] font-black uppercase tracking-tight">{config.label}</span>
    </div>
  );
};

const App: React.FC = () => {
  const { user, logout, subscription } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistoryDrill, setSelectedHistoryDrill] = useState<FirestoreDrill | null>(null);
  const [drillHistory, setDrillHistory] = useState<FirestoreDrill[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [session, setSession] = useState<Session>({ 
    id: 'initial-id', 
    title: 'Training Session', 
    date: '', 
    team: 'First Team', 
    drills: [], 
    notes: '' 
  });

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('pepai_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }
    } else {
      setSession(prev => ({
        ...prev,
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0]
      }));
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('pepai_session', JSON.stringify(session));
    }
  }, [session, isMounted]);

  useEffect(() => {
    if (user) {
      drillService.ensureUserExists(user.uid, user.email);
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (user) {
      try {
        const history = await drillService.getUserDrills(user.uid);
        setDrillHistory(history);
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    }
  };

  if (!isMounted) {
    return null; // Or a loading skeleton
  }

  const handleGenerate = async (e?: React.FormEvent, selectedCurrency?: 'credits' | 'pepPoints') => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    console.log("handleGenerate called", { selectedCurrency, hasUser: !!user, hasSub: !!subscription });

    // 1. If no currency selected, check availability and show modal if needed
    if (!selectedCurrency && user && subscription) {
      const canUseCredits = subscription.credits >= 5;
      const canUsePoints = subscription.pepPoints >= 1;

      console.log("Currency check", { canUseCredits, canUsePoints, credits: subscription.credits, points: subscription.pepPoints });

      if (!canUseCredits && !canUsePoints) {
        setIsPricingOpen(true);
        return;
      }

      // ALWAYS show selection modal if the user has a choice (even if one is 0, they might want to see why they can't use it)
      // Or more simply: if they have ANY credits AND ANY points, or if they have enough of both.
      // The requirement said: "asking the user if they want to use credits or Pep Points"
      
      // Let's force the modal if they have a subscription OR points
      if (canUseCredits || canUsePoints) {
        console.log("Opening currency modal");
        setIsCurrencyModalOpen(true);
        setPendingAction(() => (currency: 'credits' | 'pepPoints') => handleGenerate(undefined, currency));
        return;
      }
    }

    setIsGenerating(true);
    setIsRetrying(false);
    setError(null);
    try {
      // Check currency before generating
      if (user && selectedCurrency) {
        try {
          const cost = selectedCurrency === 'credits' ? 5 : 1;
          await drillService.deductCurrency(user.uid, selectedCurrency, cost);
        } catch (err: any) {
          console.error("Currency deduction failed:", err);
          setIsPricingOpen(true);
          return;
        }
      }

      const stream = generateDrillStream(prompt);
      let lastText = "";
      for await (const text of stream) { 
        if (text === "RETRYING") {
          setIsRetrying(true);
          continue;
        }
        lastText = text; 
        setIsRetrying(false);
      }
      const newDrill = processDrillJson(JSON.parse(lastText));
      
      // Removed automatic save to Firestore on generation
      // if (user) {
      //   await drillService.saveDrill(user.uid, newDrill);
      //   loadHistory();
      // }

      setSession(prev => ({ ...prev, drills: [...prev.drills, newDrill] }));
      setPrompt('');
    } catch (err: any) { 
      console.error(err); 
      if (err.message?.includes("High Demand")) {
        setError(err.message);
      } else {
        setError("Something went wrong while generating the drill.");
      }
    } finally { 
      setIsGenerating(false);
      setIsRetrying(false);
    }
  };

  const addManualDrill = () => {
    const newDrill = createEmptyDrill();
    setSession(prev => ({ ...prev, drills: [...prev.drills, newDrill] }));
  };

  const handleShare = async () => {
    if (session.drills.length === 0 || isSharing) return;
    
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!subscription?.can_export) {
      setIsPricingOpen(true);
      return;
    }

    setIsSharing(true);
    
    try {
      // Compress session data to keep the URL short
      const compressed = compressSession(session);
      const shareUrl = `${window.location.origin}/share?data=${compressed}`;
      
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback('Link copied to clipboard!');
      setTimeout(() => setShareFeedback(null), 3000);
    } catch (err) {
      console.error("Failed to share:", err);
      setShareFeedback('Failed to copy link.');
      setTimeout(() => setShareFeedback(null), 3000);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveAll = async () => {
    if (session.drills.length === 0 || isSavingAll) return;
    
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    if (!subscription?.can_save) {
      setIsPricingOpen(true);
      return;
    }

    setIsSavingAll(true);
    try {
      await drillService.saveMultipleDrills(user.uid, session.drills);
      setShareFeedback('All drills saved to history!');
      setTimeout(() => setShareFeedback(null), 3000);
      loadHistory();
    } catch (err) {
      console.error("Failed to save all drills:", err);
      setShareFeedback('Failed to save drills.');
      setTimeout(() => setShareFeedback(null), 3000);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleSaveDrill = async (drill: Drill) => {
// #region agent log
    fetch('http://127.0.0.1:7243/ingest/e6ac4867-a10c-4ed0-8bef-16e2af740160',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c01bf'},body:JSON.stringify({sessionId:'9c01bf',location:'app/page.tsx:254',message:'handleSaveDrill entry',data:{hasUser:!!user,canSave:subscription?.can_save},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
// #endregion
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!subscription?.can_save) {
      setIsPricingOpen(true);
      return;
    }

    try {
      const newId = await drillService.saveDrill(user.uid, drill);
      setShareFeedback('Drill saved to history!');
      setTimeout(() => setShareFeedback(null), 3000);
      
      // Update local state by adding the new drill to the top of the history
      setDrillHistory(prev => [
        { 
          ...drill, 
          id: newId, 
          userId: user.uid, 
          createdAt: Timestamp.now(), 
          updatedAt: Timestamp.now() 
        } as FirestoreDrill, 
        ...prev
      ]);
      
      loadHistory();
    } catch (err) {
      console.error("Failed to save drill:", err);
      setShareFeedback('Failed to save drill.');
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  const reuseDrill = (drill: Drill) => {
    const reusedDrill = { ...drill, id: crypto.randomUUID() };
    setSession(prev => ({ ...prev, drills: [...prev.drills, reusedDrill] }));
    setIsHistoryOpen(false);
    setSelectedHistoryDrill(null);
  };

  const updateDrill = (updated: Drill) => setSession(prev => ({ ...prev, drills: prev.drills.map(d => d.id === updated.id ? updated : d) }));

  const latestDrill = session.drills.length > 0 ? session.drills[session.drills.length - 1] : undefined;

  return (
    <div className="min-h-screen bg-slate-50 pb-40 text-slate-900">
      <header className="h-24 bg-white border-b border-slate-200 sticky top-0 z-50 px-8 lg:px-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg font-black text-xl">P</div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pep<span className="text-emerald-600">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
          {user && subscription && (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsPricingOpen(true)}
                className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200 shadow-inner hover:bg-slate-200 transition-colors cursor-pointer"
                title="Upgrade or Buy Points"
              >
                <span className="text-lg">⚽</span>
                <span className={`text-sm font-black ${subscription.credits < 5 ? 'text-red-600' : 'text-slate-900'}`}>
                  {subscription.credits}
                </span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Credits</span>
              </button>
              <button 
                onClick={() => setIsPricingOpen(true)}
                className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200 shadow-inner hover:bg-slate-200 transition-colors cursor-pointer"
                title="Buy Pep Points"
              >
                <span className="text-lg">⚡</span>
                <span className={`text-sm font-black ${subscription.pepPoints < 1 ? 'text-red-600' : 'text-slate-900'}`}>
                  {subscription.pepPoints}
                </span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pep Points</span>
              </button>
            </div>
          )}

          {shareFeedback && (
            <span className="text-emerald-600 text-xs font-bold animate-in fade-in slide-in-from-right-2">
              {shareFeedback}
            </span>
          )}
          
          {user ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-emerald-600 transition-colors"
              >
                Saved Drills
              </button>
              <button 
                onClick={logout}
                className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg"
            >
              Login / Sign Up
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-12 space-y-12">
        <section className="bg-white p-12 rounded-[3rem] shadow-xl space-y-8 border border-slate-100">
          <input 
            value={session.title} 
            onChange={e => setSession(p => ({...p, title: e.target.value}))}
            className="text-5xl font-black w-full outline-none placeholder-slate-100 tracking-tight bg-transparent"
            placeholder="Session Title"
          />
          <div className="flex gap-8">
            <div className="flex flex-col gap-2 flex-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session Date</label>
               <input type="date" value={session.date} onChange={e => setSession(p => ({...p, date: e.target.value}))} className="bg-slate-50 px-6 py-4 rounded-xl font-bold border-2 border-transparent focus:border-emerald-500 outline-none w-full" />
            </div>
            <div className="flex flex-col gap-2 flex-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Squad / Team</label>
               <input type="text" value={session.team} onChange={e => setSession(p => ({...p, team: e.target.value}))} className="bg-slate-50 px-6 py-4 rounded-xl font-bold border-2 border-transparent focus:border-emerald-500 outline-none w-full" placeholder="Team Name" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session Objectives & Notes</label>
             <textarea 
               value={session.notes || ''} 
               onChange={e => setSession(p => ({...p, notes: e.target.value}))} 
               placeholder="Write session focus here..." 
               className="bg-slate-50 px-8 py-6 rounded-[2rem] font-medium text-slate-600 border-2 border-transparent focus:border-emerald-500 outline-none w-full min-h-[120px] resize-none"
             />
          </div>
        </section>

        <div className="space-y-24">
          <div className="flex items-center justify-between px-4">
             <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Drills <span className="text-emerald-500 ml-2">{session.drills.length}</span></h2>
             <button 
               onClick={addManualDrill}
               className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
               Add Drill
             </button>
          </div>
          
          {session.drills.map(d => (
            <DrillCard 
              key={d.id} 
              drill={d} 
              onRemove={() => setSession(p => ({...p, drills: p.drills.filter(x => x.id !== d.id)}))}
              onUpdateDrill={updateDrill}
              onSave={() => handleSaveDrill(d)}
              onUpgradeRequired={(callback?: any) => {
                if (callback === 'AUTH') {
                  setIsAuthModalOpen(true);
                  return;
                }
                if (typeof callback === 'function' && subscription) {
                  // This is a currency selection request
                  const canUseCredits = subscription.credits >= 5;
                  const canUsePoints = subscription.pepPoints >= 1;

                  if (!canUseCredits && !canUsePoints) {
                    setIsPricingOpen(true);
                    return;
                  }

                  // Force modal if any currency is available
                  setIsCurrencyModalOpen(true);
                  setPendingAction(() => callback);
                } else {
                  // Legacy call
                  setIsPricingOpen(true);
                }
              }}
              isLoggedIn={!!user}
            />
          ))}

          {isGenerating && (
            <div className="h-64 bg-white rounded-[3rem] border-4 border-dashed border-emerald-100 animate-pulse flex flex-col items-center justify-center gap-4">
               <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="font-black text-emerald-600 uppercase tracking-widest text-sm">
                 {isRetrying ? 'Pep is busy, retrying...' : 'Pep is drafting a drill...'}
               </p>
            </div>
          )}

          <div className="flex justify-center pt-8">
            <button 
              onClick={addManualDrill}
              className="group bg-white border-4 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 w-full py-12 rounded-[3rem] transition-all flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-slate-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xl font-black uppercase tracking-widest">Manually Add Drill</span>
            </button>
          </div>
        </div>
      </main>

      {/* History Sidebar/Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-white p-8 shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Saved Drills</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-150px)] pr-2">
              {drillHistory.length === 0 ? (
                <p className="text-slate-400 font-medium text-center py-12">No drills saved yet.</p>
              ) : (
                drillHistory.map((drill) => (
                  <div 
                    key={drill.id} 
                    className="group bg-slate-50 p-6 rounded-2xl border-2 border-transparent hover:border-emerald-500 transition-all cursor-pointer"
                    onClick={() => setSelectedHistoryDrill(drill)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">{drill.name}</h3>
                      <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                        {drill.categories && drill.categories.length > 0 ? (
                          drill.categories.map(type => (
                            <DrillTypeBadge key={type} type={type} />
                          ))
                        ) : (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{(drill as any).category || 'Tactical'}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4">{drill.setup}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400">{new Date(drill.createdAt.seconds * 1000).toLocaleDateString()}</span>
                      <span className="text-[10px] font-black text-emerald-600 group-hover:translate-x-1 transition-transform">VIEW DETAILS →</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drill Detail Pop-up */}
      {selectedHistoryDrill && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 lg:p-12">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg font-black text-lg">P</div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Drill Details</h2>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => reuseDrill(selectedHistoryDrill)}
                  className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
                >
                  Reuse Drill →
                </button>
                <button 
                  onClick={() => setSelectedHistoryDrill(null)} 
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 lg:p-12">
              <DrillCard 
                drill={selectedHistoryDrill} 
                onRemove={() => {}} // No-op in history view
                onUpdateDrill={() => {}} // No-op in history view
                readOnly={true}
              />
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <CurrencySelectionModal 
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        credits={subscription?.credits || 0}
        pepPoints={subscription?.pepPoints || 0}
        onSelect={(type) => {
          setIsCurrencyModalOpen(false);
          if (pendingAction) {
            (pendingAction as any)(type);
            setPendingAction(null);
          }
        }}
      />

      {isPricingOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 lg:p-12">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg font-black text-lg">P</div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Upgrade Required</h2>
              </div>
              <button 
                onClick={() => setIsPricingOpen(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 lg:p-12">
              <div className="text-center mb-12">
                <p className="text-xl text-slate-600 font-medium">
                  This feature is only available on professional plans. Upgrade now to unlock full access.
                </p>
              </div>
              <PricingTable />
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-slate-200 p-8 z-40">
        <div className="w-full px-8">
          <form onSubmit={handleGenerate} className="flex flex-col gap-6">
            <div className="flex items-center gap-12">
              <div className="relative flex-1 flex items-center">
                <input 
                  type="text" 
                  placeholder="Describe a drill: 'A 5v5 rondo with two neutrals...'" 
                  className="w-full bg-slate-100 rounded-2xl pl-8 pr-48 py-5 text-xl font-bold outline-none border-4 border-transparent focus:bg-white focus:border-emerald-500 shadow-inner"
                  value={prompt}
                  onChange={e => {
                    setPrompt(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isGenerating}
                />
                <div className="absolute right-3 flex items-center gap-3">
                  <VoiceAssistant 
                    session={session} 
                    currentDrill={latestDrill}
                    onUpdateDrill={updateDrill}
                    onTranscriptChange={setPrompt} 
                    isProcessing={isGenerating} 
                  />
                  <button 
                    type="submit" 
                    disabled={!prompt.trim() || isGenerating} 
                    className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 shadow-lg disabled:opacity-50 transition-all h-14 flex flex-col items-center justify-center leading-tight"
                  >
                    <span>{isGenerating ? 'Drafting...' : 'Create'}</span>

                  </button>
                </div>
              </div>
              
            <div className="flex items-center gap-3 ml-auto">
              <button 
                type="button"
                onClick={handleSaveAll}
                disabled={isSavingAll || session.drills.length === 0}
                className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 shadow-md disabled:opacity-20 transition-all h-12 flex items-center gap-2 whitespace-nowrap"
              >
                {isSavingAll ? (
                  <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                )}
                {isSavingAll ? 'Saving...' : 'Save Drills'}
              </button>
              <button 
                type="button"
                onClick={handleShare} 
                disabled={isSharing || session.drills.length === 0}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-20 transition-all h-12 flex items-center gap-2 whitespace-nowrap shadow-md"
              >
                {isSharing ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6a3 3 0 010-2.684m0 2.684l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
                {isSharing ? 'Generating...' : 'Share Session'}
              </button>
            </div>
            </div>
            {error && (
              <p className="text-red-500 text-xs font-bold ml-4 animate-in fade-in slide-in-from-top-1">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;
