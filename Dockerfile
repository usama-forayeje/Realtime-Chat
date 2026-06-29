# ==========================================
# Stage 1: Base Setup (pnpm এনাবল করার জন্য)
# ==========================================
FROM node:22-alpine3.23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# ==========================================
# Stage 2: Frontend Build (Vite SPA)
# ==========================================
FROM base AS frontend-build
WORKDIR /app/frontend

# ডিপেন্ডেন্সি ক্যাশিং (যাতে বারবার npm install না হয়)
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# সোর্স কোড কপি এবং বিল্ড
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

# ডিপেন্ডেন্সি ক্যাশিং
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# সোর্স কোড কপি এবং বিল্ড (TS compile)
COPY backend/ ./
RUN pnpm run build

# ==========================================
# Stage 4: Production Runtime (একদম লাইটওয়েট)
# ==========================================
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production 
ENV PORT=3000

# Zombie process ঠেকানোর জন্য dumb-init ইনস্টল করা (ইন্ডাস্ট্রি স্ট্যান্ডার্ড)
RUN apk add --no-cache dumb-init

# শুধুমাত্র প্রোডাকশন ডিপেন্ডেন্সি ইনস্টল করা
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# ফ্রন্টএন্ড এবং ব্যাকএন্ডের বিল্ড ফাইলগুলো কপি করা
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# সিকিউরিটি: Root ইউজারের বদলে নন-রুট 'node' ইউজার ব্যবহার করা
RUN chown -R node:node /app
USER node

# পোর্ট এক্সপোজ
EXPOSE 3000

# সার্ভার স্টার্ট করা (dumb-init এর মাধ্যমে)
CMD ["dumb-init", "node", "dist/index.js"]