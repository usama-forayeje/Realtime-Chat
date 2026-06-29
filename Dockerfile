# ==========================================
# Stage 1: Base Setup (pnpm এনাবল এবং কনফিগার)
# ==========================================
FROM node:22-alpine3.23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# pnpm v11 এর নতুন সিকিউরিটি পলিসি বাইপাস করার জন্য:
RUN pnpm config set verify-store-integrity false
RUN pnpm config set minimumReleaseAge 0

# ==========================================
# Stage 2: Frontend Build (Vite SPA)
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
# Stage 3: Backend Build (Express API)
# ==========================================
FROM base AS backend-build
WORKDIR /app/backend

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY backend/ ./
# (আপনার ব্যাকএন্ড যদি শুধু জাভাস্ক্রিপ্ট হয়, তবে আলাদা করে বিল্ড করার দরকার নেই)

# ==========================================
# Stage 4: Production Runtime (একদম লাইটওয়েট)
# ==========================================
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production 
ENV PORT=3000

# Zombie process ঠেকানোর জন্য dumb-init ইনস্টল করা
RUN apk add --no-cache dumb-init

# শুধুমাত্র প্রোডাকশন ডিপেন্ডেন্সি ইনস্টল করা
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# ব্যাকএন্ডের সোর্স কোড কপি করা
COPY --from=backend-build /app/backend/ ./

# ফ্রন্টএন্ডের বিল্ড করা ফাইলগুলো ব্যাকএন্ডের "public" ফোল্ডারে কপি করা
COPY --from=frontend-build /app/frontend/dist ./public

# সিকিউরিটি: Root ইউজারের বদলে নন-রুট 'node' ইউজার ব্যবহার করা
RUN chown -R node:node /app
USER node

# পোর্ট এক্সপোজ
EXPOSE 3000

# সার্ভার স্টার্ট করা (আপনার ব্যাকএন্ডের এন্ট্রি পয়েন্ট src/index.js)
CMD ["dumb-init", "node", "src/index.js"]