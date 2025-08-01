import bcrypt from 'bcrypt';
import { APIService } from '@/services/apiService';
import mqttService from '@/services/mqttService';
import { Utils } from '@/utils/utils';
import {
  MQTTMessageObject,
  AuthMessage,
  WorkingKeysMessage,
  AcknowledgementQR,
  QRRequest,
  MQTTMessage
} from '@/types';
import { Transaction } from '@/models/transaction';
import pollingService from '@/services/pollingService';
import redisService from '@/services/redisService';
import { QRPHTransactionDataSchema, TransactionDataSchema } from '@/schemas/transaction';
import { QRPHTransaction } from '@/models/qrphtransaction';
import transactionMonitorService from '@/services/transactionMonitorService';
import { PaymentConfigSchema } from '@/schemas/terminal';
import { TerminalController } from '@/controllers/terminalController';
import { keepAliveService } from '@/services/keepAliveService';

export const setupMQTTHandlers = (): void => {
  // Authentication handler
  mqttService.subscribe('QPRO_AUTH', async (sub: any, cli: any) => {
    const messageObject: MQTTMessageObject = {
      client: sub.clientId,
      message: sub.payload.toString(),
      messageJSON: Utils.parseMessage(sub.payload)
    };

    console.log("Message Event: AUTH", messageObject);

    if (messageObject.messageJSON?.type === "GET_AUTH") {
      const { serialNum, brandName, tradeName }: AuthMessage = messageObject.messageJSON;
      const hashTradeName = bcrypt.hashSync(tradeName, bcrypt.genSaltSync(12));
      const hashBrandName = bcrypt.hashSync(brandName, bcrypt.genSaltSync(12));

      const authenticationBody = {
        serialNo: serialNum,
        brandName: hashBrandName,
        tradeName: hashTradeName
      };

      const authRes = await APIService.fetchAuth(authenticationBody);
      console.log("authRes: ",authRes)

      if (!authRes) {
        mqttService.sendError(authRes);
      } else {
        mqttService.sendAuthResponse(authRes as string, serialNum);

        // also send the terminal capabilities configs
        const terminalConfigKey = `${TerminalController.terminalConfigHKey}:${serialNum}`
        const { success, data: terminalCapabilities } = PaymentConfigSchema.safeParse(await redisService.hgetall(terminalConfigKey));
        if (success) {
          setTimeout(()=>{
            const TerminalConfigRevision: MQTTMessage = {
              type: "terminal-revision-check",
              serial: serialNum,
              data: {
                revisionId: terminalCapabilities.revision_id,
                serial: serialNum
              }
            }
            mqttService.publish(serialNum, TerminalConfigRevision);
          }, 2000)

          // Start keep alive for the terminal
          const terminalId = terminalCapabilities.terminalConfig?.terminalId!
          try {
            console.log(`Starting keep alive for terminal: ${terminalId} (serial: ${serialNum})`);
            keepAliveService.stopPeriodicKeepAlive();
            keepAliveService.startPeriodicKeepAlive(terminalId, 30000)
          } catch (keepAliveError) {
            console.error(`Failed to start keep alive for terminal ${terminalId}:`, keepAliveError);
          }
        }
      }
      return;
    }
  });

    // TERMINAL_CONFIG_FETCH
  mqttService.subscribe("TERMINAL_CONFIG_FETCH", async (sub: any, cli: any) => {
    console.log("MESSAGE EVENT: PAYMENT_REVERSAL KEYS");

    const messageObject: MQTTMessageObject = {
      client: sub.clientId,
      message: sub.payload.toString(),
      messageJSON: Utils.parseMessage(sub.payload)
    };

    const { serialNum }: AuthMessage = messageObject.messageJSON;
    console.log(">>>>> ",messageObject.messageJSON);

    const terminalConfigKey = `${TerminalController.terminalConfigHKey}:${serialNum}`
    const { success, data: terminalCapabilities } = PaymentConfigSchema.safeParse(await redisService.hgetall(terminalConfigKey));
    console.log("capa: ",terminalCapabilities);
    if (success) {
      const TerminalConfig: MQTTMessage = {
        type: "terminal-config-update",
        serial: serialNum,
        data: terminalCapabilities
      }
      mqttService.publish(serialNum, TerminalConfig);
    }
  });

  // Working keys handler
  mqttService.subscribe("WORKING_KEYS", async (sub: any, cli: any) => {
    console.log("MESSAGE EVENT: WORKING KEYS");

    const messageObject: MQTTMessageObject = {
      client: sub.clientId,
      message: sub.payload.toString(),
      messageJSON: Utils.parseMessage(sub.payload)
    };

    const { authRes, terminalId }: WorkingKeysMessage = messageObject.messageJSON;
    const workingKeysRes = await APIService.getKeys(authRes, terminalId);

    mqttService.publish("WKEY_RESPONSE", workingKeysRes);
  });

  // Payment Reversal
  mqttService.subscribe("PAYMENT_REVERSAL", async (sub: any, cli: any) => {
    console.log("MESSAGE EVENT: PAYMENT_REVERSAL KEYS");

    const messageObject: MQTTMessageObject = {
      client: sub.clientId,
      message: sub.payload.toString(),
      messageJSON: Utils.parseMessage(sub.payload)
    };

    const { authRes, terminalId }: WorkingKeysMessage = messageObject.messageJSON;
    const workingKeysRes = await APIService.getKeys(authRes, terminalId);

    mqttService.publish("PAYMENT_REVERSAL_RES", workingKeysRes);
  });

    // Acknowledgement QR
  mqttService.subscribe("ACKNOWLEDGE_QR", async (sub: any, cli: any) => {
    console.log("MESSAGE EVENT: ACKNOWLEDGE_QR");

    const messageObject: MQTTMessageObject = {
      client: sub.clientId,
      message: sub.payload.toString(),
      messageJSON: Utils.parseMessage(sub.payload)
    };

    const { transactionId }: AcknowledgementQR = messageObject.messageJSON;

    const transaction = await Transaction.findById(transactionId)
    if (transaction) {
      transaction.status = "terminal_ack"
      await Transaction.update(transaction.id, transaction)
    }
    console.log("acknowledged! ",transactionId)

    return;
  });

  // Cancel Pending Transaction
  mqttService.subscribe("CANCEL_TRANSACTION", async (sub: any, cli: any) => {
    console.log("MESSAGE EVENT: CANCEL_TRANSACTIOM");

    const messageObject: MQTTMessageObject = {
      client: sub.clientId,
      message: sub.payload.toString(),
      messageJSON: Utils.parseMessage(sub.payload)
    };

    console.log("messageobject ",messageObject.messageJSON);

    const { serialNum }: { serialNum: string; } = messageObject.messageJSON;
    console.log("transactionId: ",serialNum);

    const transaction = (await Transaction.findByStatusAndSerial("terminal_ack", serialNum))?.at(0);
    if (transaction) {
      transaction.status = "cancelled"
      await Transaction.update(transaction.id, transaction);
      pollingService.stopPolling(transaction.id);
    }
    console.log("stoppoolll! ",serialNum);
    return;
  });

  // Standalone QRPH Transaction Request
  mqttService.subscribe("QPRO_SALE", async (sub: any, cli: any) => {
    console.log("MESSAGE EVENT: QRSALE");

    const messageObject: MQTTMessageObject = {
      client: sub.clientId,
      message: sub.payload.toString(),
      messageJSON: Utils.parseMessage(sub.payload)
    };

    console.log("messageobject ",messageObject.messageJSON);

    const { serialNum, totalAmount }: { serialNum: string; totalAmount: string; } = messageObject.messageJSON;
    console.log("serial: ",serialNum);


    // fetch token and terminal config
    const authRes = await APIService.fetchAuth({
      serialNo: serialNum,
      brandName: bcrypt.hashSync("Aisino", (bcrypt.genSaltSync(12))),
      tradeName: bcrypt.hashSync("Vanstone", (bcrypt.genSaltSync(12)))
    })
    if (!authRes) {
      console.log(">>>>Error: No token found with serial no: "+serialNum)
      return;
    }

    const terminalConfigKey = `${TerminalController.terminalConfigHKey}:${serialNum}`
    const { success, data: terminalConfig } = PaymentConfigSchema.safeParse(await redisService.hgetall(terminalConfigKey));
    if (!terminalConfig) {
      console.log(">>>>Error: No terminal config with serial no: "+serialNum)
      return;
    }
    // increase stan
    terminalConfig.stan += 1
    redisService.hincrby(terminalConfigKey, "stan")

    // create transaction
    const transactionData = TransactionDataSchema.parse({
      reference_id: "standalone",
      pos_id: "standalone",
      amount: parseInt(totalAmount),
      id: Utils.generateUuid(),
      merchant_id: terminalConfig.terminalConfig?.merchantId,
      terminal_id: terminalConfig.terminalConfig?.terminalId,
      terminal_serial_no: serialNum,
      alpha_code: "PHP"
    })

    const transaction = await Transaction.create(transactionData)
    if (transaction===undefined) {
      console.log(">>>>Error: Error in creating transaction with serial no: "+serialNum)
      return;
    }

    const qrRequestPayload: QRRequest = {
      refNum: Utils.generateRefNum(),
      totalAmount: parseFloat(totalAmount).toFixed(2),
      serialNum: transaction.terminal_serial_no,
      token: authRes,
      merchantId: transaction.merchant_id,
      terminalId: transaction.terminal_id,
      traceNo: terminalConfig.stan,
      batchNo: terminalConfig.batch_no,
      alphaCode: transaction.alpha_code,
      paymentMethod: 1
    }

    console.log("qrRequestPayload: ",qrRequestPayload);

    const qrphRes = await APIService.submitQR(qrRequestPayload);


    console.log("qrPH String() ",qrphRes)
    if (!qrphRes || !qrphRes.qrCodeBody) {
      console.log(">>>>Error: Error in payconnect qr ph request serial no: "+serialNum)
      return;
    }

    // Publish to MQTT
    mqttService.sendQRPending({
      serial_no: transaction.terminal_serial_no,
      transaction_id: transaction.id,
      type: qrRequestPayload.paymentMethod,
      refNum: qrRequestPayload.refNum,
      totalAmount: qrRequestPayload.totalAmount,
      qrph_string: qrphRes?.qrCodeBody //|| staticQr
    });

    const qrPhTransactionData = QRPHTransactionDataSchema.parse({
      id: Utils.generateUuid(),
      transaction_id: transaction.id,
      qrph_string: qrphRes?.qrCodeBody,
      ref_num: qrRequestPayload.refNum,
      trace_no: qrRequestPayload.traceNo,
      batch_no: qrRequestPayload.batchNo,
      amount: transaction.amount
    })

    await QRPHTransaction.create(qrPhTransactionData)

    // Start background polling with unique job ID
    const jobId = transaction.id;
    const checkStatusParams = {
      transactionId: transaction.id,
      terminalId: transaction.terminal_id,
      rrn: qrRequestPayload.refNum,
      paymentId: qrphRes?.paymentId || ""
    };

    const pollingStarted = await pollingService.startPolling(
      jobId,
      checkStatusParams,
      authRes,
      transaction.terminal_serial_no
    );

    if (!pollingStarted) {
      console.warn(`Failed to start polling for transaction: ${jobId}. Max concurrent polls reached.`);
      //TODO add queuing mechanism for failed to start pooling
      await pollingService.startPolling(
        jobId,
        checkStatusParams,
        authRes,
        transaction.terminal_serial_no
      );
    }

    // update transaction status
    transaction.payconnect_payment_id = qrphRes?.paymentId
    transaction.status = "published"
    await Transaction.update(transaction.id, transaction)

    // START TRANSACTION MONITORING
    const monitoringStarted = await transactionMonitorService.startMonitoring(transaction.id, "QRPH");
    if (!monitoringStarted) {
      console.warn(`Failed to start monitoring for transaction: ${transaction.id}. Max concurrent monitors reached.`);
      await transactionMonitorService.startMonitoring(transaction.id, "QRPH");
    }

    return;
  });

};
