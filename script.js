document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    // Obrazovky
    const screenIntro = document.getElementById("screen-intro");
    const screenCreator = document.getElementById("screen-creator");
    const screenGame = document.getElementById("screen-game");
    
    // Bloky a UI
    const creatorGrid = document.getElementById("creator-grid");
    const azPyramid = document.getElementById("az-pyramid");
    const statusBar = document.getElementById("status-bar");
    const gameQuestionBox = document.getElementById("game-question-box");
    
    let gameQuestions = {};
    let tileElements = {};
    let activeTileId = null;
    let currentCreatorTileIndex = null;
    let currentPlayer = 1;

    // Inicializace prázdných 28 otázek
    for(let i=1; i<=28; i++) {
        gameQuestions[i] = { otazka: "", odpoved: "" };
    }

    // ALGORITMUS: Levenshteinova vzdálenost pro kontrolu překlepů
    function checkAnswerWithTolerance(userAns, correctAns) {
        const s1 = userAns.trim().toLowerCase();
        const s2 = correctAns.trim().toLowerCase();
        
        if (s1 === s2) return true;

        // Výpočet matice změn
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i == 0) costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        
        const distance = costs[s2.length];
        
        // Tolerance: 1 překlep pro slova do 5 znaků, max 2 překlepy pro delší slova
        if (s2.length <= 5 && distance <= 1) return true;
        if (s2.length > 5 && distance <= 2) return true;
        
        return false;
    }

    // PŘEPÍNAČE OBRAZOVEK
    document.getElementById("btn-create-quiz").addEventListener("click", () => {
        screenIntro.style.display = "none";
        screenCreator.style.display = "block";
        drawCreatorGrid();
    });

    // Vykreslení mřížky pro tvorbu otázek (Krok 2)
    function drawCreatorGrid() {
        creatorGrid.innerHTML = "";
        let filledCount = 0;
        for(let i=1; i<=28; i++) {
            const tile = document.createElement("div");
            tile.classList.add("creator-tile");
            tile.innerText = `Políčko ${i}`;
            if(gameQuestions[i].otazka !== "") {
                tile.classList.add("filled");
                filledCount++;
            }
            tile.addEventListener("click", () => openModal(i));
            creatorGrid.appendChild(tile);
        }
        if(filledCount === 28) {
            document.getElementById("btn-start-game").style.display = "inline-block";
        }
    }

    // MODÁLNÍ OKNO - UKLÁDÁNÍ OTÁZEK
    function openModal(index) {
        currentCreatorTileIndex = index;
        document.getElementById("modal-title").innerText = `Nová: Otázka č. ${index}`;
        document.getElementById("input-q-text").value = gameQuestions[index].otazka;
        document.getElementById("input-q-answer").value = gameQuestions[index].odpoved;
        document.getElementById("creator-modal").style.style.display = "flex";
    }

    document.getElementById("btn-modal-save").addEventListener("click", () => {
        const txt = document.getElementById("input-q-text").value.trim();
        const ans = document.getElementById("input-q-answer").value.trim();
        if(!txt || !ans) return alert("Vyplňte prosím znění i odpověď!");
        
        gameQuestions[currentCreatorTileIndex] = { otazka: txt, odpoved: ans };
        document.getElementById("creator-modal").style.display = "none";
        drawCreatorGrid();
    });

    document.getElementById("btn-modal-cancel").addEventListener("click", () => {
        document.getElementById("creator-modal").style.display = "none";
    });

    // STÁHNUTÍ OTÁZEK (EXPORT) [filegen-via-code]
    document.getElementById("btn-download-json").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(gameQuestions, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "az_kviz_export.json";
        a.click();
    });

    // NAHRÁNÍ OTÁZEK (IMPORT)
    document.getElementById("upload-questions-input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            gameQuestions = JSON.parse(event.target.result);
            screenIntro.style.display = "none";
            screenCreator.style.display = "block";
            drawCreatorGrid();
        };
        reader.readAsText(file);
    });

    // PŘECHOD DO HRY
    document.getElementById("btn-start-game").addEventListener("click", () => {
        screenCreator.style.display = "none";
        screenGame.style.display = "block";
        buildHexPyramid();
        socket.emit("sync-questions", gameQuestions);
    });

    // VYSTAVĚNÍ ŠÉSTIUHELNÍKOVÉ PYRAMIDY
    function buildHexPyramid() {
        azPyramid.innerHTML = "";
        let idCounter = 1;
        for (let row = 1; row <= 7; row++) {
            const rowDiv = document.createElement("div");
            rowDiv.classList.add("pyramid-row");
            for (let col = 1; col <= row; col++) {
                const tile = document.createElement("div");
                tile.classList.add("tile");
                tile.innerText = idCounter;
                tileElements[idCounter] = tile;

                tile.addEventListener("click", () => {
                    if(tile.className !== "tile") return;
                    socket.emit("tile-selected-live", tile.innerText);
                });

                rowDiv.appendChild(tile);
                idCounter++;
            }
            azPyramid.appendChild(rowDiv);
        }
    }

    // MULTIPLAYER OVLÁDÁNÍ
    document.getElementById("btn-game-submit").addEventListener("click", () => {
        const playerAns = document.getElementById("game-player-answer").value;
        const correctAns = gameQuestions[activeTileId].odpoved;
        
        let targetStatus = "black";
        if(checkAnswerWithTolerance(playerAns, correctAns)) {
            targetStatus = currentPlayer === 1 ? "player1" : "player2";
        }

        socket.emit("tile-processed-live", { tileId: activeTileId, status: targetStatus });
        gameQuestionBox.style.display = "none";
    });

    // SÍŤOVÁ SYNCHRONIZACE REÁLNÉHO ČASU
    socket.on("init-state", (data) => {
        currentPlayer = data.currentPlayer;
        updateStatusBarUI();
    });

    socket.on("questions-broadcast", (questions) => {
        gameQuestions = questions;
        if(screenGame.style.display === "none") {
            screenIntro.style.display = "none";
            screenCreator.style.display = "none";
            screenGame.style.display = "block";
            buildHexPyramid();
        }
    });

    socket.on("open-question-screen", (tileId) => {
        activeTileId = tileId;
        document.getElementById("game-question-title").innerText = `Otázka pro políčko č. ${tileId}`;
        document.getElementById("game-question-text").innerText = gameQuestions[tileId].otazka;
        document.getElementById("game-player-answer").value = "";
        gameQuestionBox.style.display = "block";
    });

    socket.on("state-updated", (data) => {
        currentPlayer = data.currentPlayer;
        updateStatusBarUI();
        for (const id in data.tileStates) {
            if (tileElements[id]) tileElements[id].className = 'tile ' + data.tileStates[id];
        }
    });

    function updateStatusBarUI() {
        if (currentPlayer === 1) {
            statusBar.innerText = "Na řadě je: ČERVENÝ TÝM";
            statusBar.style.background = "#fee2e2"; statusBar.style.color = "#dc2626";
        } else {
            statusBar.innerText = "Na řadě je: MODRÝ TÝM";
            statusBar.style.background = "#dbeafe"; statusBar.style.color = "#2563eb";
        }
    }
});
