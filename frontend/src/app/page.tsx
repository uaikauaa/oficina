export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="w-full max-w-xl p-8 md:p-10 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium tracking-wide">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Frontend em Execução — Operacional
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-50">
          Oficina Gestão
        </h1>

        <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
          Fundação da arquitetura WebApp inicializada com sucesso. Ambiente técnico validado (Fase 0 — Fundação).
        </p>

        <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500 font-mono">
          <span className="px-2.5 py-1 rounded bg-zinc-800/50 text-zinc-300">Next.js (App Router)</span>
          <span className="px-2.5 py-1 rounded bg-zinc-800/50 text-zinc-300">React & TypeScript</span>
          <span className="px-2.5 py-1 rounded bg-zinc-800/50 text-zinc-300">Tailwind CSS</span>
        </div>
      </div>
    </main>
  );
}
