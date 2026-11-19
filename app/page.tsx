import { GAME_NAME } from "@/lib/config";

// Placeholder until M2 (daily play loop).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-emerald-800">{GAME_NAME}</h1>
      <p className="text-zinc-600">The daily football ranking golf game. Coming soon.</p>
    </main>
  );
}
