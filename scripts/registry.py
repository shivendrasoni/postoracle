#!/usr/bin/env python3
import json
from pathlib import Path


class Registry:
    def __init__(self, path: str | Path = "vault/content-registry.json"):
        self.path = Path(path)

    def _load(self) -> list[dict]:
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text())

    def _save(self, entries: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")

    def add(self, entry: dict) -> None:
        entries = self._load()
        if any(e["id"] == entry["id"] for e in entries):
            raise ValueError(f"Entry '{entry['id']}' already exists in registry")
        entries.append(entry)
        self._save(entries)

    def get(self, entry_id: str) -> dict | None:
        for e in self._load():
            if e["id"] == entry_id:
                return e
        return None

    def update(self, entry_id: str, fields: dict) -> None:
        entries = self._load()
        for entry in entries:
            if entry["id"] == entry_id:
                entry.update(fields)
                self._save(entries)
                return
        raise KeyError(f"Entry '{entry_id}' not found in registry")

    def list(self, **filters) -> list[dict]:
        entries = self._load()
        for key, value in filters.items():
            if key == "platform":
                entries = [e for e in entries if value in e.get("platforms", [])]
            else:
                entries = [e for e in entries if e.get(key) == value]
        return entries
