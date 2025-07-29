
import { z } from 'zod';

export const TransactionLimitsSchema = z.object({
  contactless: z.number().min(0), // Maximum amount for tap-to-pay transactions without additional verification
  floorLimit: z.number().min(0), // Determines when any transaction needs online authorization
  maxAmount: z.number().min(0), // The smallest transaction value the terminal will accept
  minAmount: z.number().min(0).optional() //  The largest transaction value the terminal will accept
});

export const CVRequirementsSchema = z.object({
  offline_pin: z.boolean().default(false),
  online_pin: z.boolean().default(false),
  offline_signature: z.boolean().default(false),
  online_signature: z.boolean().default(false),
});

// Currency Schema
export const CurrencySchema = z.object({
  country: z.string(),
  symbol: z.string(),
  code: z.string(),
  countryCode: z.string(),
  numCode: z.string(),
  name: z.string()
});

// Terminal Properties Schema
export const TerminalPropertiesSchema = z.object({
  systemTraceAuditNumber: z.number(),
  posNumber: z.number(),
  storeNumber: z.string(),
  terminalPortNumber: z.string(),
  terminalIpAddress: z.string().ip().optional(),
  terminalMode: z.string(),
  terminalId: z.string(),
  batchId: z.number(),
  password: z.string(),
  merchantId: z.string(),
  batchLimit: z.number(),
  currency: z.string(),
  id: z.number(),
  storeAssociation: z.string(),
  batchNumber: z.number(),
  terminalMonitoring: z.string(),
  enableBalanceInquiry: z.number().min(0).max(1),
  emvContact: z.boolean(),
  autoSettlementTime: z.string(),
  enableVoid: z.number().min(0).max(1),
  terminalType: z.number(),
  printSaleReceipt: z.number().min(0).max(1),
  autoSettlement: z.number().min(0).max(1),
  terminalCapabilities: z.string(),
  enableCashout: z.number().min(0).max(1),
  isEnabled: z.number().min(0).max(1),
  enableRefund: z.number().min(0).max(1),
  terminalAddCapabilities: z.string(),
  enableSale: z.number().min(0).max(1)
});

// Merchant Schema
export const MerchantSchema = z.object({
  id: z.number(),
  merchantId: z.string(),
  merchantCode: z.string(),
  name: z.string(),
  companyName: z.string(),
  discountRate: z.number(),
  discountRateDebit: z.number(),
  maximumAmount: z.number(),
  minimumAmount: z.number(),
  serviceFee: z.number(),
  fixedFee: z.number(),
  bancnetFlatFee: z.number(),
  merchantCategoryCode: z.string(),
  enabled: z.boolean(),
  merchantIdList: z.array(z.object({
    merchantVerificationValue: z.string(),
    merchantId: z.string(),
    cardSchemeId: z.number()
  })),
  email: z.string().email(),
  mobileNumber: z.string(),
  city: z.string(),
  province: z.string(),
  country: z.object({
    code: z.string(),
    name: z.string(),
    currency: CurrencySchema
  })
});

// EMV Schema
export const EMVSchema = z.object({
  id: z.number(),
  emvId: z.number(),
  schemeReference: z.number(),
  issuerReference: z.number(),
  floorLimit: z.number(),
  contactlessCvmLimit: z.string(),
  tacDefault: z.string(),
  tacDenial: z.string(),
  tacOnline: z.string(),
  defaultTDOL: z.string(),
  defaultDDOL: z.string(),
  mcc: z.number()
});

// Card Scheme Schema
export const CardSchemeSchema = z.object({
  id: z.number(),
  cardSchemeId: z.number(),
  cardSchemeIndex: z.number(),
  rid: z.string(),
  acquirer: z.object({
    id: z.number(),
    acquirerId: z.number(),
    acquirerName: z.string(),
    acquirerCode: z.string(),
    visaKey: z.string(),
    postilionKey: z.string()
  })
});

// Terminal Capabilities Schema
// export const CVRequirementsSchema = z.object({
//   cvv1: z.boolean().optional(),
//   cvv2: z.boolean().optional(),
//   iCVV: z.boolean().optional(),
//   dCVV: z.boolean().optional(),
//   cvc1: z.boolean().optional(),
//   cvc2: z.boolean().optional(),
//   iCVC: z.boolean().optional(),
//   dCVC: z.boolean().optional()
// });

