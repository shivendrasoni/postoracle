# PostOracle Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Next.js dashboard that displays PostOracle's vault data — content registry, analytics, brand profile, and vault file browser — on localhost:3000.

**Architecture:** Monorepo approach — a `dashboard/` folder inside the existing project. Next.js API routes read vault files via `fs` through a shared path resolver. Dark-themed sidebar layout with 4 pages. No database, no auth.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, react-markdown, gray-matter

**Spec:** `docs/superpowers/specs/2026-05-12-postoracle-dashboard-design.md`

---

## File Map

```
dashboard/
├── app/
│   ├── layout.tsx                    # Root layout — sidebar + dark theme wrapper
│   ├── page.tsx                      # Content Registry home page
│   ├── globals.css                   # Tailwind base + dark theme tokens
│   ├── analytics/
│   │   └── page.tsx                  # Analytics dashboard
│   ├── brand/
│   │   └── page.tsx                  # Brand profile viewer
│   ├── vault/
│   │   └── [[...path]]/
│   │       └── page.tsx              # Vault explorer (catch-all route)
│   └── api/
│       ├── registry/
│       │   └── route.ts              # GET → content-registry.json
│       ├── analytics/
│       │   └── route.ts              # GET → vault/analytics/*.md
│       ├── brand/
│       │   └── route.ts              # GET → vault/brand/ files
│       └── vault/
│           └── route.ts              # GET ?path= → vault tree or file
├── components/
│   ├── sidebar.tsx                   # Fixed left nav
│   ├── stat-card.tsx                 # Metric card (number + label)
│   ├── status-badge.tsx              # Draft/published pill
│   ├── content-table.tsx             # Registry table with filters + expandable detail
│   ├── markdown-viewer.tsx           # Renders .md with frontmatter stripped
│   └── file-tree.tsx                 # Recursive folder/file tree
├── lib/
│   ├── vault.ts                      # resolveVaultPath + fs helpers
│   └── types.ts                      # Shared TypeScript types
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `dashboard/package.json`, `dashboard/next.config.ts`, `dashboard/tsconfig.json`, `dashboard/tailwind.config.ts`, `dashboard/app/globals.css`, `dashboard/app/layout.tsx`, `dashboard/app/page.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Create Next.js app with TypeScript and Tailwind**

```bash
cd /Users/shivendrasoni/personal/content_creation
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --no-turbopack
```

Accept all defaults. This generates the full scaffold.

- [ ] **Step 2: Verify it runs**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev
```

Open http://localhost:3000 — should show the default Next.js page.
Stop the dev server (Ctrl+C).

- [ ] **Step 3: Add dashboard dependencies**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm install react-markdown remark-gfm gray-matter
npm install -D @types/node
```

- [ ] **Step 4: Update .gitignore in project root**

Add to `/Users/shivendrasoni/personal/content_creation/.gitignore`:

```
dashboard/node_modules/
dashboard/.next/
```

- [ ] **Step 5: Configure vault asset rewrites in next.config.ts**

Replace `dashboard/next.config.ts` with:

```typescript
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gray-matter"],
  async rewrites() {
    return [
      {
        source: "/vault-assets/:path*",
        destination: "/api/vault-asset?path=:path*",
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 6: Set up dark theme globals.css**

Replace `dashboard/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-sidebar: #0e0e16;
  --bg-card: #16161f;
  --bg-hover: #1e1e2a;
  --border: #1e1e2a;
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;
  --accent: #e94560;
  --accent-dim: rgba(233, 69, 96, 0.15);
  --green: #4caf50;
  --green-dim: rgba(76, 175, 80, 0.15);
  --yellow: #ffc107;
  --yellow-dim: rgba(255, 193, 7, 0.15);
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 7: Commit scaffold**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/ .gitignore
git commit -m "feat(dashboard): scaffold Next.js project with Tailwind dark theme"
```

---

## Task 2: Vault path resolver and types

**Files:**
- Create: `dashboard/lib/vault.ts`, `dashboard/lib/types.ts`

- [ ] **Step 1: Create shared types**

Create `dashboard/lib/types.ts`:

```typescript
export interface RegistryEntry {
  id: string;
  type: "reel" | "carousel" | "post";
  topic: string;
  source_url: string | null;
  platforms: string[];
  status: "draft" | "published";
  virality_score: number | null;
  created_at: string;
  scheduled_at: string | null;
  published_at: Record<string, string>;
  published_urls: Record<string, string>;
  session_dir: string;
  tags: string[];
  analytics?: {
    performance_score: number;
    last_fetched_at: string;
  };
  published_media_ids?: Record<string, string>;
}

