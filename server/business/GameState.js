import {Board} from './Board.js';
/**
 * @Class A game state
 */
export class GameState {
    /**
     * Holds the info of a game
     * @constructor
     * @param {int} id - id of game
     * @param {int} player1_id - the id of the 1st player in the game
     * @param {int} player2_id - the id of the 2nd player in the game
     * @param {Board} player1_board - a board object that holds the info of player 1s board
     * @param {Board} player2_board - an board object that holds the info of player 2s board
     * @param {Boolean} player1_ready - whether or not player 1 has readied up
     * @param {Boolean} player2_ready - whether or not player 2 has readied up
     * @param {int} playerTurn - the id of the player whos turn it is
     * @param {int} winner - the id of the player who won the game
     */
    constructor(id = null, player1_id = null, player2_id = null, player1_board = new Board(), 
        player2_board = new Board(), player1_ready = null, player2_ready = null, playerTurn = null, winner = null) {
        /** @type {int} Games's id */
        this.id = id;
        /** @type {int} player 1s id*/
        this.player1_id = player1_id;
        /** @type {int} The player 2's id */
        this.player2_id = player2_id;
        /** @type {Board} player 1s board state */
        this.player1_board = player1_board;
        /** @type {Board} player 2s board state */
        this.player2_board = player2_board;
        /** @type {Boolean} player 1s ready state */
        this.player1_ready = player1_ready;
        /** @type {Boolean} player 2s ready state*/
        this.player2_ready = player2_ready;
        /** @type {int} the id of the player whos turn it is*/
        this.playerTurn = playerTurn;
        /** @type {int} the id of the winner */
        this.winner = winner;
    }
}  