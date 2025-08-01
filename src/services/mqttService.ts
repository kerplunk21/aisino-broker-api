import aedes, { Aedes, Client, PublishPacket } from 'aedes';
import fs from 'fs';
import path from 'path';
import CONFIG from '@/config/config';
import { MQTTMessage } from '@/types';

// SSL Configuration
const sslOptions = {
  port: CONFIG.MQTT_PORT,
  protocol: 'mqtts',
  pfx: fs.readFileSync(path.join(__dirname, '../../certs/keystore.p12')),
  passphrase: CONFIG.KEYSTORE_PASSPHRASE,
  rejectUnauthorized: true
};

export class MQTTService {
  private aedes: Aedes;

  constructor() {
    this.aedes = new aedes();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.aedes.on('publish', (packet: PublishPacket, client: Client | null) => {
      // Optional: Log incoming messages
    });

    this.aedes.on('client', async (client: Client) => {
      console.log(`Client connected: ${client.id}`);
    });

    this.aedes.on('clientDisconnect', (client: Client) => {
      console.log(`Client disconnected: ${client.id}`);
    });
  }

  publish(topic: string, payload: MQTTMessage | any, callback?: (err?: Error) => void): void {
    this.aedes.publish(
      {
        topic,
        retain: false,
        qos: 0,
        payload: Buffer.from(JSON.stringify(payload))
      },
      callback || ((err?: Error) => {
        if (err) {
          console.error(`Failed to publish to ${topic}:`, err.message);
        } else {
          console.log(`Message published to ${topic} successfully`);
        }
      })
    );
  }

  sendError(message: any): void {
    this.publish('RES_ERROR', message);
  }

  sendAuthResponse(token: string, serial: string): void {
    const response: MQTTMessage = {
      type: "auth-response",
      serial: "",
      data: { jwtToken: token }
    };
    this.publish(serial, response);
  }

  sendQRPending(data: any): void {
    const response: MQTTMessage = {
      type: "qr-pending",
      serial: data.serial_no,
      data: {
        transactionId: data.transaction_id,
        paymentMethod: data.type,
        refnum: data.refNum,
        amount: data.totalAmount,
        qrph_string: data.qrph_string
      }
    };
    console.log("*******************************")
    console.log(response)
    console.log("*******************************")
    this.publish(data.serial_no, response);
  }

  sendQRSuccess(data: { approvalCode: string; refnum: string; serial: string; }): void {
    const response: MQTTMessage = {
      serial: data.serial,
      type: "qr-success",
      data: {
        approvalCode: data.approvalCode,
        refnum: data.refnum
      }
    };
    this.publish(data.serial, response);
  }

  sendCardPending(data: any): void {
    const response: MQTTMessage = {
      type: "card-pending",
      serial: data.serial_no,
      data: {
        transactionId: data.transaction_id,
        paymentMethod: data.type,
        refnum: data.refNum,
        amount: data.totalAmount
      }
    };
    console.log("*******************************")
    console.log(response)
    console.log("*******************************")
    this.publish('CARD_PENDING', response);
  }

  subscribe(topic: string, handler: (sub: any, cli: any) => void): void {
    this.aedes.subscribe(topic, handler);
  }

  getAedes(): Aedes {
    return this.aedes;
  }
  
}

const mqttService = new MQTTService();
export default mqttService;