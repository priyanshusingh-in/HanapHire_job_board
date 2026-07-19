import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";
import type { Prisma, Role, RecommendedAction } from "../src/generated/prisma/client";

const DEMO_PASSWORD = "hanaphire-demo-2026";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function ensureAuthUser(email: string, name: string, role: Role) {
  const existing = await prisma.profile.findUnique({ where: { email } });
  if (existing) return existing.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (error || !data.user) {
    throw error ?? new Error(`Failed to create auth user for ${email}`);
  }
  return data.user.id;
}

async function ensureSeeker(opts: {
  email: string;
  name: string;
  rating: number;
  yearsExperience: Record<string, string>;
  certifications: string[];
  availability: string;
  savedJobIds?: string[];
}) {
  const id = await ensureAuthUser(opts.email, opts.name, "SEEKER");
  const seeker = await prisma.seekerProfile.upsert({
    where: { userId: id },
    update: {},
    create: {
      userId: id,
      rating: opts.rating,
      yearsExperience: opts.yearsExperience,
      certifications: opts.certifications,
      availability: opts.availability,
      distanceRadiusMi: 25,
      savedJobIds: opts.savedJobIds ?? [],
    },
  });
  return seeker.id;
}

async function ensureCompany(opts: {
  email: string;
  name: string;
  slug: string;
  industry: string;
  hq: string;
  founded: string;
  size: string;
  about: string;
  rating: number;
  reviewCount: number;
}) {
  const ownerId = await ensureAuthUser(opts.email, `${opts.name} Hiring Team`, "EMPLOYER");
  const company = await prisma.company.upsert({
    where: { ownerUserId: ownerId },
    update: {},
    create: {
      ownerUserId: ownerId,
      name: opts.name,
      slug: opts.slug,
      industry: opts.industry,
      hq: opts.hq,
      founded: opts.founded,
      size: opts.size,
      about: opts.about,
      rating: opts.rating,
      reviewCount: opts.reviewCount,
    },
  });
  return company.id;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding admin account...");
  await ensureAuthUser("admin@hanaphire.dev", "HanapHire Admin", "ADMIN");

  console.log("Seeding companies...");
  const quickcart = await ensureCompany({
    email: "employer+quickcart@hanaphire.dev",
    name: "QuickCart Logistics",
    slug: "quickcart-logistics",
    industry: "Logistics & Delivery",
    hq: "Austin, TX",
    founded: "2016",
    size: "201–500 employees",
    about:
      "QuickCart Logistics runs same-day local delivery for grocery and retail partners across the Southwest. We built our driver program around flexible, well-paid shifts and fast weekly payouts.",
    rating: 4.8,
    reviewCount: 342,
  });
  const fulcrum = await ensureCompany({
    email: "employer+fulcrum@hanaphire.dev",
    name: "Fulcrum Distribution",
    slug: "fulcrum-distribution",
    industry: "Warehousing & Fulfillment",
    hq: "Columbus, OH",
    founded: "2011",
    size: "501–1,000 employees",
    about:
      "Fulcrum Distribution operates regional fulfillment centers powering next-day delivery for national retail brands.",
    rating: 4.6,
    reviewCount: 158,
  });
  const bright = await ensureCompany({
    email: "employer+bright@hanaphire.dev",
    name: "Bright Events Co.",
    slug: "bright-events-co",
    industry: "Events & Hospitality",
    hq: "Denver, CO",
    founded: "2018",
    size: "51–200 employees",
    about:
      "Bright Events Co. staffs setup, breakdown, and hospitality crews for festivals and outdoor events across the Rocky Mountain region.",
    rating: 4.9,
    reviewCount: 96,
  });
  const tidynest = await ensureCompany({
    email: "employer+tidynest@hanaphire.dev",
    name: "TidyNest Home Services",
    slug: "tidynest-home-services",
    industry: "Home Services",
    hq: "Seattle, WA",
    founded: "2019",
    size: "11–50 employees",
    about:
      "TidyNest connects Seattle homeowners with reliable, recurring residential cleaning.",
    rating: 4.7,
    reviewCount: 211,
  });
  const voltworks = await ensureCompany({
    email: "employer+voltworks@hanaphire.dev",
    name: "VoltWorks Contracting",
    slug: "voltworks-contracting",
    industry: "Skilled Trades",
    hq: "Phoenix, AZ",
    founded: "2009",
    size: "51–200 employees",
    about:
      "VoltWorks Contracting handles residential and light-commercial electrical work across the Phoenix metro.",
    rating: 4.5,
    reviewCount: 74,
  });
  const northgate = await ensureCompany({
    email: "employer+northgate@hanaphire.dev",
    name: "Northgate Mercantile",
    slug: "northgate-mercantile",
    industry: "Retail",
    hq: "Chicago, IL",
    founded: "1998",
    size: "1,000+ employees",
    about:
      "Northgate Mercantile is a Midwest general-merchandise retailer with stores across Illinois and Indiana.",
    rating: 4.4,
    reviewCount: 503,
  });
  const marquee = await ensureCompany({
    email: "employer+marquee@hanaphire.dev",
    name: "Marquee Hospitality Group",
    slug: "marquee-hospitality-group",
    industry: "Events & Hospitality",
    hq: "Miami, FL",
    founded: "2014",
    size: "201–500 employees",
    about:
      "Marquee Hospitality Group caters corporate events and private banquets across South Florida.",
    rating: 4.8,
    reviewCount: 187,
  });
  const portside = await ensureCompany({
    email: "employer+portside@hanaphire.dev",
    name: "Portside Freight",
    slug: "portside-freight",
    industry: "Warehousing & Fulfillment",
    hq: "Newark, NJ",
    founded: "2005",
    size: "501–1,000 employees",
    about:
      "Portside Freight loads and unloads freight containers at a port-adjacent distribution yard.",
    rating: 4.6,
    reviewCount: 122,
  });
  const fixit = await ensureCompany({
    email: "employer+fixit@hanaphire.dev",
    name: "FixIt Local Pros",
    slug: "fixit-local-pros",
    industry: "Home Services",
    hq: "Portland, OR",
    founded: "2020",
    size: "1–10 employees",
    about:
      "FixIt Local Pros dispatches small residential repair jobs booked through the FixIt app.",
    rating: 4.3,
    reviewCount: 38,
  });

  console.log("Seeding jobs...");
  const jobDefs: Array<{
    key: string;
    companyId: string;
    data: {
      title: string;
      category: string;
      payType: string;
      payAmount: number;
      payDisplay: string;
      location: string;
      distanceMi: number;
      shift: string;
      urgent: boolean;
      verifiedEmployer: boolean;
      status: "ACTIVE" | "CLOSED";
      description: string;
      requirements: string[];
      screeningCriteria: Prisma.InputJsonValue;
      matchThreshold?: number;
      payDetails: string;
      postedAt: Date;
    };
  }> = [
    {
      key: "delivery-driver",
      companyId: quickcart,
      data: {
        title: "Delivery Driver — Same-Day Routes",
        category: "Delivery",
        payType: "hourly",
        payAmount: 22,
        payDisplay: "$22/hr",
        location: "Austin, TX",
        distanceMi: 2.4,
        shift: "Today, 2pm–8pm",
        urgent: true,
        verifiedEmployer: true,
        status: "ACTIVE",
        description:
          "QuickCart needs a same-day delivery driver to run local routes across Austin, delivering groceries and retail parcels using your own vehicle. Routes are dispatched via our driver app with real-time navigation.",
        requirements: [
          "Valid driver's license and insured vehicle",
          "Smartphone for the driver app",
          "Able to lift up to 30 lbs",
          "Available for at least 4 shifts/week",
        ],
        screeningCriteria: [
          { label: "Valid driver's license", type: "cert", value: true },
          { label: "Insured vehicle", type: "cert", value: true },
          { label: "Available 4+ shifts/week", type: "availability", value: "4+ shifts/week" },
        ],
        payDetails: "Paid $22/hr plus mileage reimbursement, deposited weekly every Friday.",
        postedAt: hoursAgo(1),
      },
    },
    {
      key: "warehouse-associate",
      companyId: fulcrum,
      data: {
        title: "Warehouse Associate — Overnight",
        category: "Warehouse",
        payType: "hourly",
        payAmount: 19.5,
        payDisplay: "$19.50/hr",
        location: "Columbus, OH",
        distanceMi: 5.1,
        shift: "Tonight, 10pm–6am",
        urgent: true,
        verifiedEmployer: true,
        status: "ACTIVE",
        description:
          "Fulcrum Distribution is hiring overnight Warehouse Associates to pick, pack, and stage outbound shipments in a fast-paced fulfillment center.",
        requirements: [
          "Forklift certification preferred",
          "1+ year warehouse experience",
          "Comfortable with overnight shifts",
          "Able to stand/lift for full shift",
        ],
        screeningCriteria: [
          { label: "Forklift certified", type: "cert", value: true },
          { label: "1+ yr warehouse experience", type: "experience", value: 1 },
          { label: "Available overnight", type: "availability", value: "overnight" },
          { label: "Within 15 miles", type: "location", value: 15 },
        ],
        matchThreshold: 75,
        payDetails: "Paid $19.50/hr with a $1.50/hr overnight differential, weekly pay.",
        postedAt: hoursAgo(3),
      },
    },
    {
      key: "event-setup-crew",
      companyId: bright,
      data: {
        title: "Event Setup Crew — Weekend Festival",
        category: "Events & Hospitality",
        payType: "fixed",
        payAmount: 180,
        payDisplay: "$180/shift",
        location: "Denver, CO",
        distanceMi: 8,
        shift: "Sat, 7am–3pm",
        urgent: false,
        verifiedEmployer: true,
        status: "CLOSED",
        description:
          "Join the setup crew for a weekend outdoor festival — staging, tent assembly, and vendor booth setup ahead of gates opening.",
        requirements: [
          "Able to lift 50 lbs",
          "Comfortable working outdoors",
          "Team-oriented and punctual",
          "Steel-toe boots recommended",
        ],
        screeningCriteria: [
          { label: "Able to lift 50 lbs", type: "cert", value: true },
          { label: "Available Saturday 7am-3pm", type: "availability", value: "sat-day" },
        ],
        payDetails: "Flat $180 for the shift, paid same day via direct deposit.",
        postedAt: hoursAgo(6),
      },
    },
    {
      key: "residential-cleaner",
      companyId: tidynest,
      data: {
        title: "Residential Cleaner — Recurring Clients",
        category: "Home Services",
        payType: "hourly",
        payAmount: 24,
        payDisplay: "$24/hr",
        location: "Seattle, WA",
        distanceMi: 3.7,
        shift: "Flexible schedule",
        urgent: false,
        verifiedEmployer: true,
        status: "ACTIVE",
        description:
          "TidyNest is looking for a reliable residential cleaner for a rotating book of recurring weekly clients across North Seattle.",
        requirements: [
          "1+ year cleaning experience",
          "Own transportation",
          "Background check required",
          "Attention to detail",
        ],
        screeningCriteria: [
          { label: "1+ yr cleaning experience", type: "experience", value: 1 },
          { label: "Own transportation", type: "cert", value: true },
        ],
        payDetails: "$24/hr, tips included, paid weekly with mileage covered between jobs.",
        postedAt: daysAgo(1),
      },
    },
    {
      key: "electrician-helper",
      companyId: voltworks,
      data: {
        title: "Licensed Electrician Helper",
        category: "Skilled Trades",
        payType: "hourly",
        payAmount: 28,
        payDisplay: "$28/hr",
        location: "Phoenix, AZ",
        distanceMi: 12,
        shift: "Mon–Fri, 7am–3:30pm",
        urgent: true,
        verifiedEmployer: true,
        status: "ACTIVE",
        description:
          "Assist a licensed electrician on residential rewiring projects — running conduit, pulling wire, and prepping job sites.",
        requirements: [
          "Basic electrical tools",
          "OSHA 10 preferred",
          "Able to work at heights",
          "Reliable transportation",
        ],
        screeningCriteria: [
          { label: "OSHA 10 preferred", type: "cert", value: false },
          { label: "Available weekdays 7am-3:30pm", type: "availability", value: "weekday-day" },
        ],
        payDetails: "$28/hr, paid biweekly, with potential for ongoing contract work.",
        postedAt: hoursAgo(2),
      },
    },
    {
      key: "retail-associate",
      companyId: northgate,
      data: {
        title: "Retail Associate — Holiday Rush",
        category: "Retail & Customer Service",
        payType: "hourly",
        payAmount: 18,
        payDisplay: "$18/hr",
        location: "Chicago, IL",
        distanceMi: 1.2,
        shift: "This week, evenings",
        urgent: false,
        verifiedEmployer: true,
        status: "ACTIVE",
        description:
          "Support front-of-store operations during the holiday rush — restocking, register support, and customer assistance.",
        requirements: [
          "Prior retail experience a plus",
          "Available evenings and weekends",
          "Comfortable on your feet for full shift",
          "Friendly, customer-first attitude",
        ],
        screeningCriteria: [
          { label: "Available evenings/weekends", type: "availability", value: "evenings-weekends" },
        ],
        payDetails: "$18/hr, paid weekly, with a holiday shift bonus.",
        postedAt: hoursAgo(4),
      },
    },
    {
      key: "banquet-server",
      companyId: marquee,
      data: {
        title: "Banquet Server — Corporate Events",
        category: "Events & Hospitality",
        payType: "hourly",
        payAmount: 21,
        payDisplay: "$21/hr + tips",
        location: "Miami, FL",
        distanceMi: 6.6,
        shift: "Fri–Sun evenings",
        urgent: true,
        verifiedEmployer: true,
        status: "ACTIVE",
        description:
          "Serve at upscale corporate events and private banquets across downtown Miami — plated service and bar support.",
        requirements: [
          "Prior serving experience preferred",
          "Black-and-white formal attire",
          "Available weekend evenings",
          "Food handler card a plus",
        ],
        screeningCriteria: [
          { label: "Prior serving experience", type: "experience", value: 0.5 },
          { label: "Available weekend evenings", type: "availability", value: "weekend-evening" },
        ],
        payDetails: "$21/hr plus pooled tips, typically $28–35/hr total, paid weekly.",
        postedAt: hoursAgo(0.5),
      },
    },
    {
      key: "forklift-operator",
      companyId: portside,
      data: {
        title: "Forklift Operator — Certified",
        category: "Warehouse",
        payType: "hourly",
        payAmount: 23,
        payDisplay: "$23/hr",
        location: "Newark, NJ",
        distanceMi: 4,
        shift: "Today, 6am–2pm",
        urgent: true,
        verifiedEmployer: true,
        status: "ACTIVE",
        description:
          "Operate a sit-down forklift loading and unloading freight containers at a busy port-adjacent distribution yard.",
        requirements: [
          "Current forklift certification",
          "6+ months forklift experience",
          "Able to pass a physical",
          "Punctual and safety-focused",
        ],
        screeningCriteria: [
          { label: "Current forklift certification", type: "cert", value: true },
          { label: "6+ months forklift experience", type: "experience", value: 0.5 },
        ],
        payDetails: "$23/hr, paid weekly, with same-day shift confirmation.",
        postedAt: hoursAgo(0.75),
      },
    },
    {
      key: "handyman",
      companyId: fixit,
      data: {
        title: "Handyman — Small Repairs",
        category: "Home Services",
        payType: "hourly",
        payAmount: 26,
        payDisplay: "$26/hr",
        location: "Portland, OR",
        distanceMi: 2.9,
        shift: "Flexible schedule",
        urgent: false,
        verifiedEmployer: false,
        status: "ACTIVE",
        description:
          "Take on small residential repair jobs booked through the FixIt app — drywall patches, fixture swaps, and minor carpentry.",
        requirements: [
          "Own basic hand tools",
          "Reliable vehicle",
          "1+ year handyman experience",
          "Smartphone for job dispatch",
        ],
        screeningCriteria: [
          { label: "1+ yr handyman experience", type: "experience", value: 1 },
          { label: "Own basic hand tools", type: "cert", value: true },
        ],
        payDetails: "$26/hr, paid per completed job within 48 hours.",
        postedAt: daysAgo(1),
      },
    },
  ];

  const jobIds: Record<string, string> = {};
  for (const def of jobDefs) {
    let job = await prisma.job.findFirst({
      where: { title: def.data.title, companyId: def.companyId },
    });
    if (!job) {
      job = await prisma.job.create({ data: { companyId: def.companyId, ...def.data } });
    }
    jobIds[def.key] = job.id;
  }

  console.log("Seeding the primary demo seeker (Jordan Diaz) and their applications...");
  const jordanId = await ensureSeeker({
    email: "jordan.diaz@hanaphire.dev",
    name: "Jordan Diaz",
    rating: 4.7,
    yearsExperience: { general: "2 yrs" },
    certifications: [],
    availability: "Flexible schedule",
    savedJobIds: [jobIds["event-setup-crew"], jobIds["banquet-server"]],
  });

  const jordanApplications: Array<[string, "APPLIED" | "VIEWED" | "INTERVIEW" | "HIRED" | "REJECTED", number]> = [
    [jobIds["delivery-driver"], "INTERVIEW", 2],
    [jobIds["banquet-server"], "VIEWED", 4],
    [jobIds["forklift-operator"], "HIRED", 7],
    [jobIds["retail-associate"], "REJECTED", 7],
  ];
  for (const [jobId, status, ago] of jordanApplications) {
    await prisma.application.upsert({
      where: { jobId_seekerId: { jobId, seekerId: jordanId } },
      update: { status },
      create: { jobId, seekerId: jordanId, status, appliedAt: daysAgo(ago) },
    });
  }

  console.log("Seeding job1/job3 applicant samples...");
  const carlos = await ensureSeeker({
    email: "carlos.nunez@hanaphire.dev",
    name: "Carlos Nunez",
    rating: 4.7,
    yearsExperience: { general: "1 yr" },
    certifications: [],
    availability: "Flexible schedule",
  });
  const amina = await ensureSeeker({
    email: "amina.yusuf@hanaphire.dev",
    name: "Amina Yusuf",
    rating: 4.9,
    yearsExperience: { general: "3 yrs" },
    certifications: [],
    availability: "Flexible schedule",
  });
  const jake = await ensureSeeker({
    email: "jake.sullivan@hanaphire.dev",
    name: "Jake Sullivan",
    rating: 4.5,
    yearsExperience: { general: "1 yr" },
    certifications: [],
    availability: "Flexible schedule",
  });
  const wendy = await ensureSeeker({
    email: "wendy.park@hanaphire.dev",
    name: "Wendy Park",
    rating: 4.8,
    yearsExperience: { general: "2 yrs" },
    certifications: [],
    availability: "Weekends",
  });
  const ravi = await ensureSeeker({
    email: "ravi.patel@hanaphire.dev",
    name: "Ravi Patel",
    rating: 4.6,
    yearsExperience: { general: "1 yr" },
    certifications: [],
    availability: "Weekends",
  });

  const secondaryApplications: Array<[string, string, "APPLIED" | "VIEWED" | "HIRED" | "REJECTED", number]> = [
    [jobIds["delivery-driver"], carlos, "APPLIED", 0.2],
    [jobIds["delivery-driver"], amina, "VIEWED", 1],
    [jobIds["delivery-driver"], jake, "APPLIED", 1],
    [jobIds["event-setup-crew"], wendy, "HIRED", 14],
    [jobIds["event-setup-crew"], ravi, "REJECTED", 14],
  ];
  for (const [jobId, seekerId, status, ago] of secondaryApplications) {
    await prisma.application.upsert({
      where: { jobId_seekerId: { jobId, seekerId } },
      update: { status },
      create: { jobId, seekerId, status, appliedAt: daysAgo(ago) },
    });
  }

  console.log("Seeding the 6 AI-screened candidates for the Warehouse Associate role...");
  const aiCandidates: Array<{
    email: string;
    name: string;
    matchScore: number;
    yearsExp: string;
    rating: number;
    availability: string;
    rationale: string;
    draftMessage: string;
  }> = [
    {
      email: "marcus.reyes@hanaphire.dev",
      name: "Marcus Reyes",
      matchScore: 96,
      yearsExp: "3 yrs warehouse",
      rating: 4.9,
      availability: "Available immediately",
      rationale:
        "Certified forklift operator with 3 years overnight warehouse experience — exceeds every requirement and available to start this week.",
      draftMessage:
        "Hi Marcus, your forklift certification and overnight availability line up perfectly with our Warehouse Associate role at Fulcrum. Would you be open to a quick call this week?",
    },
    {
      email: "dana.okafor@hanaphire.dev",
      name: "Dana Okafor",
      matchScore: 91,
      yearsExp: "2 yrs logistics",
      rating: 4.8,
      availability: "Flexible schedule",
      rationale:
        "Strong inventory management background and consistently high reliability rating from past shifts.",
      draftMessage:
        "Hi Dana, we were impressed by your inventory management experience. We have an overnight Warehouse Associate opening at Fulcrum — interested in learning more?",
    },
    {
      email: "leo.martins@hanaphire.dev",
      name: "Leo Martins",
      matchScore: 88,
      yearsExp: "1 yr warehouse",
      rating: 4.6,
      availability: "Available this week",
      rationale:
        "Newer to warehouse work but a fast learner with strong recent shift attendance.",
      draftMessage:
        "Hi Leo, your recent warehouse shifts caught our eye. We're hiring for overnight Warehouse Associates at Fulcrum — want to hear more?",
    },
    {
      email: "priya.chandran@hanaphire.dev",
      name: "Priya Chandran",
      matchScore: 84,
      yearsExp: "4 yrs logistics",
      rating: 4.7,
      availability: "Prefers overnight",
      rationale:
        "Deep logistics coordination background; slightly overqualified but explicitly prefers overnight shifts.",
      draftMessage:
        "Hi Priya, your logistics coordination background stood out. We have an overnight Warehouse Associate role at Fulcrum that matches your shift preference.",
    },
    {
      email: "sam.whitfield@hanaphire.dev",
      name: "Sam Whitfield",
      matchScore: 79,
      yearsExp: "New to warehouse",
      rating: 4.5,
      availability: "Available immediately",
      rationale:
        "No direct warehouse history yet, but a strong reliability score and immediate availability.",
      draftMessage:
        "Hi Sam, we like your reliability track record. Would you consider an overnight Warehouse Associate role at Fulcrum to get started in the space?",
    },
    {
      email: "tasha.greene@hanaphire.dev",
      name: "Tasha Greene",
      matchScore: 75,
      yearsExp: "2 yrs retail",
      rating: 4.4,
      availability: "Part-time only",
      rationale:
        "Transferable customer-facing skills, though only available part-time versus the full overnight shift.",
      draftMessage:
        "Hi Tasha, thanks for applying — we may have part-time overnight slots for the Warehouse Associate role at Fulcrum. Interested in a quick chat?",
    },
  ];

  function recommendedActionFor(score: number): RecommendedAction {
    if (score >= 85) return "APPROVE";
    if (score >= 70) return "REVIEW";
    return "PASS";
  }

  for (const c of aiCandidates) {
    const seekerId = await ensureSeeker({
      email: c.email,
      name: c.name,
      rating: c.rating,
      yearsExperience: { warehouse: c.yearsExp },
      certifications: c.matchScore >= 90 ? ["Forklift certified"] : [],
      availability: c.availability,
    });
    await prisma.application.upsert({
      where: { jobId_seekerId: { jobId: jobIds["warehouse-associate"], seekerId } },
      update: {},
      create: {
        jobId: jobIds["warehouse-associate"],
        seekerId,
        status: "APPLIED",
        appliedAt: daysAgo(3),
        matchScore: c.matchScore,
        rationale: c.rationale,
        recommendedAction: recommendedActionFor(c.matchScore),
        outreachDraft: c.draftMessage,
        outreachStatus: "PENDING",
        screenedAt: hoursAgo(1),
      },
    });
  }

  await prisma.screeningRun.create({
    data: {
      jobId: jobIds["warehouse-associate"],
      status: "DONE",
      currentStep: 4,
      scoredCount: aiCandidates.length,
      startedAt: hoursAgo(1),
      completedAt: hoursAgo(1),
      totalScreened: aiCandidates.length,
      topMatchCount: aiCandidates.filter((c) => c.matchScore >= 75).length,
    },
  });

  console.log("Seeding flagged listings (with their own throwaway job postings)...");
  const swiftParcel = await ensureCompany({
    email: "employer+swiftparcel@hanaphire.dev",
    name: "Swift Parcel Co.",
    slug: "swift-parcel-co",
    industry: "Delivery",
    hq: "Dallas, TX",
    founded: "2022",
    size: "1–10 employees",
    about: "Local parcel delivery service.",
    rating: 3.1,
    reviewCount: 4,
  });
  const boxmove = await ensureCompany({
    email: "employer+boxmove@hanaphire.dev",
    name: "BoxMove LLC",
    slug: "boxmove-llc",
    industry: "Warehousing & Fulfillment",
    hq: "Reno, NV",
    founded: "2023",
    size: "1–10 employees",
    about: "On-demand warehouse labor.",
    rating: 3.4,
    reviewCount: 2,
  });
  const starlight = await ensureCompany({
    email: "employer+starlight@hanaphire.dev",
    name: "Starlight Promotions",
    slug: "starlight-promotions",
    industry: "Events & Hospitality",
    hq: "Las Vegas, NV",
    founded: "2021",
    size: "1–10 employees",
    about: "Event staffing and promotions.",
    rating: 3.6,
    reviewCount: 9,
  });
  const fastfix = await ensureCompany({
    email: "employer+fastfix@hanaphire.dev",
    name: "FastFix Crew",
    slug: "fastfix-crew",
    industry: "Home Services",
    hq: "Tampa, FL",
    founded: "2023",
    size: "1–10 employees",
    about: "Independent home repair contractors.",
    rating: 3.0,
    reviewCount: 3,
  });

  const flaggedDefs: Array<{
    companyId: string;
    title: string;
    category: string;
    location: string;
    reason: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    reportedAt: Date;
  }> = [
    {
      companyId: swiftParcel,
      title: "Cash Only Delivery Runner",
      category: "Delivery",
      location: "Dallas, TX",
      reason: "Suspicious pay terms",
      severity: "HIGH",
      reportedAt: hoursAgo(2),
    },
    {
      companyId: boxmove,
      title: "Warehouse Help Needed ASAP",
      category: "Warehouse",
      location: "Reno, NV",
      reason: "Unverified business",
      severity: "MEDIUM",
      reportedAt: hoursAgo(5),
    },
    {
      companyId: starlight,
      title: "Event Staff — No Experience",
      category: "Events & Hospitality",
      location: "Las Vegas, NV",
      reason: "Duplicate listing",
      severity: "LOW",
      reportedAt: daysAgo(1),
    },
    {
      companyId: fastfix,
      title: "Home Repair Contractor",
      category: "Home Services",
      location: "Tampa, FL",
      reason: "Reported by worker",
      severity: "HIGH",
      reportedAt: daysAgo(2),
    },
  ];

  for (const f of flaggedDefs) {
    const job = await prisma.job.findFirst({
      where: { title: f.title, companyId: f.companyId },
    }) ?? (await prisma.job.create({
      data: {
        companyId: f.companyId,
        title: f.title,
        category: f.category,
        payType: "hourly",
        payAmount: 20,
        payDisplay: "$20/hr",
        location: f.location,
        shift: "Flexible schedule",
        urgent: false,
        verifiedEmployer: false,
        status: "ACTIVE",
        description: "Listing under review.",
        requirements: [],
        screeningCriteria: [],
        payDetails: "Pay terms under review.",
        postedAt: f.reportedAt,
      },
    }));

    const existingFlag = await prisma.flaggedListing.findFirst({ where: { jobId: job.id } });
    if (!existingFlag) {
      await prisma.flaggedListing.create({
        data: {
          jobId: job.id,
          reason: f.reason,
          severity: f.severity,
          reportedAt: f.reportedAt,
          resolved: false,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Demo password for every seeded account: ${DEMO_PASSWORD}`);
  console.log("  admin@hanaphire.dev (ADMIN)");
  console.log("  jordan.diaz@hanaphire.dev (SEEKER)");
  console.log("  employer+fulcrum@hanaphire.dev (EMPLOYER, owns the AI-eligible Warehouse Associate job)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
