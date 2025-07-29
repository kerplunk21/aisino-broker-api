import { createClient, RedisClientType, RedisClientOptions } from 'redis';

interface RedisServiceConfig {
  socket: {
    host: string;
    port: number;
  };
  username?: string;
  password?: string;
  retryDelayOnFailover?: number;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  db?: number;
  [key: string]: any;
}

interface SessionData {
  [key: string]: any;
}

interface MessageData {
  [key: string]: any;
}

interface QRTransactionData {
  [key: string]: any;
}

interface DeviceConfig {
  [key: string]: any;
}

interface PollingSessionData {
  [key: string]: any;
}

type SubscriberCallback = (message: any, channel: string) => void;

export class RedisService {
  private config: RedisServiceConfig;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private subscribers: Map<string, Set<SubscriberCallback>> = new Map();

  constructor(config: RedisServiceConfig = {}) {
    this.config = {
      socket: {
        host: config.socket?.host || process.env['REDIS_HOST'] || 'localhost',
        port: config.socket?.port || Number(process.env['REDIS_PORT']) || 6379,
      },
      username: config.username || process.env['REDIS_USERNAME'] || undefined,
      password: config.password || process.env['REDIS_PASSWORD'] || undefined,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      enableOfflineQueue: config.enableOfflineQueue || false,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      connectTimeout: config.connectTimeout || 10000,
      commandTimeout: config.commandTimeout || 5000,
      db: config.db || 0
    };
    this.connect();
  }

  async connect(): Promise<boolean> {
    try {
      const clientConfig: RedisClientOptions = {
        socket: {
          host: this.config.socket.host,
          port: this.config.socket.port,
          connectTimeout: this.config.connectTimeout,
          //tls: true,
          //rejectUnauthorized: false, // Accept self-signed certificates
          //checkServerIdentity: () => undefined, // Skip hostname verification
        },
        // username: this.config.username || undefined,
        // password: this.config.password || undefined,
        database: this.config.db,
      };

      this.client = createClient(clientConfig);
      this.client.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });


