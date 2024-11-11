# CI Tools

This folder contains miscellaneous utilities for CI.

# Docker

## Building

A custom docker image requires a certain number of directories to be present
from a desired _edition_. The root directory of the docker build context can be
provided in the `docker build` command:

```bash
docker build -t runtime:latest -f tools/ci/docker/engine/Dockerfile --build-context docker-tools=tools/ci/docker/enging built-distribution/enso-engine-0.0.0-dev-linux-amd64/enso-0.0.0-dev/
```

where for a locally built distribution on Linux it would be `VERSION=0.0.0-dev`.

## Running

To start Language Server with a default configuration simply run the built image
with the chosen name:

```bash
docker run -t <my-custom-name>
```

# Ydoc Docker

## Build Node.js container

To build a Node.js-based Ydoc, you need to first ensure that you have the
distributable sources:

```bash
pnpm -r compile
```

the resulting artifacts are located in `app/ydoc-server-nodejs/dist` directory.
Having the right Node.js sources in place, one can now build the docker image:

```bash
docker build -t ydoc-server-nodejs:latest -f tools/ci/docker/ydoc-server-nodejs/Dockerfile --build-context docker-tools=tools/ci/docker/ydoc-server-nodejs app/ydoc-server-nodejs
```

## Build Native Image container

Build the Native Image:

```bash
sbt ydoc-server/buildNativeImage
```

Build the Docker image:

```bash
docker build -t ydoc-server-polyglot:latest --build-context native-image=lib/java/ydoc-server/target/native-image tools/ci/docker/ydoc-server-polyglot
```

## Running

Both images `ydoc-server-nodejs` and `ydoc-server-polyglot` are started the same
way:

- PORT - the port number under which Ydoc will be available
- HOSTNAME - the hostname under which Ydoc will be available
- LANGUAGE_SERVER_URL - the full url (with port number) of the language server
  to connect to

```bash
docker run -it -e PORT=1234 -e HOSTNAME='0.0.0.0' -e LANGUAGE_SERVER_URL=ws://localhost:59876 ydoc-server-nodejs:latest
```

When correctly setup the network layer one can also hit Ydoc's healthcheck
endpoint:

```bash
> curl http://${HOSTNAME}:${PORT}/_health
OK
```
