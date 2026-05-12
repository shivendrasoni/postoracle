interface StatusBadgeProps {
  status: "draft" | "published";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isDraft = status === "draft";
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-[0.08em] uppercase
        ${isDraft ? "bg-pending-soft text-pending" : "bg-live-soft text-live"}
      `}
    >
      <span className="relative flex h-1.5 w-1.5">
        {!isDraft && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-live animate-[pulse-live_2s_ease-in-out_infinite]" />
        )}
        <span
          className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
            isDraft ? "bg-pending" : "bg-live"
          }`}
        />
      </span>
      {status}
    </span>
  );
}
