// ============================================================
// UI.JS — Screen switching, toasts, inventory, craft panels
// ============================================================

const UI = (() => {

  let currentScreen = 'base';

  // ---- Screen switching ----
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) target.classList.add('active');

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });

    currentScreen = name;

    // Init screen content
    if (name === 'inventory') renderInventory();
    if (name === 'craft')     renderCraft();
    if (name === 'map')       Map.init();
    if (name === 'base')      Base.draw();
  }

  // ---- Toast notifications ----
  function showToast(text, type = 'normal') {
    let toast = document.getElementById('ui-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ui-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg1);
        border: 1px solid var(--border-light);
        color: var(--text-primary);
        font-family: var(--font-ui);
        font-size: 11px;
        padding: 8px 16px;
        z-index: 9999;
        pointer-events: none;
        white-space: nowrap;
        transition: opacity .3s;
      `;
      document.getElementById('game-container').appendChild(toast);
    }

    const colors = {
      good:   'var(--accent-green-light)',
      danger: 'var(--accent-red-light)',
      normal: 'var(--text-primary)',
    };
    toast.textContent = text;
    toast.style.color = colors[type] || colors.normal;
    toast.style.borderColor = type === 'good' ? 'var(--accent-green)' : type === 'danger' ? 'var(--accent-red)' : 'var(--border-light)';
    toast.style.opacity = '1';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
  }

  // ---- Inventory ----
  function renderInventory() {
    const st   = State.get();
    const grid = document.getElementById('inv-grid');
    const wt   = document.getElementById('inv-weight');

    const weight = State.getCurrentWeight().toFixed(1);
    wt.textContent = `${weight}/${st.maxCarry} kg`;

    // Build slots — show items + empty slots up to 16
    const items = st.inventory.filter(i => i.qty > 0);
    const total = Math.max(16, items.length + 4);
    let html = '';

    items.forEach(slot => {
      const def = ITEMS[slot.id];
      if (!def) return;
      html += `
        <div class="inv-slot" data-id="${slot.id}">
          <div class="item-icon">${def.icon}</div>
          <div class="item-name">${def.name}</div>
          <div class="item-qty">×${slot.qty}</div>
        </div>`;
    });

    // Empty slots
    for (let i = items.length; i < total; i++) {
      html += `<div class="inv-slot empty"><div class="item-icon" style="font-size:14px;color:var(--text-dim)">·</div></div>`;
    }

    grid.innerHTML = html;

    // Click to use consumable / equip weapon
    grid.querySelectorAll('.inv-slot:not(.empty)').forEach(el => {
      el.addEventListener('click', () => onItemClick(el.dataset.id));
    });
  }

  function onItemClick(id) {
    const def = ITEMS[id];
    if (!def) return;

    if (def.type === 'consumable') {
      if (State.useConsumable(id)) {
        const msgs = { food: 'Yemək yeyildi.', water: 'Su içildi.', medkit: '+30 can.', bandage: '+15 can.' };
        showToast(msgs[id] || `${def.name} istifadə edildi.`, 'good');
        renderInventory();
        Base.draw();
      } else {
        showToast('İstifadə olmadı.', 'danger');
      }
    } else if (def.type === 'weapon') {
      State.get().equippedWeapon = id;
      State.save();
      showToast(`${def.name} silah kimi seçildi.`, 'good');
      renderInventory();
    } else if (def.type === 'armor') {
      State.get().equippedArmor = id;
      State.save();
      showToast(`${def.name} geyildi.`, 'good');
      renderInventory();
    } else {
      showToast(`${def.name} — material`, 'normal');
    }
  }

  // ---- Craft ----
  function renderCraft() {
    const list = document.getElementById('craft-list');
    let html = '';

    RECIPES.forEach(recipe => {
      // Check if requires a room
      if (recipe.requires && !State.get().rooms[recipe.requires]?.built) {
        return; // skip — room not built
      }

      const canCraft = Object.entries(recipe.cost).every(([k, v]) => State.getItemQty(k) >= v);
      const costStr  = Object.entries(recipe.cost)
        .map(([k, v]) => {
          const have = State.getItemQty(k);
          const color = have >= v ? 'var(--accent-green-light)' : 'var(--accent-red-light)';
          return `<span style="color:${color}">${v}×${ITEMS[k]?.name || k}(${have})</span>`;
        }).join('  ');

      html += `
        <div class="craft-item">
          <div class="craft-icon">${recipe.icon}</div>
          <div class="craft-info">
            <div class="craft-name">${recipe.name} ×${recipe.qty}</div>
            <div class="craft-req">${costStr}</div>
          </div>
          <button class="craft-btn ${canCraft ? 'available' : ''}" data-recipe="${recipe.id}" ${canCraft ? '' : 'disabled'}>
            ${canCraft ? 'Düzəlt' : 'Az'}
          </button>
        </div>`;
    });

    if (!html) html = `<div style="padding:20px;color:var(--text-dim);font-size:11px;text-align:center">Craft masası lazımdır.</div>`;
    list.innerHTML = html;

    list.querySelectorAll('.craft-btn.available').forEach(btn => {
      btn.addEventListener('click', () => doCraft(btn.dataset.recipe));
    });
  }

  function doCraft(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    // Check materials
    for (const [k, v] of Object.entries(recipe.cost)) {
      if (State.getItemQty(k) < v) {
        showToast('Material çatmır!', 'danger');
        return;
      }
    }
    // Deduct
    for (const [k, v] of Object.entries(recipe.cost)) {
      State.removeItem(k, v);
    }
    // Add result
    State.addItem(recipe.result, recipe.qty);
    State.addMessage(`${recipe.name} ×${recipe.qty} düzəldildi!`, 'good');
    showToast(`${recipe.icon} ${recipe.name} hazır!`, 'good');
    renderCraft();
  }

  // ---- Back buttons ----
  function initBackButtons() {
    document.querySelectorAll('.inv-back, .craft-back').forEach(btn => {
      btn.addEventListener('click', () => showScreen('base'));
    });
    document.getElementById('map-back')?.addEventListener('click', () => showScreen('base'));
  }

  // ---- Nav buttons ----
  function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });
  }

  function init() {
    initNav();
    initBackButtons();
  }

  return { init, showScreen, showToast, renderInventory, renderCraft };
})();
