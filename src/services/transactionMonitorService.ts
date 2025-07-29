import { Transaction } from '@/models/transaction';
import { QRPHTransaction } from '@/models/qrphtransaction';
import mqttService from './mqttService';
import { TransactionData } from '@/types';

// Monitor configuration
const MONITOR_INTERVAL = 30000; // 30 seconds - check every 30 seconds
const MONITOR_TIMEOUT = 10 * 60 * 1000; // 10 minutes - stop monitoring after 10 minutes
const MAX_CONCURRENT_MONITORS = 500; // Maximum number of concurrent monitoring operations
const REPUBLISH_INTERVAL = 30 * 1000; // 30 seconds - republish every 30seconds

interface MonitoringJob {
  id: string;
  payment_method: "CARD" | "QRPH";
  transactionId: string;
  startTime: number;
  lastRepublishTime: number;
  intervalId?: NodeJS.Timeout;
  isActive: boolean;
  republishCount: number;
}

interface MonitoringStats {
  active: number;
  max: number;
  jobs: string[];
}

export class TransactionMonitorService {
  private static instance: TransactionMonitorService;
  private activeMonitors: Map<string, MonitoringJob> = new Map();
  private monitorCount = 0;

  private constructor() {}

  static getInstance(): TransactionMonitorService {
    if (!TransactionMonitorService.instance) {
      TransactionMonitorService.instance = new TransactionMonitorService();
    }
    return TransactionMonitorService.instance;
  }

  /**
   * Start monitoring a transaction for status changes
   * @param transactionId The transaction ID to monitor
   * @returns Promise<boolean> - true if monitoring started successfully
   */
  async startMonitoring(transactionId: string, paymentMethod: "CARD" | "QRPH"): Promise<boolean> {
    // Check if we've reached the maximum concurrent monitors
    if (this.monitorCount >= MAX_CONCURRENT_MONITORS) {
      console.warn(`Maximum concurrent monitors (${MAX_CONCURRENT_MONITORS}) reached. Rejecting new monitor job for transaction: ${transactionId}`);
      return false;
    }

    // Stop existing monitor if it exists
    this.stopMonitoring(transactionId);

    const job: MonitoringJob = {
      payment_method: paymentMethod,
      id: transactionId,
      transactionId,
      startTime: Date.now(),
      lastRepublishTime: 0,
      isActive: true,
      republishCount: 0
    };

    this.activeMonitors.set(transactionId, job);
    this.monitorCount++;

    console.log(`Starting monitoring job for transaction: ${transactionId}. Active monitors: ${this.monitorCount}/${MAX_CONCURRENT_MONITORS}`);

    // Start the monitoring process
    this.scheduleNextCheck(job);

    // Set timeout to stop monitoring after configured time
    setTimeout(() => {
      if (this.activeMonitors.has(transactionId)) {
        console.log(`Monitoring timeout reached for transaction: ${transactionId}`);
        this.stopMonitoring(transactionId);
        this.handleTimeout(transactionId);
      }
    }, MONITOR_TIMEOUT);

    return true;
  }

  /**
   * Schedule the next check for a monitoring job
   * @private
   */
  private scheduleNextCheck(job: MonitoringJob): void {
    if (!job.isActive || !this.activeMonitors.has(job.id)) {
      return;
    }

    job.intervalId = setTimeout(async () => {
      await this.executeMonitoring(job);
    }, MONITOR_INTERVAL);
  }

  /**
   * Execute a single monitoring check
   * @private
   */
  private async executeMonitoring(job: MonitoringJob): Promise<void> {
    if (!job.isActive || !this.activeMonitors.has(job.id)) {
      return;
    }

    try {
      // Fetch the current transaction
      const transaction = await Transaction.findById(job.transactionId);
      if (!transaction) {
        console.log(`Transaction ${job.transactionId} not found, stopping monitoring`);
        this.stopMonitoring(job.id);
        return;
      }

      console.log(`Monitoring check for transaction ${job.transactionId}: status = ${transaction.status}`);

      // If status is no longer "published", stop monitoring
      if (transaction.status !== "published") {
        console.log(`Transaction ${job.transactionId} status changed to ${transaction.status}, stopping monitoring`);
        this.stopMonitoring(job.id);
        return;
      }

      // Check if it's time to republish
      const timeSinceLastRepublish = Date.now() - job.lastRepublishTime;
      const shouldRepublish = job.lastRepublishTime === 0 || timeSinceLastRepublish >= REPUBLISH_INTERVAL;

      if (shouldRepublish) {
        await this.republishTransaction(transaction, job);
      }

      // Schedule next check
      this.scheduleNextCheck(job);

    } catch (error) {
      console.error(`Error in monitoring job for transaction ${job.transactionId}:`, error);
      // Check if we should continue monitoring or stop due to persistent errors
      const elapsedTime = Date.now() - job.startTime;
      if (elapsedTime < MONITOR_TIMEOUT) {
        // Continue monitoring if we haven't reached timeout
        this.scheduleNextCheck(job);
      } else {
        // Stop monitoring if we've reached timeout
        this.stopMonitoring(job.id);
      }
    }
  }

