import { Response } from 'express';
import { TypedRequest, PaymentTransactionPayload, QRRequest, PaymentTransactionCheckStatusPayload, TransactionData, CheckTransactionStatusPayload } from '@/types';
import { sendResponse } from '@/helpers/response';
import { Device } from '@/models/device';
import { Utils } from '@/utils/utils';
import { CardTransactionSchema, QRPHTransactionDataSchema, TransactionDataSchema } from '@/schemas/transaction';
import mqttService from '@/services/mqttService';
import { APIService } from '@/services/apiService';
import pollingService from '@/services/pollingService';
import transactionMonitorService from '@/services/transactionMonitorService';
import bcrypt from 'bcrypt';
import { Transaction } from '@/models/transaction';
import { QRPHTransaction } from '@/models/qrphtransaction';
import redisService from '@/services/redisService';
import { CardTransaction } from '@/models/cardtransaction';
import { PaymentConfigSchema } from '@/schemas/terminal';
import { TerminalController } from '../terminalController';

export class TransactionController {

    static async processPayment(req: TypedRequest<PaymentTransactionPayload>, res: Response): Promise<Response> {
        try {
          const payload = req.body;

          const device = await Device.findByPosId(payload.pos_id)
          if (device === undefined) {
            return sendResponse(res, {
                success: false,
                message: "Pos binding not found!",
                error: "No data found in requested pos_id",
                status_code: 500,
                code: 5003
            });
          }

          // fetch token and terminal config
          const authRes = await APIService.fetchAuth({
            serialNo: device.payment_terminal_serial_no,
            brandName: bcrypt.hashSync("Aisino", (bcrypt.genSaltSync(12))),
            tradeName: bcrypt.hashSync("Vanstone", (bcrypt.genSaltSync(12)))
          })
          const terminalConfigKey = `${TerminalController.terminalConfigHKey}:${device.payment_terminal_serial_no}`
          const { success, data: config } = PaymentConfigSchema.safeParse(await redisService.hgetall(terminalConfigKey));
          if (!success) {
            return sendResponse(res, {
                  success: false,
                  message: "Payment Request Error",
                  error: "No payment terminal config found",
                  status_code: 500,
                  code: 5006
              });
          }
          console.log("terminalConfig >>> ",config)
          if (!authRes) {
            return sendResponse(res, {
                success: false,
                message: "Payment Request Error",
                error: "Payconnect Authentication error",
                status_code: 500,
                code: 5005
            });
          }

          if (payload.payment_type === "QRPH") {
            console.log("apasok... ")
            if (!config.qrph?.enabled) {
              return sendResponse(res, {
                success: false,
                message: "QRPH is not enabled!",
                error: "Terminal Capabilities Error",
                status_code: 200,
                code: 4005
              });
            }
            else if((config.qrph?.maximumAmount||0) < payload.amount) {
              return sendResponse(res, {
                success: false,
                message: `Amount exceeds transaction limit: Php ${config.qrph?.maximumAmount||0}!`,
                error: "Terminal capabilities error",
                status_code: 200,
                code: 4006
              });
            }
            else if((config.qrph?.minimumAmount||0) > payload.amount) {
              return sendResponse(res, {
                success: false,
                message: `Amount below minimum transaction: Php ${config.qrph?.minimumAmount||0}!`,
                error: "Terminal capabilities error",
                status_code: 200,
                code: 4007
              });
            }
          }
          // increase stan
          config.stan += 1
          redisService.hincrby(terminalConfigKey, "stan")

          // create transaction
          const transactionData = TransactionDataSchema.parse({
            ...payload,
            id: Utils.generateUuid(),
            merchant_id: config.terminalConfig?.merchantId,
            terminal_id: config.terminalConfig?.terminalId,
            terminal_serial_no: device.payment_terminal_serial_no,
            alpha_code: "PHP"
          })

          const transaction = await Transaction.create(transactionData)
          if (transaction===undefined) {
            return sendResponse(res, {
                success: false,
                message: "Payment Request Error",
                error: "Database transaction create failure",
                status_code: 500,
                code: 5004
            });
          }


          if (payload.payment_type === "CARD") {
            return TransactionController.processCardPayment(
              config.stan,
              config.batch_no,
              transaction,
              res
            )
          }

          const qrRequestPayload: QRRequest = {
            refNum: Utils.generateRefNum(),
            totalAmount: transaction.amount.toFixed(2),
            serialNum: transaction.terminal_serial_no,
            token: authRes,
            merchantId: transaction.merchant_id,
            terminalId: transaction.terminal_id,
            traceNo: config.stan,
            batchNo: config.batch_no,
            alphaCode: transaction.alpha_code,
            paymentMethod: 1
          }

          const qrphRes = await APIService.submitQR(qrRequestPayload);
          console.log("qrPHResponse: ", qrphRes)
          if (!qrphRes || !qrphRes?.qrCodeBody) {
            return sendResponse(res, {
                success: false,
                message: "Payment Request Error",
                error: "Check payconnect connection",
                status_code: 500,
                code: 5007
            });
          }

          const responseData = {
            type: "qr-pending",
            data: {
              payment_method: qrRequestPayload.paymentMethod,
              payment_reference_no: qrRequestPayload.refNum,
              amount: qrRequestPayload.totalAmount,
              qrph_string: qrphRes?.qrCodeBody,// || staticQr,
              payment_id: qrphRes?.paymentId,
              transaction_id: transaction.reference_id
            }
          };

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
          const monitoringStarted = await transactionMonitorService.startMonitoring(transaction.id, payload.payment_type);
          if (!monitoringStarted) {
            console.warn(`Failed to start monitoring for transaction: ${transaction.id}. Max concurrent monitors reached.`);
            await transactionMonitorService.startMonitoring(transaction.id, payload.payment_type);
          }

          console.log("polling_job_id: ", jobId)
          console.log("transactionId: ", transaction.id)
          return sendResponse(res, {
            message: "Success payment request",
            data: responseData
          })
        }
        catch(error) {
            console.log("Error in process payment ", error)
            return sendResponse(res, {
                success: false,
                message: "Error in payment request",
                error: JSON.stringify(error),
                status_code: 500,
                code: 5003
            });
        }
    }

