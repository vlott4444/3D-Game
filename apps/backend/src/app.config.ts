import { defineServer, defineRoom, LobbyRoom } from "colyseus";
import { MyRoom } from "./rooms/MyRoom.js";

const server = defineServer({
  rooms: {
    my_room: defineRoom(MyRoom).enableRealtimeListing(),
    lobby: defineRoom(LobbyRoom),
  },

});

export default server;
