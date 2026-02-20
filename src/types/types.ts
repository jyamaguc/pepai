export enum PositionType {
  PLAYER = 'player',
  CONE = 'cone',
  BALL = 'ball',
  GOAL = 'goal'
}

export enum DrillType {
  TECHNICAL = 'Technical',
  PHYSICAL = 'Physical',
  TACTICAL = 'Tactical',
  SITUATIONAL = 'Situational',
  MENTAL = 'Mental',
  PLAY = 'Play',
  DUAL = 'Dual'
}

export interface DrillTypeConfig {
  label: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind bg color (pastel)
  textColor: string; // Tailwind text color
  borderColor: string; // Tailwind border color
}

export const DRILL_TYPE_CONFIGS: Record<DrillType, DrillTypeConfig> = {
  [DrillType.TECHNICAL]: {
    label: 'Technical',
    icon: 'Zap',
    color: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-100'
  },
  [DrillType.PHYSICAL]: {
    label: 'Physical',
    icon: 'Activity',
    color: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-100'
  },
  [DrillType.TACTICAL]: {
    label: 'Tactical',
    icon: 'Target',
    color: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-100'
  },
  [DrillType.SITUATIONAL]: {
    label: 'Situational',
    icon: 'Users',
    color: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-100'
  },
  [DrillType.MENTAL]: {
    label: 'Mental',
    icon: 'Brain',
    color: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-100'
  },
  [DrillType.PLAY]: {
    label: 'Play',
    icon: 'Play',
    color: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-100'
  },
  [DrillType.DUAL]: {
    label: 'Dual',
    icon: 'Swords',
    color: 'bg-slate-900',
    textColor: 'text-white',
    borderColor: 'border-slate-800'
  }
};

export enum ArrowType {
  PASS = 'pass',
  DRIBBLE = 'dribble',
  RUN = 'run'
}

export enum PitchLayout {
  FULL = 'full',
  HALF = 'half',
  GRID = 'grid'
}

export interface Point {
  x: number;
  y: number;
}

export interface DrillArrow {
  id: string;
  start: Point;
  end: Point;
  type: ArrowType;
  color?: string;
}

export interface PitchPosition {
  id: string;
  x: number; // 0-100
  y: number; // 0-100
  label: string;
  type: PositionType;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}

export interface Drill {
  id: string;
  name: string;
  categories: DrillType[];
  duration: string;
  players: string;
  setup: string;
  instructions: string[];
  coachingPoints: string[];
  positions: PitchPosition[];
  arrows: DrillArrow[];
  layout: PitchLayout;
}

export interface Session {
  id: string;
  title: string;
  date: string;
  team: string;
  drills: Drill[];
  notes?: string;
}

export const createEmptyDrill = (): Drill => ({
  id: crypto.randomUUID(),
  name: 'New Drill',
  categories: [DrillType.TACTICAL],
  duration: '15m',
  players: '10',
  setup: 'Basic area setup.',
  instructions: ['Starting position...'],
  coachingPoints: ['Focus on...'],
  positions: [],
  arrows: [],
  layout: PitchLayout.FULL
});
