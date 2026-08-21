export default function PaymentCancelledPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <div className="rounded-xl border border-line bg-panel p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Payment not completed</p>
        <h1 className="mt-3 font-serif text-4xl">Your booking is not confirmed</h1>
        <p className="mt-4 text-muted">
          Return to WhatsApp when you are ready. The vehicle remains held only until the quote expires.
        </p>
      </div>
    </main>
  );
}
