
---

# Fintra: Terminal Financiero de Acciones

Fintra es una aplicación web que actúa como un *terminal financiero* para consultar, analizar y visualizar información sobre acciones. Combina datos en tiempo real de proveedores públicos (Financial Modeling Prep y Alpha Vantage) con una base de datos propia en Supabase para enriquecer la experiencia del usuario. Está construida en **Next.js 15** con TypeScript, Tailwind CSS y Radix UI, y se despliega fácilmente en Vercel.

## Tabla de contenidos

* [Características](#características)
* [Arquitectura](#arquitectura)
* [Instalación](#instalación)
* [Variables de entorno](#variables-de-entorno)
* [Uso](#uso)
* [Estructura del proyecto](#estructura-del-proyecto)
* [Contribuir](#contribuir)
* [Licencia](#licencia)

## Características

Fintra ofrece una colección de módulos para analizar acciones individuales desde múltiples ángulos:

* **Búsqueda de símbolos**: escribe el ticker de una compañía (por ejemplo, `AAPL`) para obtener datos básicos, fundamentales, ratios financieros y proyecciones. Las consultas se validan y transforman con Zod antes de ejecutarse.
* **Datos en tiempo real y diferidos**: integra la API de Financial Modeling Prep para métricas clave, ratios, estados financieros, dividendos y compañías comparables. La lógica de backoff y reintento está encapsulada en el helper `fmpGet`, que agrega la clave API y maneja errores/transitorios de red.
* **Cotizaciones de Alpha Vantage**: ofrece cotizaciones diarias, series históricas y resúmenes de compañía a través de un cliente específico que construye URLs e incluye la clave API por defecto.
* **Persistencia en Supabase**: utiliza Supabase como base de datos para almacenar datos básicos, análisis de acciones, proyecciones y un contador de búsquedas. El cliente se inicializa con las claves públicas en `lib/supabase.ts` y expone funciones para leer y escribir datos estructurados.
* **Visualización interactiva**: gráficos y tablas usando Chart.js, React Chartjs 2 y Recharts para mostrar desempeño histórico, proyecciones de EPS/ingresos y comparaciones entre pares.
* **Componentes reutilizables**: construidos con Radix UI y estilizados con Tailwind CSS. Incluye tarjetas, pestañas, modales y menús contextuales listos para usar.
* **Análisis asistido por IA**: algunos módulos consultan modelos de lenguaje para resumir proyecciones y drivers de crecimiento; los resultados se almacenan en Supabase junto con proyecciones financieras.

## Arquitectura

El proyecto sigue una arquitectura modular inspirada en el patrón *clean architecture*. Los elementos clave son:

* **Next.js App Router**: todas las páginas y rutas de API viven en `app/`. Las rutas API bajo `app/api/fmp` delegan la lógica a funciones auxiliares y exportan constantes como `revalidate` para controlar la caché.
* **Lógica de datos en `lib/` y `services/`**: `lib/fmp/server.ts` encapsula peticiones a Financial Modeling Prep con reintentos y tiempos de espera. `lib/supabase.ts` define el cliente y funciones para consultar y actualizar tablas en Supabase. `services/` agrupa integraciones de terceros como Alpha Vantage.
* **Componentes UI en `components/`**: se organizan por tipo (tarjetas, pestañas, menús) y siguen principios de composición. Los íconos provienen de Lucide y los estilos usan Tailwind.
* **Persistencia**: Supabase almacena las tablas `datos_accion`, `analisis_accion`, `stock_proyecciones` y `busquedas_acciones`. Las funciones utilitarias agrupan varias consultas para retornar resultados agregados (datos básicos, análisis y rendimiento) en una única llamada.
* **Gestión de estado**: al ser una aplicación React/Next.js, se utiliza estado local y hooks personalizados para manejar pestañas seleccionadas, tema oscuro/claro y favoritos. El contexto no se comparte globalmente excepto donde es necesario.
* **Despliegue**: pensado para Vercel, con configuración mínima; basta con definir las variables de entorno en el panel de Vercel. La compilación se ejecuta con `pnpm run build` según la configuración de `package.json`.

## Instalación

1. **Requisitos previos**:

   * Node.js >= 18.
   * [pnpm](https://pnpm.io/) (puedes instalarlo con `npm install -g pnpm`).

2. **Clonar el repositorio**:

   ```bash
   git clone https://github.com/S4kred/Fintra.git
   cd Fintra
   ```

3. **Instalar dependencias**:

   ```bash
   pnpm install
   ```

4. **Configurar variables de entorno**: crea un archivo `.env` en la raíz con las siguientes claves. Puedes utilizar `.env.example` como referencia si existe. Estas variables se consumen desde el código para inicializar clientes y construir URLs.

   ```dotenv
   # Claves de Financial Modeling Prep
   FMP_API_KEY=tu_clave_fmp
   FMP_BASE_URL=https://financialmodelingprep.com

   # Claves de Alpha Vantage (lado cliente)
   NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=tu_clave_alpha

   # Claves de Supabase
   NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_supabase
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key  # si ejecutas jobs/funciones servidor

   # Opcional: claves para otras integraciones (OpenAI, n8n, etc.)
   ```

5. **Ejecutar en modo desarrollo**:

   ```bash
   pnpm dev
   ```

   La aplicación estará disponible en `http://localhost:3000`.

6. **Construir para producción**:

   ```bash
   pnpm build
   pnpm start
   ```

## Uso

Al iniciar la aplicación verás un cuadro de búsqueda para ingresar el símbolo de una acción. Algunas recomendaciones:

1. **Buscar una acción**: escribe el ticker (por ejemplo, `MSFT`) y presiona Enter. El sistema valida el formato, consulta la API de FMP y almacena la búsqueda en Supabase.
2. **Navegar entre pestañas**: cada acción tiene múltiples pestañas (Fundamentales, Valoración, Desempeño, Dividendos, Proyecciones, Peers, Noticias) que se cargan de forma independiente. La caché se gestiona mediante los campos `revalidate` en las rutas API.
3. **Agregar a favoritos**: si implementas favoritos, se guardan en localStorage del navegador o en Supabase para persistencia entre sesiones.
4. **Modo oscuro/claro**: la interfaz soporta cambio de tema mediante Radix UI y Tailwind.

## Estructura del proyecto

```
Fintra/
│  package.json        # Dependencias y scripts de construcción
│  tailwind.config.ts  # Configuración de Tailwind CSS
│  next.config.mjs     # Configuración de Next.js y reglas de carga
│  .env.example        # Plantilla de variables de entorno
│
├─app/                 # App Router de Next.js
│  ├─page.tsx          # Página principal y buscador
│  ├─api/              # Rutas API para datos externos
│  │  └─fmp/           # Sub-rutas que llaman a FMP (profile, ratios, key-metrics, etc.)
│  └─...               # Otras páginas o segmentos
│
├─components/          # Componentes reutilizables (tarjetas, pestañas, tablas)
├─lib/                 # Lógica de negocio y utilidades
│  ├─fmp/              # Cliente de FMP con reintento
│  ├─supabase.ts       # Inicialización de Supabase y consultas
│  └─...               # Validaciones Zod, queries de stocks, helpers de formato
├─services/            # Conexiones con terceros (Alpha Vantage, etc.)
├─public/              # Activos estáticos (imágenes, icons)
└─styles/              # Archivos CSS/SCSS globales
```

## Contribuir

¡Las contribuciones son bienvenidas! Puedes abrir *issues* para reportar bugs o proponer mejoras, y enviar *pull requests* con nuevas funcionalidades o correcciones. Para comenzar:

1. Haz un *fork* del repositorio y clónalo localmente.
2. Crea una rama descriptiva para tu cambio: `git checkout -b fix/error-404`.
3. Realiza tus cambios siguiendo las mejores prácticas de TypeScript y Next.js. Asegúrate de mantener el código tipado y de añadir tests o comentarios cuando proceda.
4. Ejecuta `pnpm lint` y `pnpm build` para verificar que no hay errores de compilación.
5. Envía tu *pull request* describiendo claramente la motivación y la solución.

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta el archivo `LICENSE` para más detalles.

---

Fuentes que respaldan la configuración y las variables de entorno: la inicialización de la API de Financial Modeling Prep y la clave API se leen desde `process.env`, Supabase se inicializa con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y la API de Alpha Vantage utiliza la variable `NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY`. El archivo `package.json` define scripts para instalación y build.
