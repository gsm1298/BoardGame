//DataAccessLayer

import mysql from 'mysql2';
import {User} from '../business/User.js';

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



    //Accessors

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
                            reject("User does not exist");
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
     * @returns {Array} - An array with the user's information.
     */
    getUserById(userId) {
        return new Promise((resolve, reject) => {
            try {
                var str =
                    "SELECT DISTINCT users.id,users.username,users.password,users.name,users.type, " +
                    "organizations.organizationid, organizations.name AS organizationName " +
                    "FROM users " +
                    "JOIN users_organizations ON users.id = users_organizations.userid " +
                    "JOIN organizations ON users_organizations.userid = users.id " +
                    "WHERE users.id = ?";

                this.con.query(str, [userId], function (err, rows, fields) {
                    if (!err) {
                        var out = [];
                        rows.every(row => {
                            if (out.length === 0) {
                                out.push(new User(row.id, row.username, row.password, row.name, row.type,
                                    [new Organization(row.organizationid, row.organizationName)])
                                );
                                //keep iterating
                                return true;
                            } else {
                                //add aditional organizations to users orginiation array
                                out[0]['organizations'].push(new Organization(row.organizationid, row.organizationName));
                                //keep iterating
                                return true;
                            }
                        });

                        resolve(out);
                    } else {
                        reject(err);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    //Creates

    /**
     * Creates a gameroom
     * @param {int} userId - the users id
     * @param {int} orgId - organization id
     * @returns - returns the inserted id or false if it does not succeed
     */
    CreateGameRoom() {
        return new Promise((resolve, reject) => {
            try {
                var str = `INSERT INTO gamerooms values()`;
                this.con.query(str, function (err, rows, fields) {
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
}
