# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.28.0-alpine@sha256:c97ff0bf7cbae369953c6da1232ec14ad9f971d66360c5698db0856a4cd657a0

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY design-system/package.json ./design-system/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS build
COPY . .
ARG VITE_APP_VERSION
ENV VITE_API_MODE=real
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
RUN test -n "$VITE_APP_VERSION" \
    && test "$VITE_APP_VERSION" = "$(node -p "require('./package.json').version")" \
    && npm run build \
    && node scripts/check-browser-budget.mjs

FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=101:101 /app/build/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
