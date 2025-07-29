import { Router } from 'express';
import { validatePayloadSchema} from '@/middleware/validation';
import { AuthController } from '@/controllers/authController';
import { AuthenticatePayloadSchema, CreateAuthPayloadSchema } from '@/schemas/auth';
import { authenticateToken } from '@/middleware/jwt';
import { DeviceBindedListPayload, DeviceBindingPayload, DeviceUnBindingPayload } from '@/schemas/device';
import { DeviceController } from '@/controllers/deviceController';
import { PaymentCheckStatusPayloadSchema, PaymentFakeSuccessPayloadSchema, PaymentTransactionPayloadSchema } from '@/schemas/transaction';
import { TransactionController } from '@/controllers/transactionController';
import { TerminalController } from '@/controllers/terminalController';
import { PaymentConfigSchema, TerminalSerialPayloadSchema } from '@/schemas/terminal';

const router = Router();

// Secure Route
router.use('/device', authenticateToken)
router.use('/transaction', authenticateToken)

//Authentication
router.post('/auth', validatePayloadSchema(CreateAuthPayloadSchema), AuthController.createAuth)
router.post('/authenticate', validatePayloadSchema(AuthenticatePayloadSchema), AuthController.authenticate)

//Binding Pos
router.post('/device/bind', validatePayloadSchema(DeviceBindingPayload), DeviceController.bindPosAndTerminal)
router.post('/device/unbind', validatePayloadSchema(DeviceUnBindingPayload), DeviceController.unbindPosAndTerminal)
router.post('/device/list', validatePayloadSchema(DeviceBindedListPayload), DeviceController.getBindedDevices)

//Transactions
router.post('/transaction/payment-request', validatePayloadSchema(PaymentTransactionPayloadSchema), TransactionController.processPayment)
router.post('/transaction/payment-status', validatePayloadSchema(PaymentCheckStatusPayloadSchema), TransactionController.checkPaymentStatus)
router.post('/transaction/payment-fake-success', validatePayloadSchema(PaymentFakeSuccessPayloadSchema), TransactionController.fakeSuccessPayment)


// Terminal
router.post('/device/terminal-payment-configuration', validatePayloadSchema(PaymentConfigSchema), TerminalController.updateTerminalConfiguration)
router.post('/device/get-payment-configuration', validatePayloadSchema(TerminalSerialPayloadSchema), TerminalController.getTerminalConfig)

export default router;