// export const TransactionLimitsSchema = z.object({
//   contactless: z.number().min(0), // Maximum amount for tap-to-pay transactions without additional verification
//   floorLimit: z.number().min(0), // Determines when any transaction needs online authorization
//   maxAmount: z.number().min(0), // The smallest transaction value the terminal will accept
//   minAmount: z.number().min(0).optional() //  The largest transaction value the terminal will accept
// });

// export const TerminalCapabilitiesSchema = z.object({
//   emvContact: z.boolean(),
//   terminalCapabilities: z.string(),
//   terminalAddCapabilities: z.string(),
//   cvRequirements: CVRequirementsSchema,
//   transactionLimits: TransactionLimitsSchema
// });

// Request Schemas
export const ConfigureTerminalRequestSchema = z.object({
  terminalId: z.string(),
  properties: TerminalPropertiesSchema,
  merchants: z.array(MerchantSchema),
  emvs: z.array(EMVSchema),
  cardSchemes: z.array(CardSchemeSchema)
});

export const ConfigureCapabilitiesRequestSchema = z.object({
  terminalId: z.string(),
  cardSchemes: z.array(z.enum(['qrph', 'visa', 'mastercard'])),
  cvRequirements: z.object({
    qrph: CVRequirementsSchema.optional(),
    visa: CVRequirementsSchema.optional(),
    mastercard: CVRequirementsSchema.optional()
  }).optional(),
  transactionLimits: z.object({
    qrph: TransactionLimitsSchema.optional(),
    visa: TransactionLimitsSchema.optional(),
    mastercard: TransactionLimitsSchema.optional()
  }).optional(),
});


export const TerminalCapabilitiesSchema = z.object({
  terminal_serial_no: z.string(),
  stan: z.number(),
  batch_no: z.number(),
  terminal_id: z.string(),
  merchant_id: z.string(),
  alpha_code: z.string(),
  magnetic_stripe_enabled: z.boolean().default(false),
  emv_contact_enabled: z.boolean().default(false),
  emv_contactless_enabled: z.boolean().default(false),
  qrph_enabled: z.boolean().default(false),
  payment_schemes: z.object({
    visa: z.object({
      enabled: z.boolean(),
      transaction_limits: TransactionLimitsSchema,
      cv_requirements: CVRequirementsSchema
    }),
    mastercard: z.object({
      enabled: z.boolean(),
      transaction_limits: TransactionLimitsSchema,
      cv_requirements: CVRequirementsSchema
    }),
    qrph: z.object({
      enabled: z.boolean(),
      transaction_limits: TransactionLimitsSchema
    })
  })
})










// Base Terminal Configuration Schema (shared by both Visa and Mastercard)
const BaseTerminalConfigSchema = z.object({
  merchantName: z.string().max(40).default("Apollotech"),
  merchantCategoryCode: z.string().length(4).default("0025"),
  merchantId: z.string().length(15).default("283982384289378"),
  terminalId: z.string().max(8),
  countryCode: z.string().length(3).default("608"),
  transactionCurrencyCode: z.string().length(3).default("608"),
  referenceCurrencyCode: z.string().length(3).default("608"),
  acquirerId: z.string().length(8).default("12345678"),
  referenceCurrencyExponent: z.number().int().min(0).max(255).default(2),
  referenceCurrencyConversion: z.number().int().default(1000),
  terminalType: z.number().int().min(0).max(255).default(0x22),
  transactionCurrencyExponent: z.number().int().min(0).max(255).default(2),
  transactionType: z.number().int().min(0).max(255).default(0x00)
});

