# path: GroppiSite/dev/Dockerfile

FROM node:latest
RUN mkdir -p /srv/app
WORKDIR /srv/app

RUN npm install -g nodemon

CMD ["sh", "-c", "npm install && nodemon --watch /srv/app -e js server.js"]