    static async processCardPayment(
      stan: number,
      batch_no: number,
      transaction: TransactionData,
      res: Response
    ): Promise<Response> {
      try {
        const cardRequestData = CardTransactionSchema.parse({
          amount: transaction.amount,
          ref_num: Utils.generateRefNum(),
          trace_no: stan,
          batch_no,
          merchant_id: transaction.merchant_id
        })

        const onCreateCardTransaction = CardTransaction.create(cardRequestData)

        // Publish to MQTT
        mqttService.sendCardPending({
          serial_no: transaction.terminal_serial_no,
          transaction_id: transaction.id,
          type: 2,
          refNum: cardRequestData.ref_num,
          totalAmount: transaction.amount.toFixed(2)
        });

        // update transaction status
        transaction.status = "published"
        await Transaction.update(transaction.id, transaction)

        // START TRANSACTION MONITORING
        const monitoringStarted = await transactionMonitorService.startMonitoring(transaction.id, "CARD");
        if (!monitoringStarted) {
          console.warn(`Failed to start monitoring for transaction: ${transaction.id}. Max concurrent monitors reached.`);
          await transactionMonitorService.startMonitoring(transaction.id, "CARD");
        }
        await onCreateCardTransaction;

        return sendResponse(res, {
          message: "Success payment request",
          data: {
            type: "card-pending",
            data: {
              payment_method: "2", // 1. QRPH 2. CARD
              payment_reference_no: cardRequestData.ref_num,
              amount: cardRequestData.amount.toFixed(2),
              transaction_id: transaction.id
            }
          }
        })
      }
      catch(error) {
        console.log("Error in process payment ", error)
        return sendResponse(res, {
            success: false,
            message: "Error in card payment request",
            error: JSON.stringify(error),
            status_code: 500,
            code: 5003
        });
      }
    }

    /**
     * Stop polling for a specific transaction
     */
    static async stopTransactionPolling(req: TypedRequest<{job_id: string}>, res: Response): Promise<Response> {
      try {
        const { job_id } = req.body;
        const stopped = pollingService.stopPolling(job_id);
        return sendResponse(res, {
          message: stopped ? "Polling stopped successfully" : "Polling job not found",
          data: { job_id, stopped }
        });
      } catch (error) {
        return sendResponse(res, {
          success: false,
          message: "Error stopping polling",
          error: JSON.stringify(error),
          status_code: 500,
          code: 5006
        });
      }
    }

    /**
     * Get current polling statistics
     */
    static async getPollingStats(req: TypedRequest<{}>, res: Response): Promise<Response> {
      try {
        const stats = pollingService.getPollingStats();
        return sendResponse(res, {
          message: "Polling statistics retrieved successfully",
          data: stats
        });
      } catch (error) {
        return sendResponse(res, {
          success: false,
          message: "Error retrieving polling stats",
          error: JSON.stringify(error),
          status_code: 500,
          code: 5007
        });
      }
    }

