"use client";

import React, { useState, useRef } from 'react';
import { Drill, PitchLayout, PitchPosition, PositionType, ArrowType, DrillArrow, Point } from '@/types/types';

interface DrillGraphicProps {
  drill: Drill;
  onUpdate: (updatedDrill: Drill) => void;
  readOnly?: boolean;
}

type ToolMode = 'move' | 'add-player' | 'add-ball' | 'add-cone' | 'add-goal' | 'add-arrow';

export const DrillGraphic: React.FC<DrillGraphicProps> = ({ drill, onUpdate, readOnly = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDraggingOffset] = useState<Point>({ x: 0, y: 0 });
  const [toolMode, setToolMode] = useState<ToolMode>('move');
  const [arrowStart, setArrowStart] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getSvgPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    const point = getSvgPoint(e);

    if (toolMode === 'move') {
      const clickedPos = [...drill.positions].reverse().find(p => {
        const dist = Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2));
        return dist < 4;
      });

      if (clickedPos) {
        setDraggingId(clickedPos.id);
        setDraggingOffset({
          x: point.x - clickedPos.x,
          y: point.y - clickedPos.y
        });
      }
    } else if (toolMode.startsWith('add-')) {
      const type = toolMode.split('-')[1];
      if (type === 'arrow') {
        setArrowStart(point);
      } else {
        const newPos: PitchPosition = {
          id: crypto.randomUUID(),
          x: point.x,
          y: point.y,
          label: type === 'player' ? `P${drill.positions.filter(p => p.type === PositionType.PLAYER).length + 1}` : '',
          type: type as PositionType,
        };
        onUpdate({ ...drill, positions: [...drill.positions, newPos] });
        setToolMode('move');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (readOnly) return;
    const point = getSvgPoint(e);
    setCurrentPoint(point);

    if (draggingId) {
      const updatedPositions = drill.positions.map(p => {
        if (p.id === draggingId) {
          return {
            ...p,
            x: Math.max(0, Math.min(100, point.x - dragOffset.x)),
            y: Math.max(0, Math.min(100, point.y - dragOffset.y))
          };
        }
        return p;
      });
      onUpdate({ ...drill, positions: updatedPositions });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (readOnly) return;
    const point = getSvgPoint(e);

    if (arrowStart) {
      const newArrow: DrillArrow = {
        id: crypto.randomUUID(),
        start: arrowStart,
        end: point,
        type: ArrowType.PASS,
      };
      onUpdate({ ...drill, arrows: [...drill.arrows, newArrow] });
      setArrowStart(null);
      setToolMode('move');
    }
    setDraggingId(null);
  };

  const deleteElement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    onUpdate({
      ...drill,
      positions: drill.positions.filter(p => p.id !== id),
      arrows: drill.arrows.filter(a => a.id !== id)
    });
  };

  const pitchColor = "#2d5a27";
  const lineColor = "#ffffff";
  const lineWidth = 0.5;

  const renderPitch = () => {
    switch (drill.layout) {
      case PitchLayout.FULL:
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill={pitchColor} />
            <rect x="2" y="2" width="96" height="96" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
            <line x1="50" y1="2" x2="50" y2="98" stroke={lineColor} strokeWidth={lineWidth} />
            <circle cx="50" cy="50" r="8" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
            <rect x="2" y="25" width="16" height="50" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
            <rect x="82" y="25" width="16" height="50" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
          </>
        );
      case PitchLayout.HALF:
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill={pitchColor} />
            <rect x="2" y="2" width="96" height="96" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
            <rect x="2" y="20" width="25" height="60" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
            <path d="M 27 40 A 10 10 0 0 1 27 60" fill="none" stroke={lineColor} strokeWidth={lineWidth} />
          </>
        );
      default:
        return (
          <>
            <rect x="0" y="0" width="100" height="100" fill={pitchColor} />
            <rect x="10" y="10" width="80" height="80" fill="none" stroke={lineColor} strokeWidth={lineWidth} strokeDasharray="2,2" />
          </>
        );
    }
  };

  const renderPosition = (pos: PitchPosition) => {
    const isHovered = hoveredId === pos.id;
    const color = pos.color || (pos.type === PositionType.PLAYER ? "#3b82f6" : "#f59e0b");

    return (
      <g
        key={pos.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onMouseEnter={() => setHoveredId(pos.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{ cursor: readOnly ? 'default' : 'move' }}
      >
        {pos.type === PositionType.PLAYER && (
          <>
            <circle r="3" fill={color} stroke="#fff" strokeWidth="0.3" />
            <text y="0.8" textAnchor="middle" fontSize="2" fill="#fff" fontWeight="bold" style={{ userSelect: 'none' }}>
              {pos.label}
            </text>
          </>
        )}
        {pos.type === PositionType.BALL && (
          <circle r="1.2" fill="#fff" stroke="#000" strokeWidth="0.2" />
        )}
        {pos.type === PositionType.CONE && (
          <path d="M -2 2 L 0 -2 L 2 2 Z" fill="#f97316" />
        )}
        {pos.type === PositionType.GOAL && (
          <rect x="-1.5" y="-5" width="3" height="10" fill="none" stroke="#fff" strokeWidth="0.8" />
        )}
        
        {!readOnly && isHovered && !draggingId && (
          <g transform="translate(4, -4)" onClick={(e) => deleteElement(pos.id, e)} style={{ cursor: 'pointer' }}>
            <circle r="2" fill="#ef4444" />
            <text y="0.7" textAnchor="middle" fontSize="2" fill="#fff" fontWeight="bold">×</text>
          </g>
        )}
      </g>
    );
  };

  const renderArrow = (arrow: DrillArrow) => {
    const isHovered = hoveredId === arrow.id;
    const color = arrow.color || "#ffffff";
    const dashArray = arrow.type === ArrowType.PASS ? "1,1" : arrow.type === ArrowType.RUN ? "2,1" : "none";
    
    return (
      <g 
        key={arrow.id}
        onMouseEnter={() => setHoveredId(arrow.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <defs>
          <marker
            id={`arrowhead-${arrow.id}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={color} />
          </marker>
        </defs>
        <line
          x1={arrow.start.x}
          y1={arrow.start.y}
          x2={arrow.end.x}
          y2={arrow.end.y}
          stroke={color}
          strokeWidth="1"
          strokeDasharray={dashArray}
          markerEnd={`url(#arrowhead-${arrow.id})`}
        />
        {/* Invisible wider line for easier hovering */}
        <line
          x1={arrow.start.x}
          y1={arrow.start.y}
          x2={arrow.end.x}
          y2={arrow.end.y}
          stroke="transparent"
          strokeWidth="5"
          style={{ cursor: 'pointer' }}
        />
        {!readOnly && isHovered && (
          <g 
            transform={`translate(${(arrow.start.x + arrow.end.x) / 2}, ${(arrow.start.y + arrow.end.y) / 2})`} 
            onClick={(e) => deleteElement(arrow.id, e)}
            style={{ cursor: 'pointer' }}
          >
            <circle r="2" fill="#ef4444" />
            <text y="0.7" textAnchor="middle" fontSize="2" fill="#fff" fontWeight="bold">×</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="no-print flex flex-wrap gap-2 p-2 bg-[var(--background)] rounded-xl border border-[var(--card-border)]">
          <button
            onClick={() => setToolMode('move')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolMode === 'move' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}
          >
            Move
          </button>
          <div className="w-px h-6 bg-[var(--card-border)] self-center" />
          <button
            onClick={() => setToolMode('add-player')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolMode === 'add-player' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}
          >
            + Player
          </button>
          <button
            onClick={() => setToolMode('add-ball')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolMode === 'add-ball' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}
          >
            + Ball
          </button>
          <button
            onClick={() => setToolMode('add-cone')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolMode === 'add-cone' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}
          >
            + Cone
          </button>
          <button
            onClick={() => setToolMode('add-goal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolMode === 'add-goal' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}
          >
            + Goal
          </button>
          <button
            onClick={() => setToolMode('add-arrow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${toolMode === 'add-arrow' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}
          >
            + Arrow
          </button>
        </div>
      )}

      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg bg-zinc-900 border border-[var(--card-border)]">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="w-full h-full touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {renderPitch()}
          <g>
            {drill.arrows.map(renderArrow)}
          </g>
          <g>
            {drill.positions.map(renderPosition)}
          </g>
          {arrowStart && currentPoint && (
            <line
              x1={arrowStart.x}
              y1={arrowStart.y}
              x2={currentPoint.x}
              y2={currentPoint.y}
              stroke="#ffffff"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.5"
            />
          )}
        </svg>
        
        {!readOnly && (
          <div className="absolute bottom-4 right-4 no-print">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-[11px] text-white font-semibold uppercase tracking-widest shadow-xl border border-white/10">
              {toolMode === 'move' ? 'Drag to move' : toolMode === 'add-arrow' ? 'Click and drag to draw' : 'Click to place'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
