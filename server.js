const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

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

let entireRooms = {};
let numbers = {};
const MAX_LOTO = 50;
const ROW_LOTO = 5;
const COL_LOTO = 5;

function randomLoto(number) {
  let lotos = [];
  for (let i = 0; i < number; i++) {
    let a = [];
    while (a.length < ROW_LOTO * COL_LOTO) {
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
  client.on("ready", handleReady);
  client.on("disconnect", handleDisconnect);
  client.on("playAgain", playAgain);
  client.on("closeWin", closeWin);
  function closeWin({ room, namePlayer }) {
    io.in(room).emit("closeWin", namePlayer);
  }

  function playAgain(room) {
    entireRooms[room]["numbers"] = [];
    entireRooms[room]["playing"] = false;
    entireRooms[room]["players"].forEach((val, ind) => {
      if (ind > 0) {
        val.state = false;
      }
    });
    io.in(room).emit("again", entireRooms[room]);
  }
  function handleDisconnect() {
    for (room in entireRooms) {
      entireRooms[room]["players"].forEach((val, ind) => {
        if (val.id == client.id) {
          entireRooms[room]["players"].splice(ind, 1);
          io.in(room).emit("updateList", entireRooms[room]);
          if (ind == 0) {
            delete entireRooms[room];
            io.in(room).emit("reload");
          }
        }
      });
    }
  }

  function handleReady(roomName) {
    entireRooms[roomName]["players"].forEach((val) => {
      if (val.id == client.id) {
        val.state = true;
      }
    });
    io.in(roomName).emit("updateList", entireRooms[roomName]);
  }

  function winGame(room) {
    let nameWinner = "";
    entireRooms[room]["players"].forEach((val, ind) => {
      if (client.id == val.id) {
        nameWinner = val.name;
      }
    });
    client.in(room).emit("winner", nameWinner);
  }
  function progress({ lotos, room }) {
    entireRooms[room]["players"].forEach((val) => {
      if (client.id == val.id) {
        val.Lotos = lotos;
      }
    });
    io.to(`${entireRooms[room]["players"][0].id}`).emit(
      "allPlayer",
      entireRooms[room]
    );
  }
  function callNumber(roomName) {
    let num = Math.floor(Math.random() * 50) + 1;
    while (
      entireRooms[roomName]["numbers"].includes(num) &&
      entireRooms[roomName]["numbers"].length < 50
    ) {
      num = Math.floor(Math.random() * 50) + 1;
    }
    if (entireRooms[roomName]["numbers"].length < 50) {
      entireRooms[roomName]["numbers"].push(num);
      io.in(roomName).emit("call", num);
    }
  }

  function startGame(roomName) {
    let Lotos = randomLoto(entireRooms[roomName]["players"].length);
    entireRooms[roomName]["players"].forEach((val, ind) => {
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
    entireRooms[roomName]["playing"] = true;
    io.to(`${entireRooms[roomName]["players"][0].id}`).emit(
      "allPlayer",
      entireRooms[roomName]
    );
  }

  function handleJoinGame(roomName) {
    const flag = io.sockets.adapter.rooms.has(roomName);
    if (flag) {
      const flag1 = entireRooms[roomName]["playing"];
      if (!flag1) {
        client.join(roomName);
        io.to(`${client.id}`).emit("success", {
          roomName,
        });
      } else {
        io.to(`${client.id}`).emit("fail", {
          message: "Ván loto đang diễn ra.",
        });
      }
    } else {
      io.to(`${client.id}`).emit("fail", {
        message: "Mã phòng không tồn tại!",
      });
    }
  }

  function handleNewGame() {
    let roomName = makeId(4);
    let a = Object.keys(entireRooms);
    while (a.includes(roomName)) {
      roomName = makeId(4);
    }
    // clientRooms[client.id] = roomName;
    io.to(`${client.id}`).emit("gameCode", roomName);
    client.join(roomName);
    entireRooms[roomName] = {};
    entireRooms[roomName]["players"] = [];
    entireRooms[roomName]["numbers"] = [];
    entireRooms[roomName]["playing"] = false;
    entireRooms[roomName]["players"].push({
      id: client.id,
      name: "Chủ phòng",
      state: true,
    });
    io.in(roomName).emit("updateList", entireRooms[roomName]);
  }

  function handleName({ name, roomName }) {
    entireRooms[roomName]["players"].push({
      id: client.id,
      name,
      state: false,
    });
    // io.to(`${entireRooms[roomName][0].id}`).emit(
    //   "newPlayerJoined",
    //   entireRooms[roomName]
    // );
    io.in(roomName).emit("updateList", entireRooms[roomName]);
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
