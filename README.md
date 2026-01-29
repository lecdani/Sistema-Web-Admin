# Sistema Web de Vendedores

Sistema de administración y ventas migrado a Next.js con App Router.

## Tecnologías

- **Next.js 16** con App Router
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Radix UI** (componentes UI)

## Estructura del Proyecto

```
├── app/                    # Rutas de Next.js (App Router)
│   ├── (auth)/            # Rutas de autenticación
│   ├── (admin)/           # Rutas de administración
│   ├── sales/              # Rutas de ventas
│   ├── layout.tsx          # Layout raíz
│   ├── page.tsx            # Página principal
│   └── globals.css         # Estilos globales
├── src/
│   ├── components/         # Componentes reutilizables
│   ├── features/           # Módulos de la aplicación
│   ├── hooks/              # Custom hooks
│   ├── services/           # Servicios de datos
│   ├── config/             # Configuración
│   └── types/              # Tipos TypeScript
└── public/                 # Archivos estáticos
```

## Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Iniciar servidor de producción
npm start

# Linting
npm run lint

# Tests
npm test
npm run test:watch
```

## Configuración

### Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# URL del servidor API .NET
# IMPORTANTE: Si tu API usa el prefijo /api, inclúyelo en la URL:
# NEXT_PUBLIC_API_URL=http://192.168.0.113:5107/api
# Si no usa prefijo, usa solo la URL base:
NEXT_PUBLIC_API_URL=http://192.168.0.113:5107

# Por defecto se usa el proxy de Next.js para evitar problemas de CORS
# Si tu servidor tiene CORS configurado y quieres conexión directa, usa:
# NEXT_PUBLIC_USE_API_PROXY=false
```

**Nota:** 
- Si no se configura `NEXT_PUBLIC_API_URL`, la aplicación usará por defecto `http://192.168.0.113:5107`.
- **Por defecto se usa el proxy de Next.js** (`/api/proxy`) para evitar problemas de CORS. Esto es más confiable.
- Si tu servidor .NET tiene CORS configurado correctamente y prefieres conexión directa, configura `NEXT_PUBLIC_USE_API_PROXY=false`.
- **Si tu API .NET usa el prefijo `/api`** (ej: `http://192.168.0.113:5107/api/auth/login`), incluye `/api` en la URL: `NEXT_PUBLIC_API_URL=http://192.168.0.113:5107/api`

## Desarrollo

1. Instala las dependencias:
```bash
npm install
```

2. Inicia el servidor de desarrollo:
```bash
npm run dev
```

3. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Rutas Principales

- `/` - Página principal (redirige según autenticación)
- `/login` - Página de inicio de sesión
- `/forgot-password` - Recuperación de contraseña
- `/dashboard` - Panel de administración (requiere autenticación admin)
- `/users` - Gestión de usuarios
- `/orders` - Gestión de pedidos
- `/sales` - Panel de ventas (requiere autenticación user)
- `/reports` - Reportes y análisis

## Autenticación

El sistema utiliza autenticación basada en roles:
- **admin**: Acceso completo al sistema
- **user**: Acceso al panel de ventas

Las rutas protegidas están implementadas con `AuthGuard` que verifica la autenticación y el rol del usuario.

## Migración desde Vite

Este proyecto fue migrado desde React + Vite a Next.js. Los archivos de Vite (`vite.config.ts`, `index.html`, `src/main.tsx`) han sido eliminados y reemplazados por la estructura de Next.js.
