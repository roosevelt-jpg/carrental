import { z } from "zod";

const nullableUrl = z.union([z.url().max(2000), z.literal(""), z.null()]).optional();
const nullableText = z.union([z.string().max(500), z.null()]).optional();
const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const cmsSettingsPatchSchema = z
  .object({
    businessName: requiredText(120).optional(),
    legalName: nullableText,
    tagline: requiredText(180).optional(),
    businessDescription: requiredText(2000).optional(),
    phone: nullableText,
    email: z.union([z.email().max(320), z.literal(""), z.null()]).optional(),
    whatsappDisplay: nullableText,
    address: nullableText,
    city: requiredText(100).optional(),
    country: requiredText(100).optional(),
    timezone: requiredText(80).optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
    logoUrl: nullableUrl,
    heroImageUrl: nullableUrl,
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    seoTitle: requiredText(180).optional(),
    seoDescription: requiredText(320).optional(),
    heroEyebrow: requiredText(180).optional(),
    heroTitle: requiredText(240).optional(),
    heroSubtitle: requiredText(1000).optional(),
    heroPrimaryLabel: requiredText(80).optional(),
    heroPrimaryHref: requiredText(500).optional(),
    heroSecondaryLabel: requiredText(80).optional(),
    heroSecondaryHref: requiredText(500).optional(),
    aboutTitle: requiredText(180).optional(),
    aboutBody: requiredText(4000).optional(),
    fleetTitle: requiredText(180).optional(),
    fleetBody: requiredText(2000).optional(),
    faqTitle: requiredText(180).optional(),
    contactTitle: requiredText(180).optional(),
    contactBody: requiredText(2000).optional(),
    footerText: requiredText(500).optional(),
    agentTone: requiredText(2000).optional(),
    salesScript: requiredText(8000).optional(),
    agentGreeting: requiredText(1000).optional(),
    agentHandoffMessage: requiredText(1000).optional(),
    prohibitedClaims: requiredText(4000).optional(),
    sitePublished: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied");

export const faqCreateSchema = z.object({
  question: requiredText(500),
  answer: requiredText(4000),
  category: requiredText(80).default("General"),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  active: z.boolean().default(true),
});

export const faqPatchSchema = faqCreateSchema.partial().strict();

export const knowledgeCreateSchema = z.object({
  title: requiredText(200),
  body: requiredText(12000),
  category: requiredText(80).default("General"),
  keywords: z.array(requiredText(60)).max(30).default([]),
  active: z.boolean().default(true),
});

export const knowledgePatchSchema = knowledgeCreateSchema.partial().strict();
