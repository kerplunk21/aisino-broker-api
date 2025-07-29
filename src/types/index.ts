-import z from "zod";
import { AuthenticatePayloadSchema, CreateAuthPayloadSchema } from '@/schemas/auth';
import { Request, Response, NextFunction } from 'express';
import { AuthDataSchema } from "@/schemas/auth";
import { DeviceBindedListPayload, DeviceBindingPayload, DeviceDataSchema, DeviceFiltersSchema, DeviceUnBindingPayload } from "@/schemas/device";
import { CardTransactionSchema, CardTransactionWithTransactionSchema, PaymentCheckStatusPayloadSchema, PaymentTransactionPayloadSchema, QRPHTransactionDataSchema, QRPHTransactionWithTransactionSchema, TransactionDataSchema, TransactionFiltersSchema, TransactionSummarySchema, TransactionWithQRPHSchema } from "@/schemas/transaction";
import { CardSchemeSchema, ConfigureCapabilitiesRequestSchema, ConfigureTerminalRequestSchema, CVRequirementsSchema, EMVSchema, MerchantSchema, PaymentConfigSchema, TerminalCapabilitiesSchema, TerminalPropertiesSchema, TransactionLimitsSchema } from "@/schemas/terminal";
import { AIDListSchema, AIDSchema, CAPKSchema } from '@/schemas/paymentScheme';
import { TerminalSerialPayloadSchema } from '../schemas/terminal';


// Configuration Types
export interface Config {
  TDMURL: string;
  QR_TIMEOUT: number;
  QR_POLL_INTERVAL: number;
  MQTT_PORT: number;
  API_PORT: number;
  EXPECTED_CN: string | undefined;
  KEYSTORE_PASSPHRASE: string | undefined;
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_PASSWORD: string;
  REDIS_USERNAME: string;
  PSQL_HOST: string;
  PSQL_PORT: number;
  PSQL_DATABASE: string;
  PSQL_USERNAME: string;
  PSQL_PASSWORD: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

// API Request/Response Types
export interface QRRequest {
  refNum: string;
  totalAmount: string;
  serialNum: string;
  token: string;
  merchantId: string;
  terminalId: string;
  traceNo?: number;
  batchNo?: number;
  alphaCode?: string;
  paymentMethod?: number;
}

export interface QRSuccessRequest {
  approvalCode: string;
  transactionReferenceNumber?: string;
  paymentId?: string;
  requestReferenceNumber: string;
  pan?: string;
  paymentStatus?: string;
}

export interface AuthenticationBody {
  serialNo: string;
  brandName: string;
  tradeName: string;
}

export interface QRPHRequest {
  bank: string;
  batchNo: number;
  billAccountName: string;
  billAccountNumber: string;
  checkAccountName: string;
  checkAccountNumber: string;
  checkDate: string;
  checkNumber: string;
  currency: string;
  fee: string;
  merchantId: string;
  paymentMethod: number;
  terminalId: string;
  totalAmount: string;
  traceNo: number;
  transactionDateTime: string;
  transactionReferenceNumber: string;
}

export interface QRGenerationResponse {
  qrCodeBody?: string;
  paymentId?: string;
  statusCode?: number;
  code?: string;
  message?: string;
}

export interface StatusCheckResponse {
  paymentStatus?: "PAYMENT_PENDING" | "PAYMENT_SUCCESS" | "PAYMENT_FAILED";
  approvalCode?: string;
  requestReferenceNumber?: string;
  transactionReferenceNumber?: string;
  paymentId?: string;
  pan?: string;
  statusCode?: string;
  code?: string;
  message?: string;
}

// MQTT Types
export interface MQTTMessage {
  type: string;
  serial: string;
  data?: any;
}

export interface MQTTSubscription {
  clientId: string;
  payload: Buffer;
}

export interface MQTTMessageObject {
  client: string;
  message: string;
  messageJSON: any;
}

export interface AuthMessage {
  type: string;
  serialNum: string;
  brandName: string;
  tradeName: string;
}

export interface WorkingKeysMessage {
  authRes: string;
  terminalId: string;
}

// Utility Types
export interface MerchantConfigFields {
  [key: string]: string;
}

// Status Check Parameters
export interface StatusCheckParams {
  terminalId: string;
  rrn: string;
  paymentId: string;
  transactionId?: string;
}

// Express Extended Types
export interface TypedRequest<T = any> extends Request {
  body: T;
}

export interface TypedResponse<T = any> extends Response {
  json: (body: T) => TypedResponse<T>;
}

export type TypedRequestHandler<T = any, U = any> = (
  req: TypedRequest<T>,
  res: TypedResponse<U>,
  next: NextFunction
) => void | Promise<void>;

export interface QRPHPaymentStatusPayload {
  terminalId: string;
  rrn: string;
  paymentId: string;
}

export interface AcknowledgementQR {
  transactionId: string;
}


// ZOD Schema
export type AuthenticatePayload = z.infer<typeof AuthenticatePayloadSchema>
export type AuthenticationCreatePayload = z.infer<typeof CreateAuthPayloadSchema>
export type TransactionData = z.infer<typeof TransactionDataSchema>;
export type QRPHTransactionData = z.infer<typeof QRPHTransactionDataSchema>;
export type AuthData = z.infer<typeof AuthDataSchema>;
export type DeviceData = z.infer<typeof DeviceDataSchema>;
export type TransactionWithQRPH = z.infer<typeof TransactionWithQRPHSchema>;
export type QRPHTransactionWithTransaction = z.infer<typeof QRPHTransactionWithTransactionSchema>;
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;
export type DeviceFilters = z.infer<typeof DeviceFiltersSchema>;
export type TransactionSummary = z.infer<typeof TransactionSummarySchema>;
export type BindPosTerminalPayload = z.infer<typeof DeviceBindingPayload>;
export type UnBindPosTerminalPayload = z.infer<typeof DeviceUnBindingPayload>;
export type DeviceListPayload = z.infer<typeof DeviceBindedListPayload>;
export type PaymentTransactionPayload = z.infer<typeof PaymentTransactionPayloadSchema>;
export type PaymentTransactionCheckStatusPayload = z.infer<typeof PaymentCheckStatusPayloadSchema>

export type CardTransactionData = z.infer<typeof CardTransactionSchema>;
export type CardTransactionWithTransaction = z.infer<typeof CardTransactionWithTransactionSchema>;


// Helper type for paginated results
export type PaginatedResult<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};


// Terminal Configs Types
export type TerminalProperties = z.infer<typeof TerminalPropertiesSchema>;
export type Merchant = z.infer<typeof MerchantSchema>;
export type EMV = z.infer<typeof EMVSchema>;
export type CardScheme = z.infer<typeof CardSchemeSchema>;
export type ConfigureTerminalRequest = z.infer<typeof ConfigureTerminalRequestSchema>;
export type ConfigureCapabilitiesRequest = z.infer<typeof ConfigureCapabilitiesRequestSchema>;

// Terminal Capabilities
export type TerminalCapabilities = z.infer<typeof TerminalCapabilitiesSchema>
export type CVRequirements = z.infer<typeof CVRequirementsSchema>;
export type TransactionLimits = z.infer<typeof TransactionLimitsSchema>;


// Payment Schemes
export type AID = z.infer<typeof AIDSchema>
export type AIDList = z.infer<typeof AIDListSchema>
export type CAPK = z.infer<typeof CAPKSchema>
export type PaymentConfig = z.infer<typeof PaymentConfigSchema>
export type TerminalSerialPayload = z.infer<typeof TerminalSerialPayloadSchema>