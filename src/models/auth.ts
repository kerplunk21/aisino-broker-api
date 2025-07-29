import { BaseModel } from './base';
import { AuthData } from '../types';

export class Auth extends BaseModel {
  static async create(data: AuthData): Promise<AuthData|undefined> {
    const { access_key, access_secret, status = 'active', description } = data;

    const query = `
      INSERT INTO auths (access_key, access_secret, status, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result = await this.query<AuthData>(query, [access_key, access_secret, status, description]);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to create auth: ${error.message}`);
    }
  }

  static async findByAccessKey(accessKey: string): Promise<AuthData | undefined> {
    const query = 'SELECT * FROM auths WHERE access_key = $1';
    try {
      const result = await this.query<AuthData>(query, [accessKey]);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to find auth by access key: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<AuthData | null> {
    const query = 'SELECT * FROM auths WHERE id = $1';
    try {
      const result = await this.query<AuthData>(query, [id]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to find auth by id: ${error.message}`);
    }
  }

  static async updateStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<AuthData | null> {
    const query = `
      UPDATE auths
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.query<AuthData>(query, [status, id]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to update auth status: ${error.message}`);
    }
  }

  static async findAll(status?: string): Promise<AuthData[]> {
    let query = 'SELECT * FROM auths';
    const values: any[] = [];

    if (status) {
      query += ' WHERE status = $1';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC';

    try {
      const result = await this.query<AuthData>(query, values);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find auths: ${error.message}`);
    }
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM auths WHERE id = $1 RETURNING id';
    try {
      const result = await this.query<{ id: string }>(query, [id]);
      return result.rows.length > 0;
    } catch (error: any) {
      throw new Error(`Failed to delete auth: ${error.message}`);
    }
  }
}