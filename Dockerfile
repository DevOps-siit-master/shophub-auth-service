# ---- Builder stage ----
FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- Runner stage ----
FROM node:24-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Drop root: the base image ships an unprivileged 'node' user (uid 1000).
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
