import express from 'express';
import { createEmployee, getEmployees, updateEmployeePermissions, deleteEmployee } from '../controllers/staff.controller.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();

// ─── PROTECCIÓN DE RUTAS DE STAFF ──────────────────────────────────
// Solo el dueño (customer) o alguien con un permiso hipotético de "staff_management"
// puede gestionar empleados. En nuestra lógica base, si pasamos "staff_management",
// el middleware validará que sea owner o que el empleado tenga este permiso explícito.

router.get('/', requirePermission('staff_management'), getEmployees);
router.post('/', requirePermission('staff_management'), createEmployee);
router.put('/:id', requirePermission('staff_management'), updateEmployeePermissions);
router.delete('/:id', requirePermission('staff_management'), deleteEmployee);

export default router;
