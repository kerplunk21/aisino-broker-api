import z, { optional, symbol } from "zod";

// DeviceData schema
export const DeviceDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pos_id: z.string(),
  payment_terminal_serial_no: z.string(),
  status: z.enum(['online', 'offline', 'maintenance']).optional(),
  last_transaction: z.date().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

// DeviceFilters schema
export const DeviceFiltersSchema = z.object({
  status: z.string().optional(),
  pos_id: z.string().optional(),
});


export const DeviceBindingPayload = z.object({
  name: z.string(),
  description: z.string(),
  pos_id: z.string(),
  payment_terminal_serial_no: z.string()
})

export const DeviceUnBindingPayload = z.object({
  pos_id: z.string(),
  payment_terminal_serial_no: z.string()
})

export const DeviceBindedListPayload = z.object({
  pos_id: z.string().optional(),
  payment_terminal_serial_no: z.string().optional()
})


export const DevicePaymentTerminalPropertiesSchema = z.object({
  systemTraceAuditNumber:  z.number(), // traceNo/stan
  posNumber: z.number().optional().nullable(),
  storeNumber: z.string().optional().nullable(),
  terminalPortNumber: z.string().optional().nullable(),
  terminalIpAddress: z.string().optional().nullable(),
  terminalMode: z.string().optional().nullable(),
  terminalId: z.string(),
  batchId: z.number().optional().nullable(),
  password: z.string().optional().nullable(),
  merchantId: z.string(),
  batchLimit: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  id: z.number().optional().nullable(),
  storeAssociation: z.string().optional().nullable(),
  batchNumber: z.number(),
  terminalMonitoring: z.string().optional().nullable(),
  enableBalanceInquiry: z.number().optional().nullable(),
  emvContact: z.boolean().optional().nullable(),
  autoSettlementTime: z.string().optional().nullable(),
  enableVoid: z.number().optional().nullable(),
  terminalType: z.number().optional().nullable(),
  printSaleReceipt: z.number().optional().nullable(),
  autoSettlement: z.number().optional().nullable(),
  terminalCapabilities: z.string().optional().nullable(),
  enableCashout: z.number().optional().nullable(),
  isEnabled: z.number().optional().nullable(),
  enableRefund:z.number().optional().nullable(),
  terminalAddCapabilities: z.string().optional().nullable(),
  enableSale: z.number().optional().nullable()
})

export const DevicePaymentTerminalCurrencySchema = z.object({
  country: z.string(),
  symbol: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  numCode: z.string().optional().nullable(),
  name: z.string()
})

export const DevicePaymentTerminalConfigSchema = z.object({
  stan: z.number(),
  batch_no: z.number(),
  terminal_id: z.string(),
  merchant_id: z.string(),
  alpha_code: z.string()
})


export const DeviceTerminalCapabilities = z.object({
  serial: z.string()
})