# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------- build stage
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Version info shown in the app (footer, menu, About). CI and the git auto-updater
# pass these; the .git folder is not part of the build context.
ARG APP_VERSION=""
ARG GIT_SHA=""
ARG BUILD_NUMBER=""
ARG BUILD_DATE=""
ENV APP_VERSION=$APP_VERSION \
    GIT_SHA=$GIT_SHA \
    BUILD_NUMBER=$BUILD_NUMBER \
    BUILD_DATE=$BUILD_DATE

# A failing test aborts the image build, so a broken commit never gets deployed.
RUN npm test && npm run build

# -------------------------------------------------------------- runtime stage
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

ARG APP_VERSION=""
ARG GIT_SHA=""
ARG BUILD_DATE=""
LABEL org.opencontainers.image.title="WhereIBeen" \
      org.opencontainers.image.description="Animated travel globe built from Gmail flight confirmations and Google Maps Timeline" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.created="$BUILD_DATE" \
      org.opencontainers.image.licenses="MIT"

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

USER root
# Normalise line endings (repo may be checked out on Windows) and let the unprivileged
# nginx user write the runtime config file at start-up.
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-runtime-config.sh \
 && chmod 755 /docker-entrypoint.d/40-runtime-config.sh \
 && touch /usr/share/nginx/html/config.json \
 && chown 101:101 /usr/share/nginx/html/config.json
USER 101

# Google OAuth client ID is injected at runtime so one image works for any domain.
ENV GOOGLE_CLIENT_ID=""
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
