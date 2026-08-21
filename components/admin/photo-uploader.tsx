"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PhotoUploader({
  vehicleId,
  photoUrls,
}: {
  vehicleId: string;
  photoUrls: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("photos", file));
    const res = await fetch(`/api/admin/vehicles/${vehicleId}/photos`, {
      method: "POST",
      body: form,
    });
    const body = await res.json();
    setBusy(false);
    event.target.value = "";
    if (!res.ok) {
      setError(body.error ?? "Upload failed");
      return;
    }
    setStatus(`Uploaded ${body.uploaded?.length ?? 0} photo(s). WhatsApp media sync queued.`);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-6">
      <h2 className="font-serif text-2xl">Photos</h2>
      <p className="mt-2 text-sm text-muted">
        Stored on Vercel Blob when connected (else S3 / local /uploads). A worker
        job downloads the public URL and uploads to WhatsApp media once
        credentials exist.
      </p>
      <div className="mt-4">
        <label htmlFor="photos">Add photos</label>
        <input
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={onUpload}
        />
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {status ? <p className="mt-3 text-sm text-ok">{status}</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {photoUrls.length === 0 ? (
          <p className="col-span-full text-sm text-muted">No photos yet.</p>
        ) : (
          photoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="Vehicle"
              className="aspect-video w-full rounded-lg object-cover border border-line"
            />
          ))
        )}
      </div>
    </section>
  );
}
