"use client";

import { useEffect, useState } from "react";
import { getValuationHistory } from "@/lib/stockQueries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ValuationMatrixProps {
  ticker: string;
}

type MetricKey =
  | "pe_ratio"
  | "ev_ebitda"
  | "price_to_fcf"
  | "price_to_sales"
  | "price_to_book"
  | "dividend_yield"
  | "price"
  | "market_cap";

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: "pe_ratio", label: "P/E Ratio", format: (v) => v.toFixed(2) },
  { key: "ev_ebitda", label: "EV/EBITDA", format: (v) => v.toFixed(2) },
  { key: "price_to_fcf", label: "P/FCF", format: (v) => v.toFixed(2) },
  { key: "price_to_sales", label: "P/Sales", format: (v) => v.toFixed(2) },
  { key: "price_to_book", label: "P/Book", format: (v) => v.toFixed(2) },
  { key: "dividend_yield", label: "Div Yield", format: (v) => `${(v * 100).toFixed(2)}%` },
  { key: "price", label: "Price", format: (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  { key: "market_cap", label: "Market Cap", format: (v) => `$${(v / 1e9).toFixed(2)}B` },
];

interface MatrixRow {
  year: number;
  fy: number | null;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
}

export default function ValuationMatrix({ ticker }: ValuationMatrixProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("pe_ratio");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getValuationHistory(ticker);
      setHistory(data);
      setLoading(false);
    }
    if (ticker) {
      loadData();
    }
  }, [ticker]);

  useEffect(() => {
    if (!history.length) return;

    // Process data into matrix
    const rowsMap = new Map<number, MatrixRow>();

    // Sort by date desc to get latest first
    // (Already sorted by query, but good to be safe if we were merging)
    
    // We only care about unique periods. Since history is sorted date desc,
    // the first occurrence of a period (e.g. 2023Q1) is the latest snapshot for that period.
    const seenPeriods = new Set<string>();

    history.forEach((item) => {
      const period = item.denominator_period; // e.g. "2023", "2023_FY", "2023Q1"
      if (!period || seenPeriods.has(period)) return;
      seenPeriods.add(period);

      let year = 0;
      let col = "";

      // Parse period
      // Formats: "2023", "2023_FY", "2023Q1"
      if (period.includes("Q")) {
        const parts = period.split("Q");
        if (parts.length === 2) {
          year = parseInt(parts[0]);
          col = `q${parts[1]}`; // q1, q2, q3, q4
        }
      } else {
        // Annual
        const yStr = period.replace("_FY", "");
        year = parseInt(yStr);
        col = "fy";
      }

      if (year && !isNaN(year)) {
        if (!rowsMap.has(year)) {
          rowsMap.set(year, { year, fy: null, q1: null, q2: null, q3: null, q4: null });
        }
        const row = rowsMap.get(year)!;
        
        const val = item[selectedMetric];
        if (val !== null && val !== undefined) {
          // @ts-ignore
          row[col] = Number(val);
        }
      }
    });

    // Convert map to array and sort by year desc
    const sortedRows = Array.from(rowsMap.values()).sort((a, b) => b.year - a.year);
    setMatrix(sortedRows);

  }, [history, selectedMetric]);

  const currentMetric = METRICS.find((m) => m.key === selectedMetric)!;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="text-center text-zinc-500 py-8">
        No valuation history available for {ticker}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">Matriz de Valuación</h3>
        <Select
          value={selectedMetric}
          onValueChange={(v) => setSelectedMetric(v as MetricKey)}
        >
          <SelectTrigger className="w-[180px] bg-zinc-900/50 border-zinc-800">
            <SelectValue placeholder="Select Metric" />
          </SelectTrigger>
          <SelectContent>
            {METRICS.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400 font-medium">Año</TableHead>
              <TableHead className="text-zinc-400 font-medium text-right">FY (Anual)</TableHead>
              <TableHead className="text-zinc-400 font-medium text-right">Q1</TableHead>
              <TableHead className="text-zinc-400 font-medium text-right">Q2</TableHead>
              <TableHead className="text-zinc-400 font-medium text-right">Q3</TableHead>
              <TableHead className="text-zinc-400 font-medium text-right">Q4</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map((row) => (
              <TableRow key={row.year} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell className="font-medium text-zinc-300">{row.year}</TableCell>
                <TableCell className="text-right text-zinc-300 font-mono">
                  {row.fy !== null ? currentMetric.format(row.fy) : "—"}
                </TableCell>
                <TableCell className="text-right text-zinc-400 font-mono text-sm">
                  {row.q1 !== null ? currentMetric.format(row.q1) : "—"}
                </TableCell>
                <TableCell className="text-right text-zinc-400 font-mono text-sm">
                  {row.q2 !== null ? currentMetric.format(row.q2) : "—"}
                </TableCell>
                <TableCell className="text-right text-zinc-400 font-mono text-sm">
                  {row.q3 !== null ? currentMetric.format(row.q3) : "—"}
                </TableCell>
                <TableCell className="text-right text-zinc-400 font-mono text-sm">
                  {row.q4 !== null ? currentMetric.format(row.q4) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
