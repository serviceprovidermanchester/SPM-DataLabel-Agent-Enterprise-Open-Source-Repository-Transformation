# syntax=docker/dockerfile:1
FROM node:22-alpine

LABEL org.opencontainers.image.title="DataLabel"
LABEL org.opencontainers.image.description="Enterprise Annotation & Agreement Studio"
LABEL org.opencontainers.image.vendor="SPManchester Private Limited"
LABEL org.opencontainers.image.authors="Sayed Mudassar Akbar <info@spmanchester.com>"
LABEL org.opencontainers.image.url="https://www.spmanchester.com"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/datalabel.sqlite

# Create persistent storage folder
RUN mkdir -p /app/data && chown -R node:node /app

# Copy application source
COPY --chown=node:node package.json ./
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node web/ ./web/
COPY --chown=node:node database/ ./database/

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

CMD ["node", "backend/src/server.js"]
