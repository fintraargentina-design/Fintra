REGLA

@/lib/supabase (ANON / PUBLIC)
👉 Solo frontend y APIs públicas

@/lib/supabase/admin (SERVICE ROLE)
👉 Exclusivamente cron, backfill, jobs internos

PROHIBIDO

Usar NEXT_PUBLIC_SUPABASE_ANON_KEY en:

/app/api/cron/**

/app/api/cron/backfill/**

RAZÓN

Un cron es un sistema con privilegios.

Mezclar llaves públicas con escritura masiva = brecha de seguridad latente.