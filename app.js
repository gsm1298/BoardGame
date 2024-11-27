import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { v4 as genuuid } from 'uuid';


//Remove later TODO
import {DB} from './server/data_access/DataAccess.js';
//import {User} from './server/buisseness/User.js';

const app = express();

// Get the current file's full path
const __filename = fileURLToPath(import.meta.url);
// Get the current directory
const __dirname = path.dirname(__filename);

app.use(morgan(`tiny`));
app.use(express.static(path.join(__dirname, `frontend`)));
app.use(express.urlencoded({extended: true}));

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


app.use(session({
    genid: function (req) {
        return genuuid(); // use UUIDs for session IDs
    },
    key: 'session_cookie_name',
	secret: 'session_cookie_secret',
	store: sessionStore,
	resave: false,
	saveUninitialized: false,
    cookie: {}
}));

app.get('/', (req,res) => {
    res.status(200).sendFile(__dirname + '/frontend/views/login.html');
});


app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    // still needs work //TODO
    const db = new DB();
    db.getUserByUsername(username)
        .then(async result => {
            //console.log(result.passwordHash);
            const passCheck = await result.checkLogin(password);
            
            if (passCheck) {
                req.session.user = {id: result.id, username: result.username}
                res.status(200).send(`<h2>Good</h2>`);
            } else {
                res.status(400).send(`<h2>Invalid Username or Password.</h2><a href="/">Try Again</a>`);
            }
        }).catch(error => {
            console.log("getUserByUsername Error: ", error);
            res.status(400).send(`<h2>Invalid Username or Password.</h2><a href="/">Try Again</a>`);
        });

    // const pass = await bcrypt.compare(valPass, password);

    // if (username == valUser && pass) {
    //     //req.session.user = {id: 1, username: username};
    //     //res.redirect('/choice');
    //     res.send(`<h2>Good</h2>`)
    // }
    // else {
    //     res.send(`<h2>Invalid username or password.</h2><a href="/">Try Again</a>`)
    // }
});

app.listen(3000, () => {
    console.log('Server Starting on http://localhost:3000');
});