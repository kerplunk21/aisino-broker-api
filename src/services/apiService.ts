import axios, { AxiosResponse } from "axios";
import fs from 'fs';
import path from 'path';
import decompress from "decompress";
import https from "https";
import CONFIG from '@/config/config';
import { Utils } from '@/utils/utils';
import {
  AuthenticationBody,
  QRRequest,
  QRPHRequest,
  QRGenerationResponse,
  StatusCheckParams,
  StatusCheckResponse
} from '@/types';
import redisService from "./redisService";
import { DevicePaymentTerminalConfigSchema, DevicePaymentTerminalCurrencySchema, DevicePaymentTerminalPropertiesSchema } from "@/schemas/device";
const crypto = require('crypto');

interface RedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
}

interface CONFIG {
  TDMURL: string;
}

class TokenEncryption {
  private readonly encryptionKey: string;
  private readonly algorithm: string = 'aes-256-cbc';

  constructor() {
    this.encryptionKey = "e67cc54933222625e596c0f4fe7b7c13899f149af63d1057d2970b29e3e41589";
  }

   // Encrypt token before storing in Redis
  public encrypt(token: string): string {
    try {
      const key = Buffer.from(this.encryptionKey, 'hex');
      const iv = crypto.randomBytes(16); // Always generate a new IV per encryption
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return IV + encrypted data (needed for decryption)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Token encryption failed:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  // Decrypt token when retrieving from Redis
  public decrypt(encryptedToken: string): string {
    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const key = Buffer.from(this.encryptionKey, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Token decryption failed:', error);
      throw new Error('Failed to decrypt token');
    }
  }

}

// HTTPS Agent for API calls
const httpsAgent = new https.Agent({
  cert: fs.readFileSync(path.join(__dirname, '../../certs/cert.pem')),
  rejectUnauthorized: false, // Set to true for production
});

const tokenEncryption = new TokenEncryption();
export class APIService {

  static async fetchAuth(authenticationBody: AuthenticationBody): Promise<string | undefined> {
    try {
      console.log("Payconnect: ",`${CONFIG.TDMURL}/terminalQR/authenticate`)
      const cachedToken = await redisService.get(authenticationBody.serialNo)
      if (cachedToken) {
        return tokenEncryption.decrypt(cachedToken)
        //return cachedToken
      }
      const response: AxiosResponse = await axios.post(
        `${CONFIG.TDMURL}/terminalQR/authenticate`,
        authenticationBody,
        {
          headers: { "Content-Type": "application/json" },
          httpsAgent
        }
      );
      const token = response?.data?.token || response?.data;
      const ttl = 1*60*60 //1Hour Lifespan
      // prod
      await redisService.set(authenticationBody.serialNo, tokenEncryption.encrypt(token), ttl)
      //await redisService.set(authenticationBody.serialNo, token, ttl)

      // fetch terminal configs
      const configs = await APIService.fetchConfig(token, authenticationBody.serialNo, "properties")
      const parsedConfigs = DevicePaymentTerminalPropertiesSchema.safeParse(configs)
      if (parsedConfigs.error) {
        console.log("Error in fetching terminal config ",parsedConfigs.error.issues)
      }
      else {
        const parsedCurrency = DevicePaymentTerminalCurrencySchema.parse(JSON.parse(parsedConfigs.data.currency || ""))
        const terminalConfig = DevicePaymentTerminalConfigSchema.parse({
          stan: parsedConfigs.data.autoSettlement,
          batch_no: parsedConfigs.data.batchNumber,
          terminal_id: parsedConfigs.data.terminalId,
          merchant_id: parsedConfigs.data.merchantId,
          alpha_code: parsedCurrency.code
        })
        const terminalConfigKey = `xterminal:${authenticationBody.serialNo}`
        await redisService.hmset(terminalConfigKey, terminalConfig)
      }
      console.log("properties configs: ",)

      return token;
    } catch (error: any) {
      console.log("Error during authentication:", error?.response?.data);
      return error?.response?.data || { statusCode: 500, message: "Authentication failed" };
    }
  }

  static async submitQR(messageJSON: QRRequest): Promise<QRGenerationResponse> {

    console.log(messageJSON)
    const qrphRequest: QRPHRequest = {
      bank: "",
      batchNo: messageJSON.batchNo || 0,
      billAccountName: "SAMBRANO, MARK ERVIN C.",
      billAccountNumber: "0000056772",
      checkAccountName: "",
      checkAccountNumber: "",
      checkDate: "",
      checkNumber: "",
      currency: messageJSON.alphaCode || "PHP",
      fee: "0.00",
      merchantId: messageJSON.merchantId,
      paymentMethod: messageJSON.paymentMethod || 1,
      terminalId: messageJSON.terminalId,
      totalAmount: messageJSON.totalAmount,
      traceNo: messageJSON.traceNo!,
      transactionDateTime: Utils.transactionDateTime(),
      transactionReferenceNumber: messageJSON.refNum
    };

    const headers = {
      "Content-Type": "application/json",
      snid: messageJSON.serialNum,
      "Authorization": `Bearer ${messageJSON.token}`,
    };

    try {
      const response: AxiosResponse<QRGenerationResponse> = await axios.post(
        `${CONFIG.TDMURL}/payment/qr/generate`,
        qrphRequest,
        { headers, httpsAgent }
      );
      console.log("QR Generation success:", response.data);
      return response.data;
    } catch (error: any) {
      console.log("QR Generation error:", error?.response?.data);
      if (error?.response?.data?.code === 200013) {
        console.log("reauthenticate");
        //TODO Reauth function
      }
      return error?.response?.data || { statusCode: 500, message: "QR generation failed" };
    }
  }

  static async checkStatus(
    params: StatusCheckParams,
    token: string,
    snid: string
  ): Promise<StatusCheckResponse> {
    console.log("--check-status--");
    const { terminalId, rrn, paymentId } = params;
    console.log("params: ",params)

    const headers = {
      "Content-Type": "application/json",
      snid: snid,
      "Authorization": `Bearer ${token}`,
    };

    try {
      const response: AxiosResponse<StatusCheckResponse> = await axios.get(
        `${CONFIG.TDMURL}/payment/qr/${paymentId}/${rrn}/${terminalId}`,
        { headers, httpsAgent }
      );
      return response.data;
    } catch (error: any) {
      console.log("Status check error:", error?.response?.data);
      return error?.response?.data || { statusCode: "500", message: "Status check failed" };
    }
  }

  static async getKeys(token: string, terminalId: string): Promise<AxiosResponse|null> {
    try {
      const response: AxiosResponse = await axios.post(
        `${CONFIG.TDMURL}/terminalQR/getKeys`,
        { terminalId },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          httpsAgent
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(`Error getting keys: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
      return null;
    }
  }

  static async fetchConfig(token: string, snid: string, fileName: string, updateFlag: boolean=false): Promise<any> {
    console.log("::fetchConfig::");

    try {
      const response: AxiosResponse = await axios.get(
        `${CONFIG.TDMURL}/terminalQR/configuration/${snid}`,
        {
          headers: {
            "Content-Type": "application/json",
            snid: snid,
            "Authorization": `Bearer ${token}`,
          },
          httpsAgent
        }
      );

      console.log("response ",response)

      if (response.data && response.data.data) {
        const base64data: string = response.data.data;
        const zipBuffer = Buffer.from(base64data, 'base64');
        const outputFile = `${snid}.zip`;
        const outputFolder = path.join(`devices/${snid}`);

        if (!fs.existsSync(outputFolder)) {
          fs.mkdirSync(outputFolder, { recursive: true });
        }

        fs.writeFileSync(outputFile, zipBuffer);
        await decompress(outputFile, outputFolder);

        if (updateFlag) {
          return outputFolder
        }
        const fileContent = fs.readFileSync(`${outputFolder}/${fileName}.json`, "utf8");
        return JSON.parse(fileContent);
      }
      return null;
    } catch (error: any) {
      console.log("Config fetch error:", error?.response?.data);
      return error?.response?.data || { statusCode: 500, message: "Config fetch failed" };
    }
  }
}