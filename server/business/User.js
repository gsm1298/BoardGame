import {DB} from '../data_access/DataAccess.js';
import bcrypt from 'bcrypt';
/**
 * @Class A user
 */
export class User {
    /**
     * Represents a User
     * @constructor
     * @param {int} id - id of user
     * @param {String} userName - User name
     * @param {String} email - Email of user
     * @param {String} passwordHash - Hashed password
     * @param {Date} createTime - Array of associated organization objects
     */
    constructor(id = null, username = null, email = null, passwordHash = null, createTime = null) {
        /** @type {Number} User's id */
        this.id = id;
        /** @type {String} Username for login */
        this.username = username;
        /** @type {String} The user's email */
        this.email = email;
        /** @type {String} bcrypt hashed password */
        this.passwordHash = passwordHash;
        /** @type {Date} The timestamp of when the user created the account */
        this.createTime = createTime;
    }
    /**
     * @function checkLogin
     * 
     * @param {String} Password - the password entered by the user tying to login
     * 
     * @returns {Boolean} Success - whether the login is successful or not
     */
    async checkLogin(Password) {
        return await bcrypt.compare(Password, this.passwordHash);
    }
}  