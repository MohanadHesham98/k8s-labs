# syntax=docker/dockerfile:1

# ==================================================
# Backend Dependencies
# ==================================================

FROM node:22-alpine AS backend-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force


# ==================================================
# Backend
# ==================================================

FROM node:22-alpine AS backend

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=backend-deps --chown=node:node /app/node_modules ./node_modules

COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]


# ==================================================
# Frontend
# ==================================================

FROM nginx:1.28-alpine AS frontend

RUN rm -f /etc/nginx/conf.d/default.conf

COPY public/ /usr/share/nginx/html/

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
