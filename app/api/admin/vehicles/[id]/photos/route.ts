import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { uploadVehiclePhoto } from "@/lib/storage/object-storage";
import { getMediaReuploadQueue } from "@/lib/queue/queues";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

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

  const newUrls: string[] = [];
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
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadVehiclePhoto({
      vehicleId: id,
      bytes,
      contentType: file.type,
      originalName: file.name,
    });
    newUrls.push(uploaded.url);
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { photoUrls: [...vehicle.photoUrls, ...newUrls] },
  });

  await getMediaReuploadQueue().add("media-reupload", { vehicleId: id });

  return NextResponse.json({
    vehicle: updated,
    uploaded: newUrls,
    note: "WhatsApp media upload queued. Requires WhatsApp credentials when processing.",
  });
}
