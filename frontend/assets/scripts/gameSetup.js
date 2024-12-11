let draggedShip = null; // Currently dragged ship
let isHorizontal = false; // Ship orientation
let playerShips = []; // Store ship positions

const shipsContainer = document.getElementById("ships");
const readyButton = document.getElementById("ready-btn");

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
                body: JSON.stringify({ playerShips: playerShips })
            }).then(res => res).then(data => {
                // check for 200 response
                if (data.status == 200) {
                    removeStartPhaseElements();
                    fetch(`/gamePhase`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.phase == 'Started') { socket.emit('start game'); }
                        }).catch(error => { console.error('erorr when calling getGamePhase:', error) })
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