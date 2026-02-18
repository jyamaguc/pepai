import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Drill, PitchLayout } from "@/types/types";

const MAX_PROMPT_LENGTH = 2000;

const SYSTEM_PROMPT = `You are an expert soccer coach and session designer. The user will describe a single drill they want. Create exactly ONE drill that matches their description, including a detailed visual layout.

Respond with valid JSON only. Return exactly this shape: { "drill": { ... } }

The drill object must have:
- id (string, use a random UUID)
- name (string)
- categories (array of strings, choose one or more from: "Technical", "Physical", "Tactical", "Situational", "Mental", "Play")
- duration (string, e.g. "15m")
- players (string, e.g. "8-12")
- setup (string, how to set up the grid and players)
- instructions (array of strings, step-by-step how to run the drill)
- coachingPoints (array of strings, key things for the coach to look for)
- layout (string, one of: "full", "half", "grid")
- positions (array of objects):
    - id (string)
    - x (number, 0-100, where 0 is left and 100 is right)
    - y (number, 0-100, where 0 is top and 100 is bottom)
    - label (string, e.g. "P1", "GK", "Blue")
    - type (string, one of: "player", "cone", "ball", "goal")
    - color (string, hex color code)
- arrows (array of objects):
    - id (string)
    - start ({ x: number, y: number })
    - end ({ x: number, y: number })
    - type (string, one of: "pass", "dribble", "run")
    - color (string, hex color code)

Visual Layout Guidelines:
- For "full" or "half" pitch, place goals at the ends.
- For "grid", create a box using cones at the corners.
- Distribute players realistically according to the drill description.
- Use arrows to represent the primary movements or passes described in the instructions.

No markdown, no code fences, no explanation—only the raw JSON object.`;

function parseDrillResponse(text: string): { drill?: Drill; drills?: Drill[] } {
  const trimmed = text.trim();
  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const data = JSON.parse(withoutFences) as unknown;
  
  if (data && typeof data === "object" && "drill" in data) {
    return { drill: data.drill as Drill };
  }
  if (data && typeof data === "object" && "drills" in data && Array.isArray(data.drills)) {
    return { drills: data.drills as Drill[] };
  }
  if (data && typeof data === "object" && "name" in data && "instructions" in data) {
    return { drill: data as Drill };
  }
  throw new Error("Invalid drill response shape");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Add it to .env.local and restart the dev server." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing or empty prompt." },
        { status: 400 }
      );
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt must be at most ${MAX_PROMPT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent(`Coach request: ${prompt}`);

    const response = result.response;
    if (!response?.text()) {
      return NextResponse.json(
        { error: "No response from the AI. Try again." },
        { status: 502 }
      );
    }

    const parsed = parseDrillResponse(response.text());
    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Could not parse the generated drill. Try again." },
        { status: 502 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    const isDev = process.env.NODE_ENV === "development";
    const userMessage =
      isDev
        ? message
        : message.includes("API") || message.includes("API_KEY") || message.includes("403") || message.includes("401")
          ? "Check your API key and try again. Restart the dev server after changing .env.local."
          : "Something went wrong. Try again.";
    return NextResponse.json(
      { error: userMessage },
      { status: 502 }
    );
  }
}
