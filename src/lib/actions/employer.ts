"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${randomUUID().slice(0, 6)}`;
}

async function ensureCompany(profileId: string, formData: FormData) {
  const existing = await prisma.company.findUnique({ where: { ownerUserId: profileId } });
  if (existing) return existing;

  const name = String(formData.get("companyName") ?? "").trim();
  const hq = String(formData.get("location") ?? "").trim();
  if (!name) throw new Error("Company name is required for your first job posting.");

  return prisma.company.create({
    data: {
      ownerUserId: profileId,
      name,
      slug: slugify(name),
      industry: "General",
      hq,
      founded: String(new Date().getFullYear()),
      size: "1–10 employees",
      about: `${name} hires gig and hourly workers through HanapHire.`,
    },
  });
}

export async function createJob(formData: FormData) {
  const profile = await requireRole(["EMPLOYER"]);

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const payAmountRaw = String(formData.get("payAmount") ?? "").trim();
  const payType = String(formData.get("payType") ?? "") === "fixed" ? "fixed" : "hourly";
  const location = String(formData.get("location") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const criteria = String(formData.get("criteria") ?? "").trim();

  // Validate everything about the job itself before touching the database
  // at all — ensureCompany() below creates and commits a Company row on an
  // employer's first post, so if that ran first and THEN a job field
  // failed validation, the employer would be left with a permanent Company
  // row despite the job never publishing (and the "Company name" field
  // would then vanish on retry, since a company now exists for them).
  if (!title || !location || !shift || !description) {
    throw new Error("Title, location, shift, and description are all required.");
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error("Choose a valid category.");
  }
  const payAmount = Number(payAmountRaw);
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw new Error("Enter a valid pay rate greater than 0.");
  }

  const company = await ensureCompany(profile.id, formData);

  const payDisplay = payType === "hourly" ? `$${payAmount}/hr` : `$${payAmount}`;

  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      title,
      category,
      payType,
      payAmount,
      payDisplay,
      location,
      shift,
      description,
      requirements: [],
      screeningCriteria: { raw: criteria },
      payDetails: `Pay: ${payDisplay}.`,
    },
  });

  revalidatePath("/employer");
  redirect(`/employer?job=${job.id}&posted=1`);
}
