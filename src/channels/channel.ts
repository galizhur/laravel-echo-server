import { PresenceChannel } from './presence-channel';
import { PrivateChannel } from './private-channel';
import { Log } from './../log';
import { Call } from '../call';

export class Channel {
    /**
     * Channels and patters for private channels.
     */
    protected _privateChannels: string[] = ['private-*', 'presence-*'];

    /**
     * Allowed client events
     */
    protected _clientEvents: string[] = ['client-*'];

    /**
     * Allowed call events
     */
    protected _callEvents: string[] = ['call-*'];

    /**
     * Private channel instance.
     */
    private: PrivateChannel;

    /**
     * Presence channel instance.
     */
    presence: PresenceChannel;

    /**
     * Call handler instance.
     */
    call: Call;

    /**
     * Create a new channel instance.
     */
    constructor(private io, private options) {
        this.private = new PrivateChannel(options);
        this.presence = new PresenceChannel(io, options);
        this.call = new Call(io, options);

        if (this.options.devMode) {
            Log.success('Channels are ready.');
        }
    }

    /**
     * Join a channel.
     */
    join(socket, data): void {
        if (data.channel) {
            if (this.isPrivate(data.channel)) {
                this.joinPrivate(socket, data);
            } else {
                socket.join(data.channel);
                this.onJoin(socket, data.channel);
            }
        }
    }

    /**
     * Trigger a client message
     */
    clientEvent(socket, data): void {
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = data;
        }

        if (data.event && data.channel) {
            if (this.isClientEvent(data.event) &&
                this.isPrivate(data.channel) &&
                this.isInChannel(socket, data.channel)) {
                this.io.sockets.connected[socket.id]
                    .broadcast.to(data.channel)
                    .emit(data.event, data.channel, data.data);
            }
        }
    }

    /**
     * Trigger a call event
     */
    callEvent(socket, data, callback): void {
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = data;
        }

        if (data.event && data.channel) {
            if (this.isCallEvent(data.event) &&
                this.isPrivate(data.channel) &&
                this.isInChannel(socket, data.channel)) {
                this.call.handle(socket, data, callback);
            }
        }
    }

    broadcast(channel, message): void {
        if (channel.startsWith(`presence-App.Call.`)) {
            this.call.broadcast(channel, message);
        }
    }

    /**
     * Leave a channel.
     */
    leave(socket: any, channel: string, reason: string): void {
        if (channel) {
            if (this.isPresence(channel)) {
                this.presence.leave(socket, channel);

                if (this.isCall(channel)) {
                    this.call.leave(socket);
                }
            }

            socket.leave(channel);

            if (this.options.devMode) {
                Log.info(`[${new Date().toLocaleTimeString()}] - ${socket.id} left channel: ${channel} (${reason})`);
            }
        }
    }

    /**
     * Check if the incoming socket connection is a private channel.
     */
    isPrivate(channel: string): boolean {
        let isPrivate = false;

        this._privateChannels.forEach(privateChannel => {
            let regex = new RegExp(privateChannel.replace('\*', '.*'));
            if (regex.test(channel)) isPrivate = true;
        });

        return isPrivate;
    }

    /**
     * Join private channel, emit data to presence channels.
     */
    joinPrivate(socket: any, data: any): void {
        this.private.authenticate(socket, data).then(res => {
            socket.join(data.channel);

            if (this.isPresence(data.channel)) {
                var member = res.channel_data;
                try {
                    member = JSON.parse(res.channel_data);
                } catch (e) { }

                this.presence.join(socket, data.channel, member);
            }

            this.onJoin(socket, data.channel);
        }, error => {
            if (this.options.devMode) {
                Log.error(error.reason);
            }

            this.io.sockets.to(socket.id)
                .emit('subscription_error', data.channel, error.status);
        });
    }

    /**
     * Check if a channel is a presence channel.
     */
    isPresence(channel: string): boolean {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    /**
     * Check if a channel is a call channel.
     */
    isCall(channel: string): boolean {
        return channel.lastIndexOf('presence-App.Call.', 0) === 0;
    }

    /**
     * On join a channel log success.
     */
    onJoin(socket: any, channel: string): void {
        if (this.options.devMode) {
            Log.info(`[${new Date().toLocaleTimeString()}] - ${socket.id} joined channel: ${channel}`);
        }
    }

    /**
     * Check if event is a client event
     */
    isClientEvent(event: string): boolean {
        let isClientEvent = false;

        this._clientEvents.forEach(clientEvent => {
            let regex = new RegExp(clientEvent.replace('\*', '.*'));
            if (regex.test(event)) isClientEvent = true;
        });

        return isClientEvent;
    }

    /**
     * Check if event is a call event
     */
    isCallEvent(event: string): boolean {
        let isCallEvent = false;

        this._callEvents.forEach(callEvent => {
            let regex = new RegExp(callEvent.replace('\*', '.*'));
            if (regex.test(event)) isCallEvent = true;
        });

        return isCallEvent;
    }

    /**
     * Check if a socket has joined a channel.
     */
    isInChannel(socket: any, channel: string): boolean {
        return !!socket.rooms[channel];
    }
}
