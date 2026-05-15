import { NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import yaml from "js-yaml";

const CONFIG_PATH = resolve(process.cwd(), "..", "vault", "postoracle.yaml");

export async function GET() {
  if (!existsSync(CONFIG_PATH)) {
    return NextResponse.json({});
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;
  return NextResponse.json(parsed ?? {});
}

export async function PUT(request: Request) {
  const body = await request.json();
  const yamlStr = yaml.dump(body, { noRefs: true, sortKeys: false, lineWidth: -1 });

  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(CONFIG_PATH, yamlStr, "utf-8");
  return NextResponse.json({ ok: true });
}
