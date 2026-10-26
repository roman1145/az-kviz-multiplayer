document.addEventListener("DOMContentLoaded", () => {
    // Inicializace síťového propojení (bude funkční, až spustíme server)
    const socket = typeof io !== 'undefined' ? io() : null;

    const pyramidContainer = document.getElementById("az-pyramid");
    const statusBar = document.getElementById("status-bar");
    const questionBox = document.getElementById("question-box");
    const questionTitle = document.getElementById("question-title");
    const questionText = document.getElementById("question-text");
    const playerAnswerInput = document.getElementById("player-answer");
    const submitAnswerBtn = document.getElementById("submit-answer-btn");
    const questionsEditList = document.getElementById("questions-edit-list");
    const downloadBtn = document.getElementById("download-questions-btn");
    const uploadInput = document.getElementById("upload-questions-input");

    let currentPlayer = 1;
    let tileNumber = 1;
    const tileElements = {}; 
    let activeTileId = null;

    // Lokální databáze 28 otázek (výchozí texty)
    let gameQuestions = {};
    for (let i = 1; i <= 28; i++) {
        gameQuestions[i] = {
            otazka: `Zadejte text otázky pro políčko číslo ${i} v admin sekci dole.`,
            odpoved: `odpoved${i}`
        };
    }

    // Vygenerování formulářů pro úpravu otázek v administraci dole na webu
    function generateAdminQuestionsList() {
        questionsEditList.innerHTML = "";
        for (let i = 1; i <= 28; i++) {
            const row = document.createElement("div");
            row.style.marginBottom = "10px";
            row.style.display = "flex";
            row.style.flexDirection = "column";
            row.style.borderBottom = "1px solid #eee";
            row.style.paddingBottom = "5px";

            row.innerHTML = `
                <strong>Políčko ${i}:</strong>
                <input type="text" data-id="${i}" data-type="otazka" value="${gameQuestions[i].otazka}" placeholder="Otázka" style="margin: 2px 0; padding: 4px;">
                <input type="text" data-id="${i}" data-type="odpoved" value="${gameQuestions[i].odpoved}" placeholder="Správná odpověď" style="margin: 2px 0; padding: 4px; font-weight: bold;">
            `;
            questionsEditList.appendChild(row);
        }

        // Automatické ukládání změn z políček do paměti prohlížeče
        questionsEditList.querySelectorAll("input").forEach(input => {
            input.addEventListener("input", (e) => {
                const id = e.target.getAttribute("data-id");
                const type = e.target.getAttribute("data-type");
                gameQuestions[id][type] = e.target.value;
            });
        });
    }
    generateAdminQuestionsList();

    // 📥 EXPORT: Tlačítko pro stažení otázek do .json souboru v PC [filegen-via-code]
    downloadBtn.addEventListener("click", () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameQuestions, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "az_kviz_otazky.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    // 📤 IMPORT: Tlačítko pro nahrání staženého souboru s otázkami zpět do hry
    uploadInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (Object.keys(parsed).length === 28) {
                    gameQuestions = parsed;
                    generateAdminQuestionsList();
                    alert("Otázky byly úspěšně nahrány do hry!");
                } else {
                    alert("Chyba: Soubor musí obsahovat přesně 28 otázek.");
                }
            } catch (err) {
                alert("Nepovedlo se načíst soubor. Ujistěte se, že jde o správný JSON formát.");
            }
        };
        reader.readAsText(file);
    });

    // Aktualizace barvy horního panelu podle hráče na řadě
    function updateStatusBar(player) {
        currentPlayer = player;
        if (currentPlayer === 1) {
            statusBar.innerText = "Na řadě je: HRÁČ 1 (Oranžový)";
            statusBar.style.backgroundColor = "#ffe8cc";
            statusBar.style.color = "#ff8c00";
        } else {
            statusBar.innerText = "Na řadě je: HRÁČ 2 (Modrý)";
            statusBar.style.backgroundColor = "#e7f5ff";
            statusBar.style.color = "#007bff";
        }
    }
    updateStatusBar(1);

    // Vykreslení pyramidy (7 řad)
    for (let row = 1; row <= 7; row++) {
        const rowElement = document.createElement("div");
        rowElement.classList.add("pyramid-row");

        for (let col = 1; col <= row; col++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");
            tile.innerText = tileNumber;
            tileElements[tileNumber] = tile;

            // Kliknutí na políčko desky
            tile.addEventListener("click", () => {
                if (tile.classList.contains("player1") || tile.classList.contains("player2") || tile.classList.contains("black")) {
                    return;
                }

                // Otevření okna s otázkou
                activeTileId = tile.innerText;
                questionTitle.innerText = `Políčko číslo ${activeTileId}`;
                questionText.innerText = gameQuestions[activeTileId].otazka;
                playerAnswerInput.value = "";
                questionBox.style.display = "block";
                playerAnswerInput.focus();
            });

            rowElement.appendChild(tile);
            tileNumber++;
        }
        pyramidContainer.appendChild(rowElement);
    }

    // Vyhodnocení zadané odpovědi po kliknutí na tlačítko Odeslat
    submitAnswerBtn.addEventListener("click", () => {
        if (!activeTileId) return;

        const userAnswer = playerAnswerInput.value.trim().toLowerCase();
        const correctAnswer = gameQuestions[activeTileId].odpoved.trim().toLowerCase();

        let status = 'black'; // Výchozí stav při chybě (černá)
        
        if (userAnswer === correctAnswer) {
            status = currentPlayer === 1 ? 'player1' : 'player2';
            alert("Správná odpověď! Získáváte políčko.");
        } else {
            alert(`Špatná odpověď! Políčko se zamyká. Správná odpověď byla: ${gameQuestions[activeTileId].odpoved}`);
        }

        // Pokud je server aktivní, pošleme stav tam, jinak aplikujeme lokálně (pro testování)
        if (socket) {
            socket.emit('tile-clicked', { tileId: activeTileId, status: status });
        } else {
            // Nouzový lokální režim bez serveru
            tileElements[activeTileId].classList.add(status);
            updateStatusBar(currentPlayer === 1 ? 2 : 1);
        }
        
        questionBox.style.display = "none";
        activeTileId = null;
    });

    // Příjem zpráv ze serveru (pro multiplayer v reálném čase)
    if (socket) {
        socket.on('init-state', (data) => {
            updateStatusBar(data.currentPlayer);
            for (const id in data.tileStates) {
                if (tileElements[id]) tileElements[id].className = 'tile ' + data.tileStates[id];
            }
        });

        socket.on('state-updated', (data) => {
            updateStatusBar(data.currentPlayer);
            for (const id in data.tileStates) {
                if (tileElements[id]) tileElements[id].className = 'tile ' + data.tileStates[id];
            }
        });
    }
});
