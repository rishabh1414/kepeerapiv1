FROM node:20-alpine

# Install Python and bash
RUN apk add --no-cache python3 py3-pip bash curl

WORKDIR /app

COPY keeper-service/requirements.txt /app/keeper-service/requirements.txt
RUN pip3 install --break-system-packages -r /app/keeper-service/requirements.txt

COPY node-api /app/node-api
WORKDIR /app/node-api
RUN npm install

WORKDIR /app
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
