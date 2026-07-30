# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable

# Copiar archivos de workspace necesarios para instalación
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Instalar solo dependencias del backend (esto incluye al shared vía workspace)
RUN pnpm install --frozen-lockfile --filter @inventory/backend...

# Copiar el código fuente completo
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Crear usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copiar estructura necesaria desde el builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/backend ./apps/backend

# Eliminar archivos innecesarios
RUN rm -rf apps/backend/tests/ apps/backend/.github/ apps/backend/scripts/

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Usar usuario no-root
USER appuser

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

WORKDIR /app/apps/backend

# Comando de inicio
CMD ["node", "server.js"]
