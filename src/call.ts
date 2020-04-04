const { RTCIceCandidate, RTCPeerConnection } = require('wrtc');

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

        this.peerConfig = {
            iceServers: [{
                urls: ['stun:stun.l.google.com:19302']
            }]
        };
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
     * RTC Peer default config.
     *
     * @type {object}
     */
    private peerConfig: any;

    /**
     * Handle call event.
     */
    public handle(socket, payload): void {
        if (payload.event === 'call-connect') {
            this.callConnect(socket, payload);
        } else if (payload.event === 'call-offer') {
            this.callOffer(socket, payload);
        } else if (payload.event === 'call-answer') {
            this.callAnswer(socket, payload);
        } else if (payload.event === 'call-candidate') {
            this.callCandidate(socket, payload);
        }
    }

    /**
     * Handle call connect event.
     */
    private callConnect(socket, payload) {
        // Init participant to room
        const participant = {
            socket: socket,
            streams: null,
            peer: null
        };

        // Create peer connection
        participant.peer = new RTCPeerConnection(this.peerConfig);

        // On ICE candidate
        participant.peer.onicecandidate = ({ candidate }) => {
            if (candidate) {
                console.log(`send candidate to ${socket.id}`);

                socket.emit('call-candidate', { candidate: candidate });
            }
        };

        // On negotiation needed
        participant.peer.onnegotiationneeded = () => {
            participant.peer.createOffer()
                .then((description) => participant.peer.setLocalDescription(description))
                .then(() => {
                    console.log(`send offer to ${socket.id}`);
                    
                    socket.emit('call-offer', { description: participant.peer.localDescription });
                });
        };

        // On track added
        participant.peer.ontrack = ({ streams }) => {
            console.log(`received tracks from ${socket.id}`);

            participant.streams = streams;

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
            participant.streams.forEach(stream => {
                stream.getTracks().forEach((track) => {
                    try { otherParticipant.peer.addTrack(track, stream); } catch (e) { }
                });
            });

            // Add other participant's streams to me
            if (otherParticipant.streams) {
                otherParticipant.streams.forEach(stream => {
                    stream.getTracks().forEach((track) => {
                        try { participant.peer.addTrack(track, stream); } catch (e) { }
                    });
                });
            }
        };

        // Add participant to participants list
        this.participants.push(participant);

        // Accept RTC Peer connection request
        socket.emit(payload.event, {});
    }

    /**
     * Handle call offer event.
     */
    private callOffer(socket, payload) {
        console.log(`received offer from ${socket.id}`);

        const participant = this.participants.find(participant => participant.socket.id === socket.id);

        participant.peer.setRemoteDescription(payload.data.description)
            .then(() => participant.peer.createAnswer())
            .then((description) => participant.peer.setLocalDescription(description))
            .then(() => {
                socket.emit('call-answer', { description: participant.peer.localDescription });
            });
    }

    /**
     * Handle call answer event.
     */
    private callAnswer(socket, payload) {
        console.log(`received answer from ${socket.id}`);

        const participant = this.participants.find(participant => participant.socket.id === socket.id);

        participant.peer.setRemoteDescription(payload.data.description);
    }

    /**
     * Handle call candidate event.
     */
    private callCandidate(socket, payload) {
        console.log(`received candidate from ${socket.id}`);

        const participant = this.participants.find(participant => participant.socket.id === socket.id);

        participant.peer.addIceCandidate(new RTCIceCandidate(payload.data.candidate));
    }
}