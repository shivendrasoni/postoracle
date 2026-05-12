"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Content", icon: "📋" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/brand", label: "Brand", icon: "🎨" },
  { href: "/vault", label: "Vault", icon: "📁" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col border-r"
      style={{
        width: 220,
        background: "var(--bg-sidebar)",
        borderColor: "var(--border)",
      }}
    >
      <div className="px-5 py-5">
        <span
          className="text-lg font-bold tracking-wide"
          style={{ color: "var(--accent)" }}
        >
          PostOracle
        </span>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                background: isActive ? "var(--accent-dim)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="px-5 py-4 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        localhost · read-only
      </div>
    </aside>
  );
}
