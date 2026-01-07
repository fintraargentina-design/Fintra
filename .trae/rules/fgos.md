FGOS no se infiere

REGLA

FGOS solo se calcula si:

hay sector

hay ratios y metrics mínimos

Si no:

fgos_status = 'pending'
fgos_score = null


PROHIBIDO

Inferir sector

Comparar contra benchmarks incorrectos

“Promediar” sin base sectorial

Confidence es parte del resultado, no decoración

REGLA

Todo FGOS calculado debe incluir:

confidence: number (0–100)


INTERPRETACIÓN

80–100 → Alta confianza

60–79 → Media

<60 → Baja

Punto Clave UX 
El frontend debe mostrar confidence siempre que haya score.