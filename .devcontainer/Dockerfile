FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g typescript ts-node nodemon prisma

ARG USERNAME=node
USER $USERNAME

WORKDIR /workspace
