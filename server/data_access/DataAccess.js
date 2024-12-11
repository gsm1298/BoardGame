//DataAccessLayer

import mysql from 'mysql2';
import {User} from '../business/User.js';
import { GameState } from '../business/GameState.js';

export class DB {
    constructor(con = mysql) {
        //change database credentials
        this.con = mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "Penny10187Bruno10187",
            database: "442"
        });
        this.con.connect(function (err) {
            if (err) throw err;
        });
    }

    /**
     * This function will list all users.
     * 
     * @returns {Array} array - An array of user objects. Array will be empty if no users are found.
     */
    getUsers() {
        return new Promise((resolve) => {
            try {
                this.con.query(
                    `SELECT * FROM users`,
                    (err, rows) => {
                        if (err) { throw err }

                        let users = [];
                        for (let row of rows) {
                            users.push(new User(
                                row.user_id,
                                row.username,
                                row.email,
                                row.password,
                                row.create_time
                            ));
                        }
                        resolve(users)
                    });
            } catch (e) {
                console.error(e);
                resolve([]);
            }
        });
    }

    /**
     * Gets a user based on username
     * @param {String} username - Username
     * @returns {User} user - The User object of that user if they exist.
     */
    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            try {
                var str = "SELECT * FROM users WHERE username = ?";
                this.con.query(str, [username], function (err, rows, fields) {
                    if (!err) {
                        if (rows.length > 0) {
                            resolve(new User(rows[0].user_id, rows[0].username, rows[0].email, rows[0].password, rows[0].create_time));
                        } else {
                            // no user found
                            resolve(null);
                        }
                    } else {
                        reject(err);
                    }
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }

    /**
     * This function will grab a user's information.
     * @param {number} userId - A user's ID number.
     * @returns {User} - A user object
     */
    getUserById(userId) {
        return new Promise((resolve, reject) => {
            try {
                var str =
                    "SELECT * FROM users WHERE id = ?";

                this.con.query(str, [userId], function (err, rows, fields) {
                    if (!err) {
                        var row = rows[0]
                        resolve(new User(row.id,row.username,row.email, null, row.create_time));
                    } else {
                        reject(err);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Creates a user
     * @param {String} username - the username to be entered into the db
     * @param {String} email - the email linked to the account
     * @param {String} hasedPass - the hased password for the account
     * @returns - returns the inserted id or false if it does not succeed
     */
    CreateUser(username, email, hashedPass) {
        return new Promise((resolve, reject) => {
            try {
                var str = `INSERT INTO users (username, email, password) VALUES(?, ?, ?)`;
                this.con.query(str, [username, email, hashedPass], function (err, rows, fields) {
                    if (!err) {
                        resolve(rows.insertId);
                    } else {
                        resolve(false);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }


    /**
     * Creates a gameroom
     * @param {int} playerId - the users id
     * @returns - returns the inserted id or false if it does not succeed
     */
    CreateGameRoom(playerId, opponentId) {
        return new Promise((resolve, reject) => {
            try {
                var str = `INSERT INTO gamerooms (player1_id, player2_id) values(?, ?)`;
                this.con.query(str, [playerId, opponentId], function (err, rows, fields) {
                    if (!err) {
                        resolve(rows.insertId);
                    } else {
                        resolve(false);
                    }
                });
            } catch (error) {
                resolve(false);
            }
        });
    }

    // finish setting up database link and finish getting basic game working.
    // add validation next
    // add nounce to registation after
    // add chat logging function next

    /**
     * Gets the current gameroom info from db
     * @param {int} - the id of the gameroom the info is being selected from
     * @return {GameState} - returns the current gamestate info from db in a gamestate object
     */
    getGameState(roomId) {
        return new Promise((resolve, reject) => {
            try {
                var str = `SELECT * FROM gamerooms WHERE gameroom_id = ?`;
                this.con.query(str, [roomId], function(err,rows,fields) {
                    if (!err) {
                        var row = rows[0];

                        // parse json strings into objects
                        var p1_board = row.player1_board ? JSON.parse(row.player1_board) : null;
                        var p2_board = row.player2_board ? JSON.parse(row.player2_board) : null;
                        // create gamestate object with info
                        var gamestate = new GameState(roomId, row.player1_id, row.player2_id, 
                            p1_board, p2_board, row.player1_ready, row.player2_ready,row.player_turn, row.winner);
                        resolve(gamestate);
                    } else { reject(err); }
                });
            } catch(error) { reject(error); }
        });
    }

    /**
     * Updates gameroom specifically when someone readies up
     * @param {GameState} - GameState object
     * @return - true if it succeeded and rejects with an error if it didnt
     */
    updateGameRoomReadyState(gamestate) {
        return new Promise((resolve, reject) => {
            try {
                var str = `UPDATE gamerooms SET `;
                if (gamestate?.player1_id) { 
                    var board = JSON.stringify(gamestate.player1_board); //stringify the board object
                    str += `player1_board = ?, player1_ready = ? WHERE gameroom_id = ?`; 
                    this.con.query(str, [board, gamestate.player1_ready, gamestate.id], function(err, rows, fields) {
                        if(!err) { resolve(true); } else { reject(err); }
                    });
                }
                else if (gamestate?.player2_id) { 
                    var board = JSON.stringify(gamestate.player2_board); //stringify the board object
                    str +='player2_board = ?, player2_ready = ? WHERE gameroom_id = ?'; 
                    this.con.query(str, [board, gamestate.player2_ready, gamestate.id], function(err, rows, fields) {
                        if(!err) { resolve(true); } else { reject(err); }
                    });
                }
                else { return reject('Gamestate does not have either player set'); }
            } catch(error) { reject(error); }
        });
    }

    /**
     * Updates gameroom specifically to update which players turn it is
     * @param {GameState} - GameState object
     * @return - true if it succeeded and rejects with an error if it didnt
     */
    updateGameRoomPlayerTurn(gamestate) {
        return new Promise((resolve, reject) => {
            try {
                var lastPlayerTurn = gamestate?.playerTurn;
                var nextPlayerTurn = null;

                switch(lastPlayerTurn){
                    case null:
                        // no last turn so defualt to player 1
                        nextPlayerTurn = gamestate.player1_id;
                        break;
                    case gamestate.player1_id:
                        // player 1 had the last turn so update it to be player 2 now
                        nextPlayerTurn = gamestate.player2_id;
                        break;
                    case gamestate.player2_id:
                        // player 2 had the last turn so update it to be player 1 now
                        nextPlayerTurn = gamestate.player1_id;
                        break;
                }
                
                var str = `UPDATE gamerooms SET player_turn = ? WHERE gameroom_id = ?`;
                this.con.query(str, [nextPlayerTurn, gamestate.id], function(err, rows, fields) {
                    if(!err) { resolve(true); } else { reject(err); }
                });
            } catch(error) { reject(error); }
        });
    }

    /**
     * Updates gameroom specifically to update after a players turn ends
     * @param {GameState} - GameState object
     * @return - true if it succeeded and rejects with an error if it didnt
    */
    updateGameRoomAfterPlayerTurn(gamestate) {
        return new Promise((resolve, reject) => {
            try {
                var lastPlayerTurn = gamestate?.playerTurn;
                var nextPlayerTurn = null;
                var enemyBoard = null
                var boardStr = null;

                switch(lastPlayerTurn){
                    case null:
                        // no last turn so defualt to player 1
                        nextPlayerTurn = gamestate.player1_id;
                        enemyBoard = JSON.stringify(gamestate.player2_board);
                        boardStr = 'player2_board';
                        break;
                    case gamestate.player1_id:
                        // player 1 had the last turn so update it to be player 2 now
                        nextPlayerTurn = gamestate.player2_id;
                        enemyBoard = JSON.stringify(gamestate.player2_board);
                        boardStr = 'player2_board';
                        break;
                    case gamestate.player2_id:
                        // player 2 had the last turn so update it to be player 1 now
                        nextPlayerTurn = gamestate.player1_id;
                        enemyBoard = JSON.stringify(gamestate.player1_board);
                        boardStr = 'player1_board';
                        break;
                }
                
                var str = `UPDATE gamerooms SET ${boardStr} = ?, player_turn = ? WHERE gameroom_id = ?`;
                this.con.query(str, [enemyBoard, nextPlayerTurn, gamestate.id], function(err, rows, fields) {
                    if(!err) { resolve(true); } else { reject(err); }
                });
            } catch(error) { reject(error); }
        });
    }

    /**
    * Updates gameroom specifically when someone has won (by any means)
    * @param {GameState} - GameState object
    * @return - true if it succeeded and rejects with an error if it didnt
    */
    updateGameRoomWinner(gamestate) {
        return new Promise((resolve, reject) => {
            try {
                var str = `UPDATE gamerooms SET winner = ? WHERE gameroom_id = ?`;
                this.con.query(str, [gamestate.winner, gamestate.id], function (err, rows, fields) {
                    if(!err) { resolve(true); } else { reject(err); }
                });
            } catch(error) { reject(error); }
        });
    }

    /**
    * Updates gameroom specifically when someone has won (by any means)
    * @param {int} - id of winner
    * @param {int} - id of game
    * @return - true if it succeeded and rejects with an error if it didnt
    */
    updateGameRoomWinnerById(winnerId, roomId) {
        return new Promise((resolve, reject) => {
            try {
                var str = `UPDATE gamerooms SET winner = ? WHERE gameroom_id = ?`;
                this.con.query(str, [winnerId, roomId], function (err, rows, fields) {
                    if(!err) { resolve(true); } else { reject(err); }
                });
            } catch(error) { reject(error); }
        });
    }
}
