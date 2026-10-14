# CBI Personitas Biblioteca

Proyecto de biblioteca digital para CBI Personitas, pensado para poner al alcance de familias recursos educativos, lectura y contenidos digitales en un entorno accesible y sencillo.

## Descripción general

- Frontend: Astro + TypeScript para la experiencia web.
- Backend: Express + Supabase para APIs y gestión de datos.
- Funcionalidades principales: catálogo de libros, lectura de contenidos, panel de gestión y flujo de apoyo a la biblioteca.

## Estructura del repositorio

```text
/
├── README.md
├── front/              # aplicación web
│   ├── src/
│   ├── public/
│   └── package.json
├── back/               # API y servicios del backend
│   ├── src/
│   ├── database/
│   └── package.json
├── reports/            # reportes y documentación operativa
└── .gitignore
```

## Requisitos

- Node.js 22+ recomendado
- npm
- acceso a Supabase para la base de datos y configuración del backend

## Configuración local

### 1) Frontend

```bash
cd front
npm install
npm run dev
```

La aplicación quedará disponible normalmente en `http://localhost:4321`.

### 2) Backend

```bash
cd back
cp .env.example .env
npm install
npm run dev
```

Asegúrate de configurar las variables de entorno de Supabase antes de iniciar la API.

## Variables de entorno

Crea en `back/.env` los valores necesarios para la conexión con Supabase y otras configuraciones del entorno local. Mantén los secretos fuera del control de versiones.

## Scripts útiles

- Frontend: `cd front && npm run build`
- Preview del frontend: `cd front && npm run preview`
- Backend: `cd back && npm run dev`
- Pruebas del backend: `cd back && npm test`

## Notas

Este repositorio está orientado a la biblioteca digital y a la experiencia de lectura de la comunidad CBI Personitas. La documentación del proyecto debe mantenerse alineada con la funcionalidad actual y sin referencias a procesos o integraciones que no formen parte del flujo vigente.