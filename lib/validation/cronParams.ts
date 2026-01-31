/**
 * Validation Schemas for Cron Job Parameters
 *
 * Uses Zod for runtime type checking and validation of API parameters.
 * Prevents injection attacks and ensures data integrity.
 */

import { z } from 'zod';

/**
 * Schema for ticker symbol validation
 * - Must be 1-10 uppercase letters
 * - No special characters or numbers
 */
export const TickerSchema = z
  .string()
  .min(1)
  .max(10)
  .regex(/^[A-Z]+$/, 'Ticker must contain only uppercase letters')
  .optional();

/**
 * Schema for limit parameter validation
 * - Must be positive integer
 * - Max 10,000 to prevent resource exhaustion
 */
export const LimitSchema = z
  .number()
  .int()
  .positive()
  .max(10000, 'Limit cannot exceed 10,000')
  .optional();

/**
 * Schema for date parameter validation (YYYY-MM-DD format)
 */
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(
    (date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    },
    { message: 'Invalid date' }
  )
  .optional();

/**
 * Schema for FMP Bulk endpoint parameters
 */
export const FmpBulkParamsSchema = z.object({
  ticker: TickerSchema,
  limit: LimitSchema
});

/**
 * Schema for Financials Bulk endpoint parameters
 */
export const FinancialsBulkParamsSchema = z.object({
  ticker: TickerSchema,
  limit: LimitSchema,
  date: DateSchema
});

/**
 * Helper function to validate and parse query parameters
 *
 * @example
 * const params = validateParams(FmpBulkParamsSchema, {
 *   ticker: searchParams.get('ticker'),
 *   limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
 * });
 *
 * if (!params.success) {
 *   return NextResponse.json({ error: params.error }, { status: 400 });
 * }
 *
 * const { ticker, limit } = params.data;
 */
export function validateParams<T extends z.ZodType>(
  schema: T,
  params: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const parsed = schema.parse(params);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return { success: false, error: messages.join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Helper to safely parse integer from string
 */
export function safeParseInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * CSV Injection Prevention
 * Sanitizes strings that will be written to CSV files
 */
export function sanitizeCsvValue(value: string): string {
  if (!value) return value;

  // Remove leading characters that could trigger formula execution
  const dangerous = /^[=+\-@]/;
  if (dangerous.test(value)) {
    return "'" + value; // Prefix with single quote to neutralize
  }

  return value;
}
