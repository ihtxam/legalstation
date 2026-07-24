# Cursor Cloud Agent base image for LexFlow
# Paths in environment.json are relative to `.cursor/`.
# Do not COPY the project — Cursor checks out the commit into the workspace.

FROM node:22-bookworm

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    mariadb-server \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Allow the default node user passwordless sudo (Cursor tooling / service start)
RUN echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

RUN corepack enable \
    && corepack prepare pnpm@10.4.1 --activate

# MariaDB listens on localhost for app + drizzle-kit
RUN mkdir -p /var/run/mysqld \
    && chown -R mysql:mysql /var/run/mysqld /var/lib/mysql \
    && sed -i 's/^bind-address.*/bind-address = 127.0.0.1/' /etc/mysql/mariadb.conf.d/50-server.cnf \
    || true

USER node
WORKDIR /workspace
