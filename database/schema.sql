-- ==========================================================
-- BASE DE DATOS: Veterinaria Entre Mascotas
-- Estructura DDL para PostgreSQL
-- ==========================================================

-- ---------- CLIENTES ----------
CREATE TABLE IF NOT EXISTS clientes (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(80)  NOT NULL,
    apellido      VARCHAR(80)  NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    telefono      VARCHAR(30),
    direccion     VARCHAR(200),
    password_hash VARCHAR(255) NOT NULL,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------- CATÁLOGO ----------
CREATE TABLE IF NOT EXISTS categorias (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS productos (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    nombre       VARCHAR(150)  NOT NULL,
    descripcion  TEXT,
    precio       NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock        INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
    imagen_url   VARCHAR(255),
    activo       BOOLEAN       NOT NULL DEFAULT TRUE,
    creado_en    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------- PEDIDOS ----------
CREATE TABLE IF NOT EXISTS pedidos (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','pagado','enviado','entregado','cancelado')),
    direccion_envio VARCHAR(200),
    total           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS detalle_pedido (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id     INTEGER NOT NULL REFERENCES productos(id),
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)
);

-- ---------- TURNOS ----------
CREATE TABLE IF NOT EXISTS servicios (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(100)  NOT NULL,
    descripcion  VARCHAR(255),
    duracion_min INTEGER       NOT NULL CHECK (duracion_min > 0),
    precio       NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    activo       BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS mascotas (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id       INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nombre           VARCHAR(80) NOT NULL,
    raza             VARCHAR(80),
    fecha_nacimiento DATE,
    notas            TEXT
);

CREATE TABLE IF NOT EXISTS turnos (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id    INTEGER NOT NULL REFERENCES clientes(id),
    mascota_id    INTEGER NOT NULL REFERENCES mascotas(id),
    servicio_id   INTEGER NOT NULL REFERENCES servicios(id),
    fecha_hora    TIMESTAMPTZ NOT NULL,
    estado        VARCHAR(20) NOT NULL DEFAULT 'reservado'
                  CHECK (estado IN ('reservado','confirmado','cancelado','realizado')),
    notas         TEXT,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- ÍNDICES ----------
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente     ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pedido      ON detalle_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha        ON turnos(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_turnos_cliente      ON turnos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_cliente    ON mascotas(cliente_id);

-- ---------- DATOS INICIALES: CATEGORÍAS ----------
INSERT INTO categorias (nombre, descripcion) VALUES
    ('Comida',     'Alimento balanceado, húmedo y snacks nutritivos'),
    ('Limpieza',   'Shampoo, cepillos, toallitas y productos de higiene'),
    ('Juguetes',   'Pelotas, mordillos y juguetes interactivos estimulantes'),
    ('Correas',    'Correas, collares ergonómicos y pecheras de paseo'),
    ('Accesorios', 'Camas térmicas, platos antiderrame, ropa y mantas')
ON CONFLICT (nombre) DO NOTHING;

-- ---------- DATOS INICIALES: SERVICIOS ----------
INSERT INTO servicios (nombre, descripcion, duracion_min, precio) VALUES
    ('Baño y Desinfección', 'Baño terapéutico, secado suave, corte de uñas y limpieza de oídos', 60, 8500.00),
    ('Peluquería Canina y Felina', 'Corte de raza o higiénico, cepillado profundo y perfume especial', 90, 11500.00),
    ('Consulta Veterinaria General', 'Evaluación clínica completa, control de peso y diagnóstico preventivo', 30, 9000.00),
    ('Vacunación y Desparasitación', 'Aplicación de vacunas quíntuple/séxtuple o antirrábica con certificado', 25, 7500.00)
ON CONFLICT DO NOTHING;
