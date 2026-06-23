// ============================================================
// RENDERER.JS — Canvas drawing for base floor plan
// ============================================================

const Renderer = (() => {

  // ---- Colors ----
  const C = {
    bg:         '#0a0a0a',
    wall:       '#2e2e2e',
    wallLight:  '#3a3a3a',
    floor:      '#111111',
    floorBuilt: '#141820',
    floorEmpty: '#0d0d0d',
    door:       '#222222',
    textMain:   '#aaaaaa',
    textDim:    '#444444',
    textBuilt:  '#cccccc',
    accent:     '#4a7c59',
    accentDim:  '#2a4a35',
    locked:     '#1e1e1e',
    highlight:  '#1a2a1a',
    splat:      'rgba(255,255,255,0.06)',
  };

  let canvas, ctx, W, H;
  let roomRects = [];   // [{roomId, x, y, w, h}] for hit testing

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    const wrap = canvas.parentElement;
    W = wrap.offsetWidth;
    H = wrap.offsetHeight;
    canvas.width  = W;
    canvas.height = H;
  }

  // ---- Sketch helpers ----
  function sketchRect(x, y, w, h, wobble = 1.5) {
    ctx.beginPath();
    ctx.moveTo(x + rnd(wobble), y + rnd(wobble));
    ctx.lineTo(x + w + rnd(wobble), y + rnd(wobble));
    ctx.lineTo(x + w + rnd(wobble), y + h + rnd(wobble));
    ctx.lineTo(x + rnd(wobble), y + h + rnd(wobble));
    ctx.closePath();
  }

  function rnd(n) { return (Math.random() - 0.5) * n * 2; }

  function sketchLine(x1, y1, x2, y2, wobble = 1) {
    ctx.beginPath();
    ctx.moveTo(x1 + rnd(wobble), y1 + rnd(wobble));
    ctx.lineTo(x2 + rnd(wobble), y2 + rnd(wobble));
    ctx.stroke();
  }

  // Draw a rough cross-hatch fill inside rect
  function hatchFill(x, y, w, h, gap = 10, alpha = 0.04) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = x; i < x + w + h; i += gap) {
      ctx.moveTo(Math.max(x, i - h), Math.max(y, y + i - (x + w)));
      ctx.lineTo(Math.min(x + w, i), Math.min(y + h, y + i - x));
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw furniture inside a room (deterministic pseudo-random per roomId)
  function drawFurniture(roomId, rx, ry, rw, rh) {
    ctx.save();
    ctx.strokeStyle = C.wallLight;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;

    const p = 8; // padding from walls

    if (roomId === 'bedroom') {
      // Bed frame - left side
      const bx = rx + p, by = ry + p, bw = rw * 0.45, bh = rh - p * 2;
      ctx.strokeStyle = '#3a3a3a';
      sketchRect(bx, by, bw, bh, 1);
      ctx.stroke();
      // Pillow
      ctx.strokeStyle = '#333';
      sketchRect(bx + 4, by + 4, bw - 8, bh * 0.28, 0.8);
      ctx.stroke();
      // Blanket lines
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 0.7;
      for (let i = 3; i < 7; i++) {
        sketchLine(bx + 4, by + bh * 0.35 + i * 6, bx + bw - 4, by + bh * 0.35 + i * 6, 0.5);
      }
      // Nightstand - right
      const nx = rx + rw - p - 20, ny = ry + p;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      sketchRect(nx, ny, 20, 22, 0.8);
      ctx.stroke();
      // Lamp on nightstand
      ctx.beginPath();
      ctx.arc(nx + 10, ny + 8, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    else if (roomId === 'workbench') {
      // Long workbench table
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1.2;
      sketchRect(rx + p, ry + p, rw - p * 2, rh * 0.55, 1);
      ctx.stroke();
      // Tools on table
      ctx.strokeStyle = '#2e2e2e';
      ctx.lineWidth = 0.8;
      sketchLine(rx + p + 6, ry + p + 8, rx + p + 6, ry + p + rh * 0.55 - 8, 0.5);
      sketchLine(rx + p + 14, ry + p + 5, rx + p + 20, ry + p + rh * 0.55 - 5, 0.5);
      // Tool box
      ctx.strokeStyle = '#333';
      sketchRect(rx + p, ry + rh * 0.65, 18, 14, 0.7);
      ctx.stroke();
    }

    else if (roomId === 'waterCollector') {
      // Barrel
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(rx + rw / 2, ry + rh / 2, rw * 0.3, rh * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Rings on barrel
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = '#2e2e2e';
      for (let r = 0.25; r <= 0.75; r += 0.25) {
        ctx.beginPath();
        ctx.ellipse(rx + rw / 2, ry + rh * 0.3 + rh * r * 0.5, rw * 0.3, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Drip line
      sketchLine(rx + rw / 2, ry + p, rx + rw / 2, ry + rh / 2 - rh * 0.35, 0.5);
    }

    else if (roomId === 'garden') {
      // Plant rows
      ctx.strokeStyle = '#2e4a2e';
      ctx.lineWidth = 0.8;
      for (let row = 0; row < 3; row++) {
        const rowY = ry + p + row * (rh - p * 2) / 3;
        sketchLine(rx + p, rowY, rx + rw - p, rowY, 0.5);
        // Sprout marks
        for (let col = 0; col < 4; col++) {
          const cx2 = rx + p + col * (rw - p * 2) / 4 + 4;
          ctx.beginPath();
          ctx.moveTo(cx2, rowY);
          ctx.quadraticCurveTo(cx2 + 3, rowY - 8, cx2 + 6, rowY - 5);
          ctx.stroke();
        }
      }
    }

    else if (roomId === 'weaponRack') {
      // Wall rack
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1.2;
      sketchLine(rx + p, ry + p + rh * 0.2, rx + rw - p, ry + p + rh * 0.2, 0.8);
      sketchLine(rx + p, ry + p + rh * 0.5, rx + rw - p, ry + p + rh * 0.5, 0.8);
      // Weapon silhouettes
      ctx.lineWidth = 0.8;
      // Knife
      ctx.beginPath();
      ctx.moveTo(rx + p + 8, ry + p + 4);
      ctx.lineTo(rx + p + 8, ry + p + rh * 0.2 - 4);
      ctx.stroke();
      // Axe
      ctx.strokeStyle = '#2e2e2e';
      ctx.beginPath();
      ctx.moveTo(rx + p + 20, ry + p + 4);
      ctx.lineTo(rx + p + 20, ry + p + rh * 0.2 - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rx + p + 20, ry + p + 4);
      ctx.lineTo(rx + p + 26, ry + p + 12);
      ctx.stroke();
    }

    else if (roomId === 'medStation') {
      // Cross symbol
      ctx.strokeStyle = '#2e4a3e';
      ctx.lineWidth = 2;
      const cx2 = rx + rw / 2, cy2 = ry + rh * 0.4;
      sketchLine(cx2 - 10, cy2, cx2 + 10, cy2, 0.5);
      sketchLine(cx2, cy2 - 10, cx2, cy2 + 10, 0.5);
      // Medicine cabinet
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      sketchRect(rx + p, ry + rh * 0.6, rw - p * 2, rh * 0.28, 0.8);
      ctx.stroke();
    }

    else if (roomId === 'storageRoom') {
      // Boxes
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      const boxSz = 18;
      const positions = [[p, p],[p+22,p],[p+44,p],[p,p+22],[p+22,p+22]];
      positions.forEach(([bx2, by2]) => {
        sketchRect(rx + bx2, ry + by2, boxSz, boxSz, 0.8);
        ctx.stroke();
        // X on box
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = '#2a2a2a';
        sketchLine(rx + bx2 + 3, ry + by2 + 3, rx + bx2 + boxSz - 3, ry + by2 + boxSz - 3, 0.3);
        sketchLine(rx + bx2 + boxSz - 3, ry + by2 + 3, rx + bx2 + 3, ry + by2 + boxSz - 3, 0.3);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
      });
    }

    else if (roomId === 'radioRoom') {
      // Radio box
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1.2;
      sketchRect(rx + p, ry + rh * 0.2, rw - p * 2, rh * 0.45, 0.8);
      ctx.stroke();
      // Antenna
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#2e2e2e';
      sketchLine(rx + rw - p - 8, ry + rh * 0.2, rx + rw - p - 4, ry + p + 4, 0.5);
      // Dial circles
      ctx.beginPath();
      ctx.arc(rx + p + 12, ry + rh * 0.42, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rx + rw - p - 12, ry + rh * 0.42, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw ink splat at position
  function drawSplat(x, y, r, alpha = 0.07) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // drips
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(
        x + rnd(r * 0.8), y + r * 0.4 + Math.random() * r * 0.5,
        3 + Math.random() * 4, 4 + Math.random() * 6,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Main draw function ----
  function drawBase() {
    if (!canvas) return;
    const st = State.get();
    ctx.clearRect(0, 0, W, H);
    roomRects = [];

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Splats (fixed seed positions)
    drawSplat(W * 0.8, H * 0.18, 28);
    drawSplat(W * 0.1, H * 0.62, 22);
    drawSplat(W * 0.55, H * 0.85, 18);

    // Layout: grid columns/rows
    const PAD = 10;
    const COLS = 3, ROWS = 4;
    const cellW = (W - PAD * 2) / COLS;
    const cellH = (H - PAD * 2) / ROWS;
    const GAP = 5;

    const roomOrder = [
      // [roomId, col, row, colSpan, rowSpan]
      ['bedroom',       0, 0, 2, 2],
      ['workbench',     2, 0, 1, 1],
      ['waterCollector',2, 1, 1, 1],
      ['garden',        0, 2, 1, 1],
      ['weaponRack',    1, 2, 1, 1],
      ['medStation',    2, 2, 1, 1],
      ['storageRoom',   0, 3, 2, 1],
      ['radioRoom',     2, 3, 1, 1],
    ];

    roomOrder.forEach(([roomId, col, row, colSpan, rowSpan]) => {
      const rx = PAD + col * cellW + GAP / 2;
      const ry = PAD + row * cellH + GAP / 2;
      const rw = cellW * colSpan - GAP;
      const rh = cellH * rowSpan - GAP;

      const built = st.rooms[roomId]?.built;
      const def   = ROOMS[roomId];

      // Store for hit testing
      roomRects.push({ roomId, x: rx, y: ry, w: rw, h: rh });

      // Floor fill
      ctx.fillStyle = built ? C.floorBuilt : C.floorEmpty;
      ctx.fillRect(rx, ry, rw, rh);

      // Cross-hatch
      hatchFill(rx, ry, rw, rh, 12, built ? 0.06 : 0.03);

      // Walls — sketchy border
      ctx.strokeStyle = built ? C.wallLight : C.wall;
      ctx.lineWidth   = built ? 2 : 1.5;
      if (!built) ctx.setLineDash([4, 4]);
      sketchRect(rx, ry, rw, rh, 1.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw furniture if built
      if (built) {
        drawFurniture(roomId, rx, ry, rw, rh);
      } else {
        // Lock icon area (dim question mark)
        ctx.fillStyle = C.textDim;
        ctx.font = `${Math.min(rw, rh) * 0.3}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', rx + rw / 2, ry + rh / 2 - 8);
      }

      // Room label
      ctx.fillStyle = built ? C.textMain : C.textDim;
      ctx.font      = `${Math.min(11, rw * 0.13)}px "Special Elite", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(def.name, rx + rw / 2, ry + rh - 5);

      // Door marks (small gap in wall)
      if (built) {
        ctx.fillStyle = C.bg;
        // bottom door
        ctx.fillRect(rx + rw / 2 - 6, ry + rh - 2, 12, 4);
        ctx.strokeStyle = C.wallLight;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx + rw / 2 - 6, ry + rh);
        ctx.lineTo(rx + rw / 2 + 6, ry + rh);
        ctx.stroke();
      }

      // Build cost hint on unbuilt rooms
      if (!built && def.cost && Object.keys(def.cost).length > 0) {
        const costStr = Object.entries(def.cost).map(([k, v]) => `${v}×${ITEMS[k]?.icon || k}`).join(' ');
        ctx.fillStyle = C.textDim;
        ctx.font = `8px "Courier Prime", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(costStr, rx + rw / 2, ry + rh - 18);
      }
    });

    // Outer house border
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 2.5;
    sketchRect(PAD / 2, PAD / 2, W - PAD, H - PAD, 2);
    ctx.stroke();
  }

  function getRoomAt(px, py) {
    for (const r of roomRects) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return r.roomId;
      }
    }
    return null;
  }

  return { init, resize, drawBase, getRoomAt };
})();
