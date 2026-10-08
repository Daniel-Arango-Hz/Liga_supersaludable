# CBI Personitas Biblioteca

## Aportes con PSE

La página `/apoyar` recibe aportes voluntarios en COP mediante el Checkout Web alojado de Wompi. El visitante elige PSE y su banco dentro de Wompi; la aplicación no recibe datos bancarios.

1. Ejecuta el esquema de `back/database/schema.sql` en Supabase para crear la tabla `donaciones`.
2. Copia `back/.env.example` a `back/.env` y configura Supabase y las llaves de prueba de Wompi (`WOMPI_ENVIRONMENT=sandbox`). Las llaves públicas, el secreto de integridad y el secreto de eventos se obtienen en el dashboard de comercios de Wompi; nunca publiques los secretos.
3. Configura `WOMPI_REDIRECT_URL` con la URL absoluta de `/apoyar/resultado` y permite el origen del frontend en `CORS_ORIGINS`.
4. En el dashboard de Wompi registra `https://<dominio-api>/api/pagos/wompi/eventos` como URL de eventos y habilita `transaction.updated`.
5. Para producción usa las llaves productivas, `WOMPI_ENVIRONMENT=production`, HTTPS y la URL pública correspondiente.

Los estados se actualizan desde eventos firmados de Wompi y se verifican contra la transacción del proveedor antes de mostrarse al usuario. Para ejecutar las pruebas del backend: `cd back && npm test`.