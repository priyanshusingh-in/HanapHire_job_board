export default function MarketingLoading() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-30">
      <div className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-[#f0eee7]" />
        ))}
      </div>
    </div>
  );
}
