"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Atelier</p>
      <h1 className="mt-3 font-serif text-4xl text-cream">Admin can’t start</h1>
      <p className="mt-4 text-muted">
        Deploy is live, but the server couldn’t reach Postgres/Redis or read
        session secrets. Open{" "}
        <a className="text-gold underline" href="/api/health">
          /api/health
        </a>{" "}
        — <code>database</code> and <code>redis</code> must be <code>ok</code>.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-panel p-4 text-xs text-danger">
        {error.message}
        {error.digest ? `\ndigest: ${error.digest}` : ""}
      </pre>
      <button type="button" className="btn-gold mt-8 w-fit" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
