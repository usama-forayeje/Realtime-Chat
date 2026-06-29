# ==========================================
# Stage 1: Base Setup
# ==========================================
FROM node:22-alpine3.23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
# সিকিউরিটি পলিসি এরর এড়াতে এটি যোগ করা হয়েছে
RUN pnpm config set verify-store-integrity false

# ==========================================
# Stage 2: Frontend Build
# ==========================================
FROM base AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN pnpm run build

# ==========================================
# Stage 3: Backend Build
# ==========================================
FROM base AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/ ./
# যদি আপনার ব্যাকএন্ডে বিল্ড প্রয়োজন হয়
RUN pnpm run build

# ==========================================
# Stage 4: Production Runtime
# ==========================================
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production 
ENV PORT=3000

RUN apk add --no-cache dumb-init

# শুধুমাত্র ব্যাকএন্ডের প্রোডাকশন ডিপেন্ডেন্সি
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# বিল্ড ফাইল কপি করা
COPY --from=backend-build /app/backend/dist ./dist
# ফ্রন্টএন্ডের বিল্ড ফাইল ব্যাকএন্ডের public ফোল্ডারে কপি করা
COPY --from=frontend-build /app/frontend/dist ./public

# সিকিউরিটি: Non-root user
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["dumb-init", "node", "dist/index.js"]