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
# Install prod deps, then strip the bundled npm CLI: the runtime only runs
# `node dist/main.js` (and the migration Job runs typeorm's cli.js directly),
# so npm is unused at runtime and its bundled tar/ip-address only add CVEs.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=builder /app/dist ./dist
# Drop root: the base image ships an unprivileged 'node' user (uid 1000).
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
