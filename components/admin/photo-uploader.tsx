"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
  const [photos, setPhotos] = useState(photoUrls);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("photos", file));
      const res = await fetch(`/api/admin/vehicles/${vehicleId}/photos`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "The photos could not be uploaded. Please try again.");
        return;
      }
      setPhotos(body.vehicle.photoUrls);
      setStatus(
        `Uploaded ${body.uploaded?.length ?? 0} photo(s). ${
          body.mediaSyncQueued ? "WhatsApp media sync queued." : "WhatsApp sync will retry automatically."
        }`,
      );
      router.refresh();
    } catch {
      setError("The upload was interrupted. Please check your connection and try again.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-6">
      <h2 className="font-serif text-2xl">Photos</h2>
      <p className="mt-2 text-sm text-muted">
        Upload up to 12 images together to show the front, rear, sides, interior and
        details. The first photo is used as the cover image.
      </p>
      <div className="mt-4">
        <label htmlFor="photos">Add photos</label>
        <input
          ref={inputRef}
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={onUpload}
          className="sr-only"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Uploading photos…" : "Choose multiple photos"}
        </button>
        <p className="mt-2 text-xs text-muted">JPEG, PNG or WebP · 8 MB each · 24 photos maximum</p>
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {status ? <p className="mt-3 text-sm text-ok">{status}</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {photos.length === 0 ? (
          <p className="col-span-full text-sm text-muted">No photos yet.</p>
        ) : (
          photos.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`Vehicle angle ${index + 1}`}
              className="aspect-video w-full rounded-lg object-cover border border-line"
            />
          ))
        )}
      </div>
    </section>
  );
}
