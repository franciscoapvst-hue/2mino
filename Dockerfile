# ── Build ───────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite "hornea" las VITE_* al bundle en build-time, no en runtime — por eso
# entra como build arg y no como environment: en docker-compose.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ARG VITE_ADSENSE_CLIENT_ID
ENV VITE_ADSENSE_CLIENT_ID=$VITE_ADSENSE_CLIENT_ID
ARG VITE_ADSENSE_SLOT_DASHBOARD
ENV VITE_ADSENSE_SLOT_DASHBOARD=$VITE_ADSENSE_SLOT_DASHBOARD
ARG VITE_ADSENSE_SLOT_MATCHMAKING
ENV VITE_ADSENSE_SLOT_MATCHMAKING=$VITE_ADSENSE_SLOT_MATCHMAKING
ARG VITE_ADSENSE_SLOT_MANO
ENV VITE_ADSENSE_SLOT_MANO=$VITE_ADSENSE_SLOT_MANO
RUN npm run build

# ── Producción (nginx estático + proxy /api) ─────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
