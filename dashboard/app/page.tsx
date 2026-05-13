import { readVaultJson, vaultPathExists } from "@/lib/vault";
import type { RegistryEntry } from "@/lib/types";
import ComposeHome from "@/components/compose/compose-home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const exists = await vaultPathExists("content-registry.json");
  const entries: RegistryEntry[] = exists
    ? await readVaultJson<RegistryEntry[]>("content-registry.json")
    : [];

  return <ComposeHome entries={entries} />;
}
