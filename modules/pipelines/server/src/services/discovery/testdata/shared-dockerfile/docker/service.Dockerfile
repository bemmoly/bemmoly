FROM oven/bun:1
ARG SERVICE
WORKDIR /repo
COPY package.json ./
COPY packages packages
COPY services/${SERVICE} services/${SERVICE}
RUN bun install
CMD ["bun", "run", "start"]
