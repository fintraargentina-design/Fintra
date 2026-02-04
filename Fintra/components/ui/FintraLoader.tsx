"use client";

import { cn } from "@/lib/utils";

interface FintraLoaderProps {
  className?: string;
  size?: number; // Base size in pixels
}

export function FintraLoader({ className, size = 24 }: FintraLoaderProps) {
  // We calculate thickness relative to size, but keep it at least 2px
  const thickness = Math.max(2, Math.round(size * 0.15));
  
  return (
    <div 
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      {/* Top Bar - Cyan */}
      <div 
        className="absolute top-0 left-0 bg-[#00C8FF] animate-[pulse_1.5s_ease-in-out_infinite]"
        style={{ 
          height: thickness, 
          width: '100%',
          opacity: 0.9 
        }} 
      />
      
      {/* Left Bar - Cyan */}
      <div 
        className="absolute top-0 left-0 bg-[#00C8FF] animate-[pulse_1.5s_ease-in-out_infinite]"
        style={{ 
          width: thickness, 
          height: '100%',
          opacity: 0.9,
          animationDelay: '0.1s' // Slight offset for effect
        }} 
      />
      
      {/* Optional: Subtle F-body ghost for better context (optional, maybe just the corner is enough as requested) */}
      {/* User asked specifically for "right angle like the logo", so just the corner is best. */}
    </div>
  );
}
