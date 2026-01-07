# FINTRA Engineering Rules & Standards

This document establishes the architectural, security, and integrity standards for the Fintra codebase. These rules are non-negotiable and must be strictly followed by all contributors and AI agents.

---

## 1. Cron Architecture Rules

### 1.1 Fault Tolerance
- **Atomic Resilience**: A failure in processing a single ticker, chunk, or sector must **NEVER** abort the entire cron job.
- **Error Handling**: Exceptions within a loop must be caught, logged, and the loop must continue to the next item.
- **State Preservation**: Partial failures should not corrupt the state of successful operations.

### 1.2 Logic Standards
- **Explicit Stubs**: Do not leave implicit "TODOs" in code paths. If logic is missing, use an explicit stub or a defined "pending" state.
- **No Partial Logic**: Do not deploy crons that perform half-calculations. Data must be either fully computed (with valid inputs) or marked as pending.

### 1.3 Logging
- **Structured Logging**: All crons must emit structured logs for key lifecycle events:
  - `SNAPSHOT START`
  - `SNAPSHOT OK` / `SNAPSHOT FAILED`
  - `PROFILE MISSING`
  - `SECTOR MISSING`
  - `UPSERT FAILED`

---

## 2. Supabase Access Rules

### 2.1 Role Separation
- **Service Role (`service_role`)**:
  - **Usage**: EXCLUSIVELY for backend cron jobs, backfill scripts, and internal admin tasks.
  - **Location**: Allowed ONLY in `@/lib/supabase/admin` and used in `/app/api/cron/**`.
  - **Prohibition**: NEVER expose service role keys to the client-side or public APIs.

- **Anon / Public Key**:
  - **Usage**: Strictly for Frontend components and Public API endpoints.
  - **Location**: `@/lib/supabase` (client instantiation).

### 2.2 Security Context
- **Privilege**: Crons are privileged systems. Mixing public and private keys creates a latent security breach. Strict separation is mandatory.

---

## 3. Financial Data Integrity Rules

### 3.1 Data Fabrication
- **Zero Fabrication Policy**: Fintra does not invent data. We calculate metrics only when sufficient raw data exists.
- **No Inference**: Do not infer sectors, industries, or financial figures. If a data point is missing from the source, it is missing in Fintra.

### 3.2 Pending vs. Error
- **Status `pending`**: A missing data point is **NOT** an exception or an error. It is a valid state.
  - Correct: `fgos_status: 'pending'`, `valuation_status: 'pending'`.
  - Incorrect: Throwing an error or returning `500` for missing financial data.
- **Default Values**: Do not force "pretty" default values (e.g., `0` for missing growth). Use `null` or appropriate status flags.

### 3.3 Confidence & Quality
- **Confidence Scores**: Derived metrics (e.g., Benchmarks, FGOS) must include a confidence score (0-100) or level (low/medium/high).
- **Validation**:
  - `80-100`: High confidence.
  - `60-79`: Medium confidence.
  - `<60`: Low confidence.
- **User Experience**: The frontend must always display the confidence level alongside the score.

---

## 4. Naming Conventions

### 4.1 Folder Structure
- **Cron Jobs**: All folders within `app/api/cron/` must use **kebab-case**.
  - Correct: `sector-benchmarks`, `fmp-bulk`.
  - Incorrect: `sectorBenchmarks`, `FmpBulk`.

### 4.2 Type Safety
- **Strict Typing**: `any` is strictly prohibited in financial logic, scoring, and verdicts.
- **Exceptions**: `any` is permitted **ONLY** during bulk ingestion or CSV parsing boundaries, where data shapes are inherently loose before normalization.

---

## 5. Rules for Contributors & AI Agents

### 5.1 Scope & Autonomy
- **Adherence**: Do not modify core logic (schemas, migrations, central algorithms) without explicit user instruction.
- **Consistency**: Maintain existing modular design, naming conventions, and logging patterns.

### 5.2 Financial Verification
- **Double-Check**: Always verify financial formulas (CAGR, ROE, Piotroski, Altman Z-score) against standard definitions.
- **Anomaly Detection**: Use financial judgment. If a calculated ratio seems unrealistic (e.g., negative P/E where inappropriate, infinite growth), flag it or handle it via quality brakes.

### 5.3 Safety
- **Non-Destructive**: Do not perform destructive database operations (DROP, DELETE) without explicit confirmation and backup strategies.
- **Testing**: Verify changes with safe, non-production data where possible, or use dry-run flags for crons.
