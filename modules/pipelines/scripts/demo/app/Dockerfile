# The demo application the runner demo builds: a tiny HTTP service the local provider
# deploys, so a canary on a laptop has real requests to judge.
FROM node:22.17.1-alpine
WORKDIR /app
COPY server.mjs .
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
