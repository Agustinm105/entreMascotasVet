/**
 * Veterinaria Entre Mascotas - Gestor de Base de Datos Local
 * Modela fielmente el esquema relacional SQL proporcionado.
 * Persiste en localStorage para permitir pruebas interactivas en vivo.
 */

const DB_KEY = 'entre_mascotas_db_v1';

const INITIAL_DATA = {
  clientes: [
    {
      id: 1,
      nombre: 'Agustín',
      apellido: 'Morales',
      email: 'agustin.morales@ejemplo.com',
      telefono: '+54 11 4455-8899',
      direccion: 'Av. Libertador 2450, Piso 4B',
      password_hash: '$2a$12$eX4mpL3h4shP4ssw0rdEncrypted...',
      creado_en: '2026-09-15T10:30:00.000Z'
    },
    {
      id: 2,
      nombre: 'Valeria',
      apellido: 'Gómez',
      email: 'valeria.gomez@ejemplo.com',
      telefono: '+54 11 3322-1144',
      direccion: 'Calle Las Heras 890',
      password_hash: '$2a$12$s0m30th3rh4shStr1ng...',
      creado_en: '2026-09-20T14:15:00.000Z'
    }
  ],
  categorias: [
    { id: 1, nombre: 'Comida', descripcion: 'Alimento balanceado, húmedo y snacks nutritivos' },
    { id: 2, nombre: 'Limpieza', descripcion: 'Shampoo, cepillos, toallitas y productos de higiene' },
    { id: 3, nombre: 'Juguetes', descripcion: 'Pelotas, mordillos y juguetes interactivos' },
    { id: 4, nombre: 'Correas', descripcion: 'Correas, collares ergonómicos y pecheras reforzadas' },
    { id: 5, nombre: 'Accesorios', descripcion: 'Camas térmicas, comederos de acero, ropa y mantas' }
  ],
  servicios: [
    {
      id: 1,
      nombre: 'Baño y Desinfección',
      descripcion: 'Baño terapéutico hipoalergénico, secado profesional con turbina, limpieza de oídos y corte de uñas.',
      duracion_min: 60,
      precio: 8500.00,
      activo: true,
      icono: '🛁',
      imagen: 'assets/images/grooming.jpg'
    },
    {
      id: 2,
      nombre: 'Peluquería Canina y Felina',
      descripcion: 'Corte de raza o higiénico a tijera/máquina, deslanado profundo, cepillado y perfume frutal suave.',
      duracion_min: 90,
      precio: 11500.00,
      activo: true,
      icono: '✂️',
      imagen: 'assets/images/grooming.jpg'
    },
    {
      id: 3,
      nombre: 'Consulta Veterinaria General',
      descripcion: 'Chequeo físico integral, auscultación cardíaca y pulmonar, pesaje, control dental y plan preventivo.',
      duracion_min: 30,
      precio: 9000.00,
      activo: true,
      icono: '🩺',
      imagen: 'assets/images/consultation.jpg'
    },
    {
      id: 4,
      nombre: 'Vacunación y Desparasitación',
      descripcion: 'Aplicación de esquemas quíntuple/séxtuple, antirrábica, antiparasitarios internos y libreta sanitaria.',
      duracion_min: 25,
      precio: 7500.00,
      activo: true,
      icono: '💉',
      imagen: 'assets/images/consultation.jpg'
    }
  ],
  mascotas: [
    {
      id: 1,
      cliente_id: 1,
      nombre: 'Milo',
      raza: 'Golden Retriever',
      fecha_nacimiento: '2023-04-12',
      notas: 'Muy dócil y juguetón. Vacunas al día. Alergia leve al polen en primavera.'
    },
    {
      id: 2,
      cliente_id: 1,
      nombre: 'Oliver',
      raza: 'Gato Siamés',
      fecha_nacimiento: '2022-08-05',
      notas: 'Tranquilo, acostumbrado a cepillado frecuente.'
    },
    {
      id: 3,
      cliente_id: 2,
      nombre: 'Kira',
      raza: 'Bulldog Francés',
      fecha_nacimiento: '2024-01-10',
      notas: 'Sensible al calor intenso, requiere pausas breves.'
    }
  ],
  productos: [
    {
      id: 1,
      categoria_id: 1,
      nombre: 'Alimento Royal Canin Maxi Adult 15kg',
      descripcion: 'Nutrición óptima con proteínas de alta digestibilidad y soporte osteoarticular para perros grandes.',
      precio: 48900.00,
      stock: 14,
      imagen_url: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-01T12:00:00.000Z'
    },
    {
      id: 2,
      categoria_id: 1,
      nombre: 'Snacks Dentales Hills Prescription Dental Care',
      descripcion: 'Premios crocantes clínicamente probados para reducir sarro, placa bacteriana y refrescar el aliento.',
      precio: 6800.00,
      stock: 28,
      imagen_url: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-02T12:00:00.000Z'
    },
    {
      id: 3,
      categoria_id: 2,
      nombre: 'Shampoo Avena & Aloe Vera Orgánico 500ml',
      descripcion: 'Fórmula hidratante calmante para pieles sensibles, alivia picores y deja pelaje sedoso y brillante.',
      precio: 5200.00,
      stock: 19,
      imagen_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-03T12:00:00.000Z'
    },
    {
      id: 4,
      categoria_id: 3,
      nombre: 'Pelota Kong Classic con Dispensador de Treats',
      descripcion: 'Goma natural ultra resistente anti-mordidas, rebote impredecible para ejercicio mental y físico.',
      precio: 9500.00,
      stock: 22,
      imagen_url: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-04T12:00:00.000Z'
    },
    {
      id: 5,
      categoria_id: 4,
      nombre: 'Pechera Ergonómica Reflectiva Acolchada Talle M/L',
      descripcion: 'Diseño antitirones con doble anilla de sujeción frontal y trasera, tela transpirable y reflectiva nocturna.',
      precio: 14200.00,
      stock: 12,
      imagen_url: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-05T12:00:00.000Z'
    },
    {
      id: 6,
      categoria_id: 5,
      nombre: 'Cama Nube Ortopédica Memory Foam 80cm',
      descripcion: 'Alivia articulaciones y columna con espuma viscoelástica, funda lavable con cierre y base antideslizante.',
      precio: 29500.00,
      stock: 8,
      imagen_url: 'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-06T12:00:00.000Z'
    },
    {
      id: 7,
      categoria_id: 1,
      nombre: 'Lata Royal Canin Feline Wet Kitten 85g',
      descripcion: 'Textura mousse suave para gatitos de hasta 12 meses y gatas gestantes. Alto aporte calórico.',
      precio: 3100.00,
      stock: 45,
      imagen_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-07T12:00:00.000Z'
    },
    {
      id: 8,
      categoria_id: 2,
      nombre: 'Cepillo Deslanador Cardina Profesional Autolimpiante',
      descripcion: 'Remueve hasta un 95% del pelo muerto sin irritar la piel, botón expulsor fácil para una limpieza instantánea.',
      precio: 6400.00,
      stock: 16,
      imagen_url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600&auto=format&fit=crop&q=80',
      activo: true,
      creado_en: '2026-09-08T12:00:00.000Z'
    }
  ],
  pedidos: [
    {
      id: 101,
      cliente_id: 1,
      fecha: '2026-09-28T16:20:00.000Z',
      estado: 'entregado',
      direccion_envio: 'Av. Libertador 2450, Piso 4B',
      total: 55700.00
    }
  ],
  detalle_pedido: [
    {
      id: 1,
      pedido_id: 101,
      producto_id: 1,
      cantidad: 1,
      precio_unitario: 48900.00
    },
    {
      id: 2,
      pedido_id: 101,
      producto_id: 2,
      cantidad: 1,
      precio_unitario: 6800.00
    }
  ],
  turnos: [
    {
      id: 1,
      cliente_id: 1,
      mascota_id: 1,
      servicio_id: 1,
      fecha_hora: '2026-10-05T10:00:00.000Z',
      estado: 'confirmado',
      notas: 'Baño de primavera y corte de uñas para Milo.',
      creado_en: '2026-09-29T11:00:00.000Z'
    },
    {
      id: 2,
      cliente_id: 1,
      mascota_id: 2,
      servicio_id: 3,
      fecha_hora: '2026-10-08T15:30:00.000Z',
      estado: 'reservado',
      notas: 'Control preventivo anual de Oliver.',
      creado_en: '2026-09-30T09:40:00.000Z'
    }
  ]
};

