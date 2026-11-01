FROM node:24-slim
ARG SERVICE
WORKDIR /repo
COPY package.json ./
COPY packages packages
COPY services/${SERVICE} services/${SERVICE}
RUN npm install --omit=dev
CMD ["npm", "start", "--workspace", "services/${SERVICE}"]
