FROM node:24-slim

WORKDIR /usr/src/app

# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Build arguments and environment variables
ARG TDMURL
ARG KEYSTORE_PASSPHRASE
ARG CN
ARG REDIS_HOST
ARG REDIS_PORT
ARG REDIS_PASSWORD
ARG REDIS_USERNAME
ARG PSQL_HOST
ARG PSQL_PORT
ARG PSQL_DATABASE
ARG PSQL_USERNAME
ARG PSQL_PASSWORD
ARG JWT_SECRET
ARG JWT_EXPIRES_IN

ENV TDMURL="https://sbx-switch-be.payconnect.io"
ENV KEYSTORE_PASSPHRASE="f4sTsW1tcH@uyu&.*"
ENV CN=".payconnect.io"
ENV REDIS_HOST="localhost"
ENV REDIS_PORT="6379"
ENV REDIS_PASSWORD="br3w3d888"
ENV REDIS_USERNAME="brokerapi"
ENV PSQL_HOST="localhost"
ENV PSQL_PORT="5432"
ENV PSQL_DATABASE="broker_api_db"
ENV PSQL_USERNAME="brokerapi"
ENV PSQL_PASSWORD="br3w3d888"
ENV JWT_SECRET="s3cretUngm4luPeetPwed3PabuLoong"
ENV JWT_EXPIRES_IN="24h"
ENV NODE_ENV=production

# Create .env file with all environment variables
RUN echo "TDMURL=$TDMURL" >> /usr/src/app/.env && \
    echo "KEYSTORE_PASSPHRASE=$KEYSTORE_PASSPHRASE" >> /usr/src/app/.env && \
    echo "CN=$CN" >> /usr/src/app/.env && \
    echo "REDIS_HOST=$REDIS_HOST" >> /usr/src/app/.env && \
    echo "REDIS_PORT=$REDIS_PORT" >> /usr/src/app/.env && \
    echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> /usr/src/app/.env && \
    echo "REDIS_USERNAME=$REDIS_USERNAME" >> /usr/src/app/.env && \
    echo "PSQL_HOST=$PSQL_HOST" >> /usr/src/app/.env && \
    echo "PSQL_PORT=$PSQL_PORT" >> /usr/src/app/.env && \
    echo "PSQL_DATABASE=$PSQL_DATABASE" >> /usr/src/app/.env && \
    echo "PSQL_USERNAME=$PSQL_USERNAME" >> /usr/src/app/.env && \
    echo "PSQL_PASSWORD=$PSQL_PASSWORD" >> /usr/src/app/.env && \
    echo "JWT_SECRET=$JWT_SECRET" >> /usr/src/app/.env && \
    echo "JWT_EXPIRES_IN=$JWT_EXPIRES_IN" >> /usr/src/app/.env

# Copy source code
COPY . .

# Copy SSL certificates
COPY certs/fullchain.pem /etc/ssl/certs/fullchain.pem
COPY certs/privkey.pem /etc/ssl/certs/privkey.pem
COPY certs/keystore.p12 /etc/ssl/certs/keystore.p12

# Install TypeScript and nodemon globally
RUN npm install -g ts-node typescript nodemon

# # Build the application
# RUN npm run build

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nodejs

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose both API and MQTT ports
EXPOSE 3000 8883

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]