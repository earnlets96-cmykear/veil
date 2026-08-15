# Multi-Stage Reproducible Build for VEIL Relay Server
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY dist ./dist

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV RELAY_HOST=0.0.0.0
ENV RELAY_PORT=8787
ENV RELAY_STORAGE_DIR=/data/relay

# Create unprivileged service user
RUN addgroup -S veil && adduser -S veil -G veil \
    && mkdir -p /data/relay \
    && chown -R veil:veil /data/relay /app

COPY --from=builder /app /app

USER veil
VOLUME ["/data/relay"]
EXPOSE 8787

CMD ["npm", "run", "relay"]
