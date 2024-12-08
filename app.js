import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { v4 as genuuid } from 'uuid';

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
        req.session.game = {gameroom_id: 0}; //TODO- look back at
        res.status(200).sendFile(__dirname + `/frontend/views/homepage.html`);
    } else { //if no session set redirect to login
        res.status(401).redirect(`/`);
    }
});

//needs work TODO
app.get(`/gameroom`, (req, res) => {
    if (req.session.user) {
        req.session.game = {gameroom_id: 1};
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

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomID) => {
        if (socket.request.session.game.gameroom_id == roomID) {
            socket.join(roomID);
        }else {
            //TODO look back at
            console.error('error', 'mismatch gameroom ids');
            socket.leave(socket.request.session.game.gameroom_id); //leave last known room
            socket.join(roomID); //join correct room
            socket.request.session.game.gameroom_id = roomID; //set correct room id

        }
        console.log(roomID);
    });

    socket.on('chat message', (msg) => {
        console.log(socket.request.session.game.gameroom_id);
        io.to(socket.request.session.game.gameroom_id).emit('chat message', socket.request.session.user.username + ': ' + msg)
    });
  });

server.listen(3000, () => {
    console.log('Server Starting on http://localhost:3000');
});