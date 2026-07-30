# 🛒 CastillaWeb - Sistema POS e Inventario (SaaS Frontend & Integración Backend)

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Zustand](https://img.shields.io/badge/zustand-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Framer Motion](https://img.shields.io/badge/Framer--Motion-black?style=for-the-badge&logo=framer&logoColor=blue)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)

CastillaWeb es una plataforma integral SaaS de punto de venta (POS) y gestión de inventarios para comercios. Este repositorio contiene el **Frontend** de la aplicación, el cual se conecta de forma segura a una API REST robusta (**Backend**) diseñada bajo una arquitectura moderna de alta disponibilidad, transacciones atómicas y caché distribuido.

El sistema proporciona una experiencia interactiva fluida (UX), modo oscuro adaptativo, animaciones basadas en físicas, integración con lectores de código de barras físico/cámara, y un asistente estratégico de Inteligencia Artificial (Gemini 2.5 Flash) que realiza análisis del negocio en tiempo real.

---

## 📐 Arquitectura y Ecosistema de Frontend

El proyecto está construido sobre un stack moderno y reactivo utilizando **React 19** con **TypeScript**, **Vite** como bundler, **Tailwind CSS v4** para el diseño de interfaces, y **Zustand v5** para el manejo del estado global.

La aplicación cliente se estructura siguiendo el principio de **Diseño Atómico (Atomic Design)** para maximizar la reutilización de componentes y facilitar el mantenimiento de la interfaz:

### Estructura de Directorios (`src/`)

```text
src/
├── assets/         # Recursos estáticos (imágenes, iconos locales)
├── components/     # Componentes de React
│   ├── atoms/      # Componentes UI básicos (ej. Button)
│   ├── molecules/  # Componentes compuestos
│   ├── organisms/  # Secciones complejas (ej. AiChatWindow)
│   ├── pos/        # Componentes específicos del Punto de Venta
│   └── *.{jsx,tsx} # Gestores principales (ProductManager, SalesManager, etc.)
├── constants/      # Variables constantes de la aplicación
├── hooks/          # Custom React hooks
├── pages/          # Vistas principales (enrutables)
├── store/          # Archivos de Zustand para el estado global
├── styles/         # Estilos adicionales / utilidades
├── utils/          # Funciones de ayuda (formateadores, fechas)
├── App.tsx         # Componente raíz y configuración de Rutas
└── main.tsx        # Punto de entrada de React
```

### Componentes Core

- **Punto de Entrada**: `main.tsx` inicializa la renderización del entorno React 19.
- **Ruteador Core**: `App.tsx` define el sistema de enrutamiento principal con `react-router-dom` v7. Utiliza wrappers de seguridad como `<ProtectedRoute>` y `<RedirectAuthenticatedUser>` para proteger rutas, además de integrar validación de suscripción activa.
- **Guardias de Permisos**: `<PermissionGuard>` envuelve componentes específicos del sistema para restringir el acceso basado en los roles (ej. `inventory_access`, `pos_access`, `finances_access`).
- **Dashboard Central**: `DashboardPage.tsx` actúa como contenedor modular principal. Renderiza pestañas condicionales basadas en los permisos del usuario y provee acceso al chatbot de IA.
- **Menú de Navegación**: `Sidebar.jsx` maneja la barra lateral responsiva, los menús colapsables y el selector de tema (Modo Claro / Modo Oscuro).
- **Landing Page**: `HomePage.tsx` funciona como portal de ventas inicial para captar nuevos registros de negocios.

---

## 📡 Arquitectura y Ecosistema de Backend

El backend (ubicado en la carpeta de proyecto hermana [BACKEND---INVENTORY-SYSTEM](file:///c:/Users/Consultorio/Documents/proyectosCarlos/BACKEND---INVENTORY-SYSTEM)) está implementado en **Node.js (ES Modules)** utilizando **Express 5.2**, **Mongoose 9.2** (MongoDB) y **Upstash Redis 1.37**.

### 1. Modelo SaaS Multi-tenant B2B
El backend aísla los datos de cada negocio por cliente (`customer_id`). Cuando un usuario inicia sesión, el backend normaliza la identidad del solicitante:
- **`req.userId`** siempre se resuelve al ID del dueño del negocio (`ownerId`), permitiendo que las consultas compartan el mismo tenant.
- **`req.realUserId`** apunta al usuario específico en sesión (puede ser un empleado).
- **`req.userRole`** y **`req.userPermissions`** determinan los niveles de acceso.

### 2. Visibilidad y Restricciones por Rol
- **Dueño (`customer`)**: Acceso completo a datos, reportes financieros, módulo de compras y creación de empleados.
- **Empleado (`employee`)**: Visibilidad restringida a **sus propias ventas** (`sold_by: req.realUserId`) y estrictamente a **las transacciones realizadas en el día de hoy** (zona horaria de Venezuela). No tiene acceso para modificar o cancelar ventas.
- **Administrador del SaaS (`admin`)**: Encargado de registrar nuevos clientes (con periodos demo de 7 días) y purgar cuentas en cascada en caso de rescisión del servicio.

---

## 🔐 Pipeline de Seguridad (E2E)

El flujo de seguridad combina configuraciones de red y un pipeline estricto de middlewares en Express antes de tocar la base de datos:

```
Petición Frontend
     ↓
1. CORS (Con cookies y credenciales seguras)
     ↓
2. SLA Timeout (1.5s - Fail fast para servidor serverless)
     ↓
3. Helmet & HPP (HTTP Security Headers y Parameter Pollution)
     ↓
4. sanitizeNoSQL (Sanitización de llaves de consulta contra inyecciones MongoDB)
     ↓
5. globalLimiter (Rate limiting general por IP)
     ↓
6. cookieParser (Extracción de JSON Web Tokens desde cookies HttpOnly)
     ↓
7. Lazy DB Connection (Conexión perezosa a MongoDB para evitar cold starts)
     ↓
8. verifyToken (Middleware JWT asíncrono para no bloquear el Event Loop)
     ↓
9. checkSubscription (Validación rápida de suscripción mediante caché en Redis)
     ↓
10. injectBusinessContext (Asignación automática del tenant y del contexto del rol)
     ↓
Controladores de Ruta (API REST)
```

> [!IMPORTANT]
> **Subscription Expired Lock**: El interceptor global de Axios valida el estado de la suscripción. Si ha expirado, redirige de inmediato a [SubscriptionExpiredPage.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/pages/SubscriptionExpiredPage.tsx) impidiendo cualquier operación. El backend respalda esto bloqueando peticiones con un código de respuesta `403 Forbidden` si la fecha de expiración ha pasado.

---

## 💾 Optimización de Rendimiento, Caché y Consistencia

### 1. Sistema de Caché Inteligente (Upstash Redis)
Para maximizar la velocidad en entornos serverless (Vercel) sin desincronizar datos, se implementa un **patrón de caché versionado**:
- **Clave de versión**: Se almacena un contador incremental (ej: `v:products:userId123` -> `4`).
- **Claves de datos**: Contienen la versión en su estructura (ej: `products:v4:p1:l20:userId123`).
- **Invalidación**: En operaciones de escritura (crear, editar, eliminar), se realiza un `bumpCacheVersion` (incremento del contador), dejando obsoletas las consultas anteriores de golpe sin necesidad de usar comandos costosos de escaneo de llaves (`SCAN`).
- **Cache Stampede Prevention**: Utiliza un registro en memoria de promesas activas (`inFlightPromises`) para que peticiones paralelas por la misma clave esperen un único resultado del backend en lugar de saturar a MongoDB.
- **Bypass en Búsquedas Cortas**: Las consultas de búsqueda de productos con menos de 3 caracteres ignoran Redis para evitar la explosión de claves temporales.

| Entidad | TTL de Caché | Comportamiento |
| :--- | :--- | :--- |
| **Suscripción** | 5 minutos | Redis descentralizado |
| **Ventas Paginadas** | 2 minutos | Actualización constante |
| **Productos Paginados** | 5 minutos | Rendimiento optimizado |
| **Tasas de Cambio** | 1 hora | Raramente muta en el día |
| **Kardex (Ajustes)** | 1 hora | Middleware genérico `cacheMiddleware` |

### 2. Transacciones ACID de Base de Datos
Toda modificación que afecte a múltiples colecciones se realiza dentro de transacciones de MongoDB. Si ocurre un fallo en cualquiera de los pasos, se ejecuta un **Rollback total**:
- **Ventas**: Descuenta stock de productos, genera el registro de venta y la auditoría.
- **Cancelaciones**: Devuelve el stock físico a los artículos e invalida la venta.
- **Compras**: Inserta registros de compra, incrementa el stock físico de múltiples productos y recalcula automáticamente el **Costo Promedio Ponderado** (`av_inventory_cost`) de cada ítem.
- **Control de Ajustes (Kardex)**: Permite registrar variaciones manuales (mermas, robos, etc.), compartiendo la sesión de transacción si es invocado por la creación de un nuevo producto.

---

## 📊 Módulos Clave del Sistema

### 1. Punto de Venta (TPV/POS)
El componente principal [SalesManager.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/SalesManager.tsx) gestiona toda la facturación:
- **Carrito Deslizante**: El componente [CartDrawer.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/pos/CartDrawer.tsx) permite visualizar artículos en el carrito, actualizar cantidades (admite enteros y fracciones para productos pesados/medidos a granel, ej. `1.5 kg`) y procesar cobros.
- **Teclado POS Acelerado**: El custom hook [usePOSKeyboard.ts](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/hooks/usePOSKeyboard.ts) define atajos rápidos (detallados en [HelpModal.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/pos/HelpModal.tsx)).
- **Filtros Históricos**: [useSalesFilters.ts](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/hooks/useSalesFilters.ts) provee filtros por vendedor, método de pago y rangos de fechas.

### 2. Gestión de Inventarios y Categorías
- **Control de Productos**: El componente [ProductManager.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/ProductManager.tsx) permite registrar artículos asignando tipos de unidad (`kg`, `litro`, `metro`, `unidad`).
- **Auditoría de Ajuste**: Cuando se modifica físicamente el stock, el sistema requiere de forma obligatoria seleccionar un motivo (mermas, robos, vencimientos, corrección de inventario) que se registra en el Kardex.
- **Categorías Taxonómicas**: Controladas desde [CategoryManager.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/CategoryManager.tsx). El backend impide borrar una categoría si tiene productos asociados.

### 3. Registro de Compras y Cuentas por Pagar (Supplier Manager)
Control integral de los ingresos de inventario administrado por [PurchaseManager.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/PurchaseManager.tsx):
- **Cuentas por Pagar**: Controla estados de deuda con proveedores (`Pagado`, `Vencida`, `Parcial`, `Pendiente`).
- **Abonos Parciales**: Permite ir saldando facturas de compras paulatinamente mediante registro de pagos en USD.
- **Cronograma de Vencimientos**: Alertas automáticas para facturas con vencimientos próximos (rango de 7 días).

### 4. Copiloto de Inteligencia Artificial (E2E)
El módulo [AiChatWindow.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/organisms/AiChatWindow.tsx) ofrece una herramienta de análisis gerencial en tiempo real:
- **Respuestas por Streaming (SSE)**: Utiliza `Server-Sent Events` para recibir y renderizar la respuesta del bot en tiempo real, palabra por palabra, mediante la API de streams.
- **Extracción de Contexto en Paralelo**: Al hacer una pregunta, el backend ejecuta consultas asíncronas en paralelo (con un timeout máximo de 8 segundos y caché en Redis de 3 minutos) para recopilar:
  - Stock crítico (menos de 5 unidades).
  - Ventas agrupadas de hoy y balances del negocio (Ingresos vs Compras).
  - Deudas con proveedores vencidas y por vencer.
  - Top 5 productos del mes.
- **Detección Local de Intenciones**: Identifica si la consulta requiere contexto temporal adicional (ej. "ventas de los últimos 7 días") o de deudas ("cuánto le debo a...") para inyectar agregaciones específicas.
- **Normalización de Zona Horaria**: Corrige el desfase de hora de Venezuela (UTC-4) respecto al servidor, asegurando que las estadísticas temporales entregadas a Gemini 2.5 Flash coincidan exactamente con la realidad del comercio.
- **System Prompt v2**: Prioriza alertas de deudas/stock crítico, estructura la respuesta en un máximo de 200 palabras utilizando markdown y sugiere siempre una acción ejecutable y concreta.

### 5. Tasa de Cambio Multidivisa (USD / VES)
El componente [ExchangeRateBar.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/pos/ExchangeRateBar.tsx) se conecta al [currencyStore.ts](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/currencyStore.ts) para obtener la tasa del día:
- **Tasa Única Diaria**: El backend implementa un índice compuesto único `{ customer_id: 1, date: 1 }` en el modelo `ExchangeRate`, garantizando una sola tasa registrada por negocio al día.
- **Timezone VE**: Se calcula el inicio del día en huso horario de Venezuela (UTC-4) para registrar la tasa antes de persistir en MongoDB.
- **Totales Duales**: Permite al POS mostrar subtotales, impuestos y totales convertidos instantáneamente entre USD y Bolívares (VES).

### 6. Control de Personal y Desempeño
La pestaña controlada por [StaffManager.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/StaffManager.tsx) maneja al equipo:
- **Edición de Permisos**: Habilita o deshabilita accesos sobre la marcha (`pos_access`, `inventory_access`, etc.).
- **Analíticas de Rendimiento (`salesStats`)**: El backend calcula de manera agregada mediante consultas de base de datos la cantidad de transacciones cerradas y el monto acumulado en USD facturado por cada cajero.

### 7. Analíticas de Ganancia Neta
Representado en [AnalyticsManager.tsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/AnalyticsManager.tsx):
- **Gráficas Comparativas**: `Recharts` muestra la curva diaria de ingresos vs costos operativos (Compras).
- **Flujo de Caja**: Gráfico de barras interactivo con colorimetría condicional (naranja para rentabilidad positiva, rojo para pérdidas).

---

## ⚡ Escaneo de Códigos de Barras

El sistema soporta dos modalidades de escaneo simultáneas:
1. **Lector de Cámara**: Componente [BarcodeScanner.jsx](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/components/BarcodeScanner.jsx) que implementa `html5-qrcode`. Permite seleccionar un multiplicador rápido (1x, 2x, 5x, 10x, 20x) para cargar stock velozmente, cuenta con alertas acústicas (`AudioContext`) y táctiles (`vibrate`).
2. **Escáner Físico USB/Bluetooth**: Un escuchador global captura flujos rápidos de pulsaciones de teclado (con tolerancia de intervalo <= 50ms) terminados en `Enter`, añadiendo el producto al carrito de forma automática desde cualquier lector de mano.

---

## ⌨️ Atajos del Punto de Venta (Hotkeys)

| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>F1</kbd> | Mostrar / ocultar ayuda de atajos | Global |
| <kbd>F2</kbd> | Crear nueva venta vacía | Historial |
| <kbd>Esc</kbd> | Cancelar venta o cerrar ventana/modal | Global |
| <kbd>F3</kbd> ó <kbd>/</kbd> | Enfocar barra de búsqueda de productos | Venta Activa |
| <kbd>F4</kbd> | Desplegar carrito de compras | Venta Activa |
| <kbd>F5</kbd> | Ciclar método de pago en el carrito | Carrito Abierto |
| <kbd>F6</kbd> | Abrir cámara escáner de barras | Venta Activa |
| <kbd>F8</kbd> | Vaciar todo el carrito | Venta Activa |
| <kbd>F9</kbd> | Confirmar pago / procesar venta | Carrito Abierto |
| <kbd>+</kbd> / <kbd>=</kbd> | Aumentar cantidad del último ítem | Venta Activa (sin foco en input) |
| <kbd>-</kbd> | Disminuir cantidad del último ítem | Venta Activa (sin foco en input) |

---

## 📂 Arquitectura de Estado Global (Zustand Stores)

El estado asincrónico del frontend se descentraliza en múltiples almacenes ligeros con persistencia selectiva:

- **[authStore.ts](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/authStore.ts)**: Control de usuario, token de verificación, creación administrativa y purga dura de almacenamiento local al cerrar sesión.
- **[productStore.js](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/productStore.js)**: CRUD de productos, filtrados avanzados y obtención por código de barras.
- **[categoryStore.js](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/categoryStore.js)**: Gestión taxonómica.
- **[purchaseStore.js](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/purchaseStore.js)**: Transacciones con proveedores y pagos de deuda.
- **[saleStore.js](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/saleStore.js)**: Control de ventas, anulaciones y recargas de stock asociadas.
- **[staffStore.js](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/staffStore.js)**: Gestión de cajeros, asignación de permisos y estadísticas.
- **[currencyStore.ts](file:///c:/Users/Consultorio/Documents/proyectosCarlos/Dashboard-React-Tailwindcss/frontend/src/store/currencyStore.ts)**: Sincronización y persistencia local de tasa cambiaria diaria (Bs/USD).

---

## 📡 Mapa de Endpoints de la API

A continuación se detallan los endpoints del backend que consume el frontend:

| Módulo | Método | Ruta | Seguridad / Permisos | Descripción |
| :--- | :---: | :--- | :---: | :--- |
| **Auth** | `POST` | `/api/auth/login` | Público | Inicia sesión y setea cookie JWT (HttpOnly). |
| | `POST` | `/api/auth/logout` | Público | Remueve la cookie JWT de la sesión. |
| | `GET` | `/api/auth/check-auth` | 🔑 JWT | Retorna perfil del usuario activo y sus permisos. |
| | `POST` | `/api/auth/create-user` | 🔑 Admin | Creación de clientes con suscripción demo (7 días). |
| | `DELETE`| `/api/auth/purge/:id` | 🔑 Admin | Purga física en cascada de datos de un cliente. |
| **Categorías** | `GET` | `/api/categories` | 🔑 JWT + Activo | Lista categorías del comercio. |
| | `POST` | `/api/categories` | 🔑 `inventory_access`| Registra una nueva categoría. |
| | `DELETE`| `/api/categories/:id` | 🔑 `inventory_access`| Borra categoría (si no tiene productos hijos). |
| **Productos** | `GET` | `/api/products` | 🔑 JWT + Activo | Lista productos paginados con soporte de búsqueda. |
| | `GET` | `/api/products/barcode/:code`| 🔑 JWT + Activo | Retorna producto que coincida con el código de barras. |
| | `POST` | `/api/products` | 🔑 `inventory_access`| Crea producto con stock inicial (Transacción ACID). |
| | `PUT` | `/api/products/:id` | 🔑 `inventory_access`| Modifica producto y registra deltas en stock. |
| **Compras** | `GET` | `/api/purchases` | 🔑 `purchases_access`| Historial de compras a proveedores con filtros. |
| | `POST` | `/api/purchases` | 🔑 `purchases_access`| Registra compra de mercancía (Calcula costo promedio). |
| | `PUT` | `/api/purchases/:id/pay` | 🔑 `purchases_access`| Registra abonos parciales a deudas. |
| **Ventas** | `GET` | `/api/sales` | 🔑 `pos_access` | Historial de facturas. Empleados solo ven las de hoy. |
| | `POST` | `/api/sales` | 🔑 `pos_access` | Registra una venta reduciendo stock (Transacción ACID). |
| | `PUT` | `/api/sales/:id/cancel`| 🔑 `customer` (Dueño) | Anula venta y regresa productos al stock (ACID). |
| **Kardex** | `GET` | `/api/adjustments` | 🔑 `inventory_access`| Historial de movimientos de stock (Kardex). |
| | `POST` | `/api/adjustments` | 🔑 `inventory_access`| Registra variaciones manuales de inventario. |
| **Tasas** | `GET` | `/api/rates/today` | 🔑 JWT + Activo | Tasa del día USD/VES (cacheada por 1h). |
| | `POST` | `/api/rates` | 🔑 JWT + Activo | Registra o actualiza la tasa cambiaria del día. |
| **Personal** | `GET` | `/api/staff` | 🔑 `staff_management`| Lista empleados adjuntando métricas agregadas. |
| | `POST` | `/api/staff` | 🔑 `staff_management`| Crea nuevo usuario de empleado (cajero). |
| **IA** | `POST` | `/api/ai/ask` | 🔑 `finances_access` | Consulta estratégica a Gemini (SSE Streaming). |

---

## 🛠️ Instalación y Configuración del Entorno de Desarrollo

Para ejecutar el ecosistema completo en tu entorno local, sigue las siguientes instrucciones:

### 1. Clonar y Configurar Sibling Directories
Asegúrate de tener la estructura de carpetas hermana:
```
proyectosCarlos/
├── BACKEND---INVENTORY-SYSTEM/     ← Backend API
└── Dashboard-React-Tailwindcss/    ← Frontend (este repositorio)
```

### 2. Configuración del Backend (`BACKEND---INVENTORY-SYSTEM`)
1. Navega a la carpeta del backend e instala las dependencias:
   ```bash
   cd ../BACKEND---INVENTORY-SYSTEM
   npm install
   ```
2. Crea un archivo `.env` en la raíz del backend con las siguientes variables:
   ```env
   PORT=5000
   MONGO_URI=mongodb:
   JWT_SECRET=
   CLIENT_URL=http://localhost:5173
   NODE_ENV=development
   GEMINI_API_KEY=tu_api_key_de_google_ai_studio
   REDIS_URL=tu_conexion_redis_upstash
   REDIS_TOKEN=tu_token_redis_upstash
   ```
3. Lanza el backend en desarrollo:
   ```bash
   npm run dev
   ```
   *El backend correrá en `http://localhost:5000`.*

### 3. Configuración del Frontend (`Dashboard-React-Tailwindcss/frontend`)
1. Regresa a la carpeta del frontend:
   ```bash
   cd ../Dashboard-React-Tailwindcss/frontend
   ```
2. Crea un archivo `.env` en la raíz del frontend (carpeta `frontend/`) para configurar las variables de entorno del cliente:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
3. Instala las dependencias y corre el servidor de desarrollo local:
   ```bash
   npm install
   npm run dev
   ```
   *El frontend estará disponible en `http://localhost:5173` y se comunicará automáticamente con la API en el puerto `5000` enviando credenciales y cookies correspondientes.*

---

## 🌐 Despliegue en Producción (Vercel)

El frontend está optimizado para su despliegue en entornos Serverless como **Vercel**. 
El repositorio incluye un archivo `vercel.json` en su raíz que asegura el correcto funcionamiento del enrutamiento del lado del cliente (Single Page Application) redirigiendo de manera nativa todas las peticiones a `index.html`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

El cliente Axios está configurado en todo el proyecto para interceptar respuestas y adjuntar cookies automáticamente (`withCredentials: true`), lo que permite que la sesión sea administrada de forma segura mediante JWT en cookies `HttpOnly` emitidas por el Backend.
