const playerBoard = document.getElementById("player-board");
const enemyBoard = document.getElementById("enemy-board");
const BOARD_SIZE = 10; // 10x10 grid
const CELL_SIZE = 40; // Each cell will be 40x40 pixels

const SHIP_SIZES = [5, 4, 3, 3, 2]; // Ship lengths

var gamePhase = null; // the current phase the game is in (setup, started, or ended)
var gamestate = null; // the current state of the game (limited based on phase)
var userID = null; // used for displaying whos turn it is
var userName = null // used to display winner

// get the curent gamephase (mainly for refresh protection)
fetch(`/gamePhase`)
    .then(res => res.json())
    .then(data => {
        gamePhase = data.phase;
        gamestate = (gamePhase != 'Setup') ? data.gamestate : null;
        userID = (gamePhase != 'Setup') ? data.userId : null;
        // Initialize the game in the correct phase and state
        initializeGame();
    }).catch(error => { console.error('erorr when calling getGamePhase:', error) });

//give up event handler
document.getElementById("give-up-btn").addEventListener('click', function () {
    socket.emit('give up');
});

// when both players are ready to start
socket.on('start game', function () {
    fetch(`/gamePhase`)
        .then(res => res.json())
        .then(data => {
            gamePhase = data.phase;
            gamestate = (gamePhase != 'Setup') ? data.gamestate : null;
            userID = (gamePhase != 'Setup') ? data.userId : null;
            // Initialize the game in the correct phase and state
            initializeGame();
        }).catch(error => { console.error('erorr when calling getGamePhase:', error) });
});

//other player gave up
socket.on('player gave up', function (username) {
    userName = username;
    removeStartPhaseElements();
    displayGiveUpPopup();
});

// Initialize the boards and game state based on phase
function initializeGame() {
    createBoard(playerBoard, false);
    createBoard(enemyBoard, true);
    if (gamePhase == 'Setup') {
        createShips();
        setupEventListeners();
    } else if (gamePhase == 'Started') {
        removeStartPhaseElements();
        //setup game event listeners (MAYBE IDK)

        //append other game visuals like indicator of whos turn it is
        gameStartSetUp();

        //place player ships on their board
        var shipsArr = null;
        var playerAttackArr = null;
        var enemyAttackArr = null;
        if (gamestate.player1_board.ships.length != 0) {
            shipsArr = gamestate.player1_board.ships;
            playerAttackArr = gamestate.player1_board.attacks;
            enemyAttackArr = gamestate.player2_board.attacks;
        }
        else {
            shipsArr = gamestate.player2_board.ships;
            playerAttackArr = gamestate.player2_board.attacks;
            enemyAttackArr = gamestate.player1_board.attacks;
        }

        placeShips(shipsArr, playerBoard);

        //place attacks on the boards
        placeAttacks(enemyAttackArr, enemyBoard); //place them on the enemy board first
        placeAttacks(playerAttackArr, playerBoard); //place them on the player board seconds
    } else if (gamePhase == "Ended") {
        removeStartPhaseElements();

        placeShips(gamestate.player1_board.ships, playerBoard);
        placeShips(gamestate.player2_board.ships, enemyBoard);
        placeAttacks(gamestate.player1_board.attacks, playerBoard);
        placeAttacks(gamestate.player2_board.attacks, enemyBoard);
    }


}

// Initialize Boards
function createBoard(board, isEnemy) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    // make sure board is empty
    board.innerHTML = '';

    // Create grid cells
    let id = 0;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const x = col * CELL_SIZE + CELL_SIZE;
            const y = row * CELL_SIZE + CELL_SIZE;
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', CELL_SIZE);
            rect.setAttribute('height', CELL_SIZE);
            rect.setAttribute('class', 'cell');
            rect.setAttribute('data-id', id);
            if (isEnemy && gamePhase == 'Started') {
                rect.addEventListener("click", handleEnemyClick);
                rect.classList.add('clickable');
            }
            else if (!isEnemy && gamePhase == 'Setup') {
                // Allow ships to be dropped on board cells
                rect.addEventListener("dragover", handleDragOver);
                rect.addEventListener("drop", handleDrop);
            }
            board.appendChild(rect);
            id++;
        }
    }

    // Create column numbers
    for (let col = 0; col < BOARD_SIZE; col++) {
        const x = col * CELL_SIZE + CELL_SIZE / 2;
        const y = 0;
        const number = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        number.setAttribute('x', x + CELL_SIZE);
        number.setAttribute('y', y + CELL_SIZE / 2);
        number.setAttribute('class', 'label');
        number.textContent = col + 1;
        board.appendChild(number);
    }

    // Create row letters
    for (let row = 0; row < BOARD_SIZE; row++) {
        const x = 0;
        const y = row * CELL_SIZE + CELL_SIZE / 2;
        const letter = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        letter.setAttribute('x', x + CELL_SIZE / 2);
        letter.setAttribute('y', y + CELL_SIZE);
        letter.setAttribute('class', 'label');
        letter.textContent = letters[row];
        board.appendChild(letter);
    }
}

//create and display the give up popup
function displayGiveUpPopup() {
    const giveup = document.createElement("div");
    giveup.setAttribute("id", "giveup-popup");
    giveup.setAttribute("class", "popup");
    const header = document.createElement("h1")
    header.innerText = `${userName} Has Given Up.`;
    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.innerText = "Back to Lobby";
    button.addEventListener('click', function () { window.location = '/homepage'; });
    const div = document.createElement("div");

    div.appendChild(header);
    div.appendChild(button);
    giveup.appendChild(div);
    document.body.appendChild(giveup);
}

// Update game with new state
function updateGame() {
    var playerAttackArr = null;
    var enemyAttackArr = null;
    if (gamestate.player1_board.id == userID) {
        playerAttackArr = gamestate.player1_board.attacks;
        enemyAttackArr = gamestate.player2_board.attacks;
    }
    else {
        playerAttackArr = gamestate.player2_board.attacks;
        enemyAttackArr = gamestate.player1_board.attacks;
    }

    //update the placed attacks on the boards
    placeAttacks(enemyAttackArr, enemyBoard); //place them on the enemy board first
    placeAttacks(playerAttackArr, playerBoard); //place them on the player board seconds

    // updated the turn text
    var turnSpan = document.getElementById("info-container").querySelector("h3 span");
    if (gamestate.playerTurn == userID) { turnSpan.innerText = "Your"; }
    else { turnSpan.innerText = "Your Opponents"; }
}