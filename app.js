import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { v4 as genuuid } from 'uuid';


import bodyParser from 'body-parser'

import http from 'http';
import {Server} from 'socket.io';


//Remove later TODO
import {DB} from './server/data_access/DataAccess.js';
//import {User} from './server/buisseness/User.js';

const app = express();


// create websocket server
const server = http.createServer(app);
const io = new Server(server);

// Get the current file's full path
const __filename = fileURLToPath(import.meta.url);
// Get the current directory
const __dirname = path.dirname(__filename);

app.use(morgan(`tiny`));
app.use(express.static(path.join(__dirname, `frontend`)));
app.use(express.urlencoded({extended: true}));

app.use(bodyParser.json());


// move or put in a file TODO
const options = 
{
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Penny10187Bruno10187',
    database: '442'
};

const mySQLStore = MySQLStore(session);
const sessionStore = new mySQLStore(options);

const sessionMW = session({
    genid: function (req) {
        return genuuid(); // use UUIDs for session IDs
    },
    key: 'session_cookie_name',
	secret: 'session_cookie_secret',
	store: sessionStore,
	resave: false,
	saveUninitialized: false,
    cookie: {}
});

app.use(sessionMW);

//websocket session sharing
io.engine.use(sessionMW);

// needs work TODO
app.get('/', (req,res) => {
    res.status(200).sendFile(__dirname + '/frontend/views/login.html');
});

//need get login route TODO

app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    // still needs work TODO
    const db = new DB();
    db.getUserByUsername(username)
        .then(async result => {
            //console.log(result.passwordHash);
            const passCheck = await result.checkLogin(password);
            
            if (passCheck) {
                req.session.user = result;
                res.status(200).redirect(`/homepage`);
            } else {
                res.status(400).send(`<h2>Invalid Username or Password.</h2><a href="/">Try Again</a>`);
            }
        }).catch(error => {
            console.log("getUserByUsername Error: ", error);
            res.status(400).send(`<h2>Invalid Username or Password.</h2><a href="/">Try Again</a>`);
        });
});

//needs work TODO
app.get(`/homepage`, (req, res) => {
    if (req.session.user) { //if session set allow access to homepage
        //see if player is part of a active game TODO

        req.session.room_id = -1; //TODO- look back at
        res.status(200).sendFile(__dirname + `/frontend/views/homepage.html`);
    } else { //if no session set redirect to login
        res.status(401).redirect(`/`);
    }
});

app.post(`/createGameRoom`, (req, res) => {
    //create the game room in the DB
    const db = new DB();
    db.CreateGameRoom().then( result => {
        console.log(result);
        if (result) { req.session.room_id = result; }
        else { return res.status(500); }

        // send game room id to opponant so they can join
        io.to(req.body.opponentSocketId).emit('gameroom created', req.session.room_id);

        res.status(200).json({url: `/gameroom/${req.session.room_id}`});
    }).catch(error => {
        console.log("createGameRoom Error: ", error);
        return res.status(500);
    });
});

//needs work TODO
app.get(`/gameroom/:room_id`, (req, res) => {
    //check to make use user is suposed to be in the game room TODO
    if (req.session.user) {
        if (req.session.room_id !== req.params.room_id) { req.session.room_id = req.params.room_id; }
        res.status(200).sendFile(__dirname + `/frontend/views/gameroom.html`);
    }
});



// game testing TODO
const BOARD_SIZE = 10;
const SHIPS = [5, 4, 3, 3, 2]; // Ship lengths
let enemyShips = generateShips();
let playerShips = generateShips();

app.get(`/gameboard`,(req, res) => {
    res.status(200).sendFile(__dirname + `/frontend/views/gameboard.html`);
});

app.get("/setup", (req, res) => {
    res.json({ ships: playerShips.flat() });
  });
  
  app.get("/attack", (req, res) => {
    const index = parseInt(req.query.index, 10);
    const hit = enemyShips.some(ship => ship.includes(index));
    res.json({ hit });
  });
  
