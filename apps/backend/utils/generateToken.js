import jwt from "jsonwebtoken";

/**
 * Genera un Access Token JWT (corta duración).
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion || 0,
      role: user.role,
      permissions: user.permissions || [],
      ownerId: user.owner_id ? user.owner_id.toString() : null,
      assignedBranches: (user.assigned_branches || []).map((id) => id.toString()),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m", // Corta duración para seguridad
    }
  );
};

/**
 * Genera un Refresh Token JWT (larga duración, solo sirve para obtener un nuevo Access Token).
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString()
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, // Idealmente una clave secreta distinta
    {
      expiresIn: "7d",
    }
  );
};
