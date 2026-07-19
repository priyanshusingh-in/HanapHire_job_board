import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/actions/employer";
import { CATEGORIES } from "@/lib/constants";

export default async function PostJobPage() {
  const profile = await requireRole(["EMPLOYER"]);
  const company = await prisma.company.findUnique({ where: { ownerUserId: profile.id } });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1.5 font-serif text-[28px] font-medium tracking-tight">Post a job</h1>
      <p className="mb-7.5 text-sm text-text-muted">
        Fill in shift details — our AI screening agent will use this to rank applicants automatically.
      </p>

      <form action={createJob} className="flex flex-col gap-4">
        {!company && (
          <Field label="Company name">
            <input name="companyName" required placeholder="Your business name" className="input" />
          </Field>
        )}

        <Field label="Job title">
          <input name="title" required placeholder="e.g. Warehouse Associate — Overnight" className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select name="category" required defaultValue={CATEGORIES[0]} className="input bg-white">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pay rate">
            <input name="payRate" required placeholder="$/hr or fixed" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Location">
            <input name="location" required placeholder="City, state" className="input" />
          </Field>
          <Field label="Shift / schedule">
            <input name="shift" required placeholder="Today 2pm–8pm" className="input" />
          </Field>
        </div>

        <Field label="Description">
          <textarea name="description" required rows={4} placeholder="Describe the role and daily tasks" className="input resize-y" />
        </Field>

        <Field label="Screening criteria (used by the AI agent)">
          <textarea
            name="criteria"
            rows={3}
            placeholder="e.g. Forklift certified, 1+ yr warehouse experience, available overnight"
            className="input resize-y"
          />
        </Field>

        <button type="submit" className="mt-2 rounded-md bg-accent px-5 py-3 text-[15px] font-semibold text-white">
          Publish job
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium tracking-wide text-text-muted uppercase">{label}</label>
      {children}
    </div>
  );
}
