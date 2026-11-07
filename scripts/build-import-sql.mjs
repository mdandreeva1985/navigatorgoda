// Builds one SQL file that replaces ALL planner data in the new database with the
// contents of an admin-panel export (navigator-export-<date>.json).
//
//   node scripts/build-import-sql.mjs navigator-export-2026-11-07.json <out.sql>
//   npx supabase db query --remote -f <out.sql> --yes
//
// Runs in a single transaction: either everything is imported or nothing changes.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const [, , exportPath, outPath] = process.argv;
if (!exportPath || !outPath) {
  console.error("Usage: node scripts/build-import-sql.mjs <export.json> <out.sql>");
  process.exit(1);
}

const { tables } = JSON.parse(readFileSync(exportPath, "utf8"));
const names = Object.keys(tables);

// Parents first: almost everything references profiles; habit_completions references habits.
const first = ["profiles", "habits"];
const order = [...first.filter((t) => names.includes(t)), ...names.filter((t) => !first.includes(t))];

const tag = `d${randomBytes(8).toString("hex")}`;
const ident = (t) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(t)) throw new Error(`Unexpected table name: ${t}`);
  return `life_navigator.${t}`;
};

const lines = ["BEGIN;", `TRUNCATE ${order.map(ident).join(", ")} CASCADE;`];
for (const t of order) {
  const rows = tables[t];
  if (!rows.length) continue;
  const json = JSON.stringify(rows);
  if (json.includes(`$${tag}$`)) throw new Error("Quote tag collision, run again");
  lines.push(
    `INSERT INTO ${ident(t)} SELECT * FROM jsonb_populate_recordset(NULL::${ident(t)}, $${tag}$${json}$${tag}$::jsonb);`,
  );
}
// Keep SERIAL counters ahead of the imported ids.
lines.push(
  "SELECT setval(pg_get_serial_sequence('life_navigator.push_config', 'id'), COALESCE((SELECT MAX(id) FROM life_navigator.push_config), 0) + 1, false);",
  "COMMIT;",
);

writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${outPath}: ${order.length} tables, ${order.reduce((n, t) => n + tables[t].length, 0)} rows`);
