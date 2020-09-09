import * as ioSfu from 'socket.io-client';
import * as Redis from 'ioredis';
import * as Redlock from 'redlock';
import { Signaling } from './signaling';

/**
 * Laravel Echo Call handler
 */
export class Call {
    private ioEcho: any;
    private options: any;
    private redis: any;
    private redlock: any;
    private signaling: Array<Signaling>;

    constructor(ioEcho: any, options: any) {
        this.ioEcho = ioEcho;
        this.options = options;

        this.redis = new Redis({
          host: this.options.databaseConfig.redis.host,
          port: this.options.databaseConfig.redis.port,
          password: this.options.databaseConfig.redis.password,
        });
        this.redlock = new Redlock([this.redis]);

        this.signaling = [];
        this.options.sfuHosts.forEach(sfuHost => {
            const socket = ioSfu.connect(sfuHost);
            this.signaling.push(new Signaling(socket));

            socket.on('newConsumer', (data) => {
                const payload = {
                    id: data.id,
                    producerId: data.producerId,
                    kind: data.kind,
                    rtpParameters: data.rtpParameters
                };

                this.ioEcho.to(data.socketId).emit('call-newConsumer', payload);
            });
        });
    }

    public async handle(socket, payload, callback): Promise<void> {
        // Get call key
        const callKey = payload.channel.replace('presence-App.Call.', '');

        // Get signaling index key
        const signalingIndexKey = `${this.options.databaseConfig.redis.adapterKeyPrefix}_signaling_index_${callKey}`;

        // Get call event type
        const type = payload.event.replace('call-', '');

        // Assign call to signaling index
        if (type === 'getRouterCapabilities') {
            const lockKey = `${this.options.databaseConfig.redis.adapterKeyPrefix}_signaling_lock`;
            const nextIndexKey = `${this.options.databaseConfig.redis.adapterKeyPrefix}_signaling_nextIndex`;

            const lock = await this.redlock.lock(lockKey, 5000);

            try {
                let signalingIndex = parseInt(await this.redis.get(signalingIndexKey));

                if (isNaN(signalingIndex)) {
                    let nextIndex = parseInt(await this.redis.get(nextIndexKey));

                    if (isNaN(nextIndex)) {
                        nextIndex = 0;
                    }

                    if (nextIndex >= this.options.sfuHosts.length) {
                        nextIndex = nextIndex % this.options.sfuHosts.length;
                    }

                    await this.redis.set(signalingIndexKey, nextIndex);

                    await this.redis.set(nextIndexKey, (nextIndex + 1) % this.options.sfuHosts.length);
                }
            } finally {
                lock.unlock();
            }
        }

        // Get signaling index
        let signalingIndex = parseInt(await this.redis.get(signalingIndexKey));

        if (!isNaN(signalingIndex)) {
            // Add socket id to sfu event payload
            payload.data.socketId = socket.id;

            // Forward event to sfu
            this.signaling[signalingIndex].request(type, payload.data)
                .then(response => { callback(response) })
                .catch(error => { callback({ error: error.message }) });
        }
    }

    public leave(socket): void {
        this.signaling.forEach(signalingElement => {
            signalingElement.request('socketDisconnect', { socketId: socket.id });
        });
    }

    public broadcast(channel, message): void {
        const callInsufficientTokensEvent = this.options.callInsufficientTokensEvent || 'App\\Events\\CallInsufficientTokens';

        if (message.event === callInsufficientTokensEvent) {
            const room = this.ioEcho.sockets.adapter.rooms[channel];

            if (room && room.sockets) {
                Object.keys(room.sockets).forEach(socketId => {
                    this.signaling.forEach(signalingElement => {
                        signalingElement.request('socketDisconnect', { socketId });
                    });
                });
            }
        }
    }
}
