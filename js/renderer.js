// ============================================================
// RENDERER.JS — Canvas drawing for base floor plan (PNG background)
// ============================================================

const Renderer = (() => {

  const C = {
    bg:           '#0a0a0a',
    overlayBuilt: 'rgba(74,124,89,0.12)',
    overlayHover: 'rgba(74,124,89,0.25)',
    wallBuilt:    'rgba(74,124,89,0.85)',
    wallHover:    'rgba(110,200,140,0.9)',
    textBuilt:    '#88cc99',
    labelBg:      'rgba(0,0,0,0.72)',
  };

  let canvas, ctx, W, H;
  let roomRects = [];
  let hoveredRoom = null;

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

  const ROOM_ZONES = {
    garden:        [0.03, 0.01, 0.94, 0.19],
    waterCollector:[0.03, 0.22, 0.38, 0.16],
    workbench:     [0.03, 0.39, 0.38, 0.14],
    bedroom:       [0.43, 0.22, 0.54, 0.31],
    medStation:    [0.03, 0.55, 0.38, 0.18],
    weaponRack:    [0.43, 0.55, 0.54, 0.18],
    storageRoom:   [0.03, 0.74, 0.38, 0.13],
    radioRoom:     [0.43, 0.74, 0.54, 0.13],
  };

  function getImgRect() {
    const imgAspect = 971 / 1619;
    const canvasAspect = W / H;
    let iw, ih, ix, iy;
    if (canvasAspect < imgAspect) {
      iw = W; ih = W / imgAspect; ix = 0; iy = (H - ih) / 2;
    } else {
      ih = H; iw = H * imgAspect; ix = (W - iw) / 2; iy = 0;
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

  function drawBase() {
    if (!canvas) return;
    const st = State.get();
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const imgRect = getImgRect();

    if (imgLoaded) {
      ctx.drawImage(baseImg, imgRect.x, imgRect.y, imgRect.w, imgRect.h);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(imgRect.x, imgRect.y, imgRect.w, imgRect.h);
    } else {
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(imgRect.x, imgRect.y, imgRect.w, imgRect.h);
    }

    roomRects = [];

    Object.keys(ROOM_ZONES).forEach(roomId => {
      const rect      = getRoomRect(roomId, imgRect);
      const built     = st.rooms[roomId]?.built;
      const def       = ROOMS[roomId];
      const isHovered = hoveredRoom === roomId;

      roomRects.push({ roomId, ...rect });

      // Overlay tint on hover or built
      if (isHovered || built) {
        ctx.fillStyle = isHovered ? C.overlayHover : C.overlayBuilt;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }

      // Border — only draw when hovered
      if (isHovered) {
        ctx.lineWidth   = 2.5;
        ctx.strokeStyle = built ? C.wallHover : 'rgba(160,160,160,0.7)';
        sketchRect(rect.x, rect.y, rect.w, rect.h, 1.2);
        ctx.stroke();
      }

      // Room label pill
      const label = `${def.icon} ${def.name}`;
      const fsize = Math.max(9, Math.min(13, rect.w * 0.12));
      ctx.font = `${fsize}px "Special Elite", monospace`;
      const tw = ctx.measureText(label).width;
      const lx = rect.x + rect.w / 2;
      const ly = rect.y + rect.h - 6;

      ctx.fillStyle = C.labelBg;
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2 - 6, ly - fsize - 3, tw + 12, fsize + 7, 3);
      ctx.fill();

      ctx.fillStyle = C.textBuilt;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, lx, ly);

      // Lock icon for unbuilt rooms
      if (!built) {
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2 - 10;
        const sz = Math.max(14, Math.min(22, rect.h * 0.2));

        ctx.font = `${sz}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText('🔒', cx + 1, cy + 1);
        ctx.fillText('🔒', cx, cy);

        // Build cost hint on hover
        if (isHovered && def.cost && Object.keys(def.cost).length > 0) {
          const costStr = Object.entries(def.cost)
            .map(([k, v]) => `${v}×${ITEMS[k]?.icon || k}`)
            .join(' ');
          const cf = Math.max(8, fsize - 1);
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
