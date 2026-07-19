import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-5 bg-ink">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-8 pt-13 pb-7 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image src="/logo.png" alt="HanapHire" width={140} height={40} className="mb-4 h-10 w-auto brightness-0 invert" />
          <p className="max-w-[280px] text-sm leading-relaxed text-text-faint">
            On-demand hiring for gig and hourly work, built to move at the speed of a shift.
          </p>
        </div>
        <div>
          <div className="mb-4.5 font-serif text-[15px] italic text-text-faint">Product</div>
          <div className="flex flex-col gap-3 text-sm">
            <Link href="/jobs" className="cursor-pointer text-cream/90">
              Browse jobs
            </Link>
            <Link href="/signup?role=employer" className="cursor-pointer text-cream/90">
              Post a job
            </Link>
            <Link href="/companies" className="cursor-pointer text-cream/90">
              Company directory
            </Link>
          </div>
        </div>
        <div>
          <div className="mb-4.5 font-serif text-[15px] italic text-text-faint">Company</div>
          <div className="flex flex-col gap-3 text-sm">
            <span className="text-[#6b675e]">
              About <em className="italic opacity-70">(soon)</em>
            </span>
            <span className="text-[#6b675e]">
              Careers <em className="italic opacity-70">(soon)</em>
            </span>
            <Link href="/admin" className="cursor-pointer text-[12.5px] text-text-faint">
              Admin console →
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-cream/12 px-8 py-5 text-[13px] text-[#6b675e]">
        © 2026 HanapHire, Inc.
      </div>
    </footer>
  );
}
