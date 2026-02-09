import React, { useState, useRef, useMemo } from 'react';
import { Drill, PositionType, PitchPosition, PitchLayout, DrillArrow, ArrowType, Point } from '../types/types';

export type TacticalTool = 'select' | 'player' | 'cone' | 'ball' | 'goal' | 'pass' | 'dribble' | 'run';

interface PitchVisualizerProps {
  drill: Drill;
  onUpdatePositions?: (newPositions: PitchPosition[]) => void;
  onUpdateArrows?: (newArrows: DrillArrow[]) => void;
  onSelectPosition?: (idx: number) => void;
  selectedArrowId?: string | null;
  onSelectArrow?: (id: string | null) => void;
  tool?: TacticalTool;
  onToolChange?: (tool: TacticalTool) => void;
  readOnly?: boolean;
}

const PitchVisualizer: React.FC<PitchVisualizerProps> = ({ 
  drill, 
  onUpdatePositions, 
  onUpdateArrows,
  onSelectPosition,
  selectedArrowId,
  onSelectArrow,
  tool = 'select',
  onToolChange,
  readOnly = false 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [draggingArrowId, setDraggingArrowId] = useState<string | null>(null);
  const [lastPointerPos, setLastPointerPos] = useState<Point | null>(null);
  const [draggingArrowHandle, setDraggingArrowHandle] = useState<{ id: string, point: 'start' | 'end' } | null>(null);
  const [drawingArrow, setDrawingArrow] = useState<{ start: Point, end: Point } | null>(null);

  const visualizerId = useMemo(() => drill.id.slice(0, 8), [drill.id]);

  const toSVG = (p: number) => p * 10;

  const getCoordFromEvent = (e: React.PointerEvent | PointerEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    const coord = getCoordFromEvent(e);

    if (tool === 'select') {
      if (e.target === e.currentTarget) {
        onSelectPosition?.(-1);
        onSelectArrow?.(null);
      }
    } else if (['pass', 'dribble', 'run'].includes(tool)) {
      e.preventDefault();
      setDrawingArrow({ start: coord, end: coord });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      // Place marker
      const typeMap: Record<string, PositionType> = {
        'player': PositionType.PLAYER,
        'cone': PositionType.CONE,
        'ball': PositionType.BALL,
        'goal': PositionType.GOAL
      };
      const newPos: PitchPosition = {
        id: crypto.randomUUID(),
        x: coord.x,
        y: coord.y,
        label: tool === 'player' ? (drill.positions.filter(p => p.type === PositionType.PLAYER).length + 1).toString() : '',
        type: typeMap[tool] || PositionType.PLAYER,
        color: tool === 'player' ? '#2563eb' : undefined
      };
      onUpdatePositions?.([...drill.positions, newPos]);
    }
  };

  const handleItemPointerDown = (e: React.PointerEvent, idx: number) => {
    if (readOnly || tool !== 'select') return;
    e.stopPropagation();
    setDraggingIdx(idx);
    onSelectPosition?.(idx);
    onSelectArrow?.(null);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleArrowPointerDown = (e: React.PointerEvent, arrowId: string) => {
    if (readOnly || tool !== 'select') return;
    e.stopPropagation();
    onSelectArrow?.(arrowId);
    onSelectPosition?.(-1);
    setDraggingArrowId(arrowId);
    setLastPointerPos(getCoordFromEvent(e));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHandlePointerDown = (e: React.PointerEvent, arrowId: string, point: 'start' | 'end') => {
    if (readOnly || tool !== 'select') return;
    e.stopPropagation();
    setDraggingArrowHandle({ id: arrowId, point });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (draggingIdx !== null && tool === 'select') {
      const coord = getCoordFromEvent(e);
      const newPositions = [...drill.positions];
      newPositions[draggingIdx] = { ...newPositions[draggingIdx], x: coord.x, y: coord.y };
      onUpdatePositions?.(newPositions);
    } else if (draggingArrowHandle !== null && tool === 'select') {
      const coord = getCoordFromEvent(e);
      const newArrows = (drill.arrows || []).map(a => 
        a.id === draggingArrowHandle.id ? { ...a, [draggingArrowHandle.point]: coord } : a
      );
      onUpdateArrows?.(newArrows);
    } else if (draggingArrowId !== null && lastPointerPos && tool === 'select') {
      const currentPos = getCoordFromEvent(e);
      const dx = currentPos.x - lastPointerPos.x;
      const dy = currentPos.y - lastPointerPos.y;
      const newArrows = (drill.arrows || []).map(a => {
        if (a.id === draggingArrowId) {
          return {
            ...a,
            start: { x: a.start.x + dx, y: a.start.y + dy },
            end: { x: a.end.x + dx, y: a.end.y + dy }
          };
        }
        return a;
      });
      onUpdateArrows?.(newArrows);
      setLastPointerPos(currentPos);
    } else if (drawingArrow) {
      const coord = getCoordFromEvent(e);
      setDrawingArrow(prev => prev ? { ...prev, end: coord } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingIdx !== null) {
      setDraggingIdx(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } else if (draggingArrowHandle !== null) {
      setDraggingArrowHandle(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } else if (draggingArrowId !== null) {
      setDraggingArrowId(null);
      setLastPointerPos(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } else if (drawingArrow) {
      let type = ArrowType.PASS;
      if (tool === 'dribble') type = ArrowType.DRIBBLE;
      if (tool === 'run') type = ArrowType.RUN;
      const newArrow: DrillArrow = { id: crypto.randomUUID(), start: drawingArrow.start, end: drawingArrow.end, type };
      const dist = Math.sqrt(Math.pow(newArrow.end.x - newArrow.start.x, 2) + Math.pow(newArrow.end.y - newArrow.start.y, 2));
      if (dist > 1.5) {
        onUpdateArrows?.([...(drill.arrows || []), newArrow]);
        onSelectArrow?.(newArrow.id);
      }
      setDrawingArrow(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const renderPitchMarkings = () => {
    const strokeProps = { stroke: "#ffffff", strokeWidth: 5, fill: "none", opacity: 0.8 };
    switch (drill.layout) {
      case PitchLayout.FULL:
        return (
          <g>
            {/* Outer boundary - Maximized within square container while keeping rectangular feel */}
            <rect x="100" y="10" width="800" height="980" {...strokeProps} />
            {/* Halfway line */}
            <line x1="100" y1="500" x2="900" y2="500" {...strokeProps} />
            {/* Center circle */}
            <circle cx="500" cy="500" r="120" {...strokeProps} />
            {/* Penalty areas */}
            <rect x="250" y="10" width="500" height="180" {...strokeProps} />
            <rect x="250" y="810" width="500" height="180" {...strokeProps} />
            {/* Goal areas */}
            <rect x="370" y="10" width="260" height="60" {...strokeProps} />
            <rect x="370" y="930" width="260" height="60" {...strokeProps} />
            {/* Penalty arcs */}
            <path d="M 380 190 A 120 120 0 0 0 620 190" {...strokeProps} />
            <path d="M 380 810 A 120 120 0 0 1 620 810" {...strokeProps} />
          </g>
        );
      case PitchLayout.HALF:
        return (
          <g>
            {/* Outer boundary - Maximized for Half Pitch */}
            <rect x="50" y="50" width="900" height="900" {...strokeProps} />
            {/* Penalty area (18-yard box) - Proportionally sized */}
            <rect x="200" y="600" width="600" height="350" {...strokeProps} />
            {/* Goal area (6-yard box) */}
            <rect x="360" y="830" width="280" height="120" {...strokeProps} />
            {/* Penalty arc (the "D") - Outside the 18-yard box */}
            <path d="M 380 600 A 120 120 0 0 1 620 600" {...strokeProps} />
          </g>
        );
      case PitchLayout.GRID:
        return (
          <g>
             {[...Array(9)].map((_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 125} x2="1000" y2={i * 125} stroke="#ffffff" strokeWidth="2" strokeOpacity="0.4" />
             ))}
             {[...Array(9)].map((_, i) => (
                <line key={`v${i}`} x1={i * 125} y1="0" x2={i * 125} y2="1000" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.4" />
             ))}
          </g>
        );
      default:
        return null;
    }
  };

  const renderArrow = (arrow: DrillArrow, isSelected: boolean) => {
    const startX = toSVG(arrow.start.x);
    const startY = toSVG(arrow.start.y);
    const endX = toSVG(arrow.end.x);
    const endY = toSVG(arrow.end.y);

    let strokeColor = "#ffffff";
    if (arrow.type === ArrowType.DRIBBLE) strokeColor = "#facc15";
    else if (arrow.type === ArrowType.RUN) strokeColor = "#000000";

    let dashArray = "0";
    if (arrow.type === ArrowType.DRIBBLE) dashArray = "15,10";
    else if (arrow.type === ArrowType.RUN) dashArray = "5,8";

    const angle = Math.atan2(endY - startY, endX - startX);
    const headSize = 35; 
    
    // Offset the line end so it doesn't poke through the arrowhead
    const lineEndX = endX - (headSize * 0.5) * Math.cos(angle);
    const lineEndY = endY - (headSize * 0.5) * Math.sin(angle);

    const h1X = endX - headSize * Math.cos(angle - Math.PI / 6);
    const h1Y = endY - headSize * Math.sin(angle - Math.PI / 6);
    const h2X = endX - headSize * Math.cos(angle + Math.PI / 6);
    const h2Y = endY - headSize * Math.sin(angle + Math.PI / 6);

    return (
      <g key={arrow.id}>
        {!readOnly && (
          <line
            x1={startX} y1={startY} x2={endX} y2={endY}
            stroke="transparent" strokeWidth="60"
            className="pointer-events-auto cursor-pointer"
            onPointerDown={(e) => handleArrowPointerDown(e, arrow.id)}
          />
        )}
        <line
          x1={startX} y1={startY} x2={lineEndX} y2={lineEndY}
          stroke={strokeColor}
          strokeWidth={isSelected ? 12 : 10}
          strokeDasharray={dashArray}
        />
        <polygon points={`${endX},${endY} ${h1X},${h1Y} ${h2X},${h2Y}`} fill={strokeColor} />
        {isSelected && !readOnly && (
          <>
            <circle cx={startX} cy={startY} r="15" fill="#ffffff" stroke="#1e293b" strokeWidth="4" className="pointer-events-auto cursor-move" onPointerDown={(e) => handleHandlePointerDown(e, arrow.id, 'start')} />
            <circle cx={endX} cy={endY} r="15" fill="#ffffff" stroke="#1e293b" strokeWidth="4" className="pointer-events-auto cursor-move" onPointerDown={(e) => handleHandlePointerDown(e, arrow.id, 'end')} />
          </>
        )}
      </g>
    );
  };

  const ToolButton = ({ t, label, icon }: { t: TacticalTool, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => onToolChange?.(t)}
      className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
        tool === t ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white/90 text-slate-600 hover:bg-slate-100'
      }`}
      title={label}
    >
      {icon}
      <span className="text-[7px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );

  return (
    <div className="flex gap-4 w-full h-full">
      {!readOnly && (
        <div className="flex flex-col gap-2 shrink-0">
          <ToolButton t="select" label="Select" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>} />
          <div className="h-px bg-slate-200 my-1 mx-2" />
          <ToolButton t="player" label="Player" icon={<div className="w-5 h-5 rounded-full border-2 border-current" />} />
          <ToolButton t="cone" label="Cone" icon={<div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-current" />} />
          <ToolButton t="ball" label="Ball" icon={<div className="w-4 h-4 rounded-full bg-current" />} />
          <ToolButton t="goal" label="Goal" icon={<div className="w-6 h-3 border-2 border-current rounded-xs" />} />
          <div className="h-px bg-slate-200 my-1 mx-2" />
          <ToolButton t="pass" label="Pass/Shot" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>} />
          <ToolButton t="dribble" label="Dribble" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeDasharray="4 4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>} />
          <ToolButton t="run" label="Run" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeDasharray="1 3"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>} />
        </div>
      )}

      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative flex-1 h-full bg-[#1e4d3b] rounded-[2rem] overflow-hidden border-8 border-[#2d6650] shadow-2xl select-none aspect-square ${
          tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
      >
        <svg 
          width="1000"
          height="1000"
          viewBox="0 0 1000 1000"
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          style={{ backgroundColor: '#1e4d3b' }} 
        >
          {renderPitchMarkings()}
          {(drill.arrows || []).map((arrow) => renderArrow(arrow, arrow.id === selectedArrowId))}
          {drawingArrow && renderArrow({
            id: `temp-${visualizerId}`,
            start: drawingArrow.start,
            end: drawingArrow.end,
            type: tool === 'pass' ? ArrowType.PASS : (tool === 'dribble' ? ArrowType.DRIBBLE : ArrowType.RUN)
          }, false)}
        </svg>

        {drill.positions.map((pos, idx) => (
          <div
            key={pos.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform ${
              !readOnly && tool === 'select' ? 'cursor-move active:scale-125 z-20' : 'z-10'
            } ${draggingIdx === idx ? 'opacity-70 scale-150 z-30' : 'hover:scale-110'}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, touchAction: 'none' }}
            onPointerDown={(e) => handleItemPointerDown(e, idx)}
          >
            {pos.type === PositionType.PLAYER && (
              <div className="w-9 h-9 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-[10px] text-white font-black" style={{ backgroundColor: pos.color || '#2563eb' }}>
                {pos.label || 'P'}
              </div>
            )}
            {pos.type === PositionType.CONE && (
              <div className="relative group">
                <div 
                  className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] shadow-md" 
                  style={{ borderBottomColor: pos.color || '#f97316' }}
                ></div>
                {pos.label && (
                  <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-black text-white pointer-events-none">
                    {pos.label}
                  </div>
                )}
              </div>
            )}
            {pos.type === PositionType.BALL && (
              <div className="w-8 h-8 bg-white rounded-full border-2 border-slate-900 shadow-xl flex items-center justify-center"></div>
            )}
            {pos.type === PositionType.GOAL && (
              <div className="border-4 border-white bg-white/10 flex items-center justify-center text-[10px] text-white font-black uppercase tracking-widest rounded-sm backdrop-blur-[1px]"
                style={{ 
                  width: pos.size === 'small' ? '40px' : pos.size === 'large' ? '120px' : '80px', 
                  height: pos.size === 'small' ? '16px' : pos.size === 'large' ? '32px' : '24px',
                  fontSize: pos.size === 'small' ? '8px' : pos.size === 'large' ? '12px' : '10px'
                }}>
                Goal
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PitchVisualizer;
