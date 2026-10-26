document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    // Elementy obrazovek
    const screenIntro = document.getElementById("screen-intro");
    const screenCreator = document.getElementById("screen-creator");
    const screenGame = document.getElementById("screen-game");
    
    // Ostatní elementy
    const creatorGrid = document.getElementById("creator-grid");
    const azPyramid = document.getElementById("az-pyramid");
    const statusBar = document.getElementById("status-bar");
    const gameQuestionBox = document.getElementById("game-question-box");
    const solutionRevealText = document.getElementById("solution-reveal-text");
    const btnRevealSolution = document.getElementById("btn-reveal-solution");
    
    let gameQuestions = {};
    let tileElements = {};
    let activeTileId = null;
    let currentCreatorTileIndex = null;
    let currentPlayer = 1;

    // Generování výchozích 28 prázdných slotů
    for (let i = 1; i <= 28; i++) {
        gameQuestions[i] = { otazka: "", odpoved: "" };
    }

    // ALGORITMUS KONTROLY PŘEKLEPŮ (Levenshteinova metoda)
    function checkAnswerWithTolerance(userAns, correctAns) {
        const s1 = userAns.trim().toLowerCase().replace(/[^a-záčďéěíňóřšťúůýž0-9]/g, "");
        const s2 = correctAns.trim().toLowerCase().replace(/[^a-záčďéěíňóřšťúůýž0-9]/g, "");
        
        if (s1 === s2) return true;
        if (s1.length === 0 || s2.length === 0) return false;

        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        
        const distance = costs[s2.length];
        if (s2.length <= 5 && distance <= 1) return true; // 1 překlep povolen
        if (s2.length > 5 && distance <= 2) return true;  // 2 překlepy povoleny
        
        return false;
    }

    // PŘEPÍNÁNÍ DO CREATORU
    document.getElementById("btn-create-quiz").addEventListener("click", () => {
        screenIntro.style.display = "none";
        screenCreator.style.display = "block";
        drawCreatorGrid();
    });

    function drawCreatorGrid() {
        creatorGrid.innerHTML = "";
        let filledCount = 0;
        for (let i = 1; i <= 28; i++) {
            const tile = document.createElement("div");
            tile.classList.add("creator-tile");
            tile.innerText = `Políčko ${i}`;
            if (gameQuestions[i].otazka !== "" && gameQuestions[i].odpoved !== "") {
                tile.classList.add("filled");
                filledCount++;
            }
            tile.addEventListener("click", () => openModal(i));
            creatorGrid.appendChild(tile);
        }
        
        if (filledCount === 28) {
            document.getElementById("btn-start-game").style.display = "inline-block";
        } else {
            document.getElementById("btn-start-game").style.display = "none";
        }
    }

    // OTEVŘENÍ MODÁLNÍHO OKNA PRO ZÁPIS
    function openModal(index) {
        currentCreatorTileIndex = index;
        document.getElementById("modal-title").innerText = `Nová: Otázka č. ${index}`;
        document.getElementById("input-q-text").value = gameQuestions[index].otazka;
        document.getElementById("input-q-answer").value = gameQuestions[index].odpoved;
        document.getElementById("creator-modal").style.display = "flex";
    }

    document.getElementById("btn-modal-save").addEventListener("click", () => {
        const txt = document.getElementById("input-q-text").value.trim();
        const ans = document.getElementById("input-q-answer").value.trim();
        if (!txt || !ans) {
            alert("Musíte vyplnit znění i odpověď!");
            return;
        }
        gameQuestions[currentCreatorTileIndex] = { otazka: txt, odpoved: ans };
        document.getElementById("creator-modal").style.display = "none";
        drawCreatorGrid();
    });

    document.getElementById("btn-modal-cancel").addEventListener("click", () => {
        document.getElementById("creator-modal").style.display = "none";
    });

    // EXPORT SOUBORU (STÁHNUTÍ SIKY)
    document.getElementById("btn-download-json").addEventListener("click", () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameQuestions, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", "az_kviz_otazky.json");
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    });

    // IMPORT SOUBORU (NAHRÁNÍ SADY)
    document.getElementById("upload-questions-input").addEventListener("change", (e) => {
        const file = e.target.files;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (Object.keys(parsed).length === 28) {
                    gameQuestions = parsed;
                    screenIntro.style.display = "none";
                    screenCreator.style.display = "block";
                    drawCreatorGrid();
                } else {
                    alert("Chybný formát souboru (musí mít 28 polí).");
                }
            } catch (err) {
                alert("Nepodařilo se přečíst JSON soubor.");
            }
        };
        reader.readAsText(file);
    });

    // START HRY A GENEROVÁNÍ DESKY
    document.getElementById("btn-start-game").addEventListener("click", () => {
        screenCreator.style.display = "none";
        screenGame.style.display = "block";
        buildHexPyramid();
        socket.emit("sync-questions", gameQuestions);
    });

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
                    if (tile.className !== "tile") return;
                    socket.emit("tile-selected-live", tile.innerText);
                });

                rowDiv.appendChild(tile);
                idCounter++;
            }
            azPyramid.appendChild(rowDiv);
        }
    }

    // ODHALENÍ ŘEŠENÍ MODERÁTOROVI
    btnRevealSolution.addEventListener("click", () => {
        solutionRevealText.innerText = `Správné řešení: ${gameQuestions[activeTileId].odpoved}`;
        solutionRevealText.style.display = "block";
    });

    // EVALUACE TEXTOVÉ ODPOVÊDI S TOLERANCÍ
    document.getElementById("btn-game-submit").addEventListener("click", () => {
        const playerAns = document.getElementById("game-player-answer").value;
        const correctAns = gameQuestions[activeTileId].odpoved;
        
        let targetStatus = "black"; 
        if (checkAnswerWithTolerance(playerAns, correctAns)) {
            targetStatus = currentPlayer === 1 ? "player1" : "player2";
            alert("Odpověď uznána jako správná!");
        } else {
            alert(`Odpověď byla chybná. Správné řešení: ${correctAns}`);
        }

        socket.emit("tile-processed-live", { tileId: activeTileId, status: targetStatus });
        closeQuestionBox();
    });

    // RUČNÍ TLAČÍTKA MODERÁTORA
    document.getElementById("btn-manual-red").addEventListener("click", () => {
        socket.emit("tile-processed-live", { tileId: activeTileId, status: "player1" });
        closeQuestionBox();
    });
    document.getElementById("btn-manual-black").addEventListener("click", () => {
        socket.emit("tile-processed-live", { tileId: activeTileId, status: "black" });
        closeQuestionBox();
    });
    document.getElementById("btn-manual-blue").addEventListener("click", () => {
        socket.emit("tile-processed-live", { tileId: activeTileId, status: "player2" });
        closeQuestionBox();
    });

    function closeQuestionBox() {
        gameQuestionBox.style.display = "none";
        solutionRevealText.style.display = "none";
    }

    // WEBSOCKET REFRESH STATU V REÁLNÉM ČASE
    socket.on("init-state", (data) => {
        currentPlayer = data.currentPlayer;
        updateStatusBarUI();
    });

    socket.on("questions-broadcast", (questions) => {
        gameQuestions = questions;
        if (screenGame.style.display === "none") {
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
        solutionRevealText.style.display = "none";
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
            statusBar.innerText = "Na řadě je: ČERVENÝ TÝM 🔴";
            statusBar.style.background = "#fee2e2"; statusBar.style.color = "#dc2626";
        } else {
            statusBar.innerText = "Na řadě je: MODRÝ TÝM 🔵";
            statusBar.style.background = "#dbeafe"; statusBar.style.color = "#2563eb";
        }
    }
});