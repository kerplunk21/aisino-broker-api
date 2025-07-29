import { Pool } from "pg"
import CONFIG from "@/config/config";

export const pgPool = new Pool({
  host: CONFIG.PSQL_HOST,
  port: CONFIG.PSQL_PORT,
  database: CONFIG.PSQL_DATABASE,
  user: CONFIG.PSQL_USERNAME,
  password: CONFIG.PSQL_PASSWORD,
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  // ssl: {
  //   rejectUnauthorized: false, // For IBM Cloud self-signed certificates
  // },
});