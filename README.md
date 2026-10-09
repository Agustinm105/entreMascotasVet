# 🐾 Veterinaria "Entre Mascotas" - Sistema Web Integrado

Aplicación web moderna y completa para una clínica veterinaria y pet shop, integrada con **Supabase** (PostgreSQL, Auth con Google, Storage y Row Level Security) y preparada para publicación estática en Netlify.

---

## 🏗️ Estructura del Proyecto

```text
entreMascotasVet/
│
├── supabase/
│   └── setup.sql          # Esquema definitivo en Supabase (PostgreSQL, Auth, RLS, Storage, RPC y Seeds)
│
├── docs/
│   └── CONTEXTO.md        # Contexto técnico, reglas de arquitectura y fases del proyecto
│
├── assets/
│   └── images/
│       ├── hero.jpg           # Imagen de portada en alta resolución
│       ├── grooming.jpg       # Servicio de peluquería canina y spa
│       └── consultation.jpg   # Consulta médica veterinaria
│
├── css/
│   └── styles.css         # Sistema de diseño moderno (Glassmorphism, tipografía, paleta clínica)
│
├── js/
│   ├── config.js          # Configuración pública del frontend (Supabase URL y Key)
│   ├── supabase-client.js # Inicialización y exposición del cliente Supabase (window.sb)
│   ├── auth.js            # Autenticación con Google, perfiles y roles (window.vetAuth)
│   ├── db.js              # Base de datos local en transición (localStorage)
│   └── app.js             # Lógica interactiva principal del sitio
│
├── admin/                 # Panel de administración dedicado (Backoffice con roles staff y admin)
├── index.html             # Página principal completa y responsiva
└── README.md              # Documentación técnica y guía de uso
```

---

## 🗄️ Esquema de Base de Datos y Supabase

El backend y la base de datos están gestionados por **Supabase** según la definición de [supabase/setup.sql](supabase/setup.sql):

| Módulo | Entidades y Tablas | Seguridad & Lógica |
| :--- | :--- | :--- |
| **Autenticación y Perfiles** | `auth.users`, `public.perfiles` | Login con Google OAuth, trigger automático `on_auth_user_created`, roles (`cliente`, `empleado`, `admin`). |
| **Servicios y Turnos** | `servicios`, `mascotas`, `turnos` | Validación de solapamiento de horarios, cálculo de agenda disponible (`horarios_ocupados`), políticas RLS por cliente. |
| **Catálogo Pet Shop** | `categorias`, `productos` | Búsqueda, control de stock en servidor y bucket de imágenes en Supabase Storage (`productos`). |
| **Pedidos y Ventas** | `pedidos`, `detalle_pedido` | Creación atómica mediante RPC `crear_pedido(p_items, ...)`, estados de pedido y pago. |
| **Reportes y Backoffice** | `estadisticas_ventas` | Función RPC exclusiva para personal staff y administradores. |

---

## 🚀 Cómo Iniciar el Proyecto

Para levantar el servidor local en el puerto `3000` (origen autorizado para Google OAuth):

```powershell
# Con npx serve (recomendado):
npx serve . -l 3000

# O con Vite:
npm run dev
```

Podés ingresar en tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔮 Roadmap de Fases de Migración

El proyecto evoluciona en fases ordenadas hacia una arquitectura 100% cloud:

1. **Fase 1 (Actual) - Conexión y Autenticación con Google**: Integración de `@supabase/supabase-js`, `config.js`, `supabase-client.js`, autenticación OAuth con Google, carga de perfiles y menú interactivo de usuario.
2. **Fase 2 - Migración de Datos y Catálogo**: Reemplazo definitivo de `js/db.js` por consultas en tiempo real a Supabase para turnos, productos, mascotas y pedidos.
3. **Fase 3 - Panel de Administración (`admin/`)**: Backoffice seguro con diseño independiente para gestión de turnos, inventario, clientes y métricas según el rol (`empleado` / `admin`).
4. **Fase 4 - Pasarela de Pagos con Mercado Pago**: Integración de Checkout Pro mediante Supabase Edge Functions (`crear-pago` y `mp-webhook`) para cobro automático y actualización de estados.