    /**
     * Check if a specific polling job is active
     */
    static async checkPollingStatus(req: TypedRequest<{job_id: string}>, res: Response): Promise<Response> {
      try {
        const { job_id } = req.body;
        const isActive = pollingService.isJobActive(job_id);
        const jobDetails = pollingService.getJobDetails(job_id);
        return sendResponse(res, {
          message: "Polling status retrieved successfully",
          data: {
            job_id,
            is_active: isActive,
            details: jobDetails ? {
              start_time: jobDetails.startTime,
              elapsed_time: Date.now() - jobDetails.startTime
            } : null
          }
        });
      } catch (error) {
        return sendResponse(res, {
          success: false,
          message: "Error checking polling status",
          error: JSON.stringify(error),
          status_code: 500,
          code: 5008
        });
      }
    }

    static async checkPaymentStatus(req: TypedRequest<PaymentTransactionCheckStatusPayload>, res: Response): Promise<Response> {
      try {
        const payload = req.body;
        const transaction = await Transaction.getTransactionInfo(
          payload.payment_reference_no,
          payload.payment_id
        )

        if (!transaction) {
          return sendResponse(res, {
              success: false,
              message: "Transaction not found",
              error: "No data found in given payload",
              status_code: 400,
              code: 4002
          });
        }

        if (transaction.status === "completed") {
          return sendResponse(res, {
            message: "Success check status",
            data: {
              authorization_code: transaction?.payconnect_approval_code || "",
              payconnect_reference_no: transaction?.payconnect_reference_no || "",
              payment_id: payload.payment_id,
              payment_reference_no: payload.payment_reference_no,
              pan: transaction?.payconnect_pan || "",
              payment_status: "PAYMENT_SUCCESS",
              tid: transaction.terminal_id,
              mid: transaction.merchant_id,
              batch_no: Utils.toSixDigitString(transaction.batch_no),
              trace_no: Utils.toSixDigitString(transaction.trace_no),
              transaction_date: transaction.created_at
            }
          })
        }

        // fetch token and terminal config
        const authRes = await APIService.fetchAuth({
          serialNo: transaction.terminal_serial_no,
          brandName: bcrypt.hashSync("Aisino", (bcrypt.genSaltSync(12))),
          tradeName: bcrypt.hashSync("Vanstone", (bcrypt.genSaltSync(12)))
        })

        if (!authRes) {
          return sendResponse(res, {
              success: false,
              message: "Payment Request Error",
              error: "Payconnect Authentication error",
              status_code: 500,
              code: 5003
          });
        }

        const checkStatusPayload = {
          terminalId: transaction.terminal_id,
          rrn: payload.payment_reference_no,
          paymentId: payload.payment_id
        }

        const results = await APIService.checkStatus(checkStatusPayload, authRes, transaction.terminal_serial_no);
        console.log("results ",results)
        if (results?.statusCode && parseInt(results.statusCode) > 300) {
          return sendResponse(res, {
            success: false,
            message: results?.message || "Payment Request Error",
            status_code: 500,
            code: 5004
          });
        }

        if (results?.paymentStatus === "PAYMENT_SUCCESS") {
          transaction.payconnect_approval_code = results?.approvalCode || ""
          transaction.payconnect_reference_no = results?.transactionReferenceNumber || ""
          transaction.payconnect_pan = results?.pan || ""
          transaction.status = "completed"
          await Transaction.update(transaction.id, transaction)
        }

        return sendResponse(res, {
          message: "Success check status",
          data: {
            authorization_code: results?.approvalCode || "",
            payconnect_reference_no: results?.transactionReferenceNumber || "",
            payment_id: results?.paymentId || "",
            payment_reference_no: results?.requestReferenceNumber || "",
            pan: results?.pan || "",
            payment_status: results?.paymentStatus || "",
            tid: transaction.terminal_id,
            mid: transaction.merchant_id,
            batch_no: Utils.toSixDigitString(transaction.batch_no),
            trace_no: Utils.toSixDigitString(transaction.trace_no),
            transaction_date: transaction.created_at
          }
        })
      }
      catch(error) {
        console.log("Error in checkPaymentStatus", error)
        return sendResponse(res, {
            success: false,
            message: "Error in check payment status",
            error: JSON.stringify(error),
            status_code: 500,
            code: 5002
        });
      }
    }

