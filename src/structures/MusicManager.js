const { Collection } = require("discord.js");
const { PlayerManager } = require("discord.js-lavalink");

class MusicManager {
    /**
     * @param {import("../bot").client} client
     */
    constructor(client) {
        this.client = client;
        this.player = new PlayerManager(client, client.config.nodes,  {
            user: client.user.id,
            shards: client.shard ? client.shard.count : 0
        });
        this.queue = new Collection();
    }

    handleVideo(message, voiceChannel, song) {
        const serverQueue = this.queue.get(message.guild.id);
        song.requestedBy = message.author;
        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel,
                player: null,
                songs: [song],
                volume: 100,
                playing: true,
                loop: false
            };
            this.queue.set(message.guild.id, queueConstruct);

            try {
                queueConstruct.player = this.player.join({
                    channel: voiceChannel.id,
                    guild: message.guild.id,
                    host: this.player.nodes.first().host
                }, {
                    selfdeaf: true
                });
                this.play(message.guild, song);
            } catch (error) {
                console.error(`I could not join the voice channel: ${error}`);
                this.queue.delete(message.guild.id);
                this.player.leave(message.guild.id);
                message.channel.send(`I could not join the voice channel: ${error.message}`);
            }
        } else {
            serverQueue.songs.push(song);
            message.channel.send(`Successfully added **${song.info.title}** to the queue!`);
        }
    }

    play(guild, song) {
        const serverQueue = this.queue.get(guild.id);
        if (!song) {
            serverQueue.textChannel.send("Queue is empty! Leaving voice channel..");
            this.player.leave(guild.id);
            this.queue.delete(guild.id);
        } else {
            serverQueue.player.play(song.track);
            serverQueue.player
                .once("error", console.error)
                .once("end", data => {
                    if (data.reason === "REPLACED") return;
                    const shiffed = serverQueue.songs.shift();
                    if (serverQueue.loop === true) {
                        serverQueue.songs.push(shiffed);
                    }
                    this.play(guild, serverQueue.songs[0]);
                });
            serverQueue.player.volume(serverQueue.volume);
            serverQueue.textChannel.send(`Now playing: **${song.info.title}** by *${song.info.author}*`);
        }
    }

    async getSongs(query) {
        const node = this.player.nodes.first();
        const params = new URLSearchParams();
        params.append("identifier", query);

        let result;
        try {
            result = await this.client.request.get(`http://${node.host}:${node.port}/loadtracks?${params.toString()}`)
                .set('Authorization', node.password);
        } catch (e) {
            throw Error(e);
        }
        return result.body.tracks;
    }
}

module.exports = MusicManager;