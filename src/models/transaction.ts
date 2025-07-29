import { BaseModel } from './base';
import { TransactionData, TransactionWithQRPH, PaginatedResult, TransactionFilters } from '../types';

interface TransactionLookupParams {
  payment_reference_no: string;
  payment_id: string;
}

export class Transaction extends BaseModel {
  static async create(data: TransactionData): Promise<TransactionData|undefined> {
    const {
      reference_id,
      pos_id,
      status = 'pending',
      amount,
      merchant_id,
      terminal_id,
      terminal_serial_no,
      alpha_code,
      payment_type = 'QRPH',
      expires_at
    } = data;

    const query = `
      INSERT INTO transactions (
        reference_id, pos_id, status, amount, merchant_id,
        terminal_id, terminal_serial_no, alpha_code, payment_type, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      reference_id, pos_id, status, amount, merchant_id,
      terminal_id, terminal_serial_no, alpha_code, payment_type, expires_at
    ];

    try {
      const result = await this.query<TransactionData>(query, values);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<TransactionWithQRPH | null> {
    const query = `
      SELECT t.*,
            json_agg(
              CASE
                WHEN q.id IS NOT NULL THEN
                  json_build_object(
                    'id', q.id,
                    'qrph_string', q.qrph_string,
                    'amount', q.amount,
                    'ref_num', q.ref_num,
                    'trace_no', q.trace_no,
                    'batch_no', q.batch_no,
                    'created_at', q.created_at,
                    'updated_at', q.updated_at,
                    'expires_at', q.expires_at
                  )
                ELSE NULL
              END
            ) FILTER (WHERE q.id IS NOT NULL) AS qrph_transactions
      FROM transactions t
      LEFT JOIN qrphtransactions q ON t.id = q.transaction_id
      WHERE t.id = $1
      GROUP BY t.id
    `;

    try {
      const result = await this.query<TransactionWithQRPH>(query, [id]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to find transaction: ${error.message}`);
    }
  }

  static async findAll(options: TransactionFilters = {}): Promise<PaginatedResult<TransactionData>> {
    const {
      limit = 10,
      offset = 0,
      status,
      merchant_id,
      payment_type,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = options;

    let whereClause = '';
    const values: any[] = [];
    let paramCount = 0;

    // Build WHERE conditions
    const conditions: string[] = [];
    if (status) {
      conditions.push(`status = $${++paramCount}`);
      values.push(status);
    }
    if (merchant_id) {
      conditions.push(`merchant_id = $${++paramCount}`);
      values.push(merchant_id);
    }
    if (payment_type) {
      conditions.push(`payment_type = $${++paramCount}`);
      values.push(payment_type);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const query = `
      SELECT * FROM transactions
      ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    values.push(limit, offset);

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total FROM transactions ${whereClause}
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        this.query<TransactionData>(query, values),
        this.query<{ total: string }>(countQuery, values.slice(0, -2)) // Remove limit and offset for count
      ]);

      return {
        data: dataResult.rows,
        total: parseInt(countResult?.rows?.at(0)?.total || '0'),
        limit,
        offset
      };
    } catch (error: any) {
      throw new Error(`Failed to find transactions: ${error.message}`);
    }
  }

  static async update(id: string, data: Partial<TransactionData>): Promise<TransactionData | null> {
    const allowedFields = [
      'reference_id', 'pos_id', 'status', 'amount', 'merchant_id',
      'terminal_id', 'terminal_serial_no', 'alpha_code', 'payment_type', 'expires_at',
      'payconnect_approval_code', 'payconnect_reference_no', 'payconnect_pan', 'payconnect_payment_id'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key as keyof TransactionData] !== undefined) {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(data[key as keyof TransactionData]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_at
    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE transactions
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    try {
      const result = await this.query<TransactionData>(query, values);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to update transaction: ${error.message}`);
    }
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM transactions WHERE id = $1 RETURNING id';
    try {
      const result = await this.query<{ id: string }>(query, [id]);
      return result.rows.length > 0;
    } catch (error: any) {
      throw new Error(`Failed to delete transaction: ${error.message}`);
    }
  }

  static async findByStatus(status: string): Promise<TransactionData[]> {
    const query = 'SELECT * FROM transactions WHERE status = $1 ORDER BY created_at DESC';
    try {
      const result = await this.query<TransactionData>(query, [status]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find transactions by status: ${error.message}`);
    }
  }

    static async findByStatusAndSerial(status: string, serial: string): Promise<TransactionData[]> {
    const query = 'SELECT * FROM transactions WHERE status = $1 AND terminal_serial_no = $2 ORDER BY created_at DESC LIMIT 1';
    try {
      const result = await this.query<TransactionData>(query, [status, serial]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find transactions by status: ${error.message}`);
    }
  }

  static async findByMerchant(merchantId: string): Promise<TransactionData[]> {
    const query = 'SELECT * FROM transactions WHERE merchant_id = $1 ORDER BY created_at DESC';
    try {
      const result = await this.query<TransactionData>(query, [merchantId]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find transactions by merchant: ${error.message}`);
    }
  }

  static async getTransactionInfo(
    payment_reference_no: string,
    payment_id: string
  ): Promise<{
    id: string;
    status: 'created' | 'published' | 'terminal_ack' | 'pending' | 'completed' | 'failed' | 'cancelled';
    terminal_serial_no: string;
    terminal_id: string,
    payconnect_reference_no?: string;
    payconnect_pan?: string;
    payconnect_approval_code?: string;
  } | undefined> {

    const query = `
      SELECT
        t.id,
        t.status,
        t.terminal_serial_no,
        t.payconnect_reference_no,
        t.payconnect_pan,
        t.payconnect_approval_code,
        t.terminal_id
      FROM transactions t
      INNER JOIN qrphtransactions q ON t.id = q.transaction_id
      WHERE q.ref_num = $1
        AND t.payconnect_payment_id = $2
      ORDER BY t.created_at DESC
      LIMIT 1
    `;

    const values = [payment_reference_no, payment_id];

    try {
      const result = await this.query<{
        id: string;
        status: 'created' | 'published' | 'terminal_ack' | 'pending' | 'completed' | 'failed' | 'cancelled'
        terminal_serial_no: string;
        terminal_id: string,
        payconnect_reference_no?: string;
        payconnect_pan?: string;
        payconnect_approval_code?: string;
      }>(query, values);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to get transaction info: ${error.message}`);
    }
  }
}