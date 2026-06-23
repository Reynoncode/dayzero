// ============================================================
// MAP.JS — Interactive canvas map
// ============================================================

const Map = (() => {

  let canvas, ctx, W, H;
  let locSpots = []; // [{loc, x, y, r}] for hit testing
  let selectedLoc = null;

  function init() {
    canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resize();
    draw();

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: true });

    document.getElementById('loc-go-btn')?.addEventListener('click', onGo);
  }

  function resize() {
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;
  }

  // ---- Drawing ----
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    locSpots = [];

    drawBackground();
    drawGrid();
    drawRoads();
    LOCATIONS.forEach(loc => drawLocation(loc));
    drawPlayerBase();
  }

  function drawBackground() {
    // Dark map background
    ctx.fillStyle = '#0c0e0b';
    ctx.fillRect(0, 0, W, H);

    // Vignette
    const grad = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.8);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const step = 30;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawRoads() {
    // Horizontal roads
    ctx.strokeStyle = 'rgba(60,60,50,0.5)';
    ctx.lineWidth = 6;
    ctx.setLineDash([]);

    const roads = [
      [0, H*0.35, W, H*0.35],
      [0, H*0.65, W, H*0.65],
      [W*0.25, 0, W*0.25, H],
      [W*0.6,  0, W*0.6,  H],
    ];

    roads.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Road center lines
    ctx.strokeStyle = 'rgba(80,70,30,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 10]);
    roads.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function drawLocation(loc) {
    const x  = loc.x * W;
    const y  = loc.y * H;
    const r  = 18;
    const st = State.get();

    // Danger color
    const dangerColors = ['#4a7c59','#6a8c30','#8b8020','#8b5020','#8b2020'];
    const col = dangerColors[Math.min(loc.danger - 1, 4)];

    // Outer glow for selected
    if (selectedLoc?.id === loc.id) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.fillStyle = `${col}33`;
      ctx.fill();
    }

    // Icon circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.strokeStyle = selectedLoc?.id === loc.id ? col : `${col}88`;
    ctx.lineWidth = selectedLoc?.id === loc.id ? 2 : 1.5;
    ctx.stroke();

    // Emoji icon
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(loc.icon, x, y);

    // Name label
    ctx.font = '8px "Courier Prime", monospace';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(loc.name, x, y + r + 3);

    // Danger dots
    for (let i = 0; i < loc.danger; i++) {
      ctx.beginPath();
      ctx.arc(x - (loc.danger - 1) * 5 + i * 10, y + r + 16, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // Distance
    ctx.font = '7px "Courier Prime", monospace';
    ctx.fillStyle = '#666';
    ctx.textBaseline = 'top';
    ctx.fillText(`${loc.distanceKm}km`, x, y + r + 22);

    locSpots.push({ loc, x, y, r: r + 10 });
  }

  function drawPlayerBase() {
    const x = W * 0.5, y = H * 0.85;
    // House icon
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2a1a';
    ctx.fill();
    ctx.strokeStyle = '#4a7c59';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', x, y);

    ctx.font = '8px "Courier Prime", monospace';
    ctx.fillStyle = '#6aad7a';
    ctx.textBaseline = 'top';
    ctx.fillText('Baza', x, y + 16);
  }

  // ---- Interaction ----
  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * sx;
    const py = (e.clientY - rect.top)  * sy;
    handleTap(px, py);
  }

  function onTouch(e) {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const px = (t.clientX - rect.left) * sx;
    const py = (t.clientY - rect.top)  * sy;
    handleTap(px, py);
  }

  function handleTap(px, py) {
    for (const spot of locSpots) {
      const dx = px - spot.x, dy = py - spot.y;
      if (Math.sqrt(dx*dx + dy*dy) <= spot.r) {
        selectedLoc = spot.loc;
        showLocationPanel(spot.loc);
        draw();
        return;
      }
    }
    // Tapped empty area — deselect
    selectedLoc = null;
    hideLocationPanel();
    draw();
  }

  function showLocationPanel(loc) {
    const panel = document.getElementById('location-panel');
    const dangerLabels = ['', 'Çox Az', 'Az', 'Orta', 'Yüksək', 'Ölümcül'];
    const dangerColors = ['','#4a7c59','#6a8c30','#8b8020','#8b5020','#8b2020'];

    document.getElementById('loc-name').textContent     = `${loc.icon} ${loc.name}`;
    document.getElementById('loc-distance').textContent = `📍 ${loc.distanceKm} km — ${loc.travelHours * 60} dəqiqə yol`;
    document.getElementById('loc-desc').textContent     = loc.desc;
    document.getElementById('loc-danger').innerHTML     = `Təhlükə: <span style="color:${dangerColors[loc.danger]}">${dangerLabels[loc.danger]}</span>  |  ${loc.rooms.length} otaq`;

    panel.classList.remove('hidden');

    // Update time info
    const st = State.get();
    const hoursLeft = 24 - st.hour - st.minute / 60;
    document.getElementById('map-time-left').textContent =
      hoursLeft < loc.travelHours * 2
        ? '⚠ Gün bitir!'
        : `${Math.floor(hoursLeft)}s ${Math.round((hoursLeft % 1) * 60)}d qalır`;
  }

  function hideLocationPanel() {
    document.getElementById('location-panel')?.classList.add('hidden');
    document.getElementById('map-time-left').textContent = '';
  }

  function onGo() {
    if (!selectedLoc) return;
    // Set current location in state and travel time
    const st = State.get();
    st.currentLocation     = selectedLoc.id;
    st.currentRoomIndex    = 0;
    State.advanceTime(selectedLoc.travelHours);
    State.addMessage(`${selectedLoc.name}-a getdin.`, 'normal');
    State.save();

    // Go to loot/combat flow
    Loot.startLocation(selectedLoc.id);
    UI.showScreen('loot');
  }

  return { init, draw };
})();
