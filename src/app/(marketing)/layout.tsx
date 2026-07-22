import { Footer } from "@/components/footer";
import { MarketingNav } from "@/components/marketing-nav";
import { getCurrentProfile } from "@/lib/auth";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <MarketingNav viewerRole={profile?.role ?? null} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
