/**
 * Cron Job Authorization Middleware
 *
 * Provides consistent authorization checking for all cron job endpoints.
 * Validates CRON_SECRET to prevent unauthorized execution.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface CronAuthResult {
  authorized: boolean;
  error?: NextResponse;
}

/**
 * Validates the Authorization header against CRON_SECRET
 *
 * @param request - Next.js request object
 * @returns Object with authorized flag and optional error response
 *
 * @example
 * export async function GET(request: Request) {
 *   const auth = validateCronAuth(request);
 *   if (!auth.authorized) return auth.error!;
 *
 *   // Proceed with cron job logic
 * }
 */
export function validateCronAuth(request: NextRequest | Request): CronAuthResult {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  // Check if CRON_SECRET is configured
  if (!expectedSecret) {
    console.error('❌ CRON_SECRET not configured in environment');
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    };
  }

  // Check if Authorization header is present
  if (!authHeader) {
    console.warn('⚠️  Unauthorized cron job attempt: Missing Authorization header');
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: Missing Authorization header' },
        { status: 401 }
      )
    };
  }

  // Validate the secret
  const expectedHeader = `Bearer ${expectedSecret}`;
  if (authHeader !== expectedHeader) {
    console.warn('⚠️  Unauthorized cron job attempt: Invalid credentials');
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: Invalid credentials' },
        { status: 401 }
      )
    };
  }

  return { authorized: true };
}

/**
 * Higher-order function that wraps a cron handler with auth check
 *
 * @param handler - The actual cron job handler function
 * @returns Wrapped handler that checks auth before executing
 *
 * @example
 * export const GET = withCronAuth(async (request) => {
 *   // Your cron logic here
 *   return NextResponse.json({ success: true });
 * });
 */
export function withCronAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async function (request: NextRequest): Promise<NextResponse> {
    // Validate authorization
    const auth = validateCronAuth(request);
    if (!auth.authorized) {
      return auth.error!;
    }

    // Execute the handler
    try {
      return await handler(request);
    } catch (error: any) {
      console.error('❌ Cron handler error:', error);
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  };
}

/**
 * Validates if request is coming from Vercel Cron
 * (Additional layer of security for production)
 */
export function isVercelCron(request: NextRequest | Request): boolean {
  const cronHeader = request.headers.get('x-vercel-cron');
  return cronHeader === '1' || cronHeader === 'true';
}

/**
 * Combined auth check: CRON_SECRET + Vercel Cron header (production only)
 *
 * @param request - Next.js request object
 * @param requireVercelCron - If true, also checks for Vercel Cron header in production
 */
export function validateCronAuthStrict(
  request: NextRequest | Request,
  requireVercelCron: boolean = true
): CronAuthResult {
  // First, validate CRON_SECRET
  const basicAuth = validateCronAuth(request);
  if (!basicAuth.authorized) {
    return basicAuth;
  }

  // In production, optionally require Vercel Cron header
  if (requireVercelCron && process.env.NODE_ENV === 'production') {
    if (!isVercelCron(request)) {
      console.warn('⚠️  Cron job called without Vercel Cron header in production');
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Forbidden: Must be called from Vercel Cron' },
          { status: 403 }
        )
      };
    }
  }

  return { authorized: true };
}
