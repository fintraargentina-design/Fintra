# Parallelization Patterns in Fintra

**Last Updated**: February 6, 2026

## Core Philosophy

> **"Parallelize I/O, Keep CPU Sequential"**

This pattern ensures maximum throughput while maintaining:

- ✅ Predictable state management
- ✅ Constant memory footprint
- ✅ Readable, sequential logs
- ✅ Easy debugging

---

## When to Parallelize

### ✅ DO Parallelize (I/O-bound operations)

1. **Database Writes**
   - Multiple upserts to the same table
   - Bulk inserts split into chunks
   - Independent write operations

2. **API Calls**
   - Multiple endpoints with no dependencies
   - Batch data fetching
   - Independent HTTP requests

3. **File I/O**
   - Reading/writing multiple files
   - Processing independent CSV files
   - Cache file operations

### ❌ DON'T Parallelize (CPU-bound or stateful operations)

1. **Calculations**
   - Financial metrics derivation
   - Score calculations
   - Statistical computations

2. **Stateful Processing**
   - Cache updates (Set/Map modifications)
   - Shared state management
   - Sequential logging

3. **Operations Requiring Order**
   - Migration scripts
   - Data transformations with dependencies
   - Ordered batch processing

---

## Pattern Implementation

### Template: Sequential CPU + Parallel I/O

```typescript
for (const batch of batches) {
  // STEP 1: Load Data (Sequential I/O - single query)
  const data = await loadBatchData(batch);

  // STEP 2: Process in CPU (Sequential - predictable state)
  const results = [];
  for (const item of batch) {
    const processed = processItem(item, data); // CPU work
    results.push(processed);
  }

  // STEP 3: Write Results (PARALLEL I/O - multiple writes)
  const chunks = chunkArray(results, CHUNK_SIZE);
  await Promise.all(
    chunks.map(async (chunk, idx) => {
      await writeToDatabase(chunk);
      console.log(`✓ Chunk ${idx + 1}/${chunks.length} completed`);
    }),
  );
}
```

### Real-World Example: financials-bulk

**Context**: Processing 53,367 tickers with financial statements

```typescript
// BATCH LEVEL (Sequential - 2000 tickers at a time)
for (let offset = 0; offset < allTickers.length; offset += BATCH_SIZE) {
  const batch = allTickers.slice(offset, offset + BATCH_SIZE);

  // 1. Load parsed CSVs for this batch (Sequential)
  const { incomeMap, balanceMap, cashflowMap } = await parseCachedCSVs(batch);

  // 2. Process each ticker (Sequential - CPU work)
  const rows = [];
  for (const ticker of batch) {
    const metrics = deriveFinancialMetrics(
      incomeMap.get(ticker),
      balanceMap.get(ticker),
      cashflowMap.get(ticker),
    );
    rows.push(...metrics); // ~20,000 rows total
  }

  // 3. Upsert in parallel chunks (PARALLEL I/O)
  const chunks = chunkArray(rows, 5000); // 4 chunks of 5000 rows
  await Promise.all(
    chunks.map((chunk, idx) =>
      upsertToDatabase(chunk).then(() => {
        console.log(
          `✓ Chunk ${idx + 1}/${chunks.length}: ${chunk.length} rows`,
        );
      }),
    ),
  );
}
```

**Performance**:

