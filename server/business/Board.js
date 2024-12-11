/**
 * @Class A board
 */
export class Board {
    /**
     * Holds the info of a game
     * @constructor
     * @param {int} id - id of player who the board is linked
     * @param {Array} ships - array of where the ships are located on the board
     * @param {Array[Object]} attacks - array of where the ennemy has attacked on the board
     */
    constructor(id = null, ships = [], attacks = []) {
        /** @type {int} id of player the board is linked to*/
        this.id = id;
        /** @type {Array} array of where the ships are located on the board*/
        this.ships = ships;
        /** @type {Array[Object]} array of where the enemy has attacked on the board */
        this.attacks = attacks;
    }
}  