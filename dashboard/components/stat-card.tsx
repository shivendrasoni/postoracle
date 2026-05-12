interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

export default function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div
      className="rounded-lg px-5 py-4 text-center"
      style={{ background: "var(--bg-card)" }}
    >
      <div
        className="text-2xl font-bold"
        style={{ color: color ?? "var(--accent)" }}
      >
        {value}
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
