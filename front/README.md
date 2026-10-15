# Frontend CBI Personitas Biblioteca

Aplicación web del proyecto de biblioteca digital de CBI Personitas, desarrollada con Astro.

## Objetivo

Presentar la biblioteca, los contenidos disponibles, la experiencia de lectura y las páginas de apoyo de la iniciativa.

## Estructura principal

```text
src/
├── components/
├── layouts/
├── pages/
├── styles/
├── data/
└── utils/
```

## Comandos

Ejecuta estos comandos desde `front/`:

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Desarrollo local

- La aplicación corre en `http://localhost:4321`
- Los cambios en `src/` se reflejan en caliente durante el desarrollo
- Los assets estáticos se ubican en `public/`

## Aplicación progresiva (PWA)

La app puede instalarse desde un navegador compatible mediante `/manifest.webmanifest`. El service worker almacena el manifiesto, los iconos y los recursos estáticos que se visiten; si no hay conexión al abrir una página, muestra la pantalla offline. Las páginas y respuestas dinámicas no se guardan en caché para evitar mostrar información desactualizada o privada.

La instalación y el service worker requieren HTTPS en producción (o `localhost` durante desarrollo).

## Sesiones

Las sesiones permanecen activas hasta dos días desde el inicio de sesión. Mientras tanto, la app renueva automáticamente los tokens de acceso; al cumplirse las 48 horas será necesario iniciar sesión de nuevo.

## Notas

Esta documentación está enfocada en el frontend del proyecto y mantiene la descripción general del sitio sin incluir detalles operativos específicos de integraciones o procesos internos.