    static async fakeSuccessPayment(req: TypedRequest<{transaction_id: string;}>, res: Response): Promise<Response> {
      try {
        const { transaction_id } = req.body;
        const transaction = await Transaction.findById(transaction_id)

        if (!transaction) {
          return sendResponse(res, {
              success: false,
              message: "Transaction not found",
              error: "No data found in given payload",
              status_code: 400,
              code: 4002
          });
        }

        // Publish success message via MQTT
        mqttService.sendQRSuccess({
          serial: transaction.terminal_serial_no,
          approvalCode: "fake-approval-code-0001",
          refnum: "fake-reference-no-0001"
        });

        // FAKE SUCCESS DATA
        transaction.payconnect_approval_code = "fake-approval-code-0001"
        transaction.payconnect_reference_no = "fake-reference-no-0001"
        transaction.payconnect_pan = "fake-reference-pan-0001"
        transaction.status = "completed"
        await Transaction.update(transaction.id, transaction)

        return sendResponse(res, {
          message: "Success fake with transaction_id: "+transaction_id
        })
      }
      catch(error) {
        console.log("Error in checkPaymentStatus", error)
        return sendResponse(res, {
            success: false,
            message: "Error in check payment status",
            error: JSON.stringify(error),
            status_code: 500,
            code: 5002
        });
      }
    }


    static async checkTransactionStatus(req: TypedRequest<CheckTransactionStatusPayload>, res: Response): Promise<Response> {
      try {
        const payload = req.body;
        const transaction = await Transaction.getTransactionInfoByTid(payload.transaction_id)

        if (!transaction) {
          return sendResponse(res, {
              success: false,
              message: "Transaction not found",
              error: "No data found in given payload",
              status_code: 400,
              code: 4002
          });
        }

        if (transaction.pos_id != payload.pos_id) {
          return sendResponse(res, {
              success: false,
              message: "Pos and Transaction not match!",
              error: "Pos ID and Transaction not match!",
              status_code: 400,
              code: 4003
          });
        }

        if (transaction.status === "completed") {
          return sendResponse(res, {
            message: "Success check status",
            data: {
              authorization_code: transaction?.payconnect_approval_code || "",
              payconnect_reference_no: transaction?.payconnect_reference_no || "",
              payment_id: transaction.payconnect_payment_id,
              payment_reference_no: transaction.ref_num!,
              pan: transaction?.payconnect_pan || "",
              payment_status: "PAYMENT_SUCCESS",
              tid: transaction.terminal_id,
              mid: transaction.merchant_id,
              batch_no: Utils.toSixDigitString(transaction.batch_no),
              trace_no: Utils.toSixDigitString(transaction.trace_no),
              transaction_date: transaction.created_at
            }
          })
        }

        // fetch token and terminal config
        const authRes = await APIService.fetchAuth({
          serialNo: transaction.terminal_serial_no,
          brandName: bcrypt.hashSync("Aisino", (bcrypt.genSaltSync(12))),
          tradeName: bcrypt.hashSync("Vanstone", (bcrypt.genSaltSync(12)))
        })

        if (!authRes) {
          return sendResponse(res, {
              success: false,
              message: "Payment Request Error",
              error: "Payconnect Authentication error",
              status_code: 500,
              code: 5003
          });
        }

        const checkStatusPayload = {
          terminalId: transaction.terminal_id,
          rrn: transaction.ref_num,
          paymentId: transaction.payconnect_payment_id!
        }

        const results = await APIService.checkStatus(checkStatusPayload, authRes, transaction.terminal_serial_no);
        console.log("results ",results)
        if (results?.statusCode && parseInt(results.statusCode) > 300) {
          return sendResponse(res, {
            success: false,
            message: results?.message || "Payment Request Error",
            status_code: 500,
            code: 5004
          });
        }

        if (results?.paymentStatus === "PAYMENT_SUCCESS") {
          transaction.payconnect_approval_code = results?.approvalCode || ""
          transaction.payconnect_reference_no = results?.transactionReferenceNumber || ""
          transaction.payconnect_pan = results?.pan || ""
          transaction.status = "completed"
          await Transaction.update(transaction.id, transaction)
        }

        return sendResponse(res, {
          message: "Success check status",
          data: {
            authorization_code: results?.approvalCode || "",
            payconnect_reference_no: results?.transactionReferenceNumber || "",
            payment_id: results?.paymentId || "",
            payment_reference_no: results?.requestReferenceNumber || "",
            pan: results?.pan || "",
            payment_status: results?.paymentStatus || "",
            tid: transaction.terminal_id,
            mid: transaction.merchant_id,
            batch_no: Utils.toSixDigitString(transaction.batch_no),
            trace_no: Utils.toSixDigitString(transaction.trace_no),
            transaction_date: transaction.created_at
          }
        })
      }
      catch(error) {
        console.log("Error in checkPaymentStatus", error)
        return sendResponse(res, {
            success: false,
            message: "Error in check payment status",
            error: JSON.stringify(error),
            status_code: 500,
            code: 5002
        });
      }
    }

    /**
     * Graceful shutdown method - call this when shutting down the application
     */
    static shutdown(): void {
      console.log("Shutting down TransactionController...");
      pollingService.stopAllPolling();
    }
}