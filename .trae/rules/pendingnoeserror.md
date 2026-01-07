REGLA

Un dato faltante NO es un error.

Un dato faltante debe expresarse como:

status: 'pending'


EJEMPLOS

fgos_status: 'pending'

valuation.status: 'pending'

profile_structural: { status: 'pending', reason: 'Profile not available in bulk' }

PROHIBIDO

Tirar excepción

Abortar snapshot

Forzar valores por defecto “bonitos”