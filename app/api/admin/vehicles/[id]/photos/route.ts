import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { deleteStoredObject, uploadVehiclePhoto } from "@/lib/storage/object-storage";
import { getMediaReuploadQueue } from "@/lib/queue/queues";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BATCH = 12;
const MAX_TOTAL = 24;

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const form = await request.formData();
  const files = form.getAll("photos").filter((item): item is File => item instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No photos uploaded" }, { status: 400 });
  }

  if (files.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Upload up to ${MAX_BATCH} photos at a time.` },
      { status: 400 },
    );
  }
  if (vehicle.photoUrls.length + files.length > MAX_TOTAL) {
    return NextResponse.json(
      { error: `A vehicle can have up to ${MAX_TOTAL} photos.` },
      { status: 400 },
    );
  }

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type ${file.type}. Use JPEG, PNG, or WebP.` },
        { status: 400 },
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Each photo must be under 8MB" }, { status: 400 });
    }
  }

  const newUrls: string[] = [];
  try {
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadVehiclePhoto({
        vehicleId: id,
        bytes,
        contentType: file.type,
        originalName: file.name,
      });
      newUrls.push(uploaded.url);
    }
  } catch (error) {
    await Promise.allSettled(newUrls.map((url) => deleteStoredObject(url)));
    console.error("Vehicle photo upload failed", error);
    return NextResponse.json(
      { error: "The photos could not be stored. Please try again." },
      { status: 502 },
    );
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { photoUrls: [...vehicle.photoUrls, ...newUrls] },
  });

  let mediaSyncQueued = true;
  try {
    await getMediaReuploadQueue().add("media-reupload", { vehicleId: id });
  } catch (error) {
    mediaSyncQueued = false;
    console.error("Vehicle photo saved but WhatsApp media sync could not be queued", error);
  }

  return NextResponse.json({
    vehicle: updated,
    uploaded: newUrls,
    mediaSyncQueued,
    note: mediaSyncQueued
      ? "WhatsApp media upload queued. Requires WhatsApp credentials when processing."
      : "Photos saved. WhatsApp media sync will retry when the queue is available.",
  });
}
