const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const clientRooms = {};

const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.use(express.static("public"));
app.use("/images", express.static("images"));

// app.get("/master", (req, res) => {
//   res.sendFile(__dirname + "/master.html");
// });

let players = {};
let numbers = {};
const MAX = 50;
const ROW = 5;
const COL = 5;

function randomLoto(number) {
  let lotos = [];
  for (let i = 0; i < number; i++) {
    let a = [];
    while (a.length < ROW * COL) {
      let i = Math.floor(a.length / 5) * 10 + 1;

      let num = Math.floor(Math.random() * 10);
      while (a.includes(num + i)) {
        num = Math.floor(Math.random() * 10);
      }
      num += i;
      a.push(num);
    }
    lotos.push(a);
  }
  return lotos;
}

io.on("connection", (client) => {
  client.on("newGame", handleNewGame);
  client.on("joinGame", handleJoinGame);
  client.on("namePlayer", handleName);
  client.on("startGame", startGame);
  client.on("callNumber", callNumber);
  client.on("progress", progress);
  client.on("win", winGame);

  function winGame(room) {
    let nameWinner = "";
    players[room].forEach((val) => {
      if (client.id == val.id) {
        nameWinner = val.name;
      }
    });
    client.in(room).emit("winner", nameWinner);
  }
  function progress({ lotos, room }) {
    players[room].forEach((val) => {
      if (client.id == val.id) {
        val.Lotos = lotos;
      }
    });
    io.to(`${players[room][0].id}`).emit("allPlayer", {
      players: players[room],
    });
  }
  function callNumber(roomName) {
    let num = Math.floor(Math.random() * 50) + 1;
    while (numbers[roomName].includes(num) && numbers[roomName].length < 50) {
      num = Math.floor(Math.random() * 50) + 1;
    }
    if (numbers[roomName].length < 50) {
      numbers[roomName].push(num);
      io.in(roomName).emit("call", num);
    }
  }

  function startGame(roomName) {
    let Lotos = randomLoto(players[roomName].length);
    players[roomName].forEach((val, ind) => {
      Lotos[ind].sort(function (a, b) {
        return a - b;
      });
      let a = [];
      let tmp = [];
      Lotos[ind].forEach((val1, ind1) => {
        tmp.push({ flag: false, value: val1 });
        if ((ind1 + 1) % 5 == 0) {
          a.push(tmp);
          tmp = [];
        }
      });
      val["Lotos"] = a;
      io.to(`${val.id}`).emit("lotoGamePlay", a);
    });
    io.to(`${players[roomName][0].id}`).emit("allPlayer", {
      players: players[roomName],
    });
  }

  function handleJoinGame(roomName) {
    const flag = io.sockets.adapter.rooms.has(roomName);
    if (flag) {
      client.join(roomName);
      io.to(`${client.id}`).emit("success", {
        roomName,
      });
    } else {
      io.to(`${client.id}`).emit("fail");
    }
  }

  function handleNewGame() {
    let roomName = makeId(4);
    clientRooms[client.id] = roomName;
    client.emit("gameCode", roomName);
    client.join(roomName);
    players[roomName] = [];
    numbers[roomName] = [];
    players[roomName].push({ id: client.id, name: "admin" });
  }

  function handleName({ name, roomName }) {
    players[roomName].push({ id: client.id, name });
    io.to(`${players[roomName][0].id}`).emit(
      "newPlayerJoined",
      players[roomName]
    );
    io.in(roomName).emit("updateList", players[roomName]);
  }
});

server.listen(port, () => {
  console.log("listening on port 3000");
});

function makeId(length) {
  var result = "";
  var characters = "0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
