/**
 * Audit script to find usage of deprecated columns
 *
 * Run: pnpm tsx scripts/audit-deprecated-columns.ts
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface DeprecatedColumn {
  name: string;
  replacement: string;
  patterns: string[];
}

const DEPRECATED_COLUMNS: DeprecatedColumn[] = [
  {
    name: "sector_rank",
    replacement: "performance_windows['1M']?.sector_rank",
    patterns: [
      "sector_rank[^_]", // Match sector_rank but not sector_rank_total
      "\\.sector_rank",
      "sector_rank:",
      "sector_rank,",
    ],
  },
  {
    name: "sector_rank_total",
    replacement: "performance_windows['1M']?.sector_total",
    patterns: ["sector_rank_total"],
  },
  {
    name: "relative_vs_sector_*",
    replacement: "performance_windows['WINDOW']?.vs_sector",
    patterns: ["relative_vs_sector_"],
  },
  {
    name: "relative_vs_market_*",
    replacement: "performance_windows['WINDOW']?.vs_market",
    patterns: ["relative_vs_market_"],
  },
];

interface Finding {
  file: string;
  line: number;
  content: string;
  column: string;
}

async function auditDeprecatedColumns() {
  console.log("🔍 Auditing deprecated columns usage...\n");

  const findings: Finding[] = [];

  // Directories to search
  const searchDirs = ["app", "lib", "components"];

  for (const column of DEPRECATED_COLUMNS) {
    console.log(`Searching for: ${column.name}`);

    for (const pattern of column.patterns) {
      for (const dir of searchDirs) {
        try {
          // Use PowerShell Select-String for Windows
          const cmd = `powershell -Command "Get-ChildItem -Path ${dir} -Recurse -Include *.ts,*.tsx,*.js,*.jsx | Select-String -Pattern '${pattern}' | ForEach-Object { \\\"$($_.Path):$($_.LineNumber):$($_.Line)\\\" }"`;
          const output = execSync(cmd, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "ignore"],
          });

          if (output.trim()) {
            const lines = output.split("\n").filter((l) => l.trim());

            for (const line of lines) {
              const match = line.match(/^(.+?):(\d+):(.+)$/);
              if (match) {
                const [, file, lineNum, content] = match;

                findings.push({
                  file: file.trim(),
                  line: parseInt(lineNum),
                  content: content.trim(),
                  column: column.name,
                });
              }
            }
          }
        } catch (error) {
          // Command may fail if no matches, that's OK
        }
      }
    }
  }

  // Generate report
  console.log("\n📊 AUDIT REPORT\n");
  console.log("=".repeat(80));

  if (findings.length === 0) {
    console.log("✅ No usage of deprecated columns found!");
    console.log("Safe to proceed with removal.");
  } else {
    console.log(
      `⚠️  Found ${findings.length} usage(s) of deprecated columns:\n`,
    );

    // Group by column
    const grouped = findings.reduce(
      (acc, f) => {
        if (!acc[f.column]) acc[f.column] = [];
        acc[f.column].push(f);
        return acc;
      },
      {} as Record<string, Finding[]>,
    );

    for (const [column, items] of Object.entries(grouped)) {
      const columnInfo = DEPRECATED_COLUMNS.find((c) => c.name === column);

      console.log(`\n${column} (${items.length} usage(s))`);
      console.log(`Replacement: ${columnInfo?.replacement}`);
      console.log("-".repeat(80));

      for (const item of items) {
        console.log(`  ${item.file}:${item.line}`);
        console.log(`    ${item.content}`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n📝 NEXT STEPS:\n");
    console.log("1. Review each usage above");
    console.log("2. Update to use performance_windows JSONB");
    console.log("3. Re-run this audit to verify");
    console.log("4. Once audit shows 0 usage, safe to remove columns\n");
  }

  // Write report to file
  const reportPath = path.join(process.cwd(), "deprecated-columns-audit.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ findings, timestamp: new Date().toISOString() }, null, 2),
  );

  console.log(`Full report saved to: ${reportPath}\n`);

  return findings.length;
}

// Run audit
auditDeprecatedColumns()
  .then((count) => {
    process.exit(count > 0 ? 1 : 0); // Exit with error if usage found
  })
  .catch((error) => {
    console.error("Audit failed:", error);
    process.exit(1);
  });
