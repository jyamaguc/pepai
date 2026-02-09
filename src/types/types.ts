export enum PositionType {
  PLAYER = 'player',
  CONE = 'cone',
  BALL = 'ball',
  GOAL = 'goal'
}

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
}

export interface Drill {
  id: string;
  name: string;
  category: string;
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
}

export const createEmptyDrill = (): Drill => ({
  id: crypto.randomUUID(),
  name: 'New Drill',
  category: 'Tactical',
  duration: '15m',
  players: '10',
  setup: 'Basic area setup.',
  instructions: ['Starting position...'],
  coachingPoints: ['Focus on...'],
  positions: [],
  arrows: [],
  layout: PitchLayout.FULL
});
