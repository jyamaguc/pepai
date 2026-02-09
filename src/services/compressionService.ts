import LZString from 'lz-string';
import { Session, Drill, PitchPosition, DrillArrow } from '../types/types';

const KEY_MAP: Record<string, string> = {
  id: 'i',
  title: 't',
  date: 'd',
  team: 'tm',
  drills: 'dr',
  name: 'n',
  category: 'c',
  duration: 'dur',
  players: 'p',
  setup: 's',
  instructions: 'ins',
  coachingPoints: 'cp',
  positions: 'pos',
  arrows: 'arr',
  x: 'x',
  y: 'y',
  label: 'l',
  type: 'ty',
  color: 'co',
  start: 'st',
  end: 'en',
  layout: 'ly',
  notes: 'nt'
};

const REVERSE_KEY_MAP = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k])
);

function transformKeys(obj: any, map: Record<string, string>): any {
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item, map));
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      const newKey = map[key] || key;
      newObj[newKey] = transformKeys(obj[key], map);
    }
    return newObj;
  }
  return obj;
}

export function compressSession(session: Session): string {
  // Deep clone to avoid modifying the original session
  const sessionClone = JSON.parse(JSON.stringify(session));
  
  // Round coordinates to 2 decimal places to save space
  sessionClone.drills.forEach((drill: any) => {
    drill.positions.forEach((pos: any) => {
      pos.x = Math.round(pos.x * 100) / 100;
      pos.y = Math.round(pos.y * 100) / 100;
    });
    drill.arrows.forEach((arrow: any) => {
      arrow.start.x = Math.round(arrow.start.x * 100) / 100;
      arrow.start.y = Math.round(arrow.start.y * 100) / 100;
      arrow.end.x = Math.round(arrow.end.x * 100) / 100;
      arrow.end.y = Math.round(arrow.end.y * 100) / 100;
    });
  });

  const simplified = transformKeys(sessionClone, KEY_MAP);
  const json = JSON.stringify(simplified);
  return LZString.compressToEncodedURIComponent(json);
}

export function decompressSession(compressed: string): Session | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    const simplified = JSON.parse(json);
    return transformKeys(simplified, REVERSE_KEY_MAP) as Session;
  } catch (e) {
    console.error("Decompression failed", e);
    return null;
  }
}