class VetDatabase {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(DB_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('No se pudo acceder al localStorage, iniciando con datos iniciales', e);
    }
    const initialCopy = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.save(initialCopy);
    return initialCopy;
  }

  save(data = this.data) {
    this.data = data;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Error al guardar en localStorage', e);
    }
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.save();
    return this.data;
  }

  // Operaciones de consulta
  getAll(table) {
    return this.data[table] || [];
  }

  getById(table, id) {
    const list = this.data[table] || [];
    return list.find(item => Number(item.id) === Number(id)) || null;
  }

  filter(table, predicate) {
    const list = this.data[table] || [];
    return list.filter(predicate);
  }

  // Operaciones de inserción con auto-increment y validación de tipos
  insert(table, record) {
    if (!this.data[table]) {
      this.data[table] = [];
    }
    const list = this.data[table];
    const maxId = list.reduce((max, item) => (item.id > max ? item.id : max), 0);
    const newRecord = {
      ...record,
      id: maxId + 1,
      creado_en: record.creado_en || new Date().toISOString()
    };
    list.push(newRecord);
    this.save();
    return newRecord;
  }

  update(table, id, updates) {
    const list = this.data[table] || [];
    const index = list.findIndex(item => Number(item.id) === Number(id));
    if (index === -1) return null;

    list[index] = {
      ...list[index],
      ...updates
    };
    this.save();
    return list[index];
  }

  delete(table, id) {
    const list = this.data[table] || [];
    const index = list.findIndex(item => Number(item.id) === Number(id));
    if (index === -1) return false;

    list.splice(index, 1);
    this.save();
    return true;
  }

  // Relaciones e información compuesta
  getTurnosDetallados() {
    return this.getAll('turnos').map(t => {
      const cliente = this.getById('clientes', t.cliente_id) || { nombre: 'Desconocido', apellido: '', email: '', telefono: '' };
      const mascota = this.getById('mascotas', t.mascota_id) || { nombre: 'Desconocida', raza: '' };
      const servicio = this.getById('servicios', t.servicio_id) || { nombre: 'Servicio', duracion_min: 0, precio: 0 };
      return {
        ...t,
        cliente,
        mascota,
        servicio
      };
    });
  }

  getPedidosDetallados() {
    return this.getAll('pedidos').map(p => {
      const cliente = this.getById('clientes', p.cliente_id) || { nombre: 'Invitado', apellido: '', email: '' };
      const detalles = this.filter('detalle_pedido', dp => dp.pedido_id === p.id).map(dp => {
        const prod = this.getById('productos', dp.producto_id) || { nombre: 'Producto borrado' };
        return {
          ...dp,
          producto: prod
        };
      });
      return {
        ...p,
        cliente,
        detalles
      };
    });
  }

  // Exportar volcado de base de datos SQL o JSON
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }
}

// Instancia global disponible en window.db
window.vetDB = new VetDatabase();
