// when a player finish their turn rerun gamePhase
socket.on('player finished turn', function () {
    fetch(`/gamePhase`)
        .then(res => res.json())
        .then(data => {
            gamePhase = data.phase;
            gamestate = (gamePhase != 'Setup') ? data.gamestate : null;
            userID = (gamePhase != 'Setup') ? data.userId : null;
            // Update game to match new state
            updateGame();
        }).catch(error => { console.error('erorr when calling getGamePhase:', error) });;
});

// when a player has won display a popup and allow them to leave
socket.on('player has won', async function (info) {
    userName = await info.username;
    gamestate = await info.gamestate;
    // Update one last time to complete the board
    updateGame();
    // wait before then making changes for the win state
    setTimeout(() => {
        removeTurnInfo();
        gameEndSetup();
        displayWinPopup();
    }, 500); // 500 milliseconds (0.5 seconds)
});

// append the info that will be needed for playing the game
function gameStartSetUp() {
    const gameConrainer = document.getElementById('game-container');
    const infoContainer = document.createElement('div');
    infoContainer.setAttribute("id", "info-container");
    const turnIndiator = document.createElement("h3");
    const turnSpan = document.createElement('span');
    const text1 = document.createTextNode("It Is ");
    const text2 = document.createTextNode(" Turn");

    turnIndiator.appendChild(text1);
    turnIndiator.appendChild(turnSpan);
    turnIndiator.appendChild(text2);
    infoContainer.appendChild(turnIndiator);
    gameConrainer.appendChild(infoContainer);

    if (gamestate.playerTurn == userID) { turnSpan.innerText = "Your"; }
    else { turnSpan.innerText = "Your Opponents"; }
}

// remove turn based info
function removeTurnInfo() {
    const infoContainer = document.getElementById('info-container');
    if (!infoContainer) { return; } //exit if container dones not exist
    // remove the info elements
    infoContainer.remove();

    //remove eventlisteners for board cells
    const board = document.getElementById('enemy-board');
    const cells = board.querySelectorAll('*');

    cells.forEach(cell => {
        const clone = cell.cloneNode(true); // Clone the node
        cell.parentNode.replaceChild(clone, cell); // Replace the original with the clone
        clone.style.cursor = "unset";
    });
}

// append the info of who won the game
function gameEndSetup() {

    const gameConrainer = document.getElementById('game-container');
    const infoContainer = document.createElement('div');
    infoContainer.setAttribute("id", "end-container");
    const winIndicator = document.createElement("h2");
    const text1 = document.createTextNode(`${userName} Has Won!`);

    winIndicator.appendChild(text1);
    infoContainer.appendChild(winIndicator);
    gameConrainer.appendChild(infoContainer);
}

//create and display the win popup
function displayWinPopup() {
    const winPopUp = document.createElement("div");
    winPopUp.setAttribute("id", "end-popup");
    winPopUp.setAttribute("class", "popup");
    const header = document.createElement("h1")
    header.innerText = `${userName} Has Won!`;
    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.innerText = "Back to Lobby";
    button.addEventListener('click', function () { window.location = '/homepage' });
    const div = document.createElement("div");

    div.appendChild(header);
    div.appendChild(button);
    winPopUp.appendChild(div);
    document.body.appendChild(winPopUp);
}

function handleEnemyClick(event) {
    const cell = event.target;
    const index = cell.dataset.id;
    fetch(`/attack?index=${index}`)
        .then(res => {
            if (!res.ok) {
                throw new Error("Failed to fetch attack result");
            }
            return res.json();
        })
        .then(data => {
            cell.removeEventListener("click", handleEnemyClick);
            cell.classList.add(data.hit ? "hit" : "miss");
        })
        .catch(err => console.error(err));
}

// Place the ship on the board
function placeShips(shipsArr, board) {
    for (let x = 0; x < shipsArr.length; x++) {
        for (let i = 0; i < shipsArr[x].length; i++) {
            const cell = board.querySelector(`[data-id="${shipsArr[x][i]}"]`);
            cell.setAttribute("fill", "gray");
            cell.setAttribute("class", "ship");
        }
    }
}

// Place the attckas on the board
function placeAttacks(attcksArr, board) {
    for (var i = 0; i < attcksArr.length; i++) {
        const cell = board.querySelector(`[data-id="${attcksArr[i].index}"`);
        if (attcksArr[i].hit) { cell.setAttribute("class", "cell hit"); }
        else { cell.setAttribute("class", "cell miss"); }
        cell.removeEventListener("click", handleEnemyClick);
    }
}

// Removes all start phase elements and eventlisteners
function removeStartPhaseElements() {
    const startPhaseContainer = document.getElementById('start-phase-container');
    if (!startPhaseContainer) { return; } //exit if container dones not exist
    // remove the start phase elements
    startPhaseContainer.remove();

    //remove eventlisteners for board cells
    const board = document.getElementById('player-board');
    const cells = board.querySelectorAll('*');

    cells.forEach(cell => {
        const clone = cell.cloneNode(true); // Clone the node
        cell.parentNode.replaceChild(clone, cell); // Replace the original with the clone
    });

    //remove eventlistener for keydown on board
    document.removeEventListener("keydown", handleRotate);
}