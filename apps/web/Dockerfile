FROM node:22-bookworm-slim AS builder
WORKDIR /app

ARG INTERNAL_API_ORIGIN=http://api:4000
ARG NEXT_PUBLIC_PMTILES_URL=""
ARG NEXT_PUBLIC_SATELLITE_TILES_URL=""
ENV INTERNAL_API_ORIGIN=${INTERNAL_API_ORIGIN}
ENV NEXT_PUBLIC_PMTILES_URL=${NEXT_PUBLIC_PMTILES_URL}
ENV NEXT_PUBLIC_SATELLITE_TILES_URL=${NEXT_PUBLIC_SATELLITE_TILES_URL}

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/shields ./packages/shields
COPY apps/api/package.json ./apps/api/
COPY apps/web ./apps/web

RUN npm ci && npm run build -w @hexa/web

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@hexa/web"]
