# Content Dashboard

```dataviewjs
const registry = JSON.parse(await dv.io.load("content-registry.json"))

dv.header(3, `${registry.length} pieces of content`)

dv.table(
  ["ID", "Type", "Status", "Score", "Platforms", "Created"],
  registry
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .map(r => [
      r.id,
      r.type,
      r.status,
      r.virality_score ?? "—",
      r.platforms.join(", "),
      r.created_at?.slice(0, 10) ?? "—"
    ])
)
```
