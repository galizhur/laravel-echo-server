const Peer = require('simple-peer')
const wrtc = require('wrtc')

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

        this.participants = [];
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
     * List of connected participants.
     *
     * @type {Array<object>}
     */
    private participants: Array<any>;


    /**
     * Handle call event.
     */
    public handle(socket, payload): void {
        if (payload.event === 'call-connect') {
            this.callConnect(socket, payload);
        } else if (payload.event === 'call-signal') {
            this.callSignal(socket, payload);
        }
    }

    /**
     * Handle call connect event.
     */
    private callConnect(socket, payload) {
        // Init participant to room
        const participant = {
            socket: socket,
            stream: null,
            peer: null
        };

        // Create peer connection
        participant.peer = new Peer({ wrtc: wrtc });

        // On signal received
        participant.peer.on('signal', data => {
            socket.emit('call-signal', data);
        });

        // On stream added
        participant.peer.on('stream', stream => {
            participant.stream = stream;

            // Get participant call room name
            const roomName = Object.keys(this.io.sockets.adapter.sids[socket.id])
                .find(roomName => roomName.startsWith('presence-App.Call.'));

            if (roomName === undefined) {
                return;
            }

            // Get other participant's socket id
            const otherSocketId = Object.keys(this.io.sockets.adapter.rooms[roomName].sockets)
                .find(socketId => socketId !== socket.id);

            if (otherSocketId === undefined) {
                return;
            }

            // Get other participant
            const otherParticipant = this.participants.find(participant => participant.socket.id === otherSocketId);

            if (otherParticipant === undefined) {
                return;
            }

            // Add my streams to the other participant 
            otherParticipant.peer.addStream(participant.stream);

            // Add other participant's streams to me
            if (otherParticipant.stream) {
                participant.peer.addStream(otherParticipant.stream);
            }
        });

        // Add participant to participants list
        this.participants.push(participant);

        // Accept RTC Peer connection request
        socket.emit(payload.event, {});
    }

    /**
     * Handle call signal event.
     */
    private callSignal(socket, payload) {
        const participant = this.participants.find(participant => participant.socket.id === socket.id);
        participant.peer.signal(payload.data);
    }
}