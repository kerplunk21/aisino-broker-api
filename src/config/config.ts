import dotenv from 'dotenv';
import { Config } from '@/types';

dotenv.config();

const CONFIG: Config = {
  TDMURL: process.env['TDMURL']!,
  QR_TIMEOUT: 120000, // ms
  QR_POLL_INTERVAL: 5000,
  MQTT_PORT: 8883,
  API_PORT: 3000,
  EXPECTED_CN: process.env['CN'],
  KEYSTORE_PASSPHRASE: process.env['KEYSTORE_PASSPHRASE'],
  REDIS_HOST: process.env['REDIS_HOST']!,
  REDIS_PORT: process.env['REDIS_PORT']!,
  REDIS_PASSWORD: process.env['REDIS_PASSWORD']!,
  REDIS_USERNAME: process.env['REDIS_USERNAME']!,
  PSQL_HOST: process.env['PSQL_HOST']!,
  PSQL_PORT: parseInt(process.env['PSQL_PORT']!),
  PSQL_DATABASE: process.env['PSQL_DATABASE']!,
  PSQL_USERNAME: process.env['PSQL_USERNAME']!,
  PSQL_PASSWORD: process.env['PSQL_PASSWORD']!,
  JWT_SECRET: process.env['JWT_SECRET']!,
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN']!,
  VERSION: process.env["VERSION"]!,
  BRAND_NAME: process.env["BRAND_NAME"]!,
  TRADE_NAME: process.env["TRADE_NAME"]!
};

export default CONFIG;