      this.client.on('connect', () => {
        console.log('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('Redis client ready');
      });

      this.client.on('end', () => {
        console.log('Redis client disconnected');
        this.isConnected = false;
      });

      await Promise.all([
        this.client.connect(),
      ]);

      console.log('Redis service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) await this.client.quit();
      this.isConnected = false;
      console.log('Redis service disconnected');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected && this.client !== null && this.client.isOpen;
  }

  // ==================== CACHING METHODS ====================
  /**
   * Set a key-value pair with optional expiration
   */
  async set(key: string, value: any, ttl: number | null = null): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const result = await this.client.expire(key, seconds);
      return result? true : false;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  // ==================== HASH METHODS ====================

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedValue = JSON.stringify(value);
      await this.client.hSet(key, field, serializedValue);
      return true;
    } catch (error) {
      console.error('Redis HSET error:', error);
      return false;
    }
  }

  /**
   * Set multiple hash fields at once
   */
  async hmset(key: string, fields: Record<string, any>): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedFields: Record<string, string> = {};
      for (const [field, value] of Object.entries(fields)) {
        serializedFields[field] = JSON.stringify(value);
      }
      await this.client.hSet(key, serializedFields);
      return true;
    } catch (error) {
      console.error('Redis HMSET error:', error);
      return false;
    }
  }

  /**
   * Increment hash field by value
   */
  async hincrby(key: string, field: string, increment: number = 1): Promise<number | null> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      // Get current value
      const currentValue = await this.client.hGet(key, field);
      let numericValue = 0;
      if (currentValue !== null) {
        try {
          // Parse the JSON string to get the number
          numericValue = JSON.parse(currentValue);
          if (typeof numericValue !== 'number') {
            throw new Error(`Field ${field} is not a number`);
          }
        } catch (parseError) {
          throw new Error(`Cannot parse field ${field} as number`);
        }
      }
      const newValue = numericValue + increment;
      await this.client.hSet(key, field, JSON.stringify(newValue));
      return newValue;
    } catch (error) {
      console.error('Redis HINCRBY error:', error);
      return null;
    }
  }

  /**
   * Get hash field
   */
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis HGET error:', error);
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall<T = Record<string, any>>(key: string): Promise<T> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const hash = await this.client.hGetAll(key);
      const result: Record<string, any> = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      return result as T;
    } catch (error) {
      console.error('Redis HGETALL error:', error);
      return {} as T;
    }
  }

  /**
   * Delete hash field
   */
  async hdel(key: string, field: string): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      await this.client.hDel(key, field);
      return true;
    } catch (error) {
      console.error('Redis HDEL error:', error);
      return false;
    }
  }

  // ==================== LIST METHODS ====================

  /**
   * Push to list (left)
   */
  async lpush(key: string, ...values: any[]): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedValues = values.map(v => JSON.stringify(v));
      await this.client.lPush(key, serializedValues);
      return true;
    } catch (error) {
      console.error('Redis LPUSH error:', error);
      return false;
    }
  }

  /**
   * Push to list (right)
   */
  async rpush(key: string, ...values: any[]): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedValues = values.map(v => JSON.stringify(v));
      await this.client.rPush(key, serializedValues);
      return true;
    } catch (error) {
      console.error('Redis RPUSH error:', error);
      return false;
    }
  }

  /**
   * Pop from list (left)
   */
  async lpop<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const value = await this.client.lPop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis LPOP error:', error);
      return null;
    }
  }

  /**
   * Pop from list (right)
   */
  async rpop<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const value = await this.client.rPop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis RPOP error:', error);
      return null;
    }
  }

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      return await this.client.lLen(key);
    } catch (error) {
      console.error('Redis LLEN error:', error);
      return 0;
    }
  }

  /**
   * Get list range
   */
  async lrange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const values = await this.client.lRange(key, start, stop);
      return values.map(v => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    } catch (error) {
      console.error('Redis LRANGE error:', error);
      return [];
    }
  }

  // ==================== SET METHODS ====================

  /**
   * Add to set
   */
  async sadd(key: string, ...members: any[]): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedMembers = members.map(m => JSON.stringify(m));
      await this.client.sAdd(key, serializedMembers);
      return true;
    } catch (error) {
      console.error('Redis SADD error:', error);
      return false;
    }
  }

  /**
   * Remove from set
   */
  async srem(key: string, ...members: any[]): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedMembers = members.map(m => JSON.stringify(m));
      await this.client.sRem(key, serializedMembers);
      return true;
    } catch (error) {
      console.error('Redis SREM error:', error);
      return false;
    }
  }

  /**
   * Get all set members
   */
  async smembers<T = any>(key: string): Promise<T[]> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const members = await this.client.sMembers(key);
      return members.map(m => {
        try {
          return JSON.parse(m);
        } catch {
          return m;
        }
      });
    } catch (error) {
      console.error('Redis SMEMBERS error:', error);
      return [];
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: any): Promise<number> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      const serializedMember = JSON.stringify(member);
      return await this.client.sIsMember(key, serializedMember);
    } catch (error) {
      console.error('Redis SISMEMBER error:', error);
      return 0;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Redis KEYS error:', error);
      return [];
    }
  }

  /**
   * Flush all data
   */
  async flushall(): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('Redis FLUSHALL error:', error);
      return false;
    }
  }

  /**
   * Get Redis info
   */
  async info(): Promise<string | null> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      return await this.client.info();
    } catch (error) {
      console.error('Redis INFO error:', error);
      return null;
    }
  }

  // ==================== MQTT SPECIFIC METHODS ====================

  /**
   * Store client session data
   */
  async storeClientSession(clientId: string, sessionData: SessionData): Promise<boolean> {
    const key = `mqtt:client:${clientId}`;
    return await this.hset(key, 'session', sessionData);
  }

  /**
   * Get client session data
   */
  async getClientSession(clientId: string): Promise<SessionData | null> {
    const key = `mqtt:client:${clientId}`;
    return await this.hget<SessionData>(key, 'session');
  }

  /**
   * Remove client session
   */
  async removeClientSession(clientId: string): Promise<boolean> {
    const key = `mqtt:client:${clientId}`;
    return await this.del(key);
  }

  /**
   * Store message for offline client
   */
  async storeOfflineMessage(clientId: string, message: MessageData): Promise<boolean> {
    const key = `mqtt:offline:${clientId}`;
    return await this.lpush(key, message);
  }

  /**
   * Get offline messages for client
   */
  async getOfflineMessages(clientId: string): Promise<MessageData[]> {
    const key = `mqtt:offline:${clientId}`;
    const messages = await this.lrange<MessageData>(key, 0, -1);
    await this.del(key); // Clear messages after retrieval
    return messages;
  }

  /**
   * Store QR transaction data
   */
  async storeQRTransaction(transactionId: string, data: QRTransactionData, ttl: number = 3600): Promise<boolean> {
    const key = `qr:transaction:${transactionId}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get QR transaction data
   */
  async getQRTransaction(transactionId: string): Promise<QRTransactionData | null> {
    const key = `qr:transaction:${transactionId}`;
    return await this.get<QRTransactionData>(key);
  }

  /**
   * Store authentication token
   */
  async storeAuthToken(clientId: string, token: string, ttl: number = 3600): Promise<boolean> {
    const key = `auth:token:${clientId}`;
    return await this.set(key, token, ttl);
  }

  /**
   * Get authentication token
   */
  async getAuthToken(clientId: string): Promise<string | null> {
    const key = `auth:token:${clientId}`;
    return await this.get<string>(key);
  }

  /**
   * Store device configuration
   */
  async storeDeviceConfig(serialNum: string, config: DeviceConfig, ttl: number = 7200): Promise<boolean> {
    const key = `device:config:${serialNum}`;
    return await this.set(key, config, ttl);
  }

  /**
   * Get device configuration
   */
  async getDeviceConfig(serialNum: string): Promise<DeviceConfig | null> {
    const key = `device:config:${serialNum}`;
    return await this.get<DeviceConfig>(key);
  }

  /**
   * Store active polling sessions
   */
  async storePollingSession(sessionId: string, data: PollingSessionData): Promise<boolean> {
    const key = `polling:session:${sessionId}`;
    return await this.set(key, data, 600); // 10 minutes TTL
  }

  /**
   * Get polling session
   */
  async getPollingSession(sessionId: string): Promise<PollingSessionData | null> {
    const key = `polling:session:${sessionId}`;
    return await this.get<PollingSessionData>(key);
  }

  /**
   * Remove polling session
   */
  async removePollingSession(sessionId: string): Promise<boolean> {
    const key = `polling:session:${sessionId}`;
    return await this.del(key);
  }

  /**
   * Execute Lua script
   */
  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<any> {
    try {
      if (!this.client) throw new Error('Redis client not connected');
      return await this.client.eval(script, { keys: args.slice(0, numKeys), arguments: args.slice(numKeys) });
    } catch (error) {
      console.error('Redis EVAL error:', error);
      throw error;
    }
  }

  /**
   * Multi-HSET operation using Lua script for atomicity
   * @param key - The hash key
   * @param fieldsAndValues - Object with field-value pairs or flat array [field1, value1, field2, value2, ...]
   * @returns Array of results (1 for new field, 0 for updated field)
   */
  async multiHset(key: string, fieldsAndValues: Record<string, any> | any[]): Promise<number[]> {
    try {
      if (!this.client) throw new Error('Redis client not connected');

      const luaScript = `
        local hash_key = KEYS[1]
        local fields_and_values = ARGV
        local results = {}

        -- Check if we have an even number of arguments (field-value pairs)
        if #fields_and_values % 2 ~= 0 then
            return redis.error_reply("ERR wrong number of arguments: fields and values must be paired")
        end

        -- Process each field-value pair
        for i = 1, #fields_and_values, 2 do
            local field = fields_and_values[i]
            local value = fields_and_values[i + 1]

            -- Execute HSET and store result
            local result = redis.call('HSET', hash_key, field, value)
            table.insert(results, result)
        end

        -- Return array of results (1 for new field, 0 for updated field)
        return results
      `;

      let args: string[] = [];

      // Handle both object and array inputs
      if (Array.isArray(fieldsAndValues)) {
        // Convert values to JSON strings
        for (let i = 0; i < fieldsAndValues.length; i++) {
          if (i % 2 === 0) {
            // Field names as-is
            args.push(String(fieldsAndValues[i]));
          } else {
            // Values as JSON strings
            args.push(JSON.stringify(fieldsAndValues[i]));
          }
        }
      } else {
        // Convert object to flat array
        for (const [field, value] of Object.entries(fieldsAndValues)) {
          args.push(field);
          args.push(JSON.stringify(value));
        }
      }

      const results = await this.eval(luaScript, 1, key, ...args);
      return results as number[];
    } catch (error) {
      console.error('Redis MULTI-HSET error:', error);
      throw error;
    }
  }

  /**
   * Batch HSET operations for multiple keys
   * @param operations - Array of { key, field, value } objects
   * @returns Array of results for each operation
   */
  async batchHset(operations: Array<{ key: string; field: string; value: any }>): Promise<number[]> {
    try {
      if (!this.client) throw new Error('Redis client not connected');

      const luaScript = `
        local operations = ARGV
        local results = {}

        -- Process operations in groups of 3 (key, field, value)
        for i = 1, #operations, 3 do
            local key = operations[i]
            local field = operations[i + 1]
            local value = operations[i + 2]

            if key and field and value then
                local result = redis.call('HSET', key, field, value)
                table.insert(results, result)
            end
        end

        return results
      `;

      const args: string[] = [];
      for (const op of operations) {
        args.push(op.key, op.field, JSON.stringify(op.value));
      }

      const results = await this.eval(luaScript, 0, ...args);
      return results as number[];
    } catch (error) {
      console.error('Redis BATCH-HSET error:', error);
      throw error;
    }
  }

  /**
   * Atomic increment with conditional set
   * @param key - The key to increment
   * @param field - The hash field to increment (for hash keys) or null for string keys
   * @param increment - The increment value
   * @param maxValue - Maximum allowed value (optional)
   * @returns New value or null if max exceeded
   */
  async atomicIncrementWithLimit(key: string, field: string | null, increment: number = 1, maxValue?: number): Promise<number | null> {
    try {
      if (!this.client) throw new Error('Redis client not connected');

      const luaScript = `
        local key = KEYS[1]
        local field = ARGV[1]
        local increment = tonumber(ARGV[2])
        local max_value = ARGV[3] and tonumber(ARGV[3]) or nil

        local current_value = 0

        -- Get current value
        if field == "null" then
            -- String key
            local val = redis.call('GET', key)
            if val then
                current_value = tonumber(val) or 0
            end
        else
            -- Hash key
            local val = redis.call('HGET', key, field)
            if val then
                current_value = tonumber(val) or 0
            end
        end

        local new_value = current_value + increment

        -- Check max value constraint
        if max_value and new_value > max_value then
            return nil
        end

        -- Set new value
        if field == "null" then
            redis.call('SET', key, new_value)
        else
            redis.call('HSET', key, field, new_value)
        end

        return new_value
      `;

      const result = await this.eval(
        luaScript,
        1,
        key,
        field || "null",
        increment.toString(),
        maxValue?.toString() || ""
      );

      return result as number | null;
    } catch (error) {
      console.error('Redis ATOMIC-INCREMENT error:', error);
      return null;
    }
  }

  // ==================== ENHANCED PAYMENT SCHEME METHODS ====================

  /**
   * Store multiple CAPKs atomically
   */
  async storeCAPKs(capks: Array<{ rid: string; index?: string; data: any }>): Promise<number[]> {
    try {
      const operations = capks.map(capk => ({
        key: "paymentscheme:capk",
        field: capk.index ? `${capk.rid}:${capk.index}` : capk.rid,
        value: capk.data
      }));

      return await this.batchHset(operations);
    } catch (error) {
      console.error('Error storing CAPKs:', error);
      throw error;
    }
  }

  /**
   * Get all CAPKs for a specific RID
   */
  async getCAPKsByRID(rid: string): Promise<Record<string, any>> {
    try {
      if (!this.client) throw new Error('Redis client not connected');

      const luaScript = `
        local hash_key = KEYS[1]
        local rid_pattern = ARGV[1]
        local all_fields = redis.call('HGETALL', hash_key)
        local results = {}

        -- Process fields in pairs (field, value)
        for i = 1, #all_fields, 2 do
            local field = all_fields[i]
            local value = all_fields[i + 1]

            -- Check if field starts with RID pattern
            if string.sub(field, 1, #rid_pattern) == rid_pattern then
                results[field] = value
            end
        end

        return results
      `;

      const result = await this.eval(luaScript, 1, "paymentscheme:capk", rid);

      // Parse JSON values
      const parsed: Record<string, any> = {};
      for (const [field, value] of Object.entries(result as Record<string, string>)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }

      return parsed;
    } catch (error) {
      console.error('Error getting CAPKs by RID:', error);
      return {};
    }
  }
}


const redisService = new RedisService();
export default redisService;