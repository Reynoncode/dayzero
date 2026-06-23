// ============================================================
// RENDERER.JS — Canvas drawing for base floor plan (PNG background)
// ============================================================

const Renderer = (() => {

  // ---- Colors ----
  const C = {
    bg:           '#0a0a0a',
    overlay:      'rgba(0,0,0,0.45)',
    overlayBuilt: 'rgba(74,124,89,0.12)',
    overlayHover: 'rgba(74,124,89,0.25)',
    wallBuilt:    'rgba(74,124,89,0.85)',
    wallUnbuilt:  'rgba(80,80,80,0.6)',
    textMain:     '#cccccc',
    textDim:      '#555555',
    textBuilt:    '#88cc99',
    accent:       '#4a7c59',
    labelBg:      'rgba(0,0,0,0.72)',
  };

  let canvas, ctx, W, H;
  let roomRects = [];
  let hoveredRoom = null;

  // Base image
  const baseImg = new Image();
  let imgLoaded = false;
  baseImg.onload = () => { imgLoaded = true; if (canvas) drawBase(); };
  baseImg.src = 'base.png';

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

  // ---- Room layout (relative to image, 0-1 scale) ----
  // Based on pixel art PNG layout (971x1619 px):
  //   garden:        top section, full width
  //   kitchen area:  middle-left (waterCollector + workbench stacked)
  //   bedroom:       middle-right
  //   medStation:    lower-left block
  //   weaponRack:    lower-right block
  //   storageRoom:   lower-left secondary (with ammo box area)
  //   radioRoom:     lower-right secondary (storage shelves)
  //   entrance:      bottom strip (optional, no room action)

  // Zones are [x, y, w, h] as fraction of canvas (after fitting the image)
  const ROOM_ZONES = {
    garden:        [0.03, 0.01, 0.94, 0.19],  // top garden rows
    waterCollector:[0.03, 0.22, 0.38, 0.16],  // kitchen left side (water barrel area)
    workbench:     [0.03, 0.39, 0.38, 0.14],  // craft table area below kitchen
    bedroom:       [0.43, 0.22, 0.54, 0.31],  // right bedroom
    medStation:    [0.03, 0.55, 0.38, 0.18],  // med cross area
    weaponRack:    [0.43, 0.55, 0.54, 0.18],  // weapon rack right
    storageRoom:   [0.03, 0.74, 0.38, 0.13],  // ammo/generator left
    radioRoom:     [0.43, 0.74, 0.54, 0.13],  // storage shelves right
  };

  function getImgRect() {
    // Fit image into canvas (object-fit: contain style)
    const imgAspect = 971 / 1619;
    const canvasAspect = W / H;
    let iw, ih, ix, iy;
    if (canvasAspect < imgAspect) {
      iw = W;
      ih = W / imgAspect;
      ix = 0;
      iy = (H - ih) / 2;
    } else {
      ih = H;
      iw = H * imgAspect;
      ix = (W - iw) / 2;
      iy = 0;
    }
    return { x: ix, y: iy, w: iw, h: ih };
  }

  function getRoomRect(zoneKey, imgRect) {
    const [fx, fy, fw, fh] = ROOM_ZONES[zoneKey];
    return {
      x: imgRect.x + fx * imgRect.w,
      y: imgRect.y + fy * imgRect.h,
      w: fw * imgRect.w,
      h: fh * imgRect.h,
    };
  }

  function rnd(n) { return (Math.random() - 0.5) * n * 2; }

  function sketchRect(x, y, w, h, wobble = 1.2) {
    ctx.beginPath();
    ctx.moveTo(x + rnd(wobble), y + rnd(wobble));
    ctx.lineTo(x + w + rnd(wobble), y + rnd(wobble));
    ctx.lineTo(x + w + rnd(wobble), y + h + rnd(wobble));
    ctx.lineTo(x + rnd(wobble), y + h + rnd(wobble));
    ctx.closePath();
  }

  // ---- Main draw function ----
  function drawBase() {
    if (!canvas) return;
    const st = State.get();
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const imgRect = getImgRect();

    // Draw base image
    if (imgLoaded) {
      ctx.drawImage(baseImg, imgRect.x, imgRect.y, imgRect.w, imgRect.h);
      // Darken overlay so UI elements are readable
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(imgRect.x, imgRect.y, imgRect.w, imgRect.h);
    } else {
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(imgRect.x, imgRect.y, imgRect.w, imgRect.h);
    }

    roomRects = [];

    // Draw room overlays
    const roomIds = Object.keys(ROOM_ZONES);
    roomIds.forEach(roomId => {
      const rect  = getRoomRect(roomId, imgRect);
      const built = st.rooms[roomId]?.built;
      const def   = ROOMS[roomId];
      const isHovered = hoveredRoom === roomId;

      roomRects.push({ roomId, ...rect });

      // Highlight overlay
      if (isHovered) {
        ctx.fillStyle = C.overlayHover;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      } else if (built) {
        ctx.fillStyle = C.overlayBuilt;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }

      // Border
      ctx.lineWidth   = isHovered ? 2.5 : (built ? 1.8 : 1.2);
      ctx.strokeStyle = built
        ? (isHovered ? 'rgba(110,200,140,0.9)' : C.wallBuilt)
        : (isHovered ? 'rgba(160,160,160,0.7)' : C.wallUnbuilt);
      if (!built) ctx.setLineDash([5, 5]);
      sketchRect(rect.x, rect.y, rect.w, rect.h, 1.2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label pill at bottom of zone
      const label = `${def.icon} ${def.name}`;
      const fsize = Math.max(9, Math.min(13, rect.w * 0.12));
      ctx.font = `${fsize}px "Special Elite", monospace`;
      const tw = ctx.measureText(label).width;
      const lx = rect.x + rect.w / 2;
      const ly = rect.y + rect.h - 6;

      // Pill background
      ctx.fillStyle = C.labelBg;
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2 - 6, ly - fsize - 3, tw + 12, fsize + 7, 3);
      ctx.fill();

      ctx.fillStyle = built ? C.textBuilt : C.textDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, lx, ly);

      // "İnşa et" hint for unbuilt rooms
      if (!built && isHovered && def.cost && Object.keys(def.cost).length > 0) {
        const costStr = Object.entries(def.cost)
          .map(([k, v]) => `${v}×${ITEMS[k]?.icon || k}`)
          .join(' ');
        const cf = Math.max(8, fsize - 2);
        ctx.font = `${cf}px "Courier Prime", monospace`;
        const cw = ctx.measureText(costStr).width;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.roundRect(lx - cw / 2 - 5, ly - fsize * 2 - 10, cw + 10, cf + 6, 3);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(costStr, lx, ly - fsize - 5);
      }

      // "?" for completely unbuilt, not hovered
      if (!built && !isHovered) {
        const isize = Math.max(14, Math.min(24, rect.h * 0.22));
        ctx.font = `${isize}px serif`;
        ctx.fillStyle = 'rgba(80,80,80,0.5)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', rect.x + rect.w / 2, rect.y + rect.h / 2 - 10);
      }
    });
  }

  function getRoomAt(px, py) {
    for (const r of roomRects) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return r.roomId;
      }
    }
    return null;
  }

  function setHovered(roomId) {
    if (hoveredRoom !== roomId) {
      hoveredRoom = roomId;
      drawBase();
    }
  }

  return { init, resize, drawBase, getRoomAt, setHovered };
})();
