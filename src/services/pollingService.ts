import { Transaction } from '@/models/transaction';
import { APIService } from './apiService';
import mqttService from './mqttService';

// Polling configuration
const POLL_INTERVAL = 5000; // 5 seconds
const POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENT_POLLS = 1000; // Maximum number of concurrent polling operations

interface PollingJob {
  id: string;
  params: any;
  token: string;
  snid: string;
  startTime: number;
  intervalId?: NodeJS.Timeout;
  isActive: boolean;
}

interface PollingStats {
  active: number;
  max: number;
  jobs: string[];
}

interface StatusCheckParams {
  transactionId: string
  terminalId: string;
  rrn: string;
  paymentId?: string;
}

export class PollingService {
  private static instance: PollingService;
  private activePolls: Map<string, PollingJob> = new Map();
  private pollCount = 0;

  private constructor() {}

  static getInstance(): PollingService {
    if (!PollingService.instance) {
      PollingService.instance = new PollingService();
    }
    return PollingService.instance;
  }

  /**
   * Start polling for a payment status
   * @param jobId Unique identifier for the polling job
   * @param params Status check parameters
   * @param token Authentication token
   * @param snid Serial number ID
   * @returns Promise<boolean> - true if polling started successfully
   */
  async startPolling(jobId: string, params: StatusCheckParams, token: string, snid: string): Promise<boolean> {
    // Check if we've reached the maximum concurrent polls
    if (this.pollCount >= MAX_CONCURRENT_POLLS) {
      console.warn(`Maximum concurrent polls (${MAX_CONCURRENT_POLLS}) reached. Rejecting new poll job: ${jobId}`);
      return false;
    }

    // Stop existing poll if it exists
    this.stopPolling(jobId);

    const job: PollingJob = {
      id: jobId,
      params,
      token,
      snid,
      startTime: Date.now(),
      isActive: true
    };

    this.activePolls.set(jobId, job);
    this.pollCount++;

    console.log(`Starting polling job: ${jobId}. Active polls: ${this.pollCount}/${MAX_CONCURRENT_POLLS}`);

    // Start the polling process
    this.scheduleNextPoll(job);

    // Set timeout to stop polling after configured time
    setTimeout(() => {
      if (this.activePolls.has(jobId)) {
        console.log(`Polling timeout reached for job: ${jobId}`);
        this.stopPolling(jobId);
        this.handleTimeout(jobId, params);
      }
    }, POLL_TIMEOUT);

    return true;
  }

  /**
   * Schedule the next poll for a job
   * @private
   */
  private scheduleNextPoll(job: PollingJob): void {
    if (!job.isActive || !this.activePolls.has(job.id)) {
      return;
    }

    job.intervalId = setTimeout(async () => {
      await this.executePolling(job);
    }, POLL_INTERVAL);
  }

