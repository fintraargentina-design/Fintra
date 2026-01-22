# Estrategia de Cliente Nativo (C# / Windows)

Esta regla define la arquitectura aprobada para la futura expansión de Fintra hacia un cliente de escritorio de alto rendimiento.

## 1. Concepto: Arquitectura "Dual Head"

Fintra está diseñado bajo el principio de **Lógica Desacoplada**.
Esto permite tener múltiples "cabezas" (frontends) consumiendo el mismo "cerebro" (backend/datos).

- **Web (Next.js)**: Acceso universal, cero instalación.
- **Desktop (C#/.NET)**: Power users, grids de alto rendimiento, multi-monitor.

## 2. El Habilitador: Modelo de Snapshots

La arquitectura actual de Cron Jobs Nocturnos es la clave que hace esto viable sin duplicar lógica.

**Flujo de Datos:**
1.  **FMP API** (Ingestión)
2.  **Motor de Cálculo** (TypeScript/Node en Cron)
    *   Calcula FGOS
    *   Calcula IFS
    *   Calcula Valoración
3.  **Persistencia**: Tabla `fintra_snapshots` (Supabase)

**Consumo:**
*   El cliente Web lee `fintra_snapshots`.
*   El cliente Windows leerá `fintra_snapshots`.

**REGLA DE ORO**: El cliente de escritorio **NO** debe recalcular métricas. Debe consumir los datos ya procesados ("The Single Source of Truth").

## 3. Stack Tecnológico Aprobado

Para el cliente Windows:

*   **Lenguaje**: C# (Tipado fuerte, ideal para financiero).
*   **UI Framework**: WPF o WinUI 3 (Soporte nativo de Grids masivas).
*   **Datos**: Supabase C# Client (Conexión directa a Postgres vía PostgREST).
*   **Auth**: Supabase Auth (Mismo usuario/pass que en la web).

## 4. Ventajas

1.  **Cero Duplicidad**: No hay que reescribir la lógica de negocio (FGOS/IFS) en C#.
2.  **Consistencia**: Web y Desktop siempre muestran el mismo número porque leen el mismo registro de base de datos.
3.  **Performance**: C# permite manejar grids de 10,000+ tickers con updates en tiempo real y uso intensivo de memoria local, superando los límites del navegador.
