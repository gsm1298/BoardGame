const playerBoard = document.getElementById("player-board");
const enemyBoard = document.getElementById("enemy-board");
const BOARD_SIZE = 10; // 10x10 grid
const CELL_SIZE = 40; // Each cell will be 40x40 pixels

const SHIP_SIZES = [5, 4, 3, 3, 2]; // Ship lengths
let draggedShip = null; // Currently dragged ship
let isHorizontal = false; // Ship orientation
let playerShips = []; // Store ship positions

const shipsContainer = document.getElementById("ships");
const readyButton = document.getElementById("ready-btn");

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
  }).catch(error => {console.error('erorr when calling getGamePhase:', error)});

  //give up event handler
  document.getElementById("give-up-btn").addEventListener('click', function() {
    socket.emit('give up');
});

// when both players are ready to start
socket.on('start game', function() {
  fetch(`/gamePhase`)
  .then(res => res.json())
  .then(data => {
    gamePhase = data.phase;
    gamestate = (gamePhase != 'Setup') ? data.gamestate : null;
    userID = (gamePhase != 'Setup') ? data.userId : null;
    // Initialize the game in the correct phase and state
    initializeGame();
  }).catch(error => {console.error('erorr when calling getGamePhase:', error)});
});

// when a player finish their turn rerun gamePhase
socket.on('player finished turn', function() {
  fetch(`/gamePhase`)
  .then(res => res.json())
  .then(data => {
    gamePhase = data.phase;
    gamestate = (gamePhase != 'Setup') ? data.gamestate : null;
    userID = (gamePhase != 'Setup') ? data.userId : null;
    // Update game to match new state
    updateGame();
  }).catch(error => {console.error('erorr when calling getGamePhase:', error)});;
});