  /**
   * Republish transaction via MQTT
   * @private
   */
  private async republishTransaction(transaction: TransactionData, job: MonitoringJob): Promise<void> {
    try {

      if (job.payment_method === "QRPH") {
        // Fetch the QRPH transaction data
        const qrphTransaction = (await QRPHTransaction.findByTransactionId(transaction.id))?.at(0);

        if (!qrphTransaction) {
          console.warn(`QRPH transaction not found for transaction ${transaction.id}`);
          return;
        }

        job.republishCount++;
        job.lastRepublishTime = Date.now();

        console.log(`Republishing transaction ${transaction.id} (attempt #${job.republishCount})`);
        console.log("qrphTransaction: ",qrphTransaction)

        // Republish to MQTT with updated information
        mqttService.sendQRPending({
          serial_no: transaction.terminal_serial_no,
          transaction_id: transaction.id,
          type: 1,
          refNum: qrphTransaction.ref_num,
          totalAmount: transaction.amount.toFixed(2),
          qrph_string: qrphTransaction.qrph_string!,
          republish_count: job.republishCount,
          monitoring_duration: Date.now() - job.startTime
        });
      }
      else if (job.payment_method === "CARD") {
        job.republishCount++;
        job.lastRepublishTime = Date.now();
        // Republish to MQTT with updated information
        mqttService.sendCardPending({
          serial_no: transaction.terminal_serial_no,
          transaction_id: transaction.id,
          type: 1,
          refNum: "", //qrphTransaction.ref_num,
          totalAmount: transaction.amount.toFixed(2),
          republish_count: job.republishCount,
          monitoring_duration: Date.now() - job.startTime
        });

      }
      console.log(`Successfully republished transaction ${transaction.id} via MQTT`);
    } catch (error) {
      console.error(`Error republishing transaction ${transaction.id}:`, error);
    }
  }

  /**
   * Stop monitoring for a specific transaction
   * @param transactionId The transaction ID to stop monitoring
   * @returns boolean - true if job was found and stopped
   */
  stopMonitoring(transactionId: string): boolean {
    const job = this.activeMonitors.get(transactionId);
    if (!job) {
      return false;
    }

    job.isActive = false;
    if (job.intervalId) {
      clearTimeout(job.intervalId);
    }

    this.activeMonitors.delete(transactionId);
    this.monitorCount--;

    console.log(`Stopped monitoring transaction: ${transactionId}. Active monitors: ${this.monitorCount}/${MAX_CONCURRENT_MONITORS}`);
    return true;
  }

  /**
   * Handle monitoring timeout
   * @private
   */
  private handleTimeout(transactionId: string): void {
    console.log(`Handling timeout for transaction monitoring: ${transactionId}`);
    const timeoutData = {
      transaction_id: transactionId,
      reason: `Transaction monitoring timeout after ${MONITOR_TIMEOUT / 1000} seconds`,
      final_status: "published" // Still published when timeout occurred
    };

    console.log("Transaction Monitoring Timeout:", timeoutData);
  }

  /**
   * Stop all active monitoring jobs
   */
  stopAllMonitoring(): void {
    console.log(`Stopping all monitoring jobs. Total active: ${this.monitorCount}`);

    for (const [transactionId, job] of this.activeMonitors) {
      job.isActive = false;
      if (job.intervalId) {
        clearTimeout(job.intervalId);
      }
    }

    this.activeMonitors.clear();
    this.monitorCount = 0;
    console.log("All monitoring jobs stopped");
  }

  /**
   * Get the current number of active monitoring jobs
   */
  getActiveMonitoringCount(): number {
    return this.monitorCount;
  }

  /**
   * Get detailed monitoring statistics
   */
  getMonitoringStats(): MonitoringStats {
    return {
      active: this.monitorCount,
      max: MAX_CONCURRENT_MONITORS,
      jobs: Array.from(this.activeMonitors.keys())
    };
  }

  /**
   * Check if a specific transaction is currently being monitored
   */
  isTransactionMonitored(transactionId: string): boolean {
    const job = this.activeMonitors.get(transactionId);
    return job ? job.isActive : false;
  }

  /**
   * Get monitoring job details by transaction ID
   */
  getJobDetails(transactionId: string): MonitoringJob | undefined {
    return this.activeMonitors.get(transactionId);
  }

}

// Export singleton instance
export default TransactionMonitorService.getInstance();