export interface VaultFile {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: VaultFile[];
}

export interface BrandModule {
  filename: string;
  module: string;
  last_updated: string;
  content: string;
  frontmatter: Record<string, unknown>;
  isEmpty: boolean;
}

export interface AnalyticsReport {
  filename: string;
  title: string;
  generated_at: string;
  content: string;
}
```

- [ ] **Step 2: Create vault path resolver**

Create `dashboard/lib/vault.ts`:

```typescript
import path from "path";
import fs from "fs/promises";

const VAULT_ROOT = path.resolve(process.cwd(), "../vault");

export function resolveVaultPath(...segments: string[]): string {
  const resolved = path.resolve(VAULT_ROOT, ...segments);
  if (!resolved.startsWith(VAULT_ROOT)) {
    throw new Error("Path traversal attempt blocked");
  }
  return resolved;
}

export async function readVaultFile(relativePath: string): Promise<string> {
  const fullPath = resolveVaultPath(relativePath);
  return fs.readFile(fullPath, "utf-8");
}

export async function readVaultJson<T>(relativePath: string): Promise<T> {
  const content = await readVaultFile(relativePath);
  return JSON.parse(content) as T;
}

export async function listVaultDir(
  relativePath: string
): Promise<{ name: string; isDirectory: boolean }[]> {
  const fullPath = resolveVaultPath(relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function vaultPathExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(resolveVaultPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function buildFileTree(
  relativePath: string,
  depth: number = 3
): Promise<import("./types").VaultFile[]> {
  if (depth <= 0) return [];
  const entries = await listVaultDir(relativePath);
  const tree: import("./types").VaultFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(relativePath, entry.name);
    const node: import("./types").VaultFile = {
      name: entry.name,
      path: entryPath,
      type: entry.isDirectory ? "directory" : "file",
    };
    if (entry.isDirectory) {
      node.children = await buildFileTree(entryPath, depth - 1);
    }
    tree.push(node);
  }
  return tree;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/lib/
git commit -m "feat(dashboard): add vault path resolver and shared types"
```

---

## Task 3: Sidebar layout

**Files:**
- Create: `dashboard/components/sidebar.tsx`
- Modify: `dashboard/app/layout.tsx`

- [ ] **Step 1: Create sidebar component**

Create `dashboard/components/sidebar.tsx`:

```tsx
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
```

- [ ] **Step 2: Update root layout**

Replace `dashboard/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import Sidebar from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostOracle",
  description: "Content creation dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8" style={{ marginLeft: 220 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add placeholder home page**

Replace `dashboard/app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Content Registry</h1>
      <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
    </div>
  );
}
```

- [ ] **Step 4: Verify sidebar renders**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev
```

Open http://localhost:3000 — should show dark page with left sidebar: PostOracle logo, 4 nav links (Content, Analytics, Brand, Vault), "localhost · read-only" footer. Click each link — URL changes, Content highlights on `/`.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/components/sidebar.tsx dashboard/app/layout.tsx dashboard/app/page.tsx
git commit -m "feat(dashboard): add sidebar navigation layout"
```

---

## Task 4: Content Registry API route + page

**Files:**
- Create: `dashboard/app/api/registry/route.ts`, `dashboard/components/stat-card.tsx`, `dashboard/components/status-badge.tsx`, `dashboard/components/content-table.tsx`
- Modify: `dashboard/app/page.tsx`

- [ ] **Step 1: Create registry API route**

Create `dashboard/app/api/registry/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { readVaultJson, vaultPathExists } from "@/lib/vault";
import type { RegistryEntry } from "@/lib/types";

export async function GET() {
  const exists = await vaultPathExists("content-registry.json");
  if (!exists) {
    return NextResponse.json([]);
  }

  const entries = await readVaultJson<RegistryEntry[]>("content-registry.json");
  return NextResponse.json(entries);
}
```

- [ ] **Step 2: Verify API route returns data**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev &
sleep 3
curl -s http://localhost:3000/api/registry | python3 -m json.tool | head -20
kill %1
```

Expected: JSON array with 5 entries matching `content-registry.json`.

- [ ] **Step 3: Create stat-card component**

Create `dashboard/components/stat-card.tsx`:

```tsx
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
```

- [ ] **Step 4: Create status-badge component**

Create `dashboard/components/status-badge.tsx`:

```tsx
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
```

- [ ] **Step 5: Create content-table component**

Create `dashboard/components/content-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { RegistryEntry } from "@/lib/types";
import StatusBadge from "./status-badge";

const TYPE_ICONS: Record<string, string> = {
  reel: "🎬",
  carousel: "📸",
  post: "📝",
};

type SortKey = "date" | "virality";

interface ContentTableProps {
  entries: RegistryEntry[];
}

export default function ContentTable({ entries }: ContentTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = entries.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "virality") {
      return (b.virality_score ?? -1) - (a.virality_score ?? -1);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const types = ["all", ...new Set(entries.map((e) => e.type))];
  const statuses = ["all", "draft", "published"];

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className="px-3 py-1 rounded text-xs transition-colors"
            style={{
              background:
                typeFilter === t ? "var(--accent-dim)" : "var(--bg-card)",
              color:
                typeFilter === t ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {t === "all" ? "All types" : t}
          </button>
        ))}
        <div className="w-px mx-1" style={{ background: "var(--border)" }} />
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1 rounded text-xs transition-colors"
            style={{
              background:
                statusFilter === s ? "var(--accent-dim)" : "var(--bg-card)",
              color:
                statusFilter === s ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {s === "all" ? "All statuses" : s}
          </button>
        ))}
        <div className="w-px mx-1" style={{ background: "var(--border)" }} />
        <button
          onClick={() => setSortBy(sortBy === "date" ? "virality" : "date")}
          className="px-3 py-1 rounded text-xs transition-colors"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
          }}
        >
          Sort: {sortBy === "date" ? "newest" : "virality"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && (
          <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
            No content matches the current filters.
          </p>
        )}
        {sorted.map((entry) => (
          <div key={entry.id}>
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors cursor-pointer"
              style={{ background: "var(--bg-card)" }}
              onClick={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg-card)")
              }
            >
              <div
                className="w-9 h-9 rounded flex items-center justify-center text-lg"
                style={{
                  background:
                    entry.status === "published"
                      ? "var(--green-dim)"
                      : "var(--accent-dim)",
                }}
              >
                {TYPE_ICONS[entry.type] ?? "📄"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {entry.topic}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {entry.type} · {new Date(entry.created_at).toLocaleDateString()} ·{" "}
                  {entry.platforms.join(", ")}
                </div>
              </div>
              <StatusBadge status={entry.status} />
              <span
                className="text-xs ml-1 transition-transform"
                style={{
                  color: "var(--text-muted)",
                  transform: expandedId === entry.id ? "rotate(90deg)" : "none",
                }}
              >
                ▶
              </span>
            </div>

            {expandedId === entry.id && (
              <div
                className="rounded-b-lg px-4 py-4 -mt-1 ml-12 mr-0 text-sm"
                style={{
                  background: "var(--bg-secondary)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Session:</span>{" "}
                    <a
                      href={`/vault/${entry.session_dir.replace("vault/", "")}`}
                      style={{ color: "var(--accent)" }}
                    >
                      {entry.session_dir}
                    </a>
                  </div>
                  {entry.source_url && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Source:</span>{" "}
                      <span className="truncate inline-block max-w-xs align-bottom">
                        {entry.source_url}
                      </span>
                    </div>
                  )}
                  {entry.virality_score !== null && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>
                        Virality:
                      </span>{" "}
                      {entry.virality_score}
                    </div>
                  )}
                  {Object.keys(entry.published_urls).length > 0 && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>
                        Published URLs:
                      </span>
                      {Object.entries(entry.published_urls).map(
                        ([platform, url]) => (
                          <span key={platform} className="ml-2">
                            {platform}
                          </span>
                        )
                      )}
                    </div>
                  )}
                  {entry.analytics && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>
                        Performance:
                      </span>{" "}
                      {entry.analytics.performance_score}/10
                    </div>
                  )}
                </div>
                {entry.tags.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          background: "var(--bg-card)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire up the home page**

Replace `dashboard/app/page.tsx` with:

```tsx
import StatCard from "@/components/stat-card";
import ContentTable from "@/components/content-table";
import { readVaultJson, vaultPathExists } from "@/lib/vault";
import type { RegistryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const exists = await vaultPathExists("content-registry.json");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-lg mb-2">No content yet</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Run <code>/setup</code> then <code>/make-reel</code> in Claude Code to
          get started.
        </p>
      </div>
    );
  }

  const entries = await readVaultJson<RegistryEntry[]>("content-registry.json");
  const drafts = entries.filter((e) => e.status === "draft").length;
  const published = entries.filter((e) => e.status === "published").length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Content Registry</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total" value={entries.length} />
        <StatCard label="Drafts" value={drafts} color="var(--yellow)" />
        <StatCard label="Published" value={published} color="var(--green)" />
      </div>

      <ContentTable entries={entries} />
    </div>
  );
}
```

- [ ] **Step 7: Verify home page renders with real data**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev
```

Open http://localhost:3000 — should show:
- "Content Registry" heading
- 3 stat cards: Total (5), Drafts (3), Published (2)
- 5 content rows with type icons, topics, dates, status badges
- Type and status filter buttons work
- Sort toggle switches between newest-first and virality-first
- Clicking a row expands a detail panel showing session dir link, source URL, analytics score

Stop dev server.

- [ ] **Step 8: Commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/app/api/registry/ dashboard/app/page.tsx dashboard/components/stat-card.tsx dashboard/components/status-badge.tsx dashboard/components/content-table.tsx
git commit -m "feat(dashboard): add content registry page with filters"
```

---

## Task 5: Analytics page

**Files:**
- Create: `dashboard/app/api/analytics/route.ts`, `dashboard/app/analytics/page.tsx`, `dashboard/components/markdown-viewer.tsx`

- [ ] **Step 1: Create markdown-viewer component**

Create `dashboard/components/markdown-viewer.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-invert max-w-none prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-strong:text-[var(--text-primary)] prose-td:text-[var(--text-secondary)] prose-th:text-[var(--text-primary)] prose-code:text-[var(--accent)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Create analytics API route**

Create `dashboard/app/api/analytics/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { readVaultFile, listVaultDir, vaultPathExists } from "@/lib/vault";
import matter from "gray-matter";
import type { AnalyticsReport } from "@/lib/types";

export async function GET() {
  const exists = await vaultPathExists("analytics");
  if (!exists) {
    return NextResponse.json([]);
  }

  const files = await listVaultDir("analytics");
  const mdFiles = files.filter((f) => f.name.endsWith(".md"));

  const reports: AnalyticsReport[] = [];
  for (const file of mdFiles) {
    const raw = await readVaultFile(`analytics/${file.name}`);
    const { data, content } = matter(raw);
    const titleMatch = content.match(/^#\s+(.+)$/m);
    reports.push({
      filename: file.name,
      title: titleMatch ? titleMatch[1] : file.name.replace(".md", ""),
      generated_at: data.generated_at ?? "",
      content,
    });
  }

  return NextResponse.json(reports);
}
```

- [ ] **Step 3: Create analytics page**

Create `dashboard/app/analytics/page.tsx`:

```tsx
import { readVaultFile, listVaultDir, vaultPathExists } from "@/lib/vault";
import matter from "gray-matter";
import MarkdownViewer from "@/components/markdown-viewer";
import type { AnalyticsReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const exists = await vaultPathExists("analytics");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-lg mb-2">No analytics data</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Run <code>/analytics</code> in Claude Code to pull metrics.
        </p>
      </div>
    );
  }

  const files = await listVaultDir("analytics");
  const mdFiles = files.filter((f) => f.name.endsWith(".md"));

  const reports: AnalyticsReport[] = [];
  for (const file of mdFiles) {
    const raw = await readVaultFile(`analytics/${file.name}`);
    const { data, content } = matter(raw);
    const titleMatch = content.match(/^#\s+(.+)$/m);
    reports.push({
      filename: file.name,
      title: titleMatch ? titleMatch[1] : file.name.replace(".md", ""),
      generated_at: data.generated_at ?? "",
      content,
    });
  }

  const overviewReport = reports.find((r) => r.filename === "overview.md");
  const otherReports = reports.filter((r) => r.filename !== "overview.md");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      {overviewReport && (
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          Last updated:{" "}
          {new Date(overviewReport.generated_at).toLocaleString()}
        </p>
      )}

      {overviewReport && (
        <div
          className="rounded-lg p-6 mb-6"
          style={{ background: "var(--bg-card)" }}
        >
          <MarkdownViewer content={overviewReport.content} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherReports.map((report) => (
          <div
            key={report.filename}
            className="rounded-lg p-6"
            style={{ background: "var(--bg-card)" }}
          >
            <MarkdownViewer content={report.content} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify analytics page**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev
```

Open http://localhost:3000/analytics — should show:
- "Analytics" heading with last-updated timestamp
- Overview card with Quick Stats and Reports links
- 3 report cards: Performance Leaderboard, Platform Comparison, Content Type Analysis
- Markdown tables render properly

Stop dev server.

- [ ] **Step 5: Commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/components/markdown-viewer.tsx dashboard/app/api/analytics/ dashboard/app/analytics/
git commit -m "feat(dashboard): add analytics page with rendered reports"
```

---

## Task 6: Brand profile page

**Files:**
- Create: `dashboard/app/api/brand/route.ts`, `dashboard/app/brand/page.tsx`

- [ ] **Step 1: Create brand API route**

Create `dashboard/app/api/brand/route.ts`:

```typescript
import { NextResponse } from "next/server";
import {
  readVaultFile,
  listVaultDir,
  vaultPathExists,
} from "@/lib/vault";
import matter from "gray-matter";
import type { BrandModule } from "@/lib/types";

export async function GET() {
  const hasModules = await vaultPathExists("brand/modules");
  const hasCompiled = await vaultPathExists("brand/brand-voice.md");

  let compiledContent = "";
  if (hasCompiled) {
    compiledContent = await readVaultFile("brand/brand-voice.md");
  }

  const modules: BrandModule[] = [];
  if (hasModules) {
    const files = await listVaultDir("brand/modules");
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));
    for (const file of mdFiles) {
      const raw = await readVaultFile(`brand/modules/${file.name}`);
      const { data, content } = matter(raw);
      const isPlaceholder =
        content.trim().length < 50 ||
        content.includes("To be filled in");
      modules.push({
        filename: file.name,
        module: (data.module as string) ?? file.name.replace(".md", ""),
        last_updated: (data.last_updated as string) ?? "",
        content,
        frontmatter: data,
        isEmpty: isPlaceholder,
      });
    }
  }

  return NextResponse.json({ compiledContent, modules });
}
```

- [ ] **Step 2: Create brand page**

Create `dashboard/app/brand/page.tsx`:

```tsx
import {
  readVaultFile,
  listVaultDir,
  vaultPathExists,
} from "@/lib/vault";
import matter from "gray-matter";
import MarkdownViewer from "@/components/markdown-viewer";
import type { BrandModule } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const hasModules = await vaultPathExists("brand/modules");
  const hasCompiled = await vaultPathExists("brand/brand-voice.md");

  if (!hasCompiled && !hasModules) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-lg mb-2">No brand profile</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Run <code>/brand-voice</code> in Claude Code to build your identity.
        </p>
      </div>
    );
  }

  let compiledContent = "";
  if (hasCompiled) {
    compiledContent = await readVaultFile("brand/brand-voice.md");
  }

  const modules: BrandModule[] = [];
  if (hasModules) {
    const files = await listVaultDir("brand/modules");
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));
    for (const file of mdFiles) {
      const raw = await readVaultFile(`brand/modules/${file.name}`);
      const { data, content } = matter(raw);
      const isPlaceholder =
        content.trim().length < 50 ||
        content.includes("To be filled in");
      modules.push({
        filename: file.name,
        module: (data.module as string) ?? file.name.replace(".md", ""),
        last_updated: (data.last_updated as string) ?? "",
        content,
        frontmatter: data,
        isEmpty: isPlaceholder,
      });
    }
  }

  const completed = modules.filter((m) => !m.isEmpty).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Brand Profile</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        {completed} of {modules.length} modules completed
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
        {modules.map((m) => (
          <a
            key={m.filename}
            href={`#module-${m.module}`}
            className="rounded-lg px-4 py-3 text-center text-sm transition-colors"
            style={{
              background: m.isEmpty ? "var(--bg-card)" : "var(--accent-dim)",
              color: m.isEmpty ? "var(--text-muted)" : "var(--accent)",
              fontWeight: m.isEmpty ? 400 : 600,
            }}
          >
            {m.module}
          </a>
        ))}
      </div>

      {compiledContent && (
        <div
          className="rounded-lg p-6 mb-8"
          style={{ background: "var(--bg-card)" }}
        >
          <h2 className="text-lg font-semibold mb-4">Compiled Brand Voice</h2>
          <MarkdownViewer content={compiledContent} />
        </div>
      )}

      {modules
        .filter((m) => !m.isEmpty)
        .map((m) => (
          <div
            key={m.filename}
            id={`module-${m.module}`}
            className="rounded-lg p-6 mb-4"
            style={{ background: "var(--bg-card)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold capitalize">{m.module}</h2>
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                updated {m.last_updated}
              </span>
            </div>
            <MarkdownViewer content={m.content} />
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify brand page**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev
```

Open http://localhost:3000/brand — should show:
- "Brand Profile" heading with "X of 9 modules completed"
- Grid of module name chips — completed ones highlighted in accent, incomplete ones muted
- Compiled brand voice card with full rendered markdown
- Individual module cards for each completed module (brand, cta, goals, niche, style, watermark, etc.)
- Clicking a module chip scrolls to that module's card

Stop dev server.

- [ ] **Step 4: Commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/app/api/brand/ dashboard/app/brand/
git commit -m "feat(dashboard): add brand profile page with module cards"
```

---

## Task 7: Vault explorer page

**Files:**
- Create: `dashboard/app/api/vault/route.ts`, `dashboard/app/vault/[[...path]]/page.tsx`, `dashboard/components/file-tree.tsx`

- [ ] **Step 1: Create vault API route**

Create `dashboard/app/api/vault/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  buildFileTree,
  readVaultFile,
  resolveVaultPath,
  vaultPathExists,
} from "@/lib/vault";
import fs from "fs/promises";
import matter from "gray-matter";

export async function GET(request: NextRequest) {
  const reqPath = request.nextUrl.searchParams.get("path") ?? "";

  const exists = await vaultPathExists(reqPath || ".");
  if (!exists) {
    return NextResponse.json(
      { error: "not_found", message: `Path not found: ${reqPath}` },
      { status: 404 }
    );
  }

  const fullPath = resolveVaultPath(reqPath || ".");
  const stat = await fs.stat(fullPath);

  if (stat.isDirectory()) {
    const tree = await buildFileTree(reqPath || ".", 2);
    return NextResponse.json({ type: "directory", path: reqPath, tree });
  }

  const raw = await readVaultFile(reqPath);
  const isMarkdown = reqPath.endsWith(".md");

  if (isMarkdown) {
    const { content } = matter(raw);
    return NextResponse.json({
      type: "file",
      path: reqPath,
      format: "markdown",
      content,
    });
  }

  const isJson = reqPath.endsWith(".json");
  if (isJson) {
    return NextResponse.json({
      type: "file",
      path: reqPath,
      format: "json",
      content: raw,
    });
  }

  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(reqPath);
  if (isImage) {
    return NextResponse.json({
      type: "file",
      path: reqPath,
      format: "image",
      assetUrl: `/vault-assets/${reqPath}`,
    });
  }

  return NextResponse.json({
    type: "file",
    path: reqPath,
    format: "text",
    content: raw,
  });
}
```

- [ ] **Step 2: Create vault asset API route for serving images/videos**

Create `dashboard/app/api/vault-asset/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { resolveVaultPath, vaultPathExists } from "@/lib/vault";
import fs from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".txt": "text/plain",
};

export async function GET(request: NextRequest) {
  const reqPath = request.nextUrl.searchParams.get("path") ?? "";
  if (!reqPath) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  const exists = await vaultPathExists(reqPath);
  if (!exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const fullPath = resolveVaultPath(reqPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  const data = await fs.readFile(fullPath);

  return new NextResponse(data, {
    headers: { "Content-Type": mime },
  });
}
```

- [ ] **Step 3: Create file-tree component**

Create `dashboard/components/file-tree.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { VaultFile } from "@/lib/types";

interface FileTreeProps {
  files: VaultFile[];
  basePath?: string;
}

export default function FileTree({ files, basePath = "" }: FileTreeProps) {
  return (
    <ul className="space-y-0.5">
      {files.map((file) => (
        <li key={file.path}>
          {file.type === "directory" ? (
            <details open={!!basePath}>
              <summary
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <span>📁</span>
                {file.name}
              </summary>
              {file.children && file.children.length > 0 && (
                <div className="ml-4">
                  <FileTree files={file.children} basePath={file.path} />
                </div>
              )}
            </details>
          ) : (
            <Link
              href={`/vault/${file.path}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-[var(--bg-hover)] transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              <span>{getFileIcon(file.name)}</span>
              {file.name}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function getFileIcon(name: string): string {
  if (name.endsWith(".md")) return "📄";
  if (name.endsWith(".json")) return "📋";
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "🖼️";
  if (name.endsWith(".mp4")) return "🎬";
  return "📄";
}
```

- [ ] **Step 4: Create vault explorer page**

Create `dashboard/app/vault/[[...path]]/page.tsx`:

```tsx
import {
  buildFileTree,
  readVaultFile,
  resolveVaultPath,
  vaultPathExists,
} from "@/lib/vault";
import fs from "fs/promises";
import matter from "gray-matter";
import FileTree from "@/components/file-tree";
import MarkdownViewer from "@/components/markdown-viewer";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface VaultPageProps {
  params: Promise<{ path?: string[] }>;
}

export default async function VaultPage({ params }: VaultPageProps) {
  const { path: pathSegments } = await params;
  const reqPath = pathSegments?.join("/") ?? "";

  const exists = await vaultPathExists(reqPath || ".");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-lg mb-2">Not found</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          <code>{reqPath}</code> does not exist in the vault.
        </p>
        <Link
          href="/vault"
          className="mt-4 text-sm"
          style={{ color: "var(--accent)" }}
        >
          Back to vault root
        </Link>
      </div>
    );
  }

  const fullPath = resolveVaultPath(reqPath || ".");
  const stat = await fs.stat(fullPath);

  const breadcrumbs = reqPath
    ? reqPath.split("/").map((seg, i, arr) => ({
        label: seg,
        href: "/vault/" + arr.slice(0, i + 1).join("/"),
      }))
    : [];

  if (stat.isDirectory()) {
    const tree = await buildFileTree(reqPath || ".", 2);
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Vault</h1>
        <Breadcrumbs items={breadcrumbs} />
        <div
          className="rounded-lg p-4 mt-4"
          style={{ background: "var(--bg-card)" }}
        >
          {tree.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
              Empty directory
            </p>
          ) : (
            <FileTree files={tree} />
          )}
        </div>
      </div>
    );
  }

  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(reqPath);
  if (isImage) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Vault</h1>
        <Breadcrumbs items={breadcrumbs} />
        <div
          className="rounded-lg p-6 mt-4"
          style={{ background: "var(--bg-card)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/vault-assets/${reqPath}`}
            alt={reqPath}
            className="max-w-full rounded"
          />
        </div>
      </div>
    );
  }

  const raw = await readVaultFile(reqPath);
  const isMarkdown = reqPath.endsWith(".md");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Vault</h1>
      <Breadcrumbs items={breadcrumbs} />
      <div
        className="rounded-lg p-6 mt-4"
        style={{ background: "var(--bg-card)" }}
      >
        {isMarkdown ? (
          <MarkdownViewer content={matter(raw).content} />
        ) : (
          <pre
            className="text-sm overflow-auto whitespace-pre-wrap"
            style={{ color: "var(--text-secondary)" }}
          >
            {raw}
          </pre>
        )}
      </div>
    </div>
  );
}

function Breadcrumbs({
  items,
}: {
  items: { label: string; href: string }[];
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <Link href="/vault" style={{ color: "var(--accent)" }}>
        vault
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-1">
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <Link href={item.href} style={{ color: "var(--accent)" }}>
            {item.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify vault explorer**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev
```

Open http://localhost:3000/vault — should show:
- "Vault" heading with breadcrumb showing "vault"
- File tree with folders: analytics, assets, brand, imports, library, logs, outputs
- Click into `brand/modules/` → shows `.md` files
- Click `brand/modules/brand.md` → renders markdown with brand identity content
- Click an image file in `outputs/` → displays the image inline
- Breadcrumbs update and are clickable

Stop dev server.

- [ ] **Step 6: Commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/app/api/vault/ dashboard/app/api/vault-asset/ dashboard/app/vault/ dashboard/components/file-tree.tsx
git commit -m "feat(dashboard): add vault explorer with file tree and markdown rendering"
```

---

## Task 8: Final integration and polish

**Files:**
- Modify: `dashboard/app/layout.tsx` (add font), `dashboard/components/sidebar.tsx` (active state fix)

- [ ] **Step 1: Add Inter font via next/font**

Update the top of `dashboard/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PostOracle",
  description: "Content creation dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8" style={{ marginLeft: 220 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Full smoke test**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run dev
```

Test each page:

1. **/** — Content Registry: 5 items, stat cards, filters work
2. **/analytics** — 4 report cards rendered as markdown
3. **/brand** — Module grid, compiled voice, individual module cards
4. **/vault** — File tree, click into directories, view markdown files, view images
5. **Sidebar** — Active state highlights correctly on each page
6. **Empty states** — (can't easily test without removing vault, but code paths are there)

- [ ] **Step 3: Run the production build to catch type errors**

```bash
cd /Users/shivendrasoni/personal/content_creation/dashboard
npm run build
```

Expected: Build completes successfully. Fix any TypeScript or build errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add dashboard/
git commit -m "feat(dashboard): add Inter font and final polish"
```

- [ ] **Step 5: Add start script documentation**

Update the project `CLAUDE.md` to add dashboard section. Add after the `## Commands` table:

```markdown
## Dashboard

Local web dashboard for viewing content, analytics, and brand profile:

```bash
cd dashboard && npm run dev    # http://localhost:3000
```
```

- [ ] **Step 6: Final commit**

```bash
cd /Users/shivendrasoni/personal/content_creation
git add CLAUDE.md
git commit -m "docs: add dashboard section to CLAUDE.md"
```
