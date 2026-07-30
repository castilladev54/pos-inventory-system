import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';
import app from '../../server.js';

/**
 * [STATELESS] Genera un Authorization header firmando el JWT DIRECTAMENTE
 * en memoria, sin tocar la base de datos ni el endpoint de login.
 *
 * Úsalo cuando ya tienes el userId de un usuario creado en la BD de prueba
 * y quieres construir un token con la metadata stateless completa.
 *
 * El token contiene los 4 campos obligatorios que verifyToken y
 * injectBusinessContext requieren para funcionar sin fallback a DB:
 *   - role
 *   - permissions
 *   - ownerId
 *   - assignedBranches
 *
 * @param {import('mongoose').Types.ObjectId | string} userId
 * @param {string} role - Por defecto 'admin' para simplificar la suite
 * @param {object} options - Campos opcionales para el payload
 * @returns {{ Authorization: string }}
 */
export const getAuthHeadersForUser = (userId, role = 'admin', options = {}) => {
  if (!userId) {
    throw new Error('getAuthHeadersForUser: El userId es obligatorio.');
  }
  const token = jsonwebtoken.sign(
    {
      userId: userId.toString(),
      tokenVersion: options.tokenVersion !== undefined ? options.tokenVersion : 0,
      role,
      permissions: options.permissions || [],
      ownerId: options.ownerId ? options.ownerId.toString() : null,
      assignedBranches: options.assignedBranches || [],
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { Authorization: `Bearer ${token}` };
};

/**
 * [LOGIN REAL] Hace un POST a /api/auth/login con email y password reales,
 * obteniendo el token JWT emitido por el servidor (vía generateToken).
 *
 * Úsalo en los tests de integración que necesitan verificar el flujo completo
 * de autenticación (login → token → request autenticada).
 *
 * El token devuelto ya contiene los 4 campos stateless requeridos porque
 * generateToken() los empaqueta directamente desde el documento de User.
 *
 * @param {string} email    - Email del usuario registrado en la BD de prueba
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<{ Authorization: string }>}
 * @throws {Error} Si el login falla (credenciales inválidas, usuario inexistente)
 */
export const getAuthHeaders = async (email, password) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (!res.body.success || !res.body.token) {
    throw new Error(
      `getAuthHeaders: Login falló para "${email}". ` +
      `Status: ${res.status}. Body: ${JSON.stringify(res.body)}`
    );
  }

  return { Authorization: `Bearer ${res.body.token}` };
};