// Generate Ships
function generateShips() {
    const board = [];
    while (board.length < SHIPS.length) {
      const ship = placeShip(SHIPS[board.length], board);
      board.push(ship);
    }
    return board;
  }
  
  function placeShip(length, existingShips) {
    let isValid = false;
    let ship = [];
  
    while (!isValid) {
      const isHorizontal = Math.random() > 0.5;
      const start = Math.floor(Math.random() * BOARD_SIZE * BOARD_SIZE);
      ship = [];
      for (let i = 0; i < length; i++) {
        const position = isHorizontal ? start + i : start + i * BOARD_SIZE;
  
        // Ensure the ship stays within row or column bounds
        const isWithinRow = isHorizontal
          ? Math.floor(position / BOARD_SIZE) === Math.floor(start / BOARD_SIZE)
          : position < BOARD_SIZE * BOARD_SIZE;
  
        if (isWithinRow) {
          ship.push(position);
        } else {
          break;
        }
      }
  
      // Validate ship placement
      isValid = ship.length === length && isValidShip(ship, existingShips);
    }
  
    return ship;
  }
  
  function isValidShip(ship, existingShips) {
    // Ensure ship doesn't overlap with existing ships
    return !existingShips.flat().some(cell => ship.includes(cell));
  }



//needs word TODO
// io.on('connection', (socket) => {
//     console.log('a user connected');
//     socket.on('disconnect', () => {
//         console.log('user disconnected');
//     });
// });

// io.on('connection', (socket) => {
//     socket.on('chat message', (msg) => {
//       console.log('message: ' + msg);
//     });
//   });

//testing TODO look back at
app.get(`/getUsers`, (req, res) => {
    const clients = io.sockets.adapter.rooms.get(-1);
    //console.log(clients);

    if (!clients) { return res.status(204)} //if no clients return without sending playerList

    var players = [];

    for (const clientId of clients.values() ) {
        const clientSocket = io.sockets.sockets.get(clientId);
        const clientSession = clientSocket.request.session;
        if (clientSession.user.id != req.session.user.id) { // keep yourself out of the player list
            players.push({socketID: clientSocket.id, clientName: clientSession.user.username});
        }
    }

    res.status(200).json({playerList: players}); 
});

io.on('connection', (socket) => {
    // console.log(socket.id);
    // console.log(socket.request.session.id);
    socket.on('joinRoom', (roomID) => {
        if (socket.request.session.room_id == roomID) {
            socket.join(roomID);
            console.log(`${socket.request.session.user.username} joined roomID: `, roomID);
            io.to(roomID).emit('user list update')
        } else {
            //TODO look back at
            console.error('error', `mismatch gameroom ids for ${socket.request.session.user.username}`);
            socket.leave(parseInt(socket.request.session.room_id)); //leave last known room
            console.log(`${socket.request.session.user.username} left roomID: `, socket.request.session.room_id);
            io.to(socket.request.session.room_id).emit('user list update')
            socket.join(roomID); //join correct room
            console.log(`${socket.request.session.user.username} joined roomID: `, roomID);
            io.to(roomID).emit('user list update')
            socket.request.session.room_id = roomID; //set correct room id

        }
        //console.log(`Current room ID for ${socket.request.session.user.username}`, roomID);
    });

    socket.on('challenge', (socketID) => {
        const clientSocket = io.sockets.sockets.get(socketID);
        if (!clientSocket) { return false } // if clientSocket does not exist return TODO send deny back to challenger to prevent getting stuck
        console.log(`${socket.request.session.user.username} has challenged ${clientSocket.request.session.user.username}`);
        socket.to(socketID).emit('challenge', {challengerUsername: socket.request.session.user.username, challengerSocketId: socket.id});
    });

    socket.on('accept', (challengerSocketId) => {
        socket.to(challengerSocketId).emit('accept', {challengerSocketId: challengerSocketId, opponentSocketId: socket.id});
    }); 

    socket.on('chat message', (msg) => {
        console.log(`${socket.request.session.user.username} sent a message to room id: `, socket.request.session.room_id);
        io.to(parseInt(socket.request.session.room_id)).emit('chat message', socket.request.session.user.username + ': ' + msg);
        //console.log(socket.rooms);
    });
  });

server.listen(3000, () => {
    console.log('Server Starting on http://localhost:3000');
});