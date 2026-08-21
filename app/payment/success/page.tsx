export default function PaymentSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <div className="rounded-xl border border-line bg-panel p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Payment received</p>
        <h1 className="mt-3 font-serif text-4xl">Thank you</h1>
        <p className="mt-4 text-muted">
          We are confirming your booking now. Your confirmation will arrive on WhatsApp.
        </p>
      </div>
    </main>
  );
}
