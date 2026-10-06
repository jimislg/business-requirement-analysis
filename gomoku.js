/* eslint-env browser */
/* global window, document */
(function () {
  "use strict";

  // ---------- Constants ----------
  var SIZE = 15; // 15x15 board
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;

  // Star points (天元 + 四角星位)
  var STAR_POINTS = [
    [3, 3],
    [3, 11],
    [7, 7],
    [11, 3],
    [11, 11],
  ];

  // ---------- DOM ----------
  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var statusBar = document.getElementById("statusBar");
  var turnIndicator = document.getElementById("turnIndicator");
  var turnText = document.getElementById("turnText");
  var restartBtn = document.getElementById("restartBtn");
  var undoBtn = document.getElementById("undoBtn");
  var historyList = document.getElementById("historyList");
  var modeRadios = document.getElementsByName("mode");

  // ---------- State ----------
  var board = []; // 2D array of EMPTY/BLACK/WHITE
  var history = []; // [{x,y,player}]
  var currentPlayer = BLACK;
  var gameOver = false;
  var winLine = null; // array of [x,y] for winning five
  var mode = "pvp"; // 'pvp' | 'pve'
  var hoverPos = null; // {x,y} mouse hover preview
  var aiThinking = false;

  // ---------- Layout (computed) ----------
  var canvasSize = 640;
  var padding = 30;
  var cellSize;
  var gridSize;

  function recalcLayout() {
    // canvas internal resolution stays 640; CSS may scale it.
    canvasSize = canvas.width;
    padding = Math.round(canvasSize * 0.045);
    gridSize = canvasSize - padding * 2;
    cellSize = gridSize / (SIZE - 1);
  }

  // ---------- Init ----------
  function initBoard() {
    board = [];
    for (var i = 0; i < SIZE; i++) {
      var row = [];
      for (var j = 0; j < SIZE; j++) {
        row.push(EMPTY);
      }
      board.push(row);
    }
    history = [];
    currentPlayer = BLACK;
    gameOver = false;
    winLine = null;
    hoverPos = null;
    aiThinking = false;
  }

  // ---------- Coordinate conversion ----------
  function pixelToGrid(px, py) {
    var gx = Math.round((px - padding) / cellSize);
    var gy = Math.round((py - padding) / cellSize);
    if (gx < 0 || gx >= SIZE || gy < 0 || gy >= SIZE) return null;
    // tolerance: only count if click near an intersection
    var cx = padding + gx * cellSize;
    var cy = padding + gy * cellSize;
    if (Math.abs(px - cx) > cellSize / 2 || Math.abs(py - cy) > cellSize / 2) {
      return null;
    }
    return { x: gx, y: gy };
  }

  function gridToPixel(gx, gy) {
    return {
      px: padding + gx * cellSize,
      py: padding + gy * cellSize,
    };
  }

  // ---------- Drawing ----------
  function drawBoard() {
    recalcLayout();

    // Wood background
    var grad = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    grad.addColorStop(0, "#f0c987");
    grad.addColorStop(0.5, "#e8b96b");
    grad.addColorStop(1, "#d9a14a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // subtle inner border
    ctx.strokeStyle = "rgba(120, 80, 30, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      padding - 8,
      padding - 8,
      gridSize + 16,
      gridSize + 16
    );

    // Grid lines
    ctx.strokeStyle = "rgba(60, 40, 15, 0.55)";
    ctx.lineWidth = 1;
    for (var i = 0; i < SIZE; i++) {
      var p = padding + i * cellSize;
      // horizontal
      ctx.beginPath();
      ctx.moveTo(padding, p);
      ctx.lineTo(padding + gridSize, p);
      ctx.stroke();
      // vertical
      ctx.beginPath();
      ctx.moveTo(p, padding);
      ctx.lineTo(p, padding + gridSize);
      ctx.stroke();
    }

    // Star points
    ctx.fillStyle = "rgba(60, 40, 15, 0.8)";
    for (var s = 0; s < STAR_POINTS.length; s++) {
      var sp = STAR_POINTS[s];
      var pp = gridToPixel(sp[0], sp[1]);
      ctx.beginPath();
      ctx.arc(pp.px, pp.py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStone(gx, gy, player, opts) {
    opts = opts || {};
    var p = gridToPixel(gx, gy);
    var r = cellSize * 0.42;
    var alpha = opts.alpha == null ? 1 : opts.alpha;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (player === BLACK) {
      var bg = ctx.createRadialGradient(
        p.px - r * 0.3,
        p.py - r * 0.3,
        r * 0.1,
        p.px,
        p.py,
        r
      );
      bg.addColorStop(0, "#666666");
      bg.addColorStop(0.4, "#222222");
      bg.addColorStop(1, "#000000");
      ctx.fillStyle = bg;
    } else {
      var wg = ctx.createRadialGradient(
        p.px - r * 0.3,
        p.py - r * 0.3,
        r * 0.1,
        p.px,
        p.py,
        r
      );
      wg.addColorStop(0, "#ffffff");
      wg.addColorStop(0.5, "#f0f0f0");
      wg.addColorStop(1, "#c8c8c8");
      ctx.fillStyle = wg;
    }

    ctx.beginPath();
    ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
    ctx.fill();

    // outline
    ctx.lineWidth = 1;
    ctx.strokeStyle =
      player === BLACK ? "rgba(0,0,0,0.6)" : "rgba(120,120,120,0.6)";
    ctx.stroke();

    ctx.restore();
  }

  function drawLastMoveMarker() {
    if (history.length === 0) return;
    var last = history[history.length - 1];
    var p = gridToPixel(last.x, last.y);
    ctx.save();
    ctx.strokeStyle = last.player === BLACK ? "#ff5252" : "#ff5252";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.px, p.py, cellSize * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWinHighlight() {
    if (!winLine) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    var first = gridToPixel(winLine[0][0], winLine[0][1]);
    var last = gridToPixel(
      winLine[winLine.length - 1][0],
      winLine[winLine.length - 1][1]
    );
    ctx.beginPath();
    ctx.moveTo(first.px, first.py);
    ctx.lineTo(last.px, last.py);
    ctx.stroke();
    // ring each winning stone
    for (var i = 0; i < winLine.length; i++) {
      var pp = gridToPixel(winLine[i][0], winLine[i][1]);
      ctx.beginPath();
      ctx.arc(pp.px, pp.py, cellSize * 0.46, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHover() {
    if (!hoverPos || gameOver || aiThinking) return;
    if (board[hoverPos.y][hoverPos.x] !== EMPTY) return;
    drawStone(hoverPos.x, hoverPos.y, currentPlayer, { alpha: 0.45 });
  }

  function render() {
    drawBoard();
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (board[y][x] !== EMPTY) {
          drawStone(x, y, board[y][x]);
        }
      }
    }
    drawLastMoveMarker();
    drawHover();
    drawWinHighlight();
  }

  // ---------- Win check ----------
  // Returns array of [x,y] if five-in-a-row through (lx,ly), else null.
  function checkWin(lx, ly, player) {
    var dirs = [
      [1, 0], // horizontal
      [0, 1], // vertical
      [1, 1], // diagonal down-right
      [1, -1], // diagonal up-right
    ];
    for (var d = 0; d < dirs.length; d++) {
      var dx = dirs[d][0];
      var dy = dirs[d][1];
      var line = [[lx, ly]];
      // forward
      var nx = lx + dx;
      var ny = ly + dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === player) {
        line.push([nx, ny]);
        nx += dx;
        ny += dy;
      }
      // backward
      nx = lx - dx;
      ny = ly - dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === player) {
        line.unshift([nx, ny]);
        nx -= dx;
        ny -= dy;
      }
      if (line.length >= 5) {
        return line.slice(0, 5);
      }
    }
    return null;
  }

  function isBoardFull() {
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (board[y][x] === EMPTY) return false;
      }
    }
    return true;
  }

  // ---------- Place stone ----------
  function placeStone(x, y, player) {
    if (gameOver) return false;
    if (board[y][x] !== EMPTY) return false;
    board[y][x] = player;
    history.push({ x: x, y: y, player: player });

    var line = checkWin(x, y, player);
    if (line) {
      winLine = line;
      gameOver = true;
    } else if (isBoardFull()) {
      gameOver = true;
    } else {
      currentPlayer = player === BLACK ? WHITE : BLACK;
    }
    return true;
  }

  // ---------- AI (simple heuristic) ----------
  // Scores a candidate empty cell for `player`:
  // 1. If playing here wins immediately -> very high.
  // 2. If opponent playing here would win -> high (block).
  // 3. Otherwise score by line potential for both attack & defense.
  function lineScoreFor(x, y, player) {
    // Simulate placing `player` at (x,y), count max consecutive + open ends.
    var dirs = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    var best = 0;
    for (var d = 0; d < dirs.length; d++) {
      var dx = dirs[d][0];
      var dy = dirs[d][1];
      var count = 1;
      var openEnds = 0;

      // forward
      var nx = x + dx;
      var ny = y + dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === player) {
        count++;
        nx += dx;
        ny += dy;
      }
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === EMPTY) {
        openEnds++;
      }
      // backward
      nx = x - dx;
      ny = y - dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === player) {
        count++;
        nx -= dx;
        ny -= dy;
      }
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === EMPTY) {
        openEnds++;
      }

      var score = 0;
      if (count >= 5) score = 100000;
      else if (count === 4 && openEnds >= 1) score = 10000; // live four / four with one open
      else if (count === 4) score = 1000;
      else if (count === 3 && openEnds === 2) score = 1000; // live three
      else if (count === 3 && openEnds === 1) score = 100;
      else if (count === 3) score = 50;
      else if (count === 2 && openEnds === 2) score = 100;
      else if (count === 2 && openEnds === 1) score = 20;
      else if (count === 2) score = 5;
      else if (count === 1 && openEnds === 2) score = 10;
      else if (count === 1 && openEnds === 1) score = 2;

      if (score > best) best = score;
    }
    return best;
  }

  function hasNeighbor(x, y, dist) {
    dist = dist || 2;
    for (var dy = -dist; dy <= dist; dy++) {
      for (var dx = -dist; dx <= dist; dx++) {
        if (dx === 0 && dy === 0) continue;
        var nx = x + dx;
        var ny = y + dy;
        if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] !== EMPTY) {
          return true;
        }
      }
    }
    return false;
  }

  function aiMove() {
    var aiPlayer = WHITE;
    var opp = BLACK;

    var best = null; // {x,y,score}
    var candidates = [];

    // First move: center.
    if (history.length === 0) {
      return { x: 7, y: 7 };
    }

    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (board[y][x] !== EMPTY) continue;
        if (!hasNeighbor(x, y, 2)) continue; // skip far-away cells

        var attack = lineScoreFor(x, y, aiPlayer);
        var defense = lineScoreFor(x, y, opp);

        // Immediate win > immediate block > others
        var score = attack * 1.1 + defense;

        // Slight center preference
        var centerBonus = (14 - Math.abs(x - 7) - Math.abs(y - 7)) * 0.5;
        score += centerBonus;

        candidates.push({ x: x, y: y, score: score, attack: attack, defense: defense });

        if (best === null || score > best.score) {
          best = { x: x, y: y, score: score, attack: attack, defense: defense };
        }
      }
    }

    if (!best) {
      // Board mostly empty / no neighbors: pick near center
      return { x: 7, y: 7 };
    }

    // Priority overrides:
    // 1) If AI can win now -> do it
    // 2) If opponent can win next move -> block
    for (var c = 0; c < candidates.length; c++) {
      if (candidates[c].attack >= 100000) return { x: candidates[c].x, y: candidates[c].y };
    }
    for (var d = 0; d < candidates.length; d++) {
      if (candidates[d].defense >= 100000) return { x: candidates[d].x, y: candidates[d].y };
    }
