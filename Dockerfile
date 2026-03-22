FROM oven/bun:1-slim

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY config.json ./config.json
COPY README.md ./README.md
COPY CHANGELOG.md ./CHANGELOG.md

RUN chmod +x /app/src/main.js /app/src/admin.js /app/src/admin/cli.js \
    && ln -sf /app/src/main.js /usr/local/bin/linkedin-mcp \
    && ln -sf /app/src/admin.js /usr/local/bin/linkedin-admin

ENV NODE_ENV=production
ENV LINKEDIN_STATE_DIR=/data/state
ENV LINKEDIN_MCP_HTTP_HOST=0.0.0.0
ENV LINKEDIN_MCP_HTTP_PORT=8095
ENV LINKEDIN_MCP_HTTP_PATH=/mcp

VOLUME ["/data"]

EXPOSE 8095

CMD ["bun", "src/main.js", "serve-http"]
