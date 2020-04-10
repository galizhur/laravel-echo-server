import { Socket } from 'socket.io-client';

export class Signaling {
    socket: Socket

    constructor(socket: Socket) {
        this.socket = socket;
    }

    request(type, data) {
        return new Promise((resolve, reject) => {
            this.socket.emit(type, data, (response) => {
                if (response && response.error) {
                    reject(response.error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    on(type, callback) {
        this.socket.on(type, callback);
    }
}