  /**
   * Execute a single polling check
   * @private
   */
  private async executePolling(job: PollingJob): Promise<void> {
    if (!job.isActive || !this.activePolls.has(job.id)) {
      return;
    }

    try {
      const transaction = await Transaction.findById(job.params.transactionId)
      if (!transaction || transaction.status === "completed") {
        this.stopPolling(job.id);
        return;
      }
      const results = await APIService.checkStatus(job.params, job.token, job.snid);
      // console.log(`Polling result for job ${job.id}:`, results);

      // Handle API errors
      if (results?.hasOwnProperty("statusCode") || results?.hasOwnProperty("code")) {
        console.error(`API error for job ${job.id}:`, results);
        // Continue polling on API errors, but you might want to add retry logic
        this.scheduleNextPoll(job);
        return;
      }

      // Handle successful payment
      if (results && results.paymentStatus === "PAYMENT_SUCCESS") {
        console.log(`Payment successful for job ${job.id}`);
        transaction.payconnect_approval_code = results?.approvalCode || ""
        transaction.payconnect_reference_no = results?.transactionReferenceNumber || ""
        transaction.payconnect_pan = results?.pan || ""
        transaction.status = "completed"
        await Transaction.update(transaction.id, transaction)
        // Publish success message via MQTT
        mqttService.sendQRSuccess({
          serial: transaction.terminal_serial_no,
          approvalCode: results.approvalCode!,
          refnum: results.requestReferenceNumber!,
        });

        // Stop polling for this job
        this.stopPolling(job.id);
        return;
      }

      // Handle failed payment
      if (results && results.paymentStatus === "PAYMENT_FAILED") {
        console.log(`Payment failed for job ${job.id}`);
        const failureData = {
          refnum: results.requestReferenceNumber,
          paymentId: results.paymentId,
          reason: results?.message || "Payment failed"
        };

        console.log("Payment Failed:", failureData);

        //
        // mqttService.sendQRFailed(failureData);

        // Stop polling for this job
        this.stopPolling(job.id);
        return;
      }

      // Payment still pending, continue polling
      if (results && results.paymentStatus !== "PAYMENT_SUCCESS") {
        this.scheduleNextPoll(job);
      }

    } catch (error) {
      console.error(`Error in polling job ${job.id}:`, error);
      // Check if we should continue polling or stop due to persistent errors
      const elapsedTime = Date.now() - job.startTime;
      if (elapsedTime < POLL_TIMEOUT) {
        // Continue polling if we haven't reached timeout
        this.scheduleNextPoll(job);
      } else {
        // Stop polling if we've reached timeout
        this.stopPolling(job.id);
      }
    }
  }

  /**
   * Stop polling for a specific job
   * @param jobId The job ID to stop
   * @returns boolean - true if job was found and stopped
   */
  stopPolling(jobId: string): boolean {
    const job = this.activePolls.get(jobId);
    if (!job) {
      return false;
    }

    job.isActive = false;
    if (job.intervalId) {
      clearTimeout(job.intervalId);
    }

    this.activePolls.delete(jobId);
    this.pollCount--;

    console.log(`Stopped polling job: ${jobId}. Active polls: ${this.pollCount}/${MAX_CONCURRENT_POLLS}`);
    return true;
  }

  /**
   * Handle polling timeout
   * @private
   */
  private handleTimeout(jobId: string, params: StatusCheckParams): void {
    console.log(`Handling timeout for job: ${jobId}`);
    const timeoutData = {
      refnum: params.rrn,
      paymentId: params.paymentId,
      reason: "Payment timeout after 5 minutes"
    };

    // You can extend mqttService to handle timeouts
    // mqttService.sendQRTimeout(timeoutData);
    console.log("Payment Timeout:", timeoutData);
  }

  /**
   * Stop all active polling jobs
   */
  stopAllPolling(): void {
    console.log(`Stopping all polling jobs. Total active: ${this.pollCount}`);
    for (const [jobId, job] of this.activePolls) {
      job.isActive = false;
      if (job.intervalId) {
        clearTimeout(job.intervalId);
      }
    }

    this.activePolls.clear();
    this.pollCount = 0;
    console.log("All polling jobs stopped");
  }

  /**
   * Get the current number of active polling jobs
   */
  getActivePollingCount(): number {
    return this.pollCount;
  }

  /**
   * Get detailed polling statistics
   */
  getPollingStats(): PollingStats {
    return {
      active: this.pollCount,
      max: MAX_CONCURRENT_POLLS,
      jobs: Array.from(this.activePolls.keys())
    };
  }

  /**
   * Check if a specific job is currently active
   */
  isJobActive(jobId: string): boolean {
    const job = this.activePolls.get(jobId);
    return job ? job.isActive : false;
  }

  /**
   * Get job details by ID
   */
  getJobDetails(jobId: string): PollingJob | undefined {
    return this.activePolls.get(jobId);
  }
}

// Export singleton instance
export default PollingService.getInstance();