import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { v4 as genuuid } from 'uuid';

import bodyParser from 'body-parser';

import dotenv from 'dotenv';
import http from 'http';
import {Server} from 'socket.io';

import bcrypt from 'bcrypt';
import crypto from 'crypto';

import 'isomorphic-fetch';

import { GameState } from './server/business/GameState.js';

//Remove later TODO
import {DB} from './server/data_access/DataAccess.js';
import { Board } from './server/business/Board.js';
//import {User} from './server/business/User.js';

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

dotenv.config();

// read values in from enviroment variables
const options = 
{
    host: process.env.host,
    port: process.env.port,
    user: process.env.user,
    password: process.env.password,
    database: process.env.database
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
    //redirect if user is auth
    if (req.session.user) { return res.status(200).redirect('/homepage'); }

    res.status(200).sendFile(__dirname + '/frontend/views/login.html');
});

app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const response_key = req.body["g-recaptcha-response"];
    const secret_key = process.env.recaptchaSecret;

    const url = 
    `https://www.google.com/recaptcha/api/siteverify?secret=${secret_key}&response=${response_key}`;

    // Make post to veriy captcha
    fetch(url, {
        method: "post",
    })
        .then((response) => response.json())
        .then((google_response) => {
            if (google_response.success == true) {
                const db = new DB();
                db.getUserByUsername(username)
                    .then(async result => {
                        const passCheck = await result.checkLogin(password);
                        
                        if (passCheck) {
                            req.session.user = result;
                            res.status(200).redirect(`/homepage`);
                        } else {
                            res.status(400).send(`<h2>Invalid Username or Password.</h2><a href="/">Try Again</a>`);
                        }
                    }).catch(error => {
                        console.error("getUserByUsername Error: ", error);
                        res.status(400).send(`<h2>Invalid Username or Password.</h2><a href="/">Try Again</a>`);
                    });
            } else {
                return res.status(401).redirect('/login');
            }
        }).catch((error) => {
          return res.json({ error });
        });
});

