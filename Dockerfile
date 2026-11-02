FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts/install-npm.mjs ./scripts/
RUN node scripts/install-npm.mjs
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.7-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e

USER root

# Resolve these packages from the selected base image's Alpine repository so a
# base-image update cannot be blocked by repository revision churn.
RUN apk add --no-cache c-ares curl libcurl

COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf.template
COPY --chown=101:101 docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
    && touch /etc/nginx/conf.d/default.conf \
    && chown 101:101 /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
