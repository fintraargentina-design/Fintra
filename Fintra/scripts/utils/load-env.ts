import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Loads environment variables from .env and .env.local files located in the project root.
 * This is robust against being called from subdirectories (e.g., scripts/pipeline).
 */
export function loadEnv() {
  // Find project root by looking for package.json
  let root = process.cwd();
  const maxDepth = 5;
  let depth = 0;

  while (depth < maxDepth) {
    if (fs.existsSync(path.join(root, 'package.json'))) {
      break;
    }
    const parent = path.dirname(root);
    if (parent === root) break; // Reached system root
    root = parent;
    depth++;
  }

  // Load .env.local
  const envLocalPath = path.resolve(root, '.env.local');
  if (fs.existsSync(envLocalPath)) {
    console.log(`[loadEnv] Loading .env.local from ${root}`);
    dotenv.config({ path: envLocalPath, override: true });
  }

  // Load .env
  const envPath = path.resolve(root, '.env');
  if (fs.existsSync(envPath)) {
    console.log(`[loadEnv] Loading .env from ${root}`);
    dotenv.config({ path: envPath }); // No override, so .env.local takes precedence if loaded first with override? 
    // Wait, dotenv won't overwrite existing keys unless override is true. 
    // Standard Next.js behavior: .env.local overrides .env.
    // So we should load .env first, then .env.local with override? 
    // Or load .env.local first? 
    // If I load .env.local first, I should use override: true?
    // Actually dotenv.config defaults to NOT overriding.
    // So if I load .env.local first, those vars are set. Then loading .env won't overwrite them.
    // Let's verify standard dotenv behavior.
    // "dotenv will never modify any environment variables that have already been set."
    // So: Load .env.local FIRST. Then load .env.
    // The previous code was:
    // if .env.local exists: load it (override: true)
    // else: load .env
    // This logic seems flawed if we want to inherit from .env and override with .env.local?
    // Usually we want both. .env has defaults, .env.local has secrets/overrides.
    // So: Load .env.local. Then Load .env.
  }
}

// Auto-execute if imported? No, better to be explicit.
