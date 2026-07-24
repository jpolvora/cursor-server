# Multi-stage production image for cursor-server.
# Never COPY .env — secrets come from Compose env_file / host env only.

FROM node:20-bookworm AS builder
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
# Non-root runtime. Named volume /data/repos must be writable by this user
# (Compose creates the volume; if SDK/volume writes fail, see docs/docker.md).
RUN groupadd --system cursorserver \
  && useradd --system --gid cursorserver --create-home --home-dir /home/cursorserver cursorserver \
  && mkdir -p /data/repos \
  && chown -R cursorserver:cursorserver /data/repos
COPY package.json package-lock.json ./
# --ignore-scripts: prepare/husky is a devDependency and is not present with --omit=dev
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN chown -R cursorserver:cursorserver /app
USER cursorserver
EXPOSE 3000
CMD ["node", "dist/index.js"]
