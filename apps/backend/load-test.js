/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LOAD TEST — CastillaWeb Backend (Vercel)
 * Simula 40 usuarios reales durante 1 hora en tráfico de producción.
 *
 * Ejecución para 1 HORA (40 Usuarios VUs):
 * $env:Path += ";" + [System.Environment]::GetEnvironmentVariable("Path","User"); k6 run load-test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// ─── Métricas personalizadas ─────────────────────────────────────────────────
const cacheHitRate = new Rate('cache_hit_rate');
const dbErrorRate = new Rate('db_error_rate');
const apiCallsTotal = new Counter('api_calls_total');

// Cambiado a local para probar escalabilidad real de Node sin bloqueos Edge/WAF
// const BASE_URL = 'https://backend-inventory-system.vercel.app'; 
const BASE_URL = 'http://localhost:5000';

const TEST_USER = {
  email: 'castillajrweb@gmail.com',
  password: 'Fullstack.90',
};

export const options = {
  stages: [
    { duration: '30s', target: 40 }, // Rampa rápida
    { duration: '4m', target: 40 },  // Carga sostenida
    { duration: '30s', target: 0 },  // Rampa de bajada
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.02'],
    db_error_rate: ['rate<0.01'],
  },
};

// ─── Setup: Se ejecuta UNA SOLA VEZ para evitar el Rate Limiter de Auth (10 req/15min) 
export function setup() {
  const payload = JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

  if (res.status === 200) {
    console.log("✅ Login Inicial Exitoso! Token capturado para todo el enjambre de prueba.");
  } else {
    console.error(`❌ Falla en Login: ${res.status} - ${res.body}`);
  }

  let extractedToken = null;
  try {
    if (res.body) {
      const body = res.json();
      if (body && body.token) {
        extractedToken = body.token;
      }
    }
  } catch (e) {
    console.error("No se pudo extraer el token del JSON de respuesta");
  }

  return {
    token: extractedToken
  };
}

// ─── Flujo por cada Usuario Virtual (VU) ─────────────────────────────────────
export default function (data) {
  if (!data || !data.token) {
    console.error(`VU ${__VU}: ¡Falta token! Saltando iteración bloqueante.`);
    sleep(1); // OBLIGATORIO: previene loop infinito que revienta la RAM local
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`, // Usando el token real capturado en el body
    // Intentamos asignar IPs virtuales diferentes por cada Usuario para evitar 
    // bloqueo del RateLimiter Global (1000/15min) de Vercel e IPs:
    'X-Forwarded-For': `192.168.10.${__VU}`,
    'x-real-ip': `192.168.10.${__VU}`
  };

  sleep(1);

  group('GET: Productos (Buscando hit en Caché)', () => {
    const res = http.get(`${BASE_URL}/api/products`, { headers });
    apiCallsTotal.add(1);

    check(res, { 'productos: status 200': (r) => r && r.status === 200 });

    let fromCache = false;
    // 🛡️ Blindaje crítico: Evita crash "GoError: body is null" si la conexión TCP se corta
    if (res && res.status === 200 && res.body) {
      try { fromCache = res.json('fromCache'); } catch (e) { }
    }

    cacheHitRate.add(fromCache === true ? 1 : 0);
    // Si res es null (TCP error) o status 500, marcamos error de BD a fines de métrica
    dbErrorRate.add(!res || res.status >= 500 ? 1 : 0);
  });

  sleep(Math.random() * 2 + 1); // Variación realista

  group('GET: Categorías (Buscando hit en Caché)', () => {
    const res = http.get(`${BASE_URL}/api/categories`, { headers });
    apiCallsTotal.add(1);

    check(res, { 'categorías: status 200': (r) => r && r.status === 200 });

    let fromCache = false;
    if (res && res.status === 200 && res.body) {
      try { fromCache = res.json('fromCache'); } catch (e) { }
    }

    cacheHitRate.add(fromCache === true ? 1 : 0);
    dbErrorRate.add(!res || res.status >= 500 ? 1 : 0);
  });

  sleep(Math.random() * 2 + 1);

  group('GET: Ventas y Compras', () => {
    const resP = http.get(`${BASE_URL}/api/purchases`, { headers });
    const resS = http.get(`${BASE_URL}/api/sales`, { headers });
    apiCallsTotal.add(2);

    check(resP, { 'compras: status 200': (r) => r && r.status === 200 });
    check(resS, { 'ventas: status 200': (r) => r && r.status === 200 });

    // Blindaje anti-crashes de red
    const pError = !resP || resP.status >= 500;
    const sError = !resS || resS.status >= 500;
    dbErrorRate.add(pError || sError ? 1 : 0);
  });

  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    apiCallsTotal.add(1);
    check(res, { 'health: status 200': (r) => r && r.status === 200 });
  });

  // Pausa del usuario leyendo la información (2 a 4 segundos)
  sleep(Math.random() * 2 + 2);
}