- Before (Sequential): 45 min first run, 10 min daily
- After (Parallel I/O): 15-20 min first run, 3-5 min daily
- **4x throughput** on I/O operations

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│  BATCH 1: 2000 tickers (Sequential Processing)  │
│  ┌──────────────────────────────────────────┐   │
│  │ 1. Load Data     (I/O Sequential)        │   │
│  │    ↓ Single DB query                     │   │
│  │ 2. Process Data  (CPU Sequential)        │   │
│  │    ↓ for-loop, calculations              │   │
│  │ 3. Generate      (Memory Sequential)     │   │
│  │    → 20,000 rows in array                │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌────────────── PARALLEL I/O ──────────────┐   │
│  │  Chunk 1     Chunk 2     Chunk 3  Chunk 4│   │
│  │  5000 rows   5000 rows   5000     5000   │   │
│  │     ↓           ↓          ↓        ↓    │   │
│  │  ┌─────────────────────────────────────┐ │   │
│  │  │    Supabase (PostgreSQL)            │ │   │
│  │  │  4 simultaneous write connections   │ │   │
│  │  └─────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────┘   │
│                   ↓                              │
│            Wait for all chunks                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  BATCH 2: Next 2000 tickers (Sequential)        │
└─────────────────────────────────────────────────┘
```

---

## Benefits of This Pattern

### Memory Management

- **Constant footprint**: One batch in memory at a time
- **No memory spikes**: CPU processing doesn't duplicate data
- **Predictable**: 400MB peak for 2000 tickers

### Performance

- **CPU utilization**: 100% during processing phase
- **I/O throughput**: 4x with 4 parallel connections
- **Network saturation**: Maximizes bandwidth during writes

### Debugging

- **Sequential logs**: Easy to follow execution order
- **Parallel progress**: Each chunk reports completion
- **Error isolation**: Failed chunk doesn't affect others

### Maintainability

- **Simple logic**: Straightforward control flow
- **No race conditions**: Shared state updated sequentially
- **Easy testing**: Deterministic behavior

---

## Anti-Patterns to Avoid

### ❌ Parallel CPU Processing

```typescript
// WRONG - Causes state conflicts
await Promise.all(
  batches.map(async (batch) => {
    const results = await processBatch(batch);
    cache.set(batch.id, results); // Race condition!
    return results;
  }),
);
```

**Problems**:

- Doubles/triples memory usage
- Race conditions on shared state (cache, logs)
- Non-deterministic execution order
- Difficult to debug

### ❌ Sequential I/O

```typescript
// WRONG - Wastes time waiting for each write
for (const chunk of chunks) {
  await writeToDatabase(chunk); // Waits unnecessarily
}
```

**Problems**:

- 4x slower than parallel
- Network/CPU idle during waits
- Doesn't utilize available connections

### ❌ Mixing Concerns

```typescript
// WRONG - Calculation and I/O mixed
await Promise.all(
  items.map(async (item) => {
    const result = calculateMetrics(item); // CPU
    await saveToDB(result); // I/O
    return result;
  }),
);
```

**Problems**:

- Can't control memory usage
- Hard to optimize separately
- Logs become unreadable

---

## Chunk Size Guidelines

### Database Writes (Supabase/PostgreSQL)

| Operation   | Optimal Chunk Size | Reason                                       |
| ----------- | ------------------ | -------------------------------------------- |
| **Upserts** | 5,000 rows         | ~3 MB payload, well under 6-10 MB limit      |
| **Inserts** | 5,000-10,000 rows  | Faster than upserts, can handle larger       |
| **Deletes** | 1,000-2,000 rows   | WHERE IN clause limit considerations         |
| **Updates** | 3,000-5,000 rows   | Balance between payload size and connections |

### Parallel Connection Count

| Database            | Recommended Parallelism | Max Safe |
| ------------------- | ----------------------- | -------- |
| Supabase (Postgres) | 4-6 connections         | 10       |
| Local Postgres      | 8-10 connections        | 20       |
| MySQL               | 4-8 connections         | 15       |

**Rule of Thumb**: Don't exceed 50% of your database's max_connections setting.

---

## Testing Parallel Operations

### Unit Test Pattern

```typescript
describe("Parallel Upserts", () => {
  it("should complete all chunks successfully", async () => {
    const chunks = createTestChunks(20000, 5000); // 4 chunks

    // Track which chunks complete
    const completed = new Set<number>();

    await Promise.all(
      chunks.map((chunk, idx) =>
        upsertChunk(chunk).then(() => completed.add(idx)),
      ),
    );

    // All chunks should complete
    expect(completed.size).toBe(4);
    expect(Array.from(completed).sort()).toEqual([0, 1, 2, 3]);
  });

  it("should handle partial failure gracefully", async () => {
    const chunks = [validChunk, validChunk, invalidChunk, validChunk];

    await expect(
      Promise.all(chunks.map((chunk) => upsertChunk(chunk))),
    ).rejects.toThrow();

    // Should still have inserted 2 successful chunks before failure
    const count = await countRows();
    expect(count).toBeGreaterThanOrEqual(10000);
  });
});
```

---

## Migration Guide

Migrating from sequential to parallel I/O:

### Step 1: Identify I/O Operations

```typescript
// Look for patterns like this (sequential I/O):
for (const chunk of chunks) {
  await writeOperation(chunk); // 🎯 Candidate for parallelization
}
```

### Step 2: Extract into Array

```typescript
// Before
for (const chunk of chunks) {
  await writeOperation(chunk);
}

// After
await Promise.all(chunks.map((chunk) => writeOperation(chunk)));
```

### Step 3: Add Progress Tracking

```typescript
await Promise.all(
  chunks.map((chunk, idx) =>
    writeOperation(chunk).then(() => {
      console.log(`✓ Chunk ${idx + 1}/${chunks.length} completed`);
    }),
  ),
);
```

### Step 4: Add Error Handling

```typescript
try {
  await Promise.all(
    chunks.map((chunk, idx) =>
      writeOperation(chunk).then(() => {
        console.log(`✓ Chunk ${idx + 1}/${chunks.length} completed`);
      }),
    ),
  );
} catch (error) {
  console.error("Parallel operation failed:", error);
  // Optionally: retry failed chunks individually
  throw error;
}
```

---

## Monitoring and Observability

### Key Metrics to Track

1. **Throughput**: Rows/sec before and after parallelization
2. **Memory Usage**: Peak memory during batch processing
3. **Database Connections**: Active connections during parallel writes
4. **Error Rate**: Failed chunks vs successful chunks
5. **Duration**: Total execution time per batch

### Example Monitoring Code

```typescript
const startTime = Date.now();
const metrics = {
  totalRows: 0,
  chunksCompleted: 0,
  chunksFailed: 0,
};

await Promise.all(
  chunks.map(async (chunk, idx) => {
    try {
      await writeToDatabase(chunk);
      metrics.chunksCompleted++;
      metrics.totalRows += chunk.length;
      console.log(`✓ Chunk ${idx + 1}/${chunks.length}: ${chunk.length} rows`);
    } catch (error) {
      metrics.chunksFailed++;
      console.error(`✗ Chunk ${idx + 1} failed:`, error);
      throw error;
    }
  }),
);

const duration = Date.now() - startTime;
const throughput = metrics.totalRows / (duration / 1000);

console.log(
  `📊 Batch completed: ${metrics.totalRows} rows in ${duration}ms (${throughput.toFixed(0)} rows/sec)`,
);
```

---

## Conclusion

The "Parallelize I/O, Keep CPU Sequential" pattern provides:

- ✅ **Optimal performance**: 3-4x faster I/O throughput
- ✅ **Predictable memory**: Constant footprint
- ✅ **Easy debugging**: Sequential logs, parallel progress tracking
- ✅ **Production-ready**: Proven in financials-bulk cron (53K+ tickers)

Apply this pattern whenever you have:

- Large batch operations
- Independent I/O tasks
- Need for throughput without sacrificing reliability

**Key Takeaway**: Don't parallelize everything—parallelize only the bottleneck (I/O), keep everything else sequential and simple.
