FROM node:20-alpine

# Install Python and bash
RUN apk add --no-cache python3 py3-pip bash curl

# Install Keeper Commander
RUN pip3 install keepercommander --break-system-packages

# Set working directory
WORKDIR /app

# Copy Keeper config (persistent login token)
COPY keeper-service/keeper-config.json /root/.keeper/config.json

# Install Node dependencies
COPY node-api/package*.json ./
RUN npm install

# Copy Node source
COPY node-api/src ./src

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000

CMD ["./start.sh"]
