import { BaseModel } from './base';
import { DeviceData, DeviceFilters } from '../types';

export class Device extends BaseModel {
  static async create(data: DeviceData): Promise<DeviceData|undefined> {
    const { id, name, description, pos_id, payment_terminal_serial_no, status = 'offline' } = data;

    const query = `
      INSERT INTO devices (id, name, description, pos_id, payment_terminal_serial_no, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    try {
      const result = await this.query<DeviceData>(query, [id, name, description, pos_id, payment_terminal_serial_no, status]);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to create device: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<DeviceData | null> {
    const query = 'SELECT * FROM devices WHERE id = $1';
    try {
      const result = await this.query<DeviceData>(query, [id]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to find device: ${error.message}`);
    }
  }

  static async findByPosId(pos_id: string): Promise<DeviceData | undefined> {
    const query = 'SELECT * FROM devices WHERE pos_id = $1';
    try {
      const result = await this.query<DeviceData>(query, [pos_id]);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to find device: ${error.message}`);
    }
  }

  static async findByPosDevices(
    pos_id?: string,
    payment_serial_no?: string
  ): Promise<DeviceData[]> {
    const conditions = [];
    const values = [];
    let query = "SELECT * FROM devices";

    if (pos_id) {
      conditions.push(`pos_id = $${conditions.length + 1}`);
      values.push(pos_id);
    }

    if (payment_serial_no) {
      conditions.push(`payment_terminal_serial_no = $${conditions.length + 1}`);
      values.push(payment_serial_no);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    console.log("QUERY ",query)
    try {
      const result = await this.query<DeviceData>(query, values);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find device: ${error.message}`);
    }
  }

  static async findAll(filters: DeviceFilters = {}): Promise<DeviceData[]> {
    const { status, pos_id } = filters;
    let whereClause = '';
    const values: any[] = [];
    let paramCount = 0;

    const conditions: string[] = [];
    if (status) {
      conditions.push(`status = $${++paramCount}`);
      values.push(status);
    }
    if (pos_id) {
      conditions.push(`pos_id = $${++paramCount}`);
      values.push(pos_id);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const query = `
      SELECT * FROM devices ${whereClause}
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.query<DeviceData>(query, values);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find devices: ${error.message}`);
    }
  }

  static async updateStatus(id: string, status: 'online' | 'offline' | 'maintenance'): Promise<DeviceData | null> {
    const query = `
      UPDATE devices
      SET status = $1, last_transaction = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const lastTransaction = status === 'online' ? new Date() : null;

    try {
      const result = await this.query<DeviceData>(query, [status, lastTransaction, id]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to update device status: ${error.message}`);
    }
  }

  static async update(id: string, data: Partial<DeviceData>): Promise<DeviceData | undefined> {
    const allowedFields = ['name', 'description', 'pos_id', 'payment_terminal_serial_no', 'status'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key as keyof DeviceData] !== undefined) {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(data[key as keyof DeviceData]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE devices
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    try {
      const result = await this.query<DeviceData>(query, values);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to update device: ${error.message}`);
    }
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM devices WHERE id = $1 RETURNING id';
    try {
      const result = await this.query<{ id: string }>(query, [id]);
      return result.rows.length > 0;
    } catch (error: any) {
      throw new Error(`Failed to delete device: ${error.message}`);
    }
  }

  static async findByStatus(status: string): Promise<DeviceData[]> {
    const query = 'SELECT * FROM devices WHERE status = $1 ORDER BY last_transaction DESC';
    try {
      const result = await this.query<DeviceData>(query, [status]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find devices by status: ${error.message}`);
    }
  }
}