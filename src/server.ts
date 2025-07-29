import { Server } from 'net';
import app from './app';
import mqttService from '@/services/mqttService';
import { setupMQTTHandlers } from '@/handlers/mqttHandlers';
import CONFIG from '@/config/config';
import { createServer } from 'tls'; // FOR PRODUCTION SECURE MQTT

// Setup MQTT handlers
setupMQTTHandlers();

// Server Setup
const server: Server = new Server(mqttService.getAedes().handle);

// Start MQTT Server
server.listen(CONFIG.MQTT_PORT, () => {
  console.log(`MQTT broker server is listening on port ${CONFIG.MQTT_PORT}`);
});

// Start API Server
app.listen(CONFIG.API_PORT, () => {
  console.log(`API server is listening on port ${CONFIG.API_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  server.close(() => {
    console.log('MQTT server closed.');
    process.exit(0);
  });
});

export { app, server };