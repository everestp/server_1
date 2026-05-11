import http from "http";
import { Server } from "socket.io";
import express from "express";

let io: Server;

export const initSocket = (
  app: express.Application
) => {
  const server = http.createServer(app);

  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://breezonetwork.xyz",
        "https://www.breezonetwork.xyz",
      ],

      methods: ["GET", "POST"],

      credentials: true,
    },

    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(
      "⚡ Client connected:",
      socket.id
    );

    // MAP ROOM
    socket.on("join:map", () => {
      socket.join("map");

      console.log(
        `📍 ${socket.id} joined map`
      );
    });

    // DASHBOARD ROOM
    socket.on("join:dashboard", () => {
      socket.join("dashboard");

      console.log(
        `📊 ${socket.id} joined dashboard`
      );
    });

    socket.on("disconnect", () => {
      console.log(
        "❌ Client disconnected:",
        socket.id
      );
    });
  });

  return server;
};

export const getIO = () => {
  if (!io)
    throw new Error(
      "Socket not initialized"
    );

  return io;
};
