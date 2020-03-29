
/**
 * Laravel Echo Call handler
 */
export class Call {
    /**
     * Create new Call instance.
     */
    constructor(io: any, options: any) {
        this.io = io;
        this.options = options;
    }

    /**
     * Socket.io client.
     *
     * @type {object}
     */
    private io: any;

    /**
     * Laravel Echo options.
     *
     * @type {object}
     */
    private options: any;


    /**
     * Handle call event.
     */
    handle(socket, data): void {
        console.log(data);

        this.io.sockets.connected[socket.id]
            .broadcast.to(data.channel)
            .emit(data.event, data);
    }
}