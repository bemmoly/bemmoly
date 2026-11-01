FROM golang:1.25
ARG APP
WORKDIR /src
COPY . .
RUN make build-$APP