app.get('/register', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const timestamp = Date.now();

    // Combine the details to generate a nonce
    const rawData = `${ip}-${userAgent}-${timestamp}`;
    const nonce = crypto.createHash('sha256').update(rawData).digest('hex');

    req.session.nonce = nonce;

    // Send the HTML file with the nonce injected into it
    res.sendFile(path.join(__dirname, '/frontend/views/register.html'), {
        headers: {
            'X-Nonce': nonce,
        },
    });
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Register</title>
            </head>
            <body>
                <h2>Register</h2>
                <p class="error-message" id="register-error"></p>
                <form id="register" name="register" action="/register" method="post">
                    <label for="username">Username:</label><br>
                    <input type="text" id="username" name="username" /><br>
                    <label for="email">Email:</label><br>
                    <input type="email" name="email" id="email"><br>
                    <label for="password">Password:</label><br>
                    <input type="text" id="password" name="password" />
                    <input type="hidden" id="nonce" name="nonce">
                    <input type="hidden" id="timestamp" name="timestamp">
                    <br>
                    <input type="submit" value="Submit" />
                </form>
                <script>
                    // Inject the nonce dynamically into the hidden input field
                    const nonce = "${nonce}";
                    const timestamp = ${timestamp};

                    document.getElementById('nonce').value = nonce;
                    document.getElementById('timestamp').value = timestamp;
                </script>
            </body>
        </html>
    `);
});

app.post('/register', async(req, res) => {
    const { username, email, password, nonce, timestamp } = req.body;

    const expectedNonce = req.session.nonce;

    // Validate nonce and timestamp
    if (nonce !== expectedNonce) {
        return res.status(400).json({ error: 'Invalid nonce.' });
    }

    const currentTime = Date.now();
    const timeDifference = currentTime - timestamp;
    const MAX_NONCE_AGE = 5 * 60 * 1000; // 5 minutes in milliseconds
    if (timeDifference > MAX_NONCE_AGE) {
        return res.status(400).json({ error: 'Nonce expired.' });
    }

    const db = new DB();

    //check to make sure user name does not exist in DB
    var user = await db.getUserByUsername(username).catch(error => { console.error('error in getUserByUsername:', error); return res.sendStatus(500); });

    if (user) { return res.status(409).send(`<h2>Username already in use.</h2><a href="/register">Try Again</a>`); }

    const hashedPass  = await bcrypt.hash(password, 10);

    var createdUserId = await db.CreateUser(username, email, hashedPass)
        .catch(error => {
            console.error('error when Creating User: ', error);
        });

    if (createdUserId) { res.status(201).redirect('/'); }
    else { res.status(500).redirect('/register'); }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Logout failed.');
        }
        res.clearCookie('session_cookie_name');
        res.sendStatus(200);
    });
});

// set authentication middleware
function isAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).redirect('/');
    }
}

app.use(isAuth);

//needs work TODO
app.get(`/homepage`, (req, res) => {
    if (req.session.user) { //if session set allow access to homepage
        //see if player is part of a active game
        if (req.session.room_id && req.session.room_id != -1) { 
            return res.status(307).redirect(`/gameroom/${req.session.room_id}`); 
        }

        req.session.room_id = -1; // -1 since it will never be used for game id
        res.status(200).sendFile(__dirname + `/frontend/views/homepage.html`);
    } else { //if no session set redirect to login
        res.status(401).redirect(`/`);
    }
});

app.post(`/createGameRoom`, (req, res) => {
    //create the game room in the DB
    const db = new DB();
    db.CreateGameRoom(req.session.user.id, req.body.opponentId).then( result => {
        //console.log(result);
        if (result) { req.session.room_id = result; }
        else { return res.sendStatus(500); }

        // send game room id to opponant so they can join
        io.to(req.body.opponentSocketId).emit('gameroom created', req.session.room_id);

        req.session.gamestate = new GameState(req.session.room_id, req.session.user.id, req.body.opponentId);

        res.status(200).json({url: `/gameroom/${req.session.room_id}`});
    }).catch(error => {
        console.error("createGameRoom Error: ", error);
        return res.sendStatus(500);
    });
});

//needs work TODO
app.get(`/gameroom/:room_id`, async(req, res) => {
    //check to make use user is suposed to be in the game room
    const db = new DB();
    const x = await db.getGameState(req.params.room_id);
    if (x.winner) { req.session.room_id = -1; return res.status(403).redirect('/homepage'); } //if game is over redirect to homepage
    if (req.session.user.id != x.player1_id && req.session.user.id != x.player2_id) {
        return res.status(403).redirect('/homepage'); //user is not in this game redirect home
    }

    if (req.session.room_id != req.params.room_id) { req.session.room_id = req.params.room_id; }
    if(req.session.gamestate?.id != req.params.room_id) {
        // add the game state to the users session 
        // if the gamestate session variable is being set here they are player2
        req.session.gamestate = new GameState(parseInt(req.params.room_id), null, req.session.user.id);
        //console.log(`${req.session.user.username}: `, req.session.gamestate);
    } //else dont reset incase of refresh or reconnect

    res.status(200).sendFile(__dirname + `/frontend/views/gameroom.html`);
});

app.post(`/readyUp/:room_id`, async (req,res) => {
    //check to make usre user is suposed to be here
    const db = new DB();
    const temp = await db.getGameState(req.params.room_id);
    if (req.session.user.id != temp.player1_id && req.session.user.id != temp.player2_id) {
        return res.status(403).redirect('/homepage'); //user is not in this game redirect home
    }

    //validate user board TODO
    const gamestate = req.session.gamestate;
    const user = req.session.user;

    if(gamestate.id != req.params.room_id) { return res.sendStatus(400); } // the room_id the request is being sent from is not the same as what its supposed to go to

    if (gamestate.player1_id 
        && user.id == gamestate.player1_id) 
    { 
        gamestate.player1_ready = true; 
        gamestate.player1_board.id = user.id;
        gamestate.player1_board.ships = req.body.playerShips;
    }
    else if (gamestate.player2_id 
        && user.id == gamestate.player2_id) 
    { 
        gamestate.player2_ready = true;
        gamestate.player2_board.id = user.id;
        gamestate.player2_board.ships = req.body.playerShips; 
    }
    else { return res.sendStatus(400); }

    var x = await db.updateGameRoomReadyState(gamestate).catch(error => { console.error('error in updateGameRoomReadyState:', error); return res.sendStatus(500) } );

    req.session.gamestate = gamestate;

    res.sendStatus(200);
});

// send back if game is in start phase, play phase, or complete
app.get('/gamePhase', async(req,res) =>{
    // check if player has access
    const db = new DB(); 
    
    var currentGamestate = await db.getGameState(req.session.room_id).catch(error => { console.error('error in getGameState:', error); return res.sendStatus(500); });
    if (req.session.user.id != currentGamestate.player1_id && req.session.user.id != currentGamestate.player2_id) {
        return res.status(403).redirect('/homepage'); //user is not in this game redirect home
    }

    // check what phase the game is in based on the current gamestate and return relavent info based on it
    var p1_id = currentGamestate?.player1_id;
    var p2_id = currentGamestate?.player2_id;
    if(!(p1_id && p2_id)) { return res.status(200).json({phase: 'Setup'}); } // both player ids are not in the db so they cant be ready

    if(currentGamestate.winner) { return res.status(200).json({phase: 'GaveUp', currentGamestate: currentGamestate}); }// player gave up

    var p1_board = currentGamestate?.player1_board;
    var p2_board = currentGamestate?.player2_board;
    if(!(p1_board && p2_board)) { return res.status(200).json({phase: 'Setup'}); } // both player boards are not in the db so can not continue

    if(!(currentGamestate.player1_ready && currentGamestate.player2_ready)) { return res.status(200).json({phase: 'Setup'}); } // both players have not been set to ready

    //console.log(currentGamestate.winner);
    if((currentGamestate.player1_ready && currentGamestate.player2_ready) && !currentGamestate.winner) { 
        // set the gamestate session variable to the latest gamestate from the db
        req.session.gamestate = currentGamestate;
        var gamestate = req.session.gamestate;

        // if no playerTurn value is set then assume the game just started and set it to player 1 and update db
        if(!gamestate.playerTurn){
            // check if there are attacks on either player board, if there are this would mean the game was being played
            if (gamestate.player1_board.attacks.length == 0 && gamestate.player2_board.attacks.length == 0) {
                // if no attacks found
                var x = await db.updateGameRoomPlayerTurn(gamestate).catch(error => { console.error('error in updateGameRoomPlayerTurn:', error); return res.sendStatus(500); });
                if(x) { req.session.gamestate.playerTurn = gamestate.player1_id; } else { return res.sendStatus(500); } // error updating player turn in db
            } else { return res.sendStatus(500); } // there was a server issue that unset the player_turn LOOK BACK AT TODO
        }

        // if there is a playerTurn set send back the current relavent info to the client about the gamestate
        var resGamestate = new GameState(gamestate.id, p1_id, p2_id, new Board(), new Board(), 
            gamestate.player1_ready, gamestate.player2_ready, gamestate.playerTurn, gamestate.winner);

        // only send back info about the boards that is needed for each player. prevent being able to see the enemy ship locations
        if(resGamestate.player1_id == req.session.user.id) { 
            resGamestate.player1_board = gamestate.player1_board;
            resGamestate.player2_board.id = gamestate.player2_board.id;
            resGamestate.player2_board.attacks = gamestate.player2_board.attacks;
        }
        if(resGamestate.player2_id == req.session.user.id) { 
            resGamestate.player2_board = gamestate.player2_board; 
            resGamestate.player1_board.id = gamestate.player1_board.id;
            resGamestate.player1_board.attacks = gamestate.player1_board.attacks;
        }

        return res.status(200).json({phase: 'Started', gamestate: resGamestate, userId: req.session.user.id}); 
    } // both players have been set to ready and the game has not been won

    else { res.status(200).json({phase: 'Ended', gamestate: currentGamestate}); } // the game already has a winner send full gamestate object
});

app.get("/attack", async(req, res) => {
    const db = new DB();
    const temp = await db.getGameState(req.session.room_id).catch(error => console.error(error));
    if (req.session.user.id != temp.player1_id && req.session.user.id != temp.player2_id) {
        return res.status(403).redirect('/homepage'); //user is not in this game redirect home
    }
    const index = parseInt(req.query.index, 10);
    const userId = req.session.user.id;

    if(temp.playerTurn != userId) { return res.sendStatus(403); } // incorrect user attacking
    
    //set var based on what was pulled from db to make sure game state is latest

    const gamestate = (temp) ? temp : req.session.gamestate;
    const enemyBoard = (gamestate.player1_board.id == userId) ? gamestate.player2_board : gamestate.player1_board;

    //should proably check if index has already been attacked TODO
    const hit = enemyBoard.ships.some(ship => ship.includes(index));

    //update gamestate in session and in db
    enemyBoard.attacks.push({index: index, hit: hit});
    if(gamestate.player1_board.id == userId) {
        gamestate.player2_board.attacks =  enemyBoard.attacks;

    } else {
        gamestate.player1_board.attacks =  enemyBoard.attacks;
    }
    var x = await db.updateGameRoomAfterPlayerTurn(gamestate).catch( error => { console.error('error in updateGameRoomAfterTurn:', error); return res.sendStatus(500); });

    const flattenedShips = enemyBoard.ships.flat();
    const attackIndices = enemyBoard.attacks.map(attack => attack.index);

    const allShipsHit = flattenedShips.every(index => attackIndices.includes(index));

    // console.log(`player ${req.session.user.username} has won?:`, allShipsHit);

    if(x) {
        //check if the player who just played won
        if(allShipsHit) {
            req.session.gamestate = gamestate
            req.session.gamestate.winner = req.session.user.id;

            var i = await db.updateGameRoomWinner(req.session.gamestate);
            if(i) {
                io.to(parseInt(req.session.room_id)).emit('player has won', {gamestate: req.session.gamestate, username: req.session.user.username});
                return res.status(200).json({hit});
            } else {
                return res.status(500).json({error: "error updating gameroom to have a winner"});
            }
        }
        req.session.gamestate = gamestate;
        io.to(parseInt(req.session.room_id)).emit('player finished turn')
        res.status(200).json({ hit });
    } else {
        res.sendStatus(500);
    }
});

//testing TODO look back at
app.get(`/getUsers`, (req, res) => {
    const clients = io.sockets.adapter.rooms.get(-1);

    if (!clients) { return res.sendStatus(204)} //if no clients return without sending playerList

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
        socket.to(challengerSocketId).emit('accept', {challengerSocketId: challengerSocketId, opponentSocketId: socket.id, opponentId: socket.request.session.user.id});
    }); 

    //might need reject

    socket.on('chat message', (msg) => {
        console.log(`${socket.request.session.user.username} sent a message to room id: `, socket.request.session.room_id);
        io.to(parseInt(socket.request.session.room_id)).emit('chat message', socket.request.session.user.username + ': ' + msg);
        //console.log(socket.rooms);
    });

    socket.on('start game', () => {
        console.log(`starting game in room: ${socket.request.session.room_id}`);
        io.to(parseInt(socket.request.session.room_id)).emit('start game');
    });

    socket.on('give up', async () => {
        console.log(`${socket.request.session.user.username} has given up in room ${socket.request.session.room_id}`);
        io.to(parseInt(socket.request.session.room_id)).emit('player gave up', socket.request.session.user.username);
        // Make sure to update db
        const db = new DB();
        var winnerId = null;
        if (socket.request.session.gamestate.player1_id == socket.request.session.user) {winnerId = req.request.session.gamestate.player2_id;}
        else {winnerId = socket.request.session.gamestate.player1_id;}

        var x = await db.updateGameRoomWinnerById(winnerId, socket.request.session.room_id).catch(error => { console.error(error)});
    });
});
server.listen(3000, () => {
    console.log('Server Starting on http://localhost:3000');
});