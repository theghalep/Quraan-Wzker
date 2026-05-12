import { Server } from "socket.io";

let io: Server | null = null;

export function initSocket(server: any) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", () => {
    console.log("Socket connected");
  });

  return io;
}

export function getIO() {
  return io;
}