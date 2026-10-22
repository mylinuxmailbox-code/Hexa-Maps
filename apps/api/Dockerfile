FROM node:22-bookworm-slim AS base
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/shields/package.json packages/shields/tsconfig.json ./packages/shields/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY apps/web/package.json apps/web/tsconfig.json ./apps/web/

RUN npm ci

COPY packages ./packages
COPY apps/api ./apps/api

EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@hexa/api"]
