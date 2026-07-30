import express from "express";
import { createUser, login, logout, forgotPassword, resetPassword, checkAuth, purgeUserAndData, refreshToken } from "../controllers/auth.controllers.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { validate } from "../middleware/validate.js";
import { createUserSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validations/auth.validation.js";

const router = express.Router();

router.get("/check-auth", verifyToken, checkAuth)
router.get("/refresh", refreshToken);
router.post("/create-user", verifyToken, validate(createUserSchema), createUser); // ¡Solo admins!
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password/:token", validate(resetPasswordSchema), resetPassword);
router.delete("/purge/:targetUserId", verifyToken, purgeUserAndData); // Botón de Borrado en Cascada

export default router;



