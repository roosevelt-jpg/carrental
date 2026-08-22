"use client";

import Image from "next/image";
import { useState } from "react";

export function VehicleGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return <div className="grid h-full place-items-center text-sm text-cream/30">Photography coming soon</div>;
  }

  const selected = photos[Math.min(active, photos.length - 1)];

  return (
    <div className="relative h-full" aria-label={`${alt} photo gallery`}>
      <Image
        unoptimized
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        src={selected}
        alt={`${alt}, view ${active + 1} of ${photos.length}`}
        className="object-cover transition duration-500 group-hover:scale-[1.02]"
      />

      {photos.length > 1 ? (
        <>
          <div className="absolute inset-x-0 bottom-0 flex gap-2 overflow-x-auto bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-10">
            {photos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show ${alt} view ${index + 1}`}
                aria-pressed={index === active}
                className={`relative h-12 w-16 shrink-0 overflow-hidden border transition ${
                  index === active ? "border-[var(--site-primary)]" : "border-white/30 hover:border-white/70"
                }`}
              >
                <Image unoptimized fill sizes="64px" src={photo} alt="" className="object-cover" />
              </button>
            ))}
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs text-cream backdrop-blur-sm">
            {active + 1} / {photos.length}
          </span>
        </>
      ) : null}
    </div>
  );
}
