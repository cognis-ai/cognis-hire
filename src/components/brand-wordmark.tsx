import { COGNIS_BRAND } from "@/lib/cognis-brand";

// Renders the brand wordmark with the second word in the accent colour
// (matches the upstream "Folo + Up" two-tone treatment for "Cognis Hire").
// Hoisted from inline copies in src/components/call/index.tsx and
// src/app/(user)/call/[interviewId]/page.tsx — follow-up flagged by the
// brand audit (a00e0dc).
export function BrandWordmark({ className }: { className?: string }) {
  const [first, ...rest] = COGNIS_BRAND.name.split(" ");
  const second = rest.join(" ");

  return (
    <span className={className}>
      <span>{first}</span>
      {second ? <span className="text-indigo-600">{` ${second}`}</span> : null}
    </span>
  );
}
