# 🐾 Veterinaria "Entre Mascotas" - Sistema Web Integrado

Aplicación web moderna y completa para una clínica veterinaria y pet shop, construida en base al esquema relacional de base de datos PostgreSQL provisto.

---

## 🏗️ Estructura del Proyecto

```text
entreMascotasVet/
│
├── database/
│   └── schema.sql         # Esquema DDL en PostgreSQL (tablas, constraints, índices y seeds)
│
├── assets/
│   └── images/
│       ├── hero.jpg           # Imagen de portada en alta resolución (veterinaria y pacientes)
│       ├── grooming.jpg       # Servicio de peluquería canina y spa
│       └── consultation.jpg   # Consulta médica veterinaria
│
├── css/
│   └── styles.css         # Sistema de diseño moderno (Glassmorphism, tipografía, paleta clínica)
│
├── js/
│   ├── db.js              # Capa de base de datos local que replica las 8 tablas SQL
│   └── app.js             # Lógica interactiva (agendamiento, carrito, checkout, explorador BD)
│
├── index.html             # Página principal completa y responsiva
└── README.md              # Documentación técnica y guía de uso
```

---

## 🗄️ Mapeo con el Esquema de Base de Datos

Cada módulo de la interfaz interactúa directamente con una o más tablas del esquema:

| Módulo en la Web | Tablas Relacionadas | Descripción |
| :--- | :--- | :--- |
| **Reserva de Turnos** | `servicios`, `turnos`, `mascotas`, `clientes` | Permite solicitar turnos online. Si el cliente o la mascota no existen, los crea automáticamente. |
| **Pet Shop / Catálogo** | `categorias`, `productos` | Catálogo de productos con filtrado por categoría, buscador en vivo y badges de stock. |
| **Carrito y Checkout** | `pedidos`, `detalle_pedido`, `productos` | Procesa la orden de compra, genera el pedido con sus líneas de detalle y descuenta stock. |
| **Portal de Mascotas** | `clientes`, `mascotas`, `turnos` | Muestra el perfil del tutor, sus mascotas registradas con notas clínicas y sus citas activas. |
| **Explorador de BD** | *Todas las tablas* | Modal interactivo en la barra superior (`💾 Explorador BD`) que permite ver los registros en tiempo real. |

---

## 🚀 Cómo Iniciar el Proyecto

El servidor local ya se encuentra activo en el puerto `3000`. Podés abrir tu navegador en:

👉 **[http://localhost:3000](http://localhost:3000)**

Para iniciarlo manualmente en cualquier momento:

```powershell
# Con Python:
python -m http.server 3000

# O con Node.js / npx:
npx serve .
```

---

## 🔮 Próximos Pasos y Modificaciones

Como solicitaste ir modificando la página y la base de datos de a poco, acá tenés algunas opciones para continuar según tus prioridades:

1. **Panel de Administración (Backoffice)**: Añadir sección protegida para que el veterinario cambie el estado de los turnos (`reservado` ➔ `confirmado` ➔ `realizado`) o cargue nuevos productos.
2. **Historia Clínica Digital**: Agregar una tabla `historial_clinico` (diagnósticos, vacunas aplicadas, peso, tratamientos).
3. **Backend con Base de Datos Real**: Conectar con una base de datos PostgreSQL real (por ejemplo en Supabase o Node.js / Express / Prisma).
4. **Pasarela de Pagos**: Integrar checkout con Mercado Pago para cobro de señas de turnos y productos.
