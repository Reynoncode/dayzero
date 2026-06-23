// ============================================================
// LOOT.JS — Room-by-room location exploration
// ============================================================

const Loot = (() => {

  let locationId  = null;
  let location    = null;
  let roomIndex   = 0;    // current room (0-based)
  let roomCleared = false; // enemies done in this room
  let roomLooted  = false;
  let lootItems   = [];   // remaining loot items in current room

  // ---- Start ----
  function startLocation(locId) {
    locationId  = locId;
    location    = LOCATIONS.find(l => l.id === locId);
    roomIndex   = 0;
    roomCleared = false;
    roomLooted  = false;
    lootItems   = [];

    if (!location) return;

    State.get().currentLocation    = locId;
    State.get().currentRoomIndex   = 0;
    State.save();

    renderRoom();
  }

  // ---- Render current room ----
  function renderRoom() {
    if (!location) return;
    const room = location.rooms[roomIndex];
    const totalRooms = location.rooms.length;
    const isLast = roomIndex === totalRooms - 1;

    // Header
    document.getElementById('loot-location-name').textContent = `${location.icon} ${location.name}`;
    document.getElementById('loot-room-info').textContent     = `Otaq ${roomIndex + 1}/${totalRooms} — ${room.name}`;

    // Canvas drawing
    drawRoomCanvas(room);

    // Determine room state
    const hasEnemies = room.enemies && room.enemies.length > 0 && !roomCleared;
    const hasLoot    = room.loot    && room.loot.length > 0;

    // Message
    const msgEl = document.getElementById('loot-message');
    if (hasEnemies) {
      msgEl.textContent = `${room.enemies.length} zombi var! Döyüş başlayacaq.`;
      msgEl.style.color = 'var(--accent-red-light)';
    } else if (!roomLooted && hasLoot) {
      msgEl.textContent = 'Otaq təmizləndi. Əşya ara!';
      msgEl.style.color = 'var(--accent-amber-light)';
    } else if (roomLooted || !hasLoot) {
      if (isLast) {
        msgEl.textContent = 'Son otaq. Çıxış buradadır.';
      } else {
        msgEl.textContent = 'Otaq boş. İrəliləyə bilərsən.';
      }
      msgEl.style.color = 'var(--text-secondary)';
    }

    // Action buttons
    renderActions(room, hasEnemies, hasLoot, isLast);
  }

  function renderActions(room, hasEnemies, hasLoot, isLast) {
    const panel = document.getElementById('loot-actions');
    panel.innerHTML = '';

    if (hasEnemies) {
      // Fight button
      addBtn(panel, '⚔ Döyüş', 'primary', onFight);
      // Sneak attempt
      addBtn(panel, '👣 Gizlən (50%)', '', onSneak);
    } else {
      // Loot items
      if (!roomLooted && hasLoot) {
        lootItems = [...room.loot];
        lootItems.forEach(itemId => {
          const def = ITEMS[itemId];
          if (!def) return;
          const weight = State.getCurrentWeight();
          const overweight = weight + def.weight > State.get().maxCarry;
          addBtn(
            panel,
            `${def.icon} ${def.name} al ${overweight ? '(ağır!)' : ''}`,
            overweight ? '' : 'primary',
            () => pickupItem(itemId)
          );
        });

        // "Take all" button
        addBtn(panel, '📦 Hamısını götür', '', takeAll);
        addBtn(panel, '🚫 Heç nə alma', '', () => {
          roomLooted = true;
          renderRoom();
        });
      } else {
        // Move to next room or exit
        if (isLast) {
          addBtn(panel, '🚪 Çıx (Bazaya dön)', 'primary', onExit);
        } else {
          addBtn(panel, '➡ Növbəti otaq', 'primary', onNextRoom);
        }

        // Option to go back to base anytime
        addBtn(panel, '🏠 Bazaya dön', '', onExit);
      }
    }
  }

  function addBtn(parent, label, cls, handler) {
    const btn = document.createElement('button');
    btn.className = `loot-btn ${cls}`;
    btn.textContent = label;
    btn.addEventListener('click', handler);
    parent.appendChild(btn);
  }

  // ---- Actions ----
  function onFight() {
    const room = location.rooms[roomIndex];
    UI.showScreen('combat');
    Combat.start(
      room.enemies,
      room.name,
      roomIndex + 1,
      location.rooms.length,
      onCombatFinish
    );
  }

  function onSneak() {
    const roll = Math.random();
    if (roll < 0.5) {
      roomCleared = true;
      State.addMessage('Gizlicə keçdin!', 'good');
      UI.showToast('Gizlicə keçdin! 👣', 'good');
      renderRoom();
    } else {
      State.addMessage('Gizlənə bilmədin — Döyüşmək lazımdır!', 'danger');
      UI.showToast('Gizlənə bilmədin!', 'danger');
      onFight();
    }
  }

  function onCombatFinish(result) {
    UI.showScreen('loot');

    if (result === 'won') {
      roomCleared = true;
      State.addMessage(`${location.rooms[roomIndex].name} təmizləndi.`, 'good');
      renderRoom();
    } else if (result === 'fled') {
      State.addMessage('Qaçdın.', 'normal');
      onExit();
    } else if (result === 'dead') {
      // Player died — game over
      State.addMessage('ÖLDÜN. Yenidən başla.', 'danger');
      showGameOver();
    }
  }

  function pickupItem(itemId) {
    const def = ITEMS[itemId];
    if (!def) return;

    const weight = State.getCurrentWeight();
    if (weight + def.weight > State.get().maxCarry) {
      UI.showToast('Çanta doludur!', 'danger');
      return;
    }

    State.addItem(itemId, 1);
    lootItems.splice(lootItems.indexOf(itemId), 1);

    UI.showToast(`${def.icon} ${def.name} götürüldü!`, 'good');

    if (lootItems.length === 0) {
      roomLooted = true;
    }
    renderRoom();
  }

  function takeAll() {
    const room = location.rooms[roomIndex];
    let taken = 0;
    room.loot.forEach(itemId => {
      const def = ITEMS[itemId];
      if (!def) return;
      if (State.getCurrentWeight() + def.weight <= State.get().maxCarry) {
        State.addItem(itemId, 1);
        taken++;
      }
    });
    roomLooted = true;
    UI.showToast(taken > 0 ? `${taken} əşya götürüldü!` : 'Çanta dolu!', taken > 0 ? 'good' : 'danger');
    renderRoom();
  }

  function onNextRoom() {
    roomIndex++;
    roomCleared = false;
    roomLooted  = false;
    lootItems   = [];

    if (roomIndex >= location.rooms.length) {
      onExit();
    } else {
      State.advanceTime(0.25); // 15 min per room
      renderRoom();
    }
  }

  function onExit() {
    // Travel back
    State.advanceTime(location.travelHours);
    State.addMessage(`${location.name}-dan qayıtdın.`, 'normal');
    State.get().currentLocation  = null;
    State.get().currentRoomIndex = 0;
    State.save();
    UI.showScreen('base');
    Base.draw();
  }

  // ---- Canvas drawing ----
  function drawRoomCanvas(room) {
    const canvas = document.getElementById('loot-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, W, H);

    // Room walls (sketchy)
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Floor tiles
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 0.5;
    const tileSize = 30;
    for (let x = 20; x < W - 20; x += tileSize) {
      ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 20); ctx.stroke();
    }
    for (let y = 20; y < H - 20; y += tileSize) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();
    }

    // Door (right wall)
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(W - 22, H / 2 - 20, 4, 40);
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 1;
    ctx.strokeRect(W - 22, H / 2 - 20, 4, 40);

    // Draw enemies or loot icons
    const hasEnemies = room.enemies && room.enemies.length > 0 && !roomCleared;
    if (hasEnemies) {
      const spacing = Math.min(60, (W - 80) / room.enemies.length);
      room.enemies.forEach((eid, i) => {
        const def = ENEMIES[eid];
        if (!def) return;
        const ex = 60 + i * spacing;
        const ey = H * 0.4;

        // Shadow
        ctx.beginPath();
        ctx.ellipse(ex, ey + 22, 18, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();

        // Enemy emoji
        ctx.font = '32px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(def.icon, ex, ey + 20);

        // HP indicator dots
        const hpFrac = 1; // full HP at start
        ctx.fillStyle = `hsl(${hpFrac * 120}, 60%, 40%)`;
        ctx.fillRect(ex - 12, ey - 18, 24 * hpFrac, 3);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(ex - 12, ey - 18, 24, 3);
      });
    } else if (!roomLooted && room.loot && room.loot.length > 0) {
      // Draw loot items on floor
      const spacing = Math.min(50, (W - 80) / room.loot.length);
      room.loot.forEach((itemId, i) => {
        const def = ITEMS[itemId];
        if (!def) return;
        const lx = 60 + i * spacing;
        const ly = H * 0.5;

        // Loot glow
        ctx.beginPath();
        ctx.arc(lx, ly, 18, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 18);
        g.addColorStop(0, 'rgba(212,160,23,0.15)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fill();

        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, lx, ly);
      });
    } else {
      // Empty room
      ctx.font = '11px "Courier Prime", monospace';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Otaq boşdur', W / 2, H / 2);
    }

    // Room name top-left
    ctx.font = '9px "Courier Prime", monospace';
    ctx.fillStyle = '#444';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(room.name, 28, 28);
  }

  // ---- Game Over ----
  function showGameOver() {
    const container = document.getElementById('game-container');
    let overlay = document.getElementById('gameover-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'gameover-overlay';
      overlay.style.cssText = `
        position:absolute;inset:0;background:rgba(0,0,0,0.92);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        z-index:500;font-family:var(--font-main);
      `;
      container.appendChild(overlay);
    }

    const st = State.get();
    overlay.innerHTML = `
      <div style="font-size:40px;margin-bottom:16px">💀</div>
      <div style="font-size:20px;color:#8b2020;margin-bottom:8px;letter-spacing:2px">ÖLDÜN</div>
      <div style="font-size:11px;color:#555;margin-bottom:4px;font-family:var(--font-ui)">Gün ${st.day}</div>
      <div style="font-size:10px;color:#444;margin-bottom:32px;font-family:var(--font-ui)">${st.xp} XP qazandın</div>
      <button id="restart-btn" style="
        padding:12px 28px;background:#1a1a1a;
        border:1px solid #4a7c59;color:#6aad7a;
        font-family:var(--font-main);font-size:13px;cursor:pointer;
      ">Yenidən Başla</button>
    `;

    document.getElementById('restart-btn').addEventListener('click', () => {
      State.reset();
      overlay.remove();
      UI.showScreen('base');
      Base.draw();
    });
  }

  return { startLocation };
})();
