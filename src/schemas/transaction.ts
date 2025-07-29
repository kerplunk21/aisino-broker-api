import { z } from 'zod';

// TransactionData schema
export const TransactionDataSchema = z.object({
  id: z.string(),
  reference_id: z.string(),
  pos_id: z.string(),
  status: z.enum(['created', 'published', 'terminal_ack', 'pending', 'completed', 'failed', 'cancelled']).default('created'),
  amount: z.number(),
  merchant_id: z.string(),
  terminal_id: z.string(),
  terminal_serial_no: z.string(),
  alpha_code: z.string().default("PHP"),
  payment_type: z.enum(['QRPH', 'CARD']).optional(),
  payconnect_payment_id: z.string().optional().nullable(),
  payconnect_reference_no: z.string().optional().nullable(),
  payconnect_approval_code: z.string().optional().nullable(),
  payconnect_pan: z.string().optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  expires_at: z.date().optional(),
});

// QRPHTransactionData schema
export const QRPHTransactionDataSchema = z.object({
  id: z.string(),
  transaction_id: z.string(),
  qrph_string: z.string().nullable().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('pending'),
  amount: z.number(),
  ref_num: z.string(),
  trace_no: z.number(),
  batch_no: z.number(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  expires_at: z.date().optional(),
});

// TransactionWithQRPH schema
export const TransactionWithQRPHSchema = TransactionDataSchema.extend({
  qrph_transactions: z.array(QRPHTransactionDataSchema).optional(),
});

// QRPHTransactionWithTransaction schema
export const QRPHTransactionWithTransactionSchema = QRPHTransactionDataSchema.extend({
  transaction: TransactionDataSchema.optional(),
  transaction_status: z.string().optional(),
});

// TransactionFilters schema
export const TransactionFiltersSchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  status: z.string().optional(),
  merchant_id: z.string().optional(),
  payment_type: z.string().optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['ASC', 'DESC']).optional(),
});

// TransactionSummary schema
export const TransactionSummarySchema = z.object({
  total_transactions: z.string(),
  total_amount: z.string(),
  completed_transactions: z.string(),
  pending_transactions: z.string(),
  failed_transactions: z.string(),
});

// PaginatedResult schema (generic)
export const PaginatedResultSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });

export const PaymentTransactionPayloadSchema = z.object({
  reference_id: z.string(),
  pos_id: z.string(),
  amount: z.number(),
  payment_type: z.enum(['QRPH', 'CARD'])
})

export const PaymentCheckStatusPayloadSchema = z.object({
  payment_reference_no: z.string(),
  payment_id: z.string(),
  pos_id: z.string()
})

export const PaymentFakeSuccessPayloadSchema = z.object({
  transaction_id: z.string()
})

export const CardTransactionSchema = z.object({
  transaction_id: z.string(),
  amount: z.number(),
  ref_num: z.string(),
  trace_no: z.number(),
  batch_no: z.number(),
  masked_pan: z.string().nullable().default(null),
  card_type: z.string().nullable().default(null),
  currency: z.string().nullable().default(null),
  entry_mode: z.string().nullable().default(null),// z.literal["CONTACTLESS", "CONTACT", "MAGSTRIPE"],
  merchant_id: z.string(),
  issuer_bank: z.string().nullable().default(null),
  emv_tags: z.string().nullable().default(null),
});


// CardTransactionWithTransaction schema
export const CardTransactionWithTransactionSchema = TransactionDataSchema.extend({
  transaction: TransactionDataSchema.optional(),
  transaction_status: z.string().optional(),
});

