import http from "http";
import { Server } from "socket.io";
import express from "express";

let io: Server;

export const initSocket = (app: express.Application) => {
  const server = http.createServer(app);

  io = new Server(server, {
    cors: {
      origin: "*", // lock this in production
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("⚡ Client connected:", socket.id);

    socket.on("join:map", () => {
      socket.join("map");
    });

    socket.on("join:dashboard", () => {
      socket.join("dashboard");
    });

    socket.on("disconnect", () => {
      console.log(" Client disconnected:", socket.id);
    });
  });

  return server;
};

// global accessor (IMPORTANT)
export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};
