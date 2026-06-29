# path: GroppiSite/Dockerfile

FROM node:latest
RUN mkdir -p /srv/app
WORKDIR /srv/app

COPY ./app/package.json /srv/app/package.json
RUN npm install

COPY ./app /srv/app

# frontend statico, servito da Express (vedi FRONTEND_DIR in server.js: ../frontend)
COPY ./frontend /srv/frontend

CMD ["node", "server.js"]