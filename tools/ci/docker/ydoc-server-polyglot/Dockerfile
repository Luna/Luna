FROM ubuntu:latest

USER root

ARG LOG_LEVEL=info
ARG YDOC_SERVER_PORT=5976
ARG YDOC_SERVER_HOSTNAME=localhost
ARG YDOC_SERVER_LANGUAGE_SERVER_URL
ARG YDOC_SERVER_DEBUG=false

RUN useradd -u 2000 -c 'Enso Developer' -U -m ensodev

RUN mkdir /opt/ydoc-server-polyglot
RUN mkdir /opt/ydoc-server-polyglot/bin

COPY --from=native-image ydoc /opt/ydoc-server-polyglot/bin/

RUN chown -hR ensodev:ensodev /opt/ydoc-server-polyglot
RUN chmod -R u=rX,g=rX /opt/ydoc-server-polyglot
RUN chmod +x /opt/ydoc-server-polyglot/bin/ydoc

USER ensodev:ensodev

WORKDIR /opt/ydoc-server-polyglot

ENTRYPOINT [ "/opt/ydoc-server-polyglot/bin/ydoc" ]

ENV LOG_LEVEL=${LOG_LEVEL}
ENV PORT=${YDOC_SERVER_PORT}
ENV HOSTNAME=${YDOC_SERVER_HOSTNAME}
ENV LANGUAGE_SERVER_URL=${YDOC_SERVER_LANGUAGE_SERVER_URL}
ENV ENSO_YDOC_LS_DEBUG=${YDOC_SERVER_DEBUG}

EXPOSE ${PORT}
