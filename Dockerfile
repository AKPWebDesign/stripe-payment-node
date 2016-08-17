FROM mhart/alpine-node:6.3.1

COPY . /usr/src/pay

WORKDIR /usr/src/pay
RUN npm install

EXPOSE 8080

CMD [ "node", "/usr/src/pay/server.js" ]
