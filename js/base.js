// ============================================================
// BASE.JS — Base screen interactions
// ============================================================

const Base = (() => {

  let canvas, tooltip;

  function init() {
    canvas  = document.getElementById('base-canvas');
    tooltip = document.getElementById('room-tooltip');

    Renderer.init(canvas);

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchstart', onCanvasTouch, { passive: true });
    canvas.addEventListener('mousemove', onCanvasHover);
    canvas.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));

    document.getElementById('build-close').addEventListener('click', closeModal);
    document.getElementById('room-close').addEventListener('click', () => {
      document.getElementById('modal-room').classList.add('hidden');
    });

    window.addEventListener('resize', () => {
      Renderer.resize();
      draw();
    });
  }

  function draw() {
    Renderer.drawBase();
    updateHUD();
  }

  function updateHUD() {
    const st = State.get();
    const fmt = (n) => String(Math.floor(n)).padStart(2, '0');

    document.getElementById('stat-day').textContent  = `Gün ${st.day}`;
    document.getElementById('stat-time').textContent = `${fmt(st.hour)}:${fmt(st.minute)}`;
    document.getElementById('stat-season').textContent = st.season;
    document.getElementById('stat-temp-val').textContent = `${st.temperature}°`;

    setBar('health', st.health, st.maxHealth);
    setBar('hunger', st.hunger, 100);
    setBar('thirst', st.thirst, 100);
    setBar('mood',   st.mood,   100);

    // Critical alerts
    toggleCritical('s-health', st.health < 25);
    toggleCritical('s-hunger', st.hunger < 20);
    toggleCritical('s-thirst', st.thirst < 20);

    // Latest message
    const msgs = st.messages;
    const logEl = document.getElementById('msg-main');
    if (msgs.length > 0) {
      logEl.textContent  = msgs[0].text;
      logEl.className    = `msg-line ${msgs[0].type === 'danger' ? 'danger' : msgs[0].type === 'good' ? 'good' : ''}`;
    }
  }

  function setBar(key, val, max) {
    const fill = document.getElementById(`fill-${key}`);
    const valEl = document.getElementById(`val-${key}`);
    if (fill)  fill.style.width = `${Math.max(0, Math.min(100, (val / max) * 100))}%`;
    if (valEl) valEl.textContent = Math.round(val);
  }

  function toggleCritical(id, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('critical', on);
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  function onCanvasClick(e) {
    const pos    = getCanvasPos(e);
    const roomId = Renderer.getRoomAt(pos.x, pos.y);
    if (roomId) openRoomModal(roomId);
  }

  function onCanvasTouch(e) {
    const touch  = e.touches[0];
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top)  * scaleY;
    const roomId = Renderer.getRoomAt(x, y);
    if (roomId) openRoomModal(roomId);
  }

  function onCanvasHover(e) {
    const pos    = getCanvasPos(e);
    const roomId = Renderer.getRoomAt(pos.x, pos.y);
    if (roomId) {
      const def = ROOMS[roomId];
      tooltip.textContent = def.name;
      tooltip.style.left  = `${e.offsetX + 10}px`;
      tooltip.style.top   = `${e.offsetY - 24}px`;
      tooltip.classList.remove('hidden');
    } else {
      tooltip.classList.add('hidden');
    }
  }

  function openRoomModal(roomId) {
    const st  = State.get();
    const def = ROOMS[roomId];
    const built = st.rooms[roomId]?.built;

    const title = document.getElementById('room-modal-title');
    const body  = document.getElementById('room-modal-body');
    title.textContent = `${def.icon} ${def.name}`;

    if (built) {
      // Room actions
      let html = `<p style="font-size:11px;color:#888;margin-bottom:12px;font-family:var(--font-ui);line-height:1.5">${def.desc}</p>`;

      if (roomId === 'bedroom') {
        html += actionBtn('Uyu (+10 can, +2 saat)', 'sleep');
        html += actionBtn('İstirahət et (+5 əhval, +1 saat)', 'rest');
      }
      if (roomId === 'workbench') {
        html += actionBtn('Craft menyusunu aç', 'craft');
      }
      if (roomId === 'waterCollector') {
        html += actionBtn('Su topla (2 su)', 'collectWater');
      }
      if (roomId === 'garden') {
        html += actionBtn('Bağçanı yoxla', 'checkGarden');
      }
      if (roomId === 'medStation') {
        html += actionBtn('Yara sar (15 can, 1 sarğı lazım)', 'useBandage');
        html += actionBtn('Dərman iç (30 can, 1 medkit lazım)', 'useMedkit');
      }

      body.innerHTML = html;

      body.querySelectorAll('.room-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          handleRoomAction(btn.dataset.action, roomId);
        });
      });

    } else {
      // Show build option
      const costStr = Object.entries(def.cost)
        .map(([k, v]) => `${v}× ${ITEMS[k]?.name || k} (bizdə: ${State.getItemQty(k)})`)
        .join('<br>');
      const canBuild = State.canBuildRoom(roomId);

      body.innerHTML = `
        <p style="font-size:11px;color:#888;margin-bottom:10px;font-family:var(--font-ui);line-height:1.5">${def.desc}</p>
        <div style="font-size:10px;color:#666;margin-bottom:12px;font-family:var(--font-ui);line-height:1.8">
          Lazımdır:<br>${costStr || 'Pulsuz'}
        </div>
        <button id="do-build-btn" style="
          width:100%;padding:10px;
          background:${canBuild ? '#1a3a1a' : '#1a1a1a'};
          border:1px solid ${canBuild ? '#4a7c59' : '#2e2e2e'};
          color:${canBuild ? '#6aad7a' : '#444'};
          font-family:var(--font-main);font-size:12px;cursor:${canBuild ? 'pointer' : 'default'}
        ">${canBuild ? 'İnşa Et' : 'Kifayət qədər material yoxdur'}</button>
      `;

      if (canBuild) {
        document.getElementById('do-build-btn').addEventListener('click', () => {
          if (State.buildRoom(roomId)) {
            document.getElementById('modal-room').classList.add('hidden');
            draw();
            UI.showToast(`${def.name} inşa edildi!`, 'good');
          }
        });
      }
    }

    document.getElementById('modal-room').classList.remove('hidden');
  }

  function actionBtn(label, action) {
    return `<button class="room-action-btn" data-action="${action}" style="
      display:block;width:100%;padding:9px 10px;margin-bottom:6px;
      background:#0d0d0d;border:1px solid #2e2e2e;color:#aaa;
      font-family:var(--font-main);font-size:11px;text-align:left;cursor:pointer;
    ">${label}</button>`;
  }

  function handleRoomAction(action, roomId) {
    const st = State.get();
    switch (action) {
      case 'sleep':
        state_modify(() => {
          st.health = Math.min(st.maxHealth, st.health + 10);
          State.addMessage('Uyudun. Daha yaxşı hiss edirsən.', 'good');
        });
        State.advanceTime(2);
        break;

      case 'rest':
        state_modify(() => {
          st.mood = Math.min(100, st.mood + 5);
          State.addMessage('İstirahət etdin.', 'good');
        });
        State.advanceTime(1);
        break;

      case 'craft':
        document.getElementById('modal-room').classList.add('hidden');
        UI.showScreen('craft');
        return;

      case 'collectWater':
        State.addItem('water', 2);
        State.addMessage('2 su topladın.', 'good');
        State.advanceTime(0.5);
        break;

      case 'checkGarden': {
        const hasFood = st.day % 2 === 0;
        if (hasFood) {
          State.addItem('food', 2);
          State.addMessage('Bağçadan 2 konserv topladın!', 'good');
        } else {
          State.addMessage('Bağça hələ hazır deyil.', 'normal');
        }
        State.advanceTime(0.25);
        break;
      }

      case 'useBandage':
        if (State.getItemQty('bandage') < 1) {
          UI.showToast('Sarğı yoxdur!', 'danger');
        } else {
          State.useConsumable('bandage');
          State.addMessage('+15 can bərpa edildi.', 'good');
        }
        break;

      case 'useMedkit':
        if (State.getItemQty('medkit') < 1) {
          UI.showToast('Dərman yoxdur!', 'danger');
        } else {
          State.useConsumable('medkit');
          State.addMessage('+30 can bərpa edildi.', 'good');
        }
        break;
    }

    document.getElementById('modal-room').classList.add('hidden');
    draw();
  }

  function state_modify(fn) {
    fn();
    State.save();
  }

  function closeModal() {
    document.getElementById('modal-build').classList.add('hidden');
  }

  return { init, draw };
})();
