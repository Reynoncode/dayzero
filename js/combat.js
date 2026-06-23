// ============================================================
// COMBAT.JS — Turn-based combat
// ============================================================

const Combat = (() => {

  let enemies    = [];   // [{def, hp, id, targeted}]
  let log        = [];
  let playerTurn = true;
  let onFinish   = null; // callback(won)
  let roomName   = '';
  let roomIndex  = 0;
  let totalRooms = 0;

  // ---- Start combat ----
  function start(enemyIds, room, roomIdx, totalRm, finishCb) {
    roomName   = room;
    roomIndex  = roomIdx;
    totalRooms = totalRm;
    onFinish   = finishCb;
    playerTurn = true;
    log        = [];

    enemies = enemyIds.map((id, i) => {
      const def = ENEMIES[id];
      return { def, hp: def.maxHp, id: `e${i}`, targeted: i === 0 };
    });

    renderHeader();
    renderEnemies();
    renderLog();
    renderActions();
  }

  // ---- Render ----
  function renderHeader() {
    document.getElementById('combat-wave-info').textContent = `Otaq ${roomIndex}/${totalRooms} — ${roomName}`;
    document.getElementById('combat-turn-info').textContent = playerTurn ? 'Sənin növbən' : 'Düşmən hücumu...';
  }

  function renderEnemies() {
    const list = document.getElementById('enemy-list');
    list.innerHTML = enemies.map(e => `
      <div class="enemy-card ${e.hp <= 0 ? 'dead' : ''} ${e.targeted && e.hp > 0 ? 'targeted' : ''}"
           data-eid="${e.id}">
        <div class="enemy-icon">${e.def.icon}</div>
        <div class="enemy-name">${e.def.name}</div>
        <div class="enemy-hp-bar">
          <div class="enemy-hp-fill" style="width:${Math.max(0, e.hp / e.def.maxHp * 100)}%"></div>
        </div>
        <div style="font-size:8px;color:#888;font-family:var(--font-ui)">${Math.max(0,e.hp)}/${e.def.maxHp}</div>
      </div>`
    ).join('');

    list.querySelectorAll('.enemy-card:not(.dead)').forEach(card => {
      card.addEventListener('click', () => {
        const eid = card.dataset.eid;
        enemies.forEach(e => e.targeted = e.id === eid);
        renderEnemies();
        renderActions();
      });
    });
  }

  function renderLog() {
    const box = document.getElementById('combat-log');
    box.innerHTML = log.slice(0, 12).map(l =>
      `<div style="color:${l.color||'#888'}">${l.text}</div>`
    ).join('');
    const logBox = document.getElementById('combat-log-box');
    logBox.scrollTop = 0;
  }

  function renderActions() {
    const st  = State.get();
    const wpn = State.getEquippedWeaponDef();
    const panel = document.getElementById('combat-actions');
    const statsEl = document.getElementById('player-combat-stats');

    const armorDef = st.equippedArmor ? ITEMS[st.equippedArmor] : null;
    statsEl.innerHTML = `
      <span style="color:var(--accent-green-light)">❤ ${Math.round(st.health)}/${st.maxHealth}</span>
      &nbsp;|&nbsp;
      <span style="color:#aaa">⚔ ${wpn ? wpn.name : 'Silahsız'}</span>
      ${armorDef ? `&nbsp;|&nbsp;<span style="color:#888">🛡 ${armorDef.defense}</span>` : ''}
    `;

    const alive = enemies.filter(e => e.hp > 0);
    const target = enemies.find(e => e.targeted && e.hp > 0) || alive[0];
    const hasBandage = State.getItemQty('bandage') > 0;
    const hasMedkit  = State.getItemQty('medkit')  > 0;

    panel.innerHTML = `
      <button class="combat-action-btn attack ${!playerTurn || !target ? 'disabled' : ''}" id="btn-attack">
        ⚔ Hücum
      </button>
      <button class="combat-action-btn ${!playerTurn || !hasBandage ? 'disabled' : ''}" id="btn-bandage">
        🩹 Sarğı (${State.getItemQty('bandage')})
      </button>
      <button class="combat-action-btn ${!playerTurn || !hasMedkit ? 'disabled' : ''}" id="btn-medkit">
        💊 Dərman (${State.getItemQty('medkit')})
      </button>
      <button class="combat-action-btn ${!playerTurn ? 'disabled' : ''}" id="btn-flee">
        🏃 Qaç
      </button>
    `;

    if (playerTurn && target) {
      document.getElementById('btn-attack')?.addEventListener('click', () => doAttack(target));
    }
    if (playerTurn && hasBandage) {
      document.getElementById('btn-bandage')?.addEventListener('click', doHeal.bind(null, 'bandage'));
    }
    if (playerTurn && hasMedkit) {
      document.getElementById('btn-medkit')?.addEventListener('click', doHeal.bind(null, 'medkit'));
    }
    if (playerTurn) {
      document.getElementById('btn-flee')?.addEventListener('click', doFlee);
    }
  }

  // ---- Player actions ----
  function doAttack(target) {
    if (!playerTurn) return;
    playerTurn = false;
    renderHeader();

    const wpn     = State.getEquippedWeaponDef();
    const dmgBonus = State.getDamageBonus();
    const dmgRange = wpn ? wpn.damage : [2, 5];
    const hitChance = wpn ? wpn.hit : 75;
    const dmg  = randInt(dmgRange[0], dmgRange[1]) + dmgBonus;
    const roll = randInt(1, 100);

    if (roll <= hitChance) {
      target.hp -= dmg;
      addLog(`Sən ${target.def.name}-a ${dmg} zərər vurdu!`, '#6aad7a');
    } else {
      addLog(`Sənin hücumun QAÇIRILDI.`, '#666');
    }

    renderEnemies();
    renderLog();
    checkWin();
  }

  function doHeal(itemId) {
    if (!playerTurn) return;
    playerTurn = false;
    State.useConsumable(itemId);
    const def = ITEMS[itemId];
    addLog(`${def.name} istifadə etdin. Can bərpa edildi.`, '#4a9a6a');
    renderLog();
    renderHeader();
    setTimeout(enemyTurn, 700);
  }

  function doFlee() {
    if (!playerTurn) return;
    const chance = 55;
    if (randInt(1, 100) <= chance) {
      addLog('Qaçdın! Yara almadan çıxdın.', '#888');
      renderLog();
      setTimeout(() => onFinish && onFinish('fled'), 900);
    } else {
      playerTurn = false;
      addLog('Qaça bilmədin!', '#c0392b');
      renderLog();
      renderHeader();
      setTimeout(enemyTurn, 700);
    }
  }

  // ---- Enemy turn ----
  function enemyTurn() {
    const alive = enemies.filter(e => e.hp > 0);
    if (alive.length === 0) return;

    const st = State.get();
    const armorDef = st.equippedArmor ? ITEMS[st.equippedArmor] : null;
    const defense  = armorDef ? armorDef.defense : 0;

    alive.forEach(enemy => {
      if (st.health <= 0) return;
      const roll = randInt(1, 100);
      if (roll <= enemy.def.hit) {
        const dmg = Math.max(0, randInt(enemy.def.damage[0], enemy.def.damage[1]) - defense);
        st.health -= dmg;
        addLog(`${enemy.def.name} sənə ${dmg} zərər vurdu!`, '#c0392b');
      } else {
        addLog(`${enemy.def.name}-nın hücumu qaçırıldı.`, '#555');
      }
    });

    st.health = Math.max(0, st.health);
    State.save();

    playerTurn = true;
    renderHeader();
    renderLog();
    renderActions();
    checkDeath();
  }

  // ---- Check outcomes ----
  function checkWin() {
    const alive = enemies.filter(e => e.hp > 0);
    if (alive.length === 0) {
      // Give XP and loot
      let xpGain = 0;
      enemies.forEach(e => {
        xpGain += e.def.xp;
        // Random loot drop
        Object.entries(e.def.loot).forEach(([item, range]) => {
          const qty = randInt(range[0], range[1]);
          if (qty > 0) {
            State.addItem(item, qty);
            addLog(`${ITEMS[item]?.icon || ''} ${qty}× ${ITEMS[item]?.name || item} düşdü.`, '#888');
          }
        });
      });
      State.get().xp += xpGain;
      State.save();
      addLog(`Qazandın! +${xpGain} XP`, '#d4a017');
      renderLog();
      renderEnemies();
      renderActions();
      setTimeout(() => onFinish && onFinish('won'), 1200);
    } else {
      // Auto-target first alive
      enemies.forEach((e, i) => e.targeted = false);
      const first = alive[0];
      first.targeted = true;
      setTimeout(enemyTurn, 700);
    }
  }

  function checkDeath() {
    const st = State.get();
    if (st.health <= 0) {
      addLog('ÖLDÜN...', '#8b2020');
      renderLog();
      renderActions();
      setTimeout(() => onFinish && onFinish('dead'), 1400);
    }
  }

  // ---- Helpers ----
  function addLog(text, color = '#888') {
    log.unshift({ text, color });
    if (log.length > 20) log.pop();
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  return { start };
})();
