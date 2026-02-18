import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Drill, PositionType, PitchLayout, ArrowType, DrillType } from "../types/types";

// Lazy initialization to avoid crashing during SSR if key is missing
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("API key must be set when using the Gemini API. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

/**
 * Tactical tool declarations for the Live API to modify the pitch visualization.
 */
export const drillToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'addPlayer',
    description: 'Add a player marker to the soccer pitch.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.NUMBER, description: 'X coordinate (0-100)' },
        y: { type: Type.NUMBER, description: 'Y coordinate (0-100)' },
        label: { type: Type.STRING, description: 'Short label for the player (e.g., "1", "GK", "ST")' },
      },
      required: ['x', 'y', 'label'],
    },
  },
  {
    name: 'addArrow',
    description: 'Add a tactical arrow (pass, run, or dribble) to the pitch.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startX: { type: Type.NUMBER, description: 'Starting X coordinate (0-100)' },
        startY: { type: Type.NUMBER, description: 'Starting Y coordinate (0-100)' },
        endX: { type: Type.NUMBER, description: 'Ending X coordinate (0-100)' },
        endY: { type: Type.NUMBER, description: 'Ending Y coordinate (0-100)' },
        type: { 
          type: Type.STRING, 
          enum: ['pass', 'dribble', 'run'],
          description: 'The type of movement or action'
        },
      },
      required: ['startX', 'startY', 'endX', 'endY', 'type'],
    },
  },
  {
    name: 'clearPitch',
    description: 'Clear all players and arrows from the current pitch.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

const drillSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Catchy name for the drill" },
    categories: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING, enum: ["Technical", "Physical", "Tactical", "Situational", "Mental", "Play"] },
      description: "Select one or more categories that best describe the drill."
    },
    duration: { type: Type.STRING, description: "e.g., 15 mins" },
    players: { type: Type.STRING, description: "e.g., 8+2" },
    layout: { type: Type.STRING, enum: ["full", "half", "grid"] },
    setup: { type: Type.STRING, description: "Brief description of the physical setup" },
    instructions: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Step by step execution guide"
    },
    coachingPoints: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Key tactical reminders for players"
    },
    positions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X coordinate 0-100" },
          y: { type: Type.NUMBER, description: "Y coordinate 0-100" },
          label: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["player", "cone", "ball", "goal"] },
          color: { type: Type.STRING }
        },
        required: ["x", "y", "label", "type"]
      }
    },
    arrows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { 
            type: Type.OBJECT, 
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
            required: ["x", "y"]
          },
          end: { 
            type: Type.OBJECT, 
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
            required: ["x", "y"]
          },
          type: { type: Type.STRING, enum: ["pass", "dribble", "run"] },
          color: { type: Type.STRING }
        },
        required: ["start", "end", "type"]
      }
    }
  },
  required: ["name", "categories", "duration", "players", "layout", "setup", "instructions", "coachingPoints", "positions", "arrows"]
};

const MODEL_NAME = 'gemini-3-flash-preview';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateDrillStream = async function* (prompt: string, retryCount = 0): AsyncGenerator<string, void, unknown> {
  const ai = getAI();
  const MAX_RETRIES = 3;
  
  try {
    const result = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: `You are an elite soccer coach. Create a tactical drill for: "${prompt}". 
      Pitch grid is 0-100. Provide clear instructions and high-quality tactical positioning. 
      Respond ONLY with valid JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: drillSchema,
      },
    });

    let fullText = "";
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        yield fullText;
      }
    }
  } catch (error: any) {
    console.error(`Gemini API Error (generate, attempt ${retryCount + 1}):`, error);
    
    const is503 = error.message?.includes("503") || error.message?.includes("high demand") || error.status === 503;
    
    if (is503 && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
      console.log(`Retrying in ${Math.round(delay)}ms...`);
      yield "RETRYING"; // Special signal for the UI
      await sleep(delay);
      yield* generateDrillStream(prompt, retryCount + 1);
      return;
    }

    if (is503) {
      throw new Error("Pep is currently overwhelmed with tactical requests (High Demand). Please try again in a moment.");
    }
    throw error;
  }
};

export const refineDrillStream = async function* (currentDrill: Drill, instruction: string, retryCount = 0): AsyncGenerator<string, void, unknown> {
  const ai = getAI();
  const MAX_RETRIES = 3;

  try {
    const result = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: `Update this drill: ${JSON.stringify(currentDrill)}. 
      Modification requested: "${instruction}". 
      Return the FULL updated JSON drill object. Keep coordinates precise on the 0-100 grid.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: drillSchema,
      },
    });

    let fullText = "";
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        yield fullText;
      }
    }
  } catch (error: any) {
    console.error(`Gemini API Error (refine, attempt ${retryCount + 1}):`, error);
    
    const is503 = error.message?.includes("503") || error.message?.includes("high demand") || error.status === 503;

    if (is503 && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
      console.log(`Retrying in ${Math.round(delay)}ms...`);
      yield "RETRYING";
      await sleep(delay);
      yield* refineDrillStream(currentDrill, instruction, retryCount + 1);
      return;
    }

    if (is503) {
      throw new Error("Pep is currently overwhelmed with tactical requests (High Demand). Please try again in a moment.");
    }
    throw error;
  }
};

export function processDrillJson(rawJson: any, existingId?: string): Drill {
  // Handle case where rawJson might still be a string from the stream
  let data = rawJson;
  if (typeof rawJson === 'string') {
    try {
      data = JSON.parse(rawJson.replace(/```json\n?|\n?```/g, ''));
    } catch (e) {
      console.error("Failed to parse drill JSON", e);
      return rawJson as any; // Fallback
    }
  }

  // If the response is wrapped in a "drill" key
  const drillData = data.drill || data;

  // Migration: If legacy 'category' exists but 'categories' doesn't
  if (drillData.category && !drillData.categories) {
    const legacyCategory = drillData.category;
    // Map legacy category to closest DrillType if possible, else default to TACTICAL
    const mapping: Record<string, DrillType> = {
      'Technical': DrillType.TECHNICAL,
      'Physical': DrillType.PHYSICAL,
      'Tactical': DrillType.TACTICAL,
      'Situational': DrillType.SITUATIONAL,
      'Mental': DrillType.MENTAL,
      'Warm-up': DrillType.TECHNICAL,
      'Possession': DrillType.TACTICAL,
      'Finishing': DrillType.TECHNICAL,
      'Transition': DrillType.TACTICAL
    };
    drillData.categories = [mapping[legacyCategory] || DrillType.TACTICAL];
  }

  // Ensure categories is always an array
  if (!drillData.categories || !Array.isArray(drillData.categories)) {
    drillData.categories = [DrillType.TACTICAL];
  }

  return {
    ...drillData,
    id: existingId || drillData.id || crypto.randomUUID(),
    positions: (drillData.positions || []).map((p: any) => ({ 
      ...p, 
      id: p.id || crypto.randomUUID() 
    })),
    arrows: (drillData.arrows || []).map((a: any) => ({ 
      ...a, 
      id: a.id || crypto.randomUUID() 
    }))
  };
}