// 3) If AI can make a live four / four (next move wins) -> play it
    for (var c2 = 0; c2 < candidates.length; c2++) {
      if (candidates[c2].attack >= 10000) return { x: candidates[c2].x, y: candidates[c2].y };
    }
    // 4) If opponent could make a live four / four next -> block it
    for (var d2 = 0; d2 < candidates.length; d2++) {
      if (candidates[d2].defense >= 10000) return { x: candidates[d2].x, y: candidates[d2].y };
    }

    return { x: best.x, y: best.y };
  }

  function runAITurn() {
    if (gameOver) return;
    if (mode !== "pve") return;
    if (currentPlayer !== WHITE) return;
    aiThinking = true;
    updateStatus();
    // Defer so UI can paint "thinking" state.
    setTimeout(function () {
      var mv = aiMove();
      if (mv) {
        placeStone(mv.x, mv.y, WHITE);
        aiThinking = false;
        afterMove();
      } else {
        aiThinking = false;
        updateStatus();
      }
    }, 280);
  }

  // ---------- UI updates ----------
  function updateStatus() {
    statusBar.classList.remove("win", "draw");
    if (gameOver) {
      if (winLine) {
        var winner = history[history.length - 1].player;
        statusBar.classList.add("win");
        turnIndicator.innerHTML =
          '<span class="stone-dot ' +
          (winner === BLACK ? "black" : "white") +
          '" aria-hidden="true"></span>' +
          "<span>" +
          (winner === BLACK ? "黑棋" : "白棋") +
          "获胜！</span>";
      } else {
        statusBar.classList.add("draw");
        turnIndicator.innerHTML = "<span>平局，棋盘已满</span>";
      }
    } else if (aiThinking) {
      turnIndicator.innerHTML =
        '<span class="stone-dot white" aria-hidden="true"></span><span>电脑思考中…</span>';
    } else {
      turnIndicator.innerHTML =
        '<span class="stone-dot ' +
        (currentPlayer === BLACK ? "black" : "white") +
        '" aria-hidden="true"></span>' +
        "<span>" +
        (currentPlayer === BLACK ? "黑棋" : "白棋") +
        "落子</span>";
    }
    turnText.textContent = "";
    undoBtn.disabled = history.length === 0 || aiThinking;
  }

  function colLabel(x) {
    // A-O
    return String.fromCharCode(65 + x);
  }

  function updateHistory() {
    historyList.innerHTML = "";
    if (history.length === 0) {
      var li = document.createElement("li");
      li.className = "mv-empty";
      li.textContent = "暂无落子";
      historyList.appendChild(li);
      return;
    }
    for (var i = 0; i < history.length; i++) {
      var h = history[i];
      var item = document.createElement("li");
      item.className = h.player === BLACK ? "mv-black" : "mv-white";
      var num = i + 1;
      var who = h.player === BLACK ? "黑" : "白";
      item.textContent =
        num + ". " + who + " " + colLabel(h.x) + (h.y + 1);
      historyList.appendChild(item);
    }
    // scroll to bottom
    historyList.scrollTop = historyList.scrollHeight;
  }

  function afterMove() {
    render();
    updateStatus();
    updateHistory();
    if (!gameOver && mode === "pve" && currentPlayer === WHITE) {
      runAITurn();
    }
  }

  // ---------- Events ----------
  function getCanvasPos(evt) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var clientX = evt.clientX;
    var clientY = evt.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener("click", function (evt) {
    if (gameOver || aiThinking) return;
    if (mode === "pve" && currentPlayer === WHITE) return; // not human's turn
    var pos = getCanvasPos(evt);
    var grid = pixelToGrid(pos.x, pos.y);
    if (!grid) return;
    if (board[grid.y][grid.x] !== EMPTY) return;
    placeStone(grid.x, grid.y, currentPlayer);
    afterMove();
  });

  canvas.addEventListener("mousemove", function (evt) {
    if (gameOver || aiThinking) {
      if (hoverPos) {
        hoverPos = null;
        render();
      }
      return;
    }
    if (mode === "pve" && currentPlayer === WHITE) return;
    var pos = getCanvasPos(evt);
    var grid = pixelToGrid(pos.x, pos.y);
    if (!grid) {
      if (hoverPos) {
        hoverPos = null;
        render();
      }
      return;
    }
    if (!hoverPos || hoverPos.x !== grid.x || hoverPos.y !== grid.y) {
      hoverPos = grid;
      render();
    }
  });

  canvas.addEventListener("mouseleave", function () {
    if (hoverPos) {
      hoverPos = null;
      render();
    }
  });

  // Touch support: tap to place
  canvas.addEventListener(
    "touchstart",
    function (evt) {
      if (gameOver || aiThinking) return;
      if (mode === "pve" && currentPlayer === WHITE) return;
      if (evt.touches.length === 0) return;
      var t = evt.touches[0];
      var pos = getCanvasPos(t);
      var grid = pixelToGrid(pos.x, pos.y);
      if (!grid) return;
      if (board[grid.y][grid.x] !== EMPTY) return;
      evt.preventDefault();
      placeStone(grid.x, grid.y, currentPlayer);
      afterMove();
    },
    { passive: false }
  );

  restartBtn.addEventListener("click", function () {
    initBoard();
    render();
    updateStatus();
    updateHistory();
  });

  undoBtn.addEventListener("click", function () {
    if (aiThinking) return;
    if (history.length === 0) return;
    // In pve mode, undo both AI's move and the player's move so it's human's turn again.
    if (mode === "pve") {
      // If last move was AI (white), pop it; then pop the human's move too.
      if (history.length >= 1 && history[history.length - 1].player === WHITE) {
        var last1 = history.pop();
        board[last1.y][last1.x] = EMPTY;
      }
      if (history.length >= 1 && history[history.length - 1].player === BLACK) {
        var last2 = history.pop();
        board[last2.y][last2.x] = EMPTY;
      }
      currentPlayer = BLACK;
    } else {
      var last = history.pop();
      board[last.y][last.x] = EMPTY;
      currentPlayer = last.player;
    }
    gameOver = false;
    winLine = null;
    render();
    updateStatus();
    updateHistory();
  });

  function getMode() {
    for (var i = 0; i < modeRadios.length; i++) {
      if (modeRadios[i].checked) return modeRadios[i].value;
    }
    return "pvp";
  }

  function setMode(m) {
    mode = m;
  }

  for (var i = 0; i < modeRadios.length; i++) {
    modeRadios[i].addEventListener("change", function () {
      var newMode = getMode();
      if (newMode === mode) return;
      setMode(newMode);
      // Restart on mode switch for clarity
      initBoard();
      render();
      updateStatus();
      updateHistory();
      // If switching to pve and it's somehow white's turn (shouldn't happen after init), run AI.
      if (mode === "pve" && currentPlayer === WHITE && !gameOver) {
        runAITurn();
      }
    });
  }

  // Handle canvas CSS scaling: redraw on resize keeps crispness consistent.
  window.addEventListener("resize", function () {
    render();
  });

  // ---------- Boot ----------
  function boot() {
    recalcLayout();
    setMode(getMode());
    initBoard();
    render();
    updateStatus();
    updateHistory();
  }

  boot();
})();
