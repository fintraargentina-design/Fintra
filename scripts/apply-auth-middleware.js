/**
 * Script para aplicar withCronAuth a todos los cron jobs
 * Uso: node scripts/apply-auth-middleware.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Encontrar todos los route.ts en app/api/cron
const cronRoutes = execSync('find app/api/cron -name "route.ts" -type f', { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`🔒 Encontrados ${cronRoutes.length} cron jobs\n`);

let updated = 0;
let skipped = 0;
let errors = 0;

cronRoutes.forEach((routePath) => {
  try {
    const content = fs.readFileSync(routePath, 'utf-8');

    // Skip si ya tiene withCronAuth
    if (content.includes('withCronAuth')) {
      console.log(`⏭️  SKIP: ${routePath} (ya tiene withCronAuth)`);
      skipped++;
      return;
    }

    // Skip si tiene validación manual de CRON_SECRET
    if (content.includes('CRON_SECRET') && content.includes('Authorization')) {
      console.log(`⚠️  SKIP: ${routePath} (tiene validación manual)`);
      skipped++;
      return;
    }

    console.log(`🔧 Procesando: ${routePath}`);

    // Backup
    fs.writeFileSync(`${routePath}.backup`, content);

    let newContent = content;

    // 1. Agregar import de withCronAuth
    if (!content.includes('withCronAuth')) {
      // Encontrar la primera línea de import
      const lines = newContent.split('\n');
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          insertIndex = i + 1;
        } else if (insertIndex > 0 && !lines[i].startsWith('import ')) {
          break;
        }
      }

      lines.splice(insertIndex, 0, "import { withCronAuth } from '@/lib/middleware/cronAuth';");
      newContent = lines.join('\n');
    }

    // 2. Asegurar que importa NextRequest
    if (!newContent.includes('NextRequest')) {
      newContent = newContent.replace(
        /import { NextResponse }/,
        'import { NextRequest, NextResponse }'
      );
    }

    // 3. Transformar el handler
    // Patrón: export async function GET(request: Request)
    // A: export const GET = withCronAuth(async (request: NextRequest) => { ... });

    // Buscar función GET
    const getFunctionMatch = newContent.match(/export async function GET\s*\(([^)]+)\)\s*{/);

    if (getFunctionMatch) {
      const paramName = getFunctionMatch[1].split(':')[0].trim();

      // Encontrar el cierre de la función
      const lines = newContent.split('\n');
      let startLine = -1;
      let endLine = -1;
      let braceCount = 0;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('export async function GET')) {
          startLine = i;
          braceCount = 1;
          continue;
        }

        if (startLine >= 0) {
          braceCount += (lines[i].match(/{/g) || []).length;
          braceCount -= (lines[i].match(/}/g) || []).length;

          if (braceCount === 0) {
            endLine = i;
            break;
          }
        }
      }

      if (startLine >= 0 && endLine >= 0) {
        // Extraer el cuerpo de la función
        const functionBody = lines.slice(startLine + 1, endLine).join('\n');

        // Reemplazar con versión wrapped
        const newFunction = `export const GET = withCronAuth(async (${paramName}: NextRequest) => {
${functionBody}
});`;

        lines.splice(startLine, endLine - startLine + 1, newFunction);
        newContent = lines.join('\n');

        // Escribir el archivo actualizado
        fs.writeFileSync(routePath, newContent);

        console.log(`✅ Actualizado: ${routePath}`);
        updated++;
      } else {
        console.log(`⚠️  WARN: ${routePath} - No se pudo encontrar el cierre de la función`);
        errors++;
      }
    } else {
      console.log(`⚠️  WARN: ${routePath} - No tiene función GET estándar`);
      errors++;
    }

  } catch (err) {
    console.error(`❌ ERROR: ${routePath} - ${err.message}`);
    errors++;
  }
});

console.log(`\n📊 Resumen:`);
console.log(`   Total: ${cronRoutes.length}`);
console.log(`   Actualizados: ${updated}`);
console.log(`   Omitidos: ${skipped}`);
console.log(`   Errores: ${errors}`);

if (updated > 0) {
  console.log(`\n⚠️  IMPORTANTE: Revisa los cambios antes de commitear`);
  console.log(`   Los backups están en *.backup`);
  console.log(`\n📝 Para revisar cambios:`);
  console.log(`   git diff app/api/cron`);
}
