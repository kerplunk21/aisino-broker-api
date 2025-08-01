import axios, { AxiosResponse, AxiosError } from 'axios';
import CONFIG from '@/config/config';

interface KeepAliveRequest {
  terminalId: string;
  dateTime: string;
  appVersion: string;
}

interface KeepAliveResponse {
  code: number;
  message: string;
  data?: any;
}

class KeepAliveService {
  private readonly baseUrl: string;
  private readonly endpoint: string;
  private readonly appVersion: string;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.baseUrl = CONFIG.TDMURL;
    this.endpoint = '/terminal/keepAlive';
    this.appVersion = CONFIG.VERSION;
  }

  private getCurrentDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  async sendKeepAlive(terminalId: string): Promise<KeepAliveResponse> {
    try {
      const requestData: KeepAliveRequest = {
        terminalId,
        dateTime: this.getCurrentDateTime(),
        appVersion: this.appVersion
      };

      const url = `${this.baseUrl}${this.endpoint}`;

      console.log(`RequestKeepAlive(terminalId=${requestData.terminalId}, dateTime=${requestData.dateTime}, appVersion=${requestData.appVersion})`);
      console.log(url);

      const response: AxiosResponse = await axios.post(url, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Terminal-${terminalId}/${this.appVersion}`
        },
        timeout: 30000,
        validateStatus: (status) => status < 500 // Accept all status codes below 500
      });

      const statusCode = response.status;
      const message = statusCode === 200 ? 'Success' : 'Error';

      console.log(`ResponseKeepAlive(code=${statusCode}, message=${message})`);

      return {
        code: statusCode,
        message,
        data: response.data
      };

    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const statusCode = axiosError.response.status;
        const message = 'Error';
        console.log(`ResponseKeepAlive(code=${statusCode}, message=${message})`);
        console.error('Keep alive request error:', axiosError.response.data);
        return {
          code: statusCode,
          message,
          data: axiosError.response.data
        };
      } else if (axiosError.request) {
        // Request was made but no response received
        console.error('Keep alive request error: No response received', axiosError.message);
        throw new Error(`Keep alive request failed: ${axiosError.message}`);
      } else {
        // Something went wrong
        console.error('Keep alive request error:', axiosError.message);
        throw new Error(`Keep alive request failed: ${axiosError.message}`);
      }
    }
  }

  startPeriodicKeepAlive(terminalId: string, intervalMs: number = 30000): void {
    if (this.intervalId) {
      this.stopPeriodicKeepAlive();
    }

    console.log(`Starting periodic keep alive for terminal ${terminalId} every ${intervalMs}ms`);
    this.intervalId = setInterval(async () => {
      try {
        await this.sendKeepAlive(terminalId);
      } catch (error) {
        console.error(`Periodic keep alive failed for terminal ${terminalId}:`, error);
      }
    }, intervalMs);

    // Send initial keep alive immediately
    this.sendKeepAlive(terminalId).catch(error => {
      console.error(`Initial keep alive failed for terminal ${terminalId}:`, error);
    });
  }

  stopPeriodicKeepAlive(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped periodic keep alive');
    }
  }


  async sendKeepAliveForTerminals(terminalIds: string[]): Promise<KeepAliveResponse[]> {
    const promises = terminalIds.map(terminalId => this.sendKeepAlive(terminalId));
    return Promise.allSettled(promises).then(results =>
      results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Keep alive failed for terminal ${terminalIds[index]}:`, result.reason);
          return {
            code: 0,
            message: 'Failed',
            data: result.reason
          };
        }
      })
    );
  }
}

export const keepAliveService = new KeepAliveService();
export { KeepAliveService, KeepAliveRequest, KeepAliveResponse };