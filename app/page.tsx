"use client";

import { useState } from "react";
import { Drill, PitchLayout, PositionType, ArrowType } from "@/types/types";
import { DrillGraphic } from "@/components/DrillGraphic";

type CreateMode = "ai" | "manual";

const initialManualDrill = {
  name: "",
  category: "Technical",
  duration: "15m",
  players: "10",
  setup: "",
  instructionsStr: "",
  coachingPointsStr: "",
  layout: PitchLayout.GRID,
};

export default function Home() {
  const [mode, setMode] = useState<CreateMode>("ai");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(initialManualDrill);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/drills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate drills. Check your API key and try again.");
        return;
      }
      if (data.drill) {
        setDrills((prev) => [...prev, data.drill]);
        setPrompt("");
      } else if (Array.isArray(data.drills)) {
        setDrills((prev) => [...prev, ...data.drills]);
        setPrompt("");
      } else {
        setError("Invalid response from server.");
      }
    } catch {
      setError("Couldn't generate drills. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!manual.name.trim()) {
      setError("Please enter a drill name.");
      return;
    }

    const instructions = manual.instructionsStr
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    
    const coachingPoints = manual.coachingPointsStr
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    if (instructions.length === 0) {
      setError("Please add at least one instruction.");
      return;
    }

    const drill: Drill = {
      id: crypto.randomUUID(),
      name: manual.name.trim(),
      category: manual.category,
      duration: manual.duration.trim() || "15m",
      players: manual.players.trim() || "10",
      setup: manual.setup.trim() || "Basic setup.",
      instructions,
      coachingPoints,
      positions: [],
      arrows: [],
      layout: manual.layout,
    };

    setDrills((prev) => [...prev, drill]);
    setManual(initialManualDrill);
  }

  function updateManual<K extends keyof typeof manual>(key: K, value: (typeof manual)[K]) {
    setManual((prev) => ({ ...prev, [key]: value }));
  }

  function handleDelete(index: number) {
    setDrills((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateDrill(index: number, updatedDrill: Drill) {
    setDrills((prev) => prev.map((d, i) => (i === index ? updatedDrill : d)));
  }

  function handleClearSession() {
    if (confirm("Are you sure you want to clear the entire session?")) {
      setDrills([]);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-4xl px-6 pt-16 pb-20 sm:px-10 sm:pt-20 sm:pb-24">
        <header className="text-center mb-14 sm:mb-16">
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            Soccer Session Builder
          </h1>
          <p className="mt-5 text-lg text-[var(--muted)] max-w-xl mx-auto leading-relaxed">
            Build your team training session drill by drill. Use AI to generate specific exercises or add your own manually.
          </p>
        </header>

        <div className="no-print mb-6 flex rounded-xl bg-[var(--card)] p-1 border border-[var(--card-border)] w-fit mx-auto">
          <button
            type="button"
            onClick={() => { setMode("ai"); setError(null); }}
            className={`rounded-lg px-5 py-2.5 text-base font-medium transition ${mode === "ai" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            Generate with AI
          </button>
          <button
            type="button"
            onClick={() => { setMode("manual"); setError(null); }}
            className={`rounded-lg px-5 py-2.5 text-base font-medium transition ${mode === "manual" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            Create manually
          </button>
        </div>

        {mode === "ai" && (
          <div className="no-print rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
            <form onSubmit={handleSubmit}>
              <label htmlFor="prompt" className="sr-only">
                Describe the drill you want
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. a passing square for 8 players, 15 min … or a dribbling slalom with turns … or a 3v2 counter-pressing drill in a 30x20 area"
                className="w-full resize-none rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                rows={5}
                disabled={loading}
              />
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-base font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                      Generating…
                    </>
                  ) : (
                    "Generate drill"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {mode === "manual" && (
          <div className="no-print rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
            <form onSubmit={handleManualSubmit} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="manual-name" className="block text-base font-semibold text-[var(--foreground)] mb-2">Name</label>
                  <input
                    id="manual-name"
                    type="text"
                    value={manual.name}
                    onChange={(e) => updateManual("name", e.target.value)}
                    placeholder="e.g. Passing square"
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>
                <div>
                  <label htmlFor="manual-category" className="block text-base font-semibold text-[var(--foreground)] mb-2">Category</label>
                  <select
                    id="manual-category"
                    value={manual.category}
                    onChange={(e) => updateManual("category", e.target.value)}
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  >
                    <option>Technical</option>
                    <option>Tactical</option>
                    <option>Physical</option>
                    <option>Warm-up</option>
                    <option>Game</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="manual-duration" className="block text-base font-semibold text-[var(--foreground)] mb-2">Duration</label>
                  <input
                    id="manual-duration"
                    type="text"
                    value={manual.duration}
                    onChange={(e) => updateManual("duration", e.target.value)}
                    placeholder="e.g. 15m"
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>
                <div>
                  <label htmlFor="manual-players" className="block text-base font-semibold text-[var(--foreground)] mb-2">Players</label>
                  <input
                    id="manual-players"
                    type="text"
                    value={manual.players}
                    onChange={(e) => updateManual("players", e.target.value)}
                    placeholder="e.g. 8-12"
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>
                <div>
                  <label htmlFor="manual-layout" className="block text-base font-semibold text-[var(--foreground)] mb-2">Pitch Layout</label>
                  <select
                    id="manual-layout"
                    value={manual.layout}
                    onChange={(e) => updateManual("layout", e.target.value as PitchLayout)}
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  >
                    <option value={PitchLayout.FULL}>Full Pitch</option>
                    <option value={PitchLayout.HALF}>Half Pitch</option>
                    <option value={PitchLayout.GRID}>Grid / Small Area</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="manual-setup" className="block text-base font-semibold text-[var(--foreground)] mb-2">Setup</label>
                <textarea
                  id="manual-setup"
                  value={manual.setup}
                  onChange={(e) => updateManual("setup", e.target.value)}
                  placeholder="How to set up the grid and players"
                  rows={3}
                  className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                />
              </div>

              <div>
                <label htmlFor="manual-instructions" className="block text-base font-semibold text-[var(--foreground)] mb-2">Instructions (one per line)</label>
                <textarea
                  id="manual-instructions"
                  value={manual.instructionsStr}
                  onChange={(e) => updateManual("instructionsStr", e.target.value)}
                  placeholder="Step 1: ...&#10;Step 2: ..."
                  rows={4}
                  className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                />
              </div>

              <div>
                <label htmlFor="manual-coaching" className="block text-base font-semibold text-[var(--foreground)] mb-2">Coaching Points (one per line)</label>
                <textarea
                  id="manual-coaching"
                  value={manual.coachingPointsStr}
                  onChange={(e) => updateManual("coachingPointsStr", e.target.value)}
                  placeholder="Focus on quality of pass&#10;Body position..."
                  rows={3}
                  className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-5 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 text-base font-medium text-white transition hover:bg-[var(--accent-hover)]"
                >
                  Add drill
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="no-print mt-8 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-5 py-4 text-base text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {drills.length > 0 && (
          <section className="mt-16 space-y-8" aria-label="Drills">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-4">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                Your Training Session ({drills.length} drill{drills.length === 1 ? "" : "s"})
              </h2>
              <div className="no-print flex gap-3">
                <button
                  onClick={handlePrint}
                  className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
                >
                  Print Session
                </button>
                <button
                  onClick={handleClearSession}
                  className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="space-y-8">
              {drills.map((drill, i) => (
                <DrillCard 
                  key={drill.id || i} 
                  drill={drill} 
                  onDelete={() => handleDelete(i)} 
                  onUpdate={(updated) => handleUpdateDrill(i, updated)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DrillCard({ drill, onDelete, onUpdate }: { drill: Drill; onDelete: () => void; onUpdate: (updated: Drill) => void }) {
  return (
    <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm overflow-hidden print:break-inside-avoid relative">
      <div className="border-l-4 border-[var(--accent)] pl-0">
        <div className="p-6 sm:p-8 pl-6 sm:pl-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Text Content */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)] mb-1 block">
                    {drill.category}
                  </span>
                  <h2 className="text-2xl font-semibold text-[var(--foreground)] flex-1 min-w-0 leading-tight">
                    {drill.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onDelete}
                  className="no-print shrink-0 rounded-lg px-3 py-2 text-base text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  aria-label="Delete this drill"
                >
                  Delete
                </button>
              </div>
              
              <ul className="mt-6 flex flex-wrap gap-4 text-base">
                <li className="inline-flex items-center gap-2 rounded-xl bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)]">
                  <span className="text-[var(--muted)]">Duration</span>
                  <span className="font-semibold">{drill.duration}</span>
                </li>
                <li className="inline-flex items-center gap-2 rounded-xl bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)]">
                  <span className="text-[var(--muted)]">Players</span>
                  <span className="font-semibold">{drill.players}</span>
                </li>
                <li className="inline-flex items-center gap-2 rounded-xl bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)]">
                  <span className="text-[var(--muted)]">Layout</span>
                  <span className="font-semibold uppercase">{drill.layout}</span>
                </li>
              </ul>

              {drill.setup && (
                <div className="mt-8 pt-8 border-t border-[var(--card-border)]">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">Setup</h3>
                  <p className="mt-3 text-base text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                    {drill.setup}
                  </p>
                </div>
              )}
            </div>

            {/* Graphic Content */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Visual Layout</h3>
              <DrillGraphic drill={drill} onUpdate={onUpdate} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 pt-8 border-t border-[var(--card-border)]">
            {drill.instructions?.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Instructions</h3>
                <ol className="space-y-5">
                  {drill.instructions.map((instruction, j) => (
                    <li key={j} className="flex gap-4">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">
                        {j + 1}
                      </span>
                      <p className="text-base text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                        {instruction}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {drill.coachingPoints?.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Coaching Points</h3>
                <ul className="space-y-3">
                  {drill.coachingPoints.map((point, j) => (
                    <li key={j} className="flex gap-3 items-start">
                      <span className="text-[var(--accent)] mt-1.5">•</span>
                      <p className="text-base text-[var(--muted)] leading-relaxed">
                        {point}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
