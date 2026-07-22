import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/actions/employer";
import { CATEGORIES } from "@/lib/constants";
import { SubmitButton } from "@/components/submit-button";

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
          <Field label="Company name" htmlFor="companyName" required>
            <input id="companyName" name="companyName" required placeholder="Your business name" className="input" />
          </Field>
        )}

        <Field label="Job title" htmlFor="title" required>
          <input id="title" name="title" required placeholder="e.g. Warehouse Associate — Overnight" className="input" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="category" required>
            <select id="category" name="category" required defaultValue={CATEGORIES[0]} className="input bg-white">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pay rate" htmlFor="payAmount" required>
            <div className="flex gap-2">
              <input
                id="payAmount"
                name="payAmount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                placeholder="25.00"
                className="input"
              />
              <select id="payType" name="payType" required defaultValue="hourly" className="input w-32 bg-white">
                <option value="hourly">/ hour</option>
                <option value="fixed">flat rate</option>
              </select>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="location" required>
            <input id="location" name="location" required placeholder="City, state" className="input" />
          </Field>
          <Field label="Shift / schedule" htmlFor="shift" required>
            <input id="shift" name="shift" required placeholder="Today 2pm–8pm" className="input" />
          </Field>
        </div>

        <Field label="Description" htmlFor="description" required>
          <textarea id="description" name="description" required rows={4} placeholder="Describe the role and daily tasks" className="input resize-y" />
        </Field>

        <Field label="Screening criteria (used by the AI agent)" htmlFor="criteria">
          <textarea
            id="criteria"
            name="criteria"
            rows={3}
            placeholder="e.g. Forklift certified, 1+ yr warehouse experience, available overnight"
            className="input resize-y"
          />
        </Field>

        <SubmitButton className="mt-2 rounded-md bg-accent px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-60">
          Publish job
        </SubmitButton>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium tracking-wide text-text-muted uppercase">
        {label}
        {required ? <span className="text-danger"> *</span> : <span className="normal-case text-text-faint"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}
