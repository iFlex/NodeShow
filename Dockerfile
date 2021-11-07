FROM node:17

COPY ./client/* /root/nodeshow/client/
COPY ./server/* /root/nodeshow/server/

WORKDIR /root/nodeshow/server
RUN npm install

VOLUME ["/var/nodeshow/prezzos", "/var/nodeshow/users", "/var/log/nodeshow"]
EXPOSE 80 443 8080

ENV PORT=8080
ENV NODE_SHOW_CLIENT_HOME=/root/nodeshow/client
ENV USER_STORAGE_HOME=/var/nodeshow/users
ENV PREZZO_STORAGE_HOME=/var/nodeshow/prezzos

ENTRYPOINT ["nodejs", "/root/nodeshow/server/server.js"]