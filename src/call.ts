import { Signaling } from './signaling';
import * as ioSfu from 'socket.io-client';

/**
 * Laravel Echo Call handler
 */
export class Call {
    private ioEcho: any;
    private options: any;
    private signaling: Signaling;

    constructor(ioEcho: any, options: any) {
        this.ioEcho = ioEcho;
        this.options = options;

        const socket = ioSfu.connect(this.options.sfuHost);
        this.signaling = new Signaling(socket);

        socket.on('newConsumer', (data) => {
            const payload = {
                id: data.id,
                producerId: data.producerId,
                kind: data.kind,
                rtpParameters: data.rtpParameters
            };

            this.ioEcho.to(data.socketId).emit('call-newConsumer', payload);
        });
    }

    public handle(socket, payload, callback): void {
        // Get call event type
        const type = payload.event.replace('call-', '');

        // Add socket id to sfu event payload
        payload.data.socketId = socket.id;

        // Forward event to sfu
        this.signaling.request(type, payload.data)
            .then(response => { callback(response) })
            .catch(error => { callback({ error: error.message }) });
    }

    public leave(socket): void {
        this.signaling.request('socketDisconnect', { socketId: socket.id });
    }
}