import { DatabaseDriver } from './database-driver';
var Redis = require('ioredis');

export class RedisDatabase implements DatabaseDriver {
    /**
     * Redis client.
     */
    private redis: any;

    /**
     *
     * KeyPrefix for used in the redis Connection
     *
     * @type {String}
     */
    private keyPrefix: string;

    /**
     * Create a new cache instance.
     */
    constructor(options: any) {
        this.keyPrefix = options.databaseConfig.redis.keyPrefix || '';
        this.redis = new Redis(options.databaseConfig.redis);
    }

    /**
     * Retrieve data from redis.
     */
    get(key: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.redis.get(key).then(value => resolve(JSON.parse(value)));
        });
    }

    /**
     * Store data to cache.
     */
    set(key: string, value: any): void {
        this.redis.set(key, JSON.stringify(value));
    }

    /**
     * Publish data on a channel.
     */
    publish(channel: string, data: any): void {
        this.redis.publish(`${this.keyPrefix}${channel}`, JSON.stringify(data));
    }
}