// PayPass/PayWave Specific Configuration Schema
const ContactlessConfigSchema = z.object({
  cardDataInputCapability: z.number().int().min(0).max(255).default(0x08),
  securityCapability: z.number().int().min(0).max(255).default(0x08),
  exCapability: z.array(z.number().int().min(0).max(255)).length(5).default([0x08, 0x08, 0x08, 0x08, 0x08]),
  readBalanceBeforeGenAC: z.number().int().min(0).max(1).default(0),
  readBalanceAfterGenAC: z.number().int().min(0).max(1).default(0),
  balanceBeforeGenAC: z.array(z.number().int().min(0).max(255)).length(6).default([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]),
  balanceAfterGenAC: z.array(z.number().int().min(0).max(255)).length(6).default([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]),
  maxTornTransactionTime: z.array(z.number().int().min(0).max(255)).length(2).default([0x00, 0x00]),
  maxTornTransactionNumber: z.number().int().min(0).max(255).default(0),
  messageHoldTime: z.array(z.number().int().min(0).max(255)).length(3).default([0x00, 0x00, 0x13]),
  maxRRTGrace: z.array(z.number().int().min(0).max(255)).length(3).default([0x00, 0x32, 0x00]),
  minRRTGrace: z.array(z.number().int().min(0).max(255)).length(3).default([0x00, 0x14, 0x00]),
  rrtThresholdMobile: z.number().int().min(0).max(255).default(0x32),
  rrtThresholdAmount: z.array(z.number().int().min(0).max(255)).length(2).default([0x01, 0x2C]),
  expectedRRTCAPDU: z.array(z.number().int().min(0).max(255)).length(2).default([0x00, 0x12]),
  expectedRRTRAPDU: z.array(z.number().int().min(0).max(255)).length(2).default([0x00, 0x18]),
  merchantCustomData: z.array(z.number().int().min(0).max(255)).length(5).default([0x04, 0x11, 0x22, 0x33, 0x44]),
  transactionCategoryCode: z.number().int().min(0).max(255).default(0x01)
});

// Visa PayWave Specific Configuration
const VisaPayWaveConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cvmLimit: z.number().int().min(0).default(5000),
  floorLimit: z.number().int().min(0).default(5000),
  minimumAmount: z.number().int().min(0).default(15),
  maximumAmount: z.number().int().min(0).default(100000),
  ttq: z.string().length(8).default("3600C000"),
  checkBlacklist: z.boolean().default(true),
  drl: z.boolean().default(false),
  cashDrl: z.boolean().default(false),
  cashbackDrl: z.boolean().default(false),
  // Cardholder Authentication (CA) settings
  ca: z.object({
    ttq: z.string().length(8).default("3600C000"),
    zeroAmountCheck: z.boolean().default(false),
    zeroAmountCheckOption: z.number().int().min(0).max(255).default(0),
    cvmLimitCheck: z.boolean().default(false),
    floorLimitCheck: z.boolean().default(false),
    hasFloorLimit: z.boolean().default(false)
  }),
  // Consumer Bill Payment (CB) settings
  cb: z.object({
    ttq: z.string().length(8).default("3600C000"),
    statusCheck: z.boolean().default(true),
    zeroAmountCheck: z.boolean().default(true),
    zeroAmountCheckOption: z.number().int().min(0).max(255).default(0),
    transactionLimitCheck: z.boolean().default(true),
    cvmLimitCheck: z.boolean().default(true),
    floorLimitCheck: z.boolean().default(true),
    hasFloorLimit: z.boolean().default(true),
    transactionLimit: z.number().int().min(0).default(5000),
    cvmLimit: z.number().int().min(0).default(20000),
    floorLimit: z.number().int().min(0).default(2000)
  })
});

// Mastercard PayPass Specific Configuration
const MastercardPayPassConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cvmLimit: z.number().int().min(0).default(5000),
  floorLimit: z.number().int().min(0).default(5000),
  minimumAmount: z.number().int().min(0).default(15),
  maximumAmount: z.number().int().min(0).default(100000),
  // Data Elements configuration
  dataElements: z.object({
    hasDSVNTerm: z.boolean().default(true),
    hasDSACType: z.boolean().default(true),
    hasDSInputCard: z.boolean().default(true),
    hasDSInputTerm: z.boolean().default(true),
    hasDSODSInfo: z.boolean().default(true),
    hasDSODSInfoForReader: z.boolean().default(true),
    hasDSODSTerm: z.boolean().default(true)
  })
});

const QRPHConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minimumAmount: z.number().default(1),
  maximumAmount: z.number().default(50000)
})

// Combined Configuration Schema
export const PaymentConfigSchema = z.object({
  batch_no: z.number().default(1),
  stan: z.number().default(1),
  terminal_serial_no: z.string(),
  revision_id: z.string().optional(),
  terminalConfig: BaseTerminalConfigSchema.optional(),
  contactlessConfig: ContactlessConfigSchema.optional(),
  visa: VisaPayWaveConfigSchema.optional(),
  mastercard: MastercardPayPassConfigSchema.optional(),
  qrph: QRPHConfigSchema.optional()
});

export const TerminalSerialPayloadSchema = z.object({
  serial: z.string()
})