const playerBoard = document.getElementById("player-board");
const enemyBoard = document.getElementById("enemy-board");
const BOARD_SIZE = 10; // 10x10 grid
const CELL_SIZE = 40; // Each cell will be 40x40 pixels

const SHIP_SIZES = [5, 4, 3, 3, 2]; // Ship lengths
let draggedShip = null; // Currently dragged ship
let isHorizontal = true; // Ship orientation
let playerShips = []; // Store ship positions
const shipsContainer = document.getElementById("ships");

const startGameButton = document.getElementById("start-game");

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
          if (isEnemy) {
            rect.addEventListener("click", () => handleEnemyClick(rect));
          }
          else {
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

function handleEnemyClick(cell) {
  const index = cell.dataset.id;
  fetch(`/attack?index=${index}`)
    .then(res => {
        if (!res.ok) {
            throw new Error("Failed to fetch attack result");
        }
        return res.json();
    })
    .then(data => {
        cell.classList.add(data.hit ? "hit" : "miss");
    })
    .catch(err => console.error(err));
}

// Setup Game


// Fetch Initial Player Ship Setup
// fetch("/setup")
//   .then(res => res.json())
//   .then(data => {
//     data.ships.forEach(index => {
//       const cell = playerBoard.querySelector(`[data-index="${index}"]`);
//       cell.classList.add("ship");
//     });
//   });

// Initialize the player board and ships container
function initializeGame() {
  createBoard(playerBoard, false);
  createBoard(enemyBoard, true);
  createShips();
  setupEventListeners();
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
  };

  //console.log(`Drag start offset: ${draggedShip.offsetX}, ${draggedShip.offsetY}`);
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

// Check if all ships are placed
function validateAllShipsPlaced() {
  const allPlaced = playerShips.length === SHIP_SIZES.length;
  startGameButton.disabled = !allPlaced;
  return allPlaced;
}

function setupEventListeners() {
  // Add event listeners to the "Start Game" button
  startGameButton.addEventListener("click", () => {
    if (validateAllShipsPlaced()) {
      alert("All ships are placed! Starting the game...");
      startGame();
    } else {
      alert("Please place all your ships on the board before starting the game.");
    }
  });

  // Allow toggling ship orientation with the "R" key
  document.addEventListener("keydown", (event) => {
    if (event.key === "r") {
      isHorizontal = !isHorizontal;
      //console.log(`Orientation: ${isHorizontal ? "Horizontal" : "Vertical"}`);
      shipsContainer.parentElement.querySelector('h5 span').textContent = isHorizontal ? "Horizontal" : "Vertical";
    }
  });
}

// Dummy function for starting the game
function startGame() {
  console.log("Game started! Player ships:", playerShips);
}


// Initialize the game
initializeGame();




// need more work on drag and drop DONE
// possible make ship move when dragged from container or show its being dragged TODO
// no preview of where you are placing DONE
// ship does not actually move when dragged TODO
// test server validating TODO
// possibly create gameboard object in server/business TODO
// possibly create ships object in server/business TODO
// possibly create ship object in server/business TODO
// save game state (both boards) in session since its not visible to client TODO
// save game state in game table in DB for backup TODO
// add win / fail conditions TODO
// add multiplayer TODO
// test multiplayer TODO
// add chat TODO
// test chat TODO
// test room creation again TODO
// make chat logs in DB TODO
// add sanitization middleware to snitize all input TODO
// add validation middleware to validate that input is what is exppected TODO
/* add auth middleware to make sure the user is authenticated before allow access 
  to endpoints other than login or registration TODO*/
// create registation page and logic on server TODO
// add nounce to registration TODO
// add timeout if a player disconnects TODO
// add matchmacking to main menu (either select from list or random) TODO

// add better svg graphics for ships TODO ---

// add better svg graphics for board (water) TODO
// add animation to svg water animation TODO
// add attack svg animation when attacking or getting attacked TODO
// add hit (explotion/fire) and miss (splash) svg animation TODO

// SETUP SERVER BEFORE PRESENTATION TODO