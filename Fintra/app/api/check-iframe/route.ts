import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Validate URL format
    new URL(url);

    // Fetch headers with a short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Fintra-Link-Checker/1.0"
      }
    });

    clearTimeout(timeoutId);

    const xFrameOptions = response.headers.get("x-frame-options")?.toUpperCase();
    const csp = response.headers.get("content-security-policy")?.toLowerCase();

    let allowed = true;
    let reason = null;

    // Check X-Frame-Options
    if (xFrameOptions === "DENY" || xFrameOptions === "SAMEORIGIN") {
      allowed = false;
      reason = `X-Frame-Options: ${xFrameOptions}`;
    }

    // Check CSP frame-ancestors
    if (allowed && csp) {
      if (csp.includes("frame-ancestors 'none'") || csp.includes("frame-ancestors 'self'")) {
        allowed = false;
        reason = "CSP frame-ancestors restricted";
      }
    }

    return NextResponse.json({ 
      allowed, 
      reason,
      status: response.status
    });

  } catch (error) {
    // If we can't even reach the site (network error, timeout), assume it might be problematic or just return true and let the client handle the error.
    // However, for "detection", if we can't reach it, we can't verify.
    // Let's return allowed=true but with a warning, or false if we want to be conservative.
    // Actually, if HEAD fails (e.g. 405 Method Not Allowed), we might try GET.
    // But for now, let's just log and return allowed=true (optimistic) or false (pessimistic).
    // Safe bet: If we can't verify, we default to allowed=true and let the client iframe try.
    // OR we return a specific error code.
    
    console.error("Error checking iframe compatibility:", error);
    return NextResponse.json({ 
      allowed: true, // Fallback to optimistic
      error: "Check failed, defaulting to allowed"
    });
  }
}
