import type { LeadHeat } from "@/lib/store/types";

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  textarea,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  const classes =
    "w-full rounded-md border border-black/10 bg-paper px-3 py-2 text-sm outline-none transition focus:border-gold focus:bg-white";
  return (
    <label className="grid gap-1 text-sm font-semibold text-ink">
      {label}
      {textarea ? (
        <textarea className={`${classes} min-h-20 resize-y`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <input className={classes} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

export function HeatBadge({ heat }: { heat: LeadHeat }) {
  const tone = heat === "חם" ? "bg-mint/20 text-emerald-800" : heat === "בינוני" ? "bg-gold/20 text-amber-800" : "bg-black/5 text-ink";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{heat}</span>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-black/15 bg-paper p-6 text-center text-sm font-semibold text-black/55">{text}</div>;
}
