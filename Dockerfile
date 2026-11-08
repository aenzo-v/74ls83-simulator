FROM node:26-bookworm-slim

ARG LOCAL_UID=1000
ARG LOCAL_GID=1000

WORKDIR /app

# Directorios con permisos del usuario del host
RUN mkdir -p /app/node_modules /tmp/npm-cache \
    && chown -R ${LOCAL_UID}:${LOCAL_GID} \
       /app /tmp/npm-cache

ENV HOME=/tmp
ENV NPM_CONFIG_CACHE=/tmp/npm-cache

USER ${LOCAL_UID}:${LOCAL_GID}

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
