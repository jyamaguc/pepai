import React, { useState, useEffect, useRef } from 'react';
import { Drill, PitchPosition, DrillArrow, PitchLayout, PositionType } from '../types/types';
import PitchVisualizer, { TacticalTool } from './PitchVisualizer';
import VoiceAssistant from './VoiceAssistant';
import { refineDrillStream, processDrillJson } from '../services/geminiService';

interface DrillCardProps {
  drill: Drill;
  onRemove: () => void;
  onUpdateDrill: (updated: Drill) => void;
  onSave?: () => void;
  isLoggedIn?: boolean;
  streaming?: boolean;
  readOnly?: boolean;
}

const DrillCard: React.FC<DrillCardProps> = ({ drill, onRemove, onUpdateDrill, onSave, isLoggedIn, streaming, readOnly = false }) => {
  const [refineText, setRefineText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeTool, setActiveTool] = useState<TacticalTool>('select');
  const [selectedPositionIdx, setSelectedPositionIdx] = useState<number>(-1);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineText.trim() || isUpdating || readOnly) return;
    setIsUpdating(true);
    setIsRetrying(false);
    try {
      const stream = refineDrillStream(drill, refineText);
      let lastText = "";
      for await (const text of stream) {
        if (text === "RETRYING") {
          setIsRetrying(true);
          continue;
        }
        setIsRetrying(false);
        lastText = text;
        // Optional: Update UI in real-time as it streams
        try {
          const partialDrill = processDrillJson(JSON.parse(lastText), drill.id);
          onUpdateDrill(partialDrill);
        } catch (e) {
          // Ignore partial parse errors
        }
      }
      setRefineText('');
    } catch (err) {
      console.error("Refinement failed:", err);
    } finally {
      setIsUpdating(false);
      setIsRetrying(false);
    }
  };

  const updateField = (field: keyof Drill, value: any) => {
    if (readOnly) return;
    onUpdateDrill({ ...drill, [field]: value });
  };

  const updateListItem = (field: 'instructions' | 'coachingPoints', index: number, value: string) => {
    if (readOnly) return;
    const newList = [...drill[field]];
    newList[index] = value;
    updateField(field, newList);
  };

  const addItem = (field: 'instructions' | 'coachingPoints') => {
    if (readOnly) return;
    updateField(field, [...drill[field], 'New step...']);
  };

  const removeItem = (field: 'instructions' | 'coachingPoints', index: number) => {
    if (readOnly) return;
    const newList = drill[field].filter((_, i) => i !== index);
    updateField(field, newList);
  };

  const textareaRef = (el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'inherit';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>, callback: (val: string) => void) => {
    if (readOnly) return;
    callback(e.target.value);
    textareaRef(e.target);
  };

  return (
    <div className={`bg-white rounded-[3rem] overflow-hidden shadow-xl border border-slate-200 transition-all relative ${streaming ? 'opacity-50 blur-[2px]' : ''}`}>
      {isUpdating && (
        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-emerald-600 uppercase tracking-widest text-sm">
            {isRetrying ? 'Pep is busy, retrying...' : 'Refining drill...'}
          </p>
        </div>
      )}
      <div className="p-8 lg:p-12 grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* Left Column: Drill Graphic */}
        <div className="flex flex-col h-full space-y-4">
          {!readOnly && (
            <div className="flex flex-col items-center">
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                {[
                  { id: PitchLayout.FULL, label: 'Full Pitch' },
                  { id: PitchLayout.HALF, label: 'Half Pitch' },
                  { id: PitchLayout.GRID, label: 'Grid View' }
                ].map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => updateField('layout', layout.id)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      drill.layout === layout.id 
                        ? 'bg-slate-900 text-white shadow-md' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={`${readOnly ? 'h-[400px]' : 'h-[700px]'} w-full shrink-0 transition-all duration-500`}>
            <PitchVisualizer 
              drill={drill} 
              tool={activeTool}
              onToolChange={setActiveTool}
              onSelectPosition={setSelectedPositionIdx}
              selectedArrowId={selectedArrowId}
              onSelectArrow={setSelectedArrowId}
              onUpdatePositions={(pos) => onUpdateDrill({ ...drill, positions: pos })}
              onUpdateArrows={(arr) => onUpdateDrill({ ...drill, arrows: arr })}
              readOnly={readOnly}
            />
          </div>

          {/* Property Controller Area (Reserved Space) */}
          {!readOnly && (
            <div className="min-h-[180px] flex flex-col justify-start">
              {selectedPositionIdx !== -1 && drill.positions[selectedPositionIdx] ? (
                <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Edit {drill.positions[selectedPositionIdx].type}
                    </h5>
                    <button 
                      onClick={() => {
                        const newPositions = drill.positions.filter((_, i) => i !== selectedPositionIdx);
                        onUpdateDrill({ ...drill, positions: newPositions });
                        setSelectedPositionIdx(-1);
                      }}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    {drill.positions[selectedPositionIdx].type !== PositionType.GOAL ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Label</label>
                          <input 
                            type="text"
                            value={drill.positions[selectedPositionIdx].label || ''}
                            onChange={(e) => {
                              const newPositions = [...drill.positions];
                              newPositions[selectedPositionIdx] = { ...newPositions[selectedPositionIdx], label: e.target.value };
                              onUpdateDrill({ ...drill, positions: newPositions });
                            }}
                            className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-emerald-400 transition-all"
                            placeholder="e.g. P1, GK"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Color</label>
                          <div className="flex gap-2">
                            {(drill.positions[selectedPositionIdx].type === PositionType.PLAYER 
                              ? ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea']
                              : ['#f97316', '#facc15', '#ef4444', '#3b82f6', '#ffffff']
                            ).map((color) => (
                              <button
                                key={color}
                                onClick={() => {
                                  const newPositions = [...drill.positions];
                                  newPositions[selectedPositionIdx] = { ...newPositions[selectedPositionIdx], color };
                                  onUpdateDrill({ ...drill, positions: newPositions });
                                }}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${
                                  drill.positions[selectedPositionIdx].color === color ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <input 
                              type="color"
                              value={drill.positions[selectedPositionIdx].color || (drill.positions[selectedPositionIdx].type === PositionType.PLAYER ? '#2563eb' : '#f97316')}
                              onChange={(e) => {
                                const newPositions = [...drill.positions];
                                newPositions[selectedPositionIdx] = { ...newPositions[selectedPositionIdx], color: e.target.value };
                                onUpdateDrill({ ...drill, positions: newPositions });
                              }}
                              className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 space-y-2">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Goal Size</label>
                        <div className="flex gap-4">
                          {['small', 'medium', 'large'].map((size) => (
                            <button
                              key={size}
                              onClick={() => {
                                const newPositions = [...drill.positions];
                                newPositions[selectedPositionIdx] = { ...newPositions[selectedPositionIdx], size: size as any };
                                onUpdateDrill({ ...drill, positions: newPositions });
                              }}
                              className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                                (drill.positions[selectedPositionIdx].size || 'medium') === size 
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                                  : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedArrowId ? (
              <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Edit {drill.arrows?.find(a => a.id === selectedArrowId)?.type === 'pass' ? 'Pass/Shot' : (drill.arrows?.find(a => a.id === selectedArrowId)?.type || 'Line')}
                  </h5>
                  <button 
                    onClick={() => {
                      const newArrows = (drill.arrows || []).filter(a => a.id !== selectedArrowId);
                      onUpdateDrill({ ...drill, arrows: newArrows });
                      setSelectedArrowId(null);
                    }}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="flex items-center justify-center h-12 border-2 border-dashed border-slate-200 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Line selected - click trash to delete</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Select an item to edit</p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Right Column: All other information */}
        <div className="flex flex-col justify-between space-y-12">
          <div className="space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-4 flex-1">
                {readOnly ? (
                  <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{drill.name}</h3>
                ) : (
                  <input 
                    value={drill.name} 
                    onChange={(e) => updateField('name', e.target.value)}
                    className="text-4xl font-extrabold text-slate-900 tracking-tight w-full outline-none focus:text-emerald-600 border-b-2 border-transparent focus:border-emerald-100 transition-all"
                    placeholder="Drill Name"
                  />
                )}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1 bg-emerald-100 px-3 py-1 rounded-lg">
                    <span className="text-[8px] font-black text-emerald-500 uppercase">Type:</span>
                    {readOnly ? (
                      <span className="text-emerald-700 text-[10px] font-black uppercase">{drill.category}</span>
                    ) : (
                      <input value={drill.category} onChange={e => updateField('category', e.target.value)} className="bg-transparent text-emerald-700 text-[10px] font-black uppercase outline-none w-20" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-blue-100 px-3 py-1 rounded-lg">
                    <span className="text-[8px] font-black text-blue-500 uppercase">Time:</span>
                    {readOnly ? (
                      <span className="text-blue-700 text-[10px] font-black uppercase">{drill.duration}</span>
                    ) : (
                      <input value={drill.duration} onChange={e => updateField('duration', e.target.value)} className="bg-transparent text-blue-700 text-[10px] font-black uppercase outline-none w-16" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-lg">
                    {readOnly ? (
                      <span className="text-slate-600 text-[10px] font-black uppercase">{drill.players}</span>
                    ) : (
                      <input value={drill.players} onChange={e => updateField('players', e.target.value)} className="bg-transparent text-slate-600 text-[10px] font-black uppercase outline-none w-8 text-center" />
                    )}
                    <span className="text-[8px] font-black text-slate-400 uppercase">Players</span>
                  </div>
                </div>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  {isLoggedIn && onSave && (
                    <button 
                      onClick={onSave} 
                      className="p-3 text-slate-300 hover:text-emerald-500 transition-colors"
                      title="Save to History"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.064 2.047a1.5 1.5 0 011.06.44l2.387 2.387a1.5 1.5 0 01.44 1.06V19.5a2 2 0 01-2 2H5.5a2 2 0 01-2-2V4.5a2 2 0 012-2h11.564zM15 4.5H6v6h9v-6zM15 19.5v-6H9v6h6z" />
                      </svg>
                    </button>
                  )}
                  <button onClick={onRemove} className="p-3 text-slate-300 hover:text-red-500 transition-colors" title="Remove Drill">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Setup Description</label>
              {readOnly ? (
                <p className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-medium text-slate-600">{drill.setup}</p>
              ) : (
                <textarea 
                  ref={textareaRef}
                  value={drill.setup} 
                  onChange={e => handleTextareaChange(e, (val) => updateField('setup', val))}
                  className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-medium text-slate-600 outline-none border-2 border-transparent focus:border-emerald-100 resize-none overflow-hidden"
                  rows={1}
                />
              )}
            </div>

            <section>
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Instructions</h4>
                {!readOnly && <button onClick={() => addItem('instructions')} className="text-emerald-500 hover:text-emerald-600 text-[10px] font-black uppercase tracking-widest">+ Add Step</button>}
              </div>
              <ul className="space-y-4">
                {drill.instructions.map((step, i) => (
                  <li key={i} className="group flex gap-4 items-start">
                    <span className="w-8 h-8 bg-slate-900 text-white text-[10px] flex items-center justify-center rounded-xl shrink-0 mt-1 shadow-lg font-black">{i + 1}</span>
                    <div className="flex-1 relative">
                      {readOnly ? (
                        <p className="w-full bg-transparent text-slate-600 font-bold py-1">{step}</p>
                      ) : (
                        <>
                          <textarea 
                            ref={textareaRef}
                            value={step} 
                            onChange={e => handleTextareaChange(e, (val) => updateListItem('instructions', i, val))}
                            className="w-full bg-transparent text-slate-600 font-bold outline-none border-b border-slate-100 py-1 focus:border-emerald-400 transition-all resize-none overflow-hidden"
                            rows={1}
                          />
                          <button onClick={() => removeItem('instructions', i)} className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Coaching Focus</h4>
                {!readOnly && <button onClick={() => addItem('coachingPoints')} className="text-emerald-500 hover:text-emerald-600 text-[10px] font-black uppercase tracking-widest">+ Add Point</button>}
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drill.coachingPoints.map((point, i) => (
                  <li key={i} className="group relative flex items-center gap-3 bg-emerald-50 px-5 py-4 rounded-[1.5rem] border border-emerald-100 transition-all hover:bg-emerald-100">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0"></div>
                    {readOnly ? (
                      <p className="bg-transparent text-emerald-800 text-sm font-bold flex-1">{point}</p>
                    ) : (
                      <>
                        <textarea 
                          ref={textareaRef}
                          value={point} 
                          onChange={e => handleTextareaChange(e, (val) => updateListItem('coachingPoints', i, val))}
                          className="bg-transparent text-emerald-800 text-sm font-bold outline-none flex-1 resize-none overflow-hidden"
                          rows={1}
                        />
                        <button onClick={() => removeItem('coachingPoints', i)} className="opacity-0 group-hover:opacity-100 text-emerald-400 hover:text-emerald-600 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {!readOnly && (
            <form onSubmit={handleRefine} className="relative mt-auto">
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  placeholder="Ask Pep to refine..." 
                  className="w-full bg-slate-50 border-4 border-slate-50 rounded-[2rem] px-8 py-6 pr-48 text-lg font-bold focus:bg-white focus:border-emerald-500/10 transition-all outline-none shadow-inner"
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  disabled={isUpdating}
                />
                <div className="absolute right-4 flex items-center gap-3">
                  <VoiceAssistant 
                    currentDrill={drill}
                    onUpdateDrill={onUpdateDrill}
                    onTranscriptChange={setRefineText} 
                    isProcessing={isUpdating} 
                  />
                  <button 
                    type="submit" 
                    disabled={!refineText.trim() || isUpdating}
                    className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 hover:bg-slate-800 transition-all shadow-xl h-12 flex items-center justify-center"
                  >
                    {isUpdating ? 'UPDATING...' : 'REFINE'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrillCard;