// when a player has won display a popup and allow them to leave
socket.on('player has won', async function(info) {
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

socket.on('player gave up', function(username) {
  userName = username;
  removeStartPhaseElements();
  displayGiveUpPopup();
});

// Initialize the boards and game state based on phase
function initializeGame() {
  createBoard(playerBoard, false);
  createBoard(enemyBoard, true);
  if(gamePhase == 'Setup') {
    createShips();
    setupEventListeners();
  }else if (gamePhase == 'Started') { 
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
    
    //needs to be updated TODO
    placeShips(gamestate.player1_board.ships, playerBoard);
    placeShips(gamestate.player2_board.ships, enemyBoard);
    placeAttacks(gamestate.player1_board.attacks, playerBoard);
    placeAttacks(gamestate.player2_board.attacks, enemyBoard);
  }
}

// Initialize Boards
function createBoard(board, isEnemy) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

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
  if(!infoContainer) { return; } //exit if container dones not exist
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
  button.addEventListener('click', function () { window.location = '/homepage'});
  const div = document.createElement("div");
  
  div.appendChild(header);
  div.appendChild(button);
  winPopUp.appendChild(div);
  document.body.appendChild(winPopUp);
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
  button.addEventListener('click', function () { window.location = '/homepage'});
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

// Create draggable ships in the ship container
function createShips() {
  let xOffset = 0; // Starting x position for ships

  SHIP_SIZES.forEach((size, index) => {
    const shipGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    shipGroup.setAttribute("class", "ship");
    shipGroup.dataset.size = size;
    shipGroup.dataset.index = index;
    shipGroup.setAttribute("draggable", "true");
    shipGroup.setAttribute("transform", `translate(${xOffset}, 0)`);

    // Create ship segments
    for (let i = 0; i < size; i++) {
      const segment = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      segment.setAttribute("x", i * CELL_SIZE);
      segment.setAttribute("y", 0);
      segment.setAttribute("width", CELL_SIZE);
      segment.setAttribute("height", CELL_SIZE);
      segment.setAttribute("class", "ship-segment");
      shipGroup.appendChild(segment);
    }

    shipsContainer.appendChild(shipGroup);
    xOffset += (size + 1) * CELL_SIZE; // Add space between ships

    // Add drag event listeners to the ship
    shipGroup.addEventListener("dragstart", handleDragStart);
    shipGroup.addEventListener("dragend", handleDragEnd);
  });
}

// Drag-and-drop event handlers
function handleDragStart(event) {
  const ship = event.target.closest(".ship");
  if (!ship) { console.log('Not ship'); return; }

  const boundingRect = ship.getBoundingClientRect();
  const cursorX = event.clientX;
  const cursorY = event.clientY;

  // Store offset relative to the ship
  draggedShip = {
      size: parseInt(ship.dataset.size, 10),
      index: parseInt(ship.dataset.index, 10),
      horizontal: isHorizontal,
      offsetX: cursorX - boundingRect.x,
      offsetY: cursorY - boundingRect.y,
      element: ship,
  };

  ship.classList.add("dragging");
  ship.setAttribute('opacity', '.5')
}

function handleDragOver(event) {
  event.preventDefault(); // Allow dropping

  const cursorX = event.clientX;
  const cursorY = event.clientY;

  // Get board position and dimensions
  const boardRect = playerBoard.getBoundingClientRect();

  // Calculate relative position of the cursor on the board
  const relativeX = cursorX - boardRect.left;
  const relativeY = cursorY - boardRect.top;

  // Snap the cursor's position to the nearest grid cell
  const col = Math.floor(relativeX / CELL_SIZE) - 1;
  const row = Math.floor(relativeY / CELL_SIZE) - 1;

  //console.log(`Cursor: (${cursorX}, ${cursorY}), Board: (${relativeX}, ${relativeY}), Cell: (row ${row}, col ${col})`);

  // Ensure snapped coordinates are within bounds
  if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) {
      return; // Ignore events outside the board
  }

  // Calculate the starting index for the ship placement
  const startIndex = row * BOARD_SIZE + col;

  // Clear previous highlights
  const cells = Array.from(playerBoard.querySelectorAll(".cell"));
  cells.forEach((cell) => cell.classList.remove("valid", "invalid"));

  // Highlight the placement if valid
  if (isValidPlacement(startIndex, draggedShip.size)) {
      highlightPlacement(startIndex, draggedShip.size, "valid");
  } else {
      highlightPlacement(startIndex, draggedShip.size, "invalid");
  }
}

function handleDrop(event) {
  const cell = event.target;
  const startIndex = parseInt(cell.dataset.id, 10);

  if (isValidPlacement(startIndex, draggedShip.size)) {
    placeShip(startIndex, draggedShip.size);
    // Remove the ship from the ship container
    shipsContainer.querySelector(`[data-index="${draggedShip.index}"]`).remove();
  }

  validateAllShipsPlaced();
}

// Handle the end of dragging (cleanup)
function handleDragEnd() {
  // reset ship in ship container in case of invalid placment
  draggedShip.element.classList.remove('dragging');
  draggedShip.element.removeAttribute('opacity');

  const cells = Array.from(playerBoard.querySelectorAll(".cell"));
  cells.forEach((cell) => cell.classList.remove("valid", "invalid"));
  draggedShip = null; // Reset the dragged ship
}

// Highlight the placement on the board
function highlightPlacement(startIndex, size, status) {
  for (let i = 0; i < size; i++) {
      const cellIndex = startIndex + (isHorizontal ? i : i * BOARD_SIZE);
      //console.log(`Highlighting cell index: ${cellIndex}`); // Debug log

      // Skip out-of-bound indices
      if (cellIndex < 0 || cellIndex >= BOARD_SIZE * BOARD_SIZE) continue;

      // Prevent horizontal wrapping
      const rowStart = Math.floor(startIndex / BOARD_SIZE) * BOARD_SIZE;
      const rowEnd = rowStart + BOARD_SIZE;
      if (isHorizontal && cellIndex >= rowEnd) break;

      // Find the cell and apply the status
      const cell = playerBoard.querySelector(`[data-id="${cellIndex}"]`);
      if (cell) {
          cell.classList.add(status);
      }
  }
}


// Check if the placement is valid
function isValidPlacement(startIndex, size) {
  const rowStart = Math.floor(startIndex / BOARD_SIZE) * BOARD_SIZE;
  const rowEnd = rowStart + BOARD_SIZE;

  for (let i = 0; i < size; i++) {
      const cellIndex = startIndex + (isHorizontal ? i : i * BOARD_SIZE);

      // Check if cell is out of bounds or crosses row boundary
      if (
          cellIndex >= BOARD_SIZE * BOARD_SIZE || // Outside the board
          (isHorizontal && cellIndex >= rowEnd) || // Crosses row boundaries
          playerShips.flat().includes(cellIndex) // Overlaps with other ships
      ) {
          return false;
      }
  }
  return true;
}


// Place the ship on the board
function placeShip(startIndex, size) {
  const ship = [];
  for (let i = 0; i < size; i++) {
    const cellIndex = startIndex + (isHorizontal ? i : i * BOARD_SIZE);
    ship.push(cellIndex);

    //console.log(cellIndex);

    const cell = playerBoard.querySelector(`[data-id="${cellIndex}"]`);
    cell.setAttribute("fill", "gray");
    cell.setAttribute("class", "ship");
  }
  playerShips.push(ship);
}

// Place the ship on the board
function placeShips(shipsArr, board) {
  for (let x = 0; x < shipsArr.length; x++){
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
    if(attcksArr[i].hit) { cell.setAttribute("class", "cell hit"); }
    else { cell.setAttribute("class", "cell miss"); }
    cell.removeEventListener("click", handleEnemyClick);
  }
}

// Check if all ships are placed
function validateAllShipsPlaced() {
  const allPlaced = playerShips.length === SHIP_SIZES.length;
  readyButton.disabled = !allPlaced;
  return allPlaced;
}

function setupEventListeners() {
  // Add event listeners to the Ready button
  readyButton.addEventListener("click", () => {
    if (validateAllShipsPlaced()) {
      fetch(`/readyUp/${parseInt(window.location.pathname.split('/')[2])}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({playerShips: playerShips})
        }).then(res=> res).then(data => {
            // check for 200 response
            if(data.status == 200) { 
              removeStartPhaseElements(); 
              fetch(`/gamePhase`)
                .then(res => res.json())
                .then(data => {
                  if(data.phase == 'Started') { socket.emit('start game'); }
                }).catch(error => {console.error('erorr when calling getGamePhase:', error)})
            }
        })
        .catch(error => { console.error('erorr when calling readyUp: ', error); });
    } else {
      alert("Please place all your ships on the board before starting the game.");
    }
  });

  // Allow toggling ship orientation with the "R" key
  document.addEventListener("keydown", handleRotate);
}

function handleRotate(event) {
  if (event.key === "r") {
    isHorizontal = !isHorizontal;
    //console.log(`Orientation: ${isHorizontal ? "Horizontal" : "Vertical"}`);
    shipsContainer.parentElement.querySelector('h5 span').textContent = isHorizontal ? "Horizontal" : "Vertical";
  }
}

// Removes all start phase elements and eventlisteners
function removeStartPhaseElements() {
  const startPhaseContainer = document.getElementById('start-phase-container');
  if(!startPhaseContainer) { return; } //exit if container dones not exist
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

// need more work on drag and drop DONE
// possible make ship move when dragged from container or show its being dragged TODO
// no preview of where you are placing DONE
// ship does not actually move when dragged TODO
// test server validating TODO
// possibly create gameboard object in server/business DONE
// possibly create ships object in server/business TODO
// possibly create ship object in server/business TODO
// save game state (both boards) in session since its not visible to client DONE
// save game state in game table in DB for backup DONE
// add win / fail conditions DONE
// add multiplayer DONE
// test multiplayer DONE
// add chat DONE
// test chat DONE
// test room creation again DONE
// make chat logs in DB TODO
// add sanitization middleware to snitize all input TODO
// add validation middleware to validate that input is what is exppected TODO
/* add auth middleware to make sure the user is authenticated before allow access 
  to endpoints other than login or registration DONE*/
// create registation page and logic on server DONE
// add nounce to registration DONE
// add validation and sanitization to all input fields TODO
// add validation for user sent json or data TODO
// add timeout if a player disconnects TODO
// add matchmacking to main menu (either select from list or random) DONE

// add better svg graphics for ships TODO ---

// add better svg graphics for board (water) TODO
// add animation to svg water animation TODO
// add attack svg animation when attacking or getting attacked TODO
// add hit (explotion/fire) and miss (splash) svg animation TODO

// redirect users who are not suposed to be in a game room back to lobby DONE
// redirect to lobby when entring game room that has ended DONE

// SETUP SERVER BEFORE PRESENTATION DONE WOOOO -- DO THIS NOW