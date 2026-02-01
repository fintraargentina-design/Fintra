#!/usr/bin/env node
/**
 * Quick Audit - Auditoría rápida de Supabase
 * No requiere tsx, solo Node.js
 */

const https = require('https');

const SUPABASE_URL = 'https://lvqfmrsvtyoemxfbnwzv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no encontrada');
  console.log('   Uso: SUPABASE_SERVICE_ROLE_KEY=tu_key node scripts/quick-audit.js');
  process.exit(1);
}

function query(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'lvqfmrsvtyoemxfbnwzv.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🔍 AUDITORÍA RÁPIDA SUPABASE - FINTRA                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  NOTA: Este script requiere una función RPC en Supabase.');
  console.log('    Ejecuta mejor el archivo SQL directamente en SQL Editor.\n');
  console.log('📄 Archivo: scripts/audit-supabase-sql.sql\n');
  console.log('🔗 URL: https://lvqfmrsvtyoemxfbnwzv.supabase.co/project/_/sql\n');
}

main();
