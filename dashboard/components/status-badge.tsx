interface StatusBadgeProps {
  status: "draft" | "published";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isDraft = status === "draft";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: isDraft ? "var(--yellow-dim)" : "var(--green-dim)",
        color: isDraft ? "var(--yellow)" : "var(--green)",
      }}
    >
      {status}
    </span>
  );
}
