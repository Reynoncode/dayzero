// ============================================================
// MAP.JS — Interactive canvas map with PNG background
// ============================================================

const Map = (() => {

  let canvas, ctx, W, H;
  let locSpots = [];
  let selectedLoc = null;
  let mapImage = null;
  let imageLoaded = false;

  function init() {
    canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Load map PNG
    mapImage = new Image();
    mapImage.src = 'map.png';
    mapImage.onload = () => {
      imageLoaded = true;
      resize();
      draw();
    };
    mapImage.onerror = () => {
      imageLoaded = false;
      resize();
      draw();
    };

    resize();
    draw();

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: true });
    canvas.addEventListener('mousemove', onMouseMove);

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
    LOCATIONS.forEach(loc => drawLocation(loc));
    drawPlayerBase();
  }

  function drawBackground() {
    if (imageLoaded && mapImage) {
      // Draw PNG image as full background
      ctx.drawImage(mapImage, 0, 0, W, H);

      // Dark overlay to keep game mood + readability
      const grad = ctx.createRadialGradient(W/2, H/2, H*0.05, W/2, H/2, H*0.75);
      grad.addColorStop(0, 'rgba(0,0,0,0.18)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Fallback dark background
      ctx.fillStyle = '#0c0e0b';
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.8);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // Grid fallback
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
  }

  function drawLocation(loc) {
    const x  = loc.x * W;
    const y  = loc.y * H;
    const r  = 16;

    const dangerColors = ['#4a7c59','#6a8c30','#8b8020','#8b5020','#8b2020'];
    const col = dangerColors[Math.min(loc.danger - 1, 4)];

    // Pulse ring for selected
    if (selectedLoc?.id === loc.id) {
      ctx.beginPath();
      ctx.arc(x, y, r + 10, 0, Math.PI * 2);
      ctx.fillStyle = `${col}22`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = `${col}33`;
      ctx.fill();
    }

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Icon circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = selectedLoc?.id === loc.id ? '#1a2a1a' : '#0e1510';
    ctx.fill();
    ctx.strokeStyle = selectedLoc?.id === loc.id ? col : `${col}aa`;
    ctx.lineWidth = selectedLoc?.id === loc.id ? 2.5 : 1.5;
    ctx.stroke();

    // Emoji icon
    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(loc.icon, x, y);

    // Name label — small background for readability
    ctx.font = 'bold 7px "Courier Prime", monospace';
    const nameW = ctx.measureText(loc.name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - nameW/2 - 2, y + r + 2, nameW + 4, 10);
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(loc.name, x, y + r + 3);

    // Danger dots
    for (let i = 0; i < loc.danger; i++) {
      ctx.beginPath();
      ctx.arc(x - (loc.danger - 1) * 4 + i * 8, y + r + 15, 2, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // Distance label
    ctx.font = '6px "Courier Prime", monospace';
    ctx.fillStyle = '#777';
    ctx.textBaseline = 'top';
    ctx.fillText(`${loc.distanceKm}km`, x, y + r + 20);

    locSpots.push({ loc, x, y, r: r + 10 });
  }

  function drawPlayerBase() {
    const x = W * 0.5, y = H * 0.82;

    // Glow
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(74,124,89,0.15)';
    ctx.fill();

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2a1a';
    ctx.fill();
    ctx.strokeStyle = '#4a7c59';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '12px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', x, y);

    ctx.font = 'bold 7px "Courier Prime", monospace';
    ctx.fillStyle = '#6aad7a';
    ctx.textBaseline = 'top';
    ctx.fillText('BAZA', x, y + 16);
  }

  // ---- Hover effect ----
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * sx;
    const py = (e.clientY - rect.top) * sy;
    let hovered = false;
    for (const spot of locSpots) {
      const dx = px - spot.x, dy = py - spot.y;
      if (Math.sqrt(dx*dx + dy*dy) <= spot.r) {
        hovered = true;
        break;
      }
    }
    canvas.style.cursor = hovered ? 'pointer' : 'default';
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
    const st = State.get();
    st.currentLocation     = selectedLoc.id;
    st.currentRoomIndex    = 0;
    State.advanceTime(selectedLoc.travelHours);
    State.addMessage(`${selectedLoc.name}-a getdin.`, 'normal');
    State.save();
    Loot.startLocation(selectedLoc.id);
    UI.showScreen('loot');
  }

  return { init, draw };
})();
