const dotenv = require("dotenv");
dotenv.config({ silent: process.env.NODE_ENV === 'production' });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://directdashv2.vercel.app",
  "https://directdash.netlify.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

const httpServer = http.createServer(app);

app.get("/", (req, res) => {
  res.send("Server is running smoothly");
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Using const for Maps
const records = new Map();
const usersToUniquedID = new Map();
const uniqueIdTousers = new Map();

io.on("connection", (socket) => {
  
  socket.on("joinRoom", (temp) => {
    const roomStr = String(temp); // Better to use strings for room names
    socket.join(roomStr);
    records.set(socket.id, roomStr);
    socket.emit("ack", `You have joined room ${roomStr}`);
  });

  socket.on("message", (temp) => {
    const roomNum = records.get(socket.id);
    if (roomNum) {
      io.to(roomNum).emit("roomMsg", temp);
    }
  });

  socket.on("details", (data) => {
    const user = data.socketId;
    const uniqueId = data.uniqueId;

    usersToUniquedID.set(user, uniqueId);
    uniqueIdTousers.set(uniqueId, user);

    console.log(`New User added: ${user} -> ${uniqueId}`);
  });

  socket.on("send-signal", (temp) => {
    const to = temp.to;
    const socketOfPartner = uniqueIdTousers.get(to);

    // Guard clause to ensure partner is still connected
    if (socketOfPartner) {
      io.to(socketOfPartner).emit("signaling", {
        from: temp.from,
        signalData: temp.signalData,
        to: temp.to,
      });
    } else {
      console.log(`Partner ${to} not found for signaling.`);
    }
  });

  socket.on("accept-signal", (temp) => {
    const to = temp.to;
    const socketOfPartner = uniqueIdTousers.get(to);

    // Guard clause to ensure partner is still connected
    if (socketOfPartner) {
      io.to(socketOfPartner).emit("callAccepted", {
        signalData: temp.signalData,
        to: temp.to,
      });
    } else {
      console.log(`Partner ${to} not found for call acceptance.`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);

    const user = socket.id;
    const uniqueId = usersToUniquedID.get(user);

    // Clean up all maps to prevent memory leaks
    if (uniqueId) {
      uniqueIdTousers.delete(uniqueId);
    }
    usersToUniquedID.delete(user);
    records.delete(user); 
  });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
