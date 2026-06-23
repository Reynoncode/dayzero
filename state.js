// ============================================================
// STATE.JS — Central game state + save/load
// ============================================================

const State = (() => {

  const DEFAULT = {
    day: 1,
    hour: 8,
    minute: 0,
    season: 'Yaz',
    temperature: 18,
    health: 80,
    hunger: 60,
    thirst: 70,
    mood: 50,
    maxHealth: 100,
    inventory: [
      { id: 'food',   qty: 3 },
      { id: 'water',  qty: 2 },
      { id: 'knife',  qty: 1 },
      { id: 'wood',   qty: 2 },
      { id: 'cloth',  qty: 1 },
    ],
    equippedWeapon: 'knife',
    equippedArmor: null,
    rooms: (() => {
      const r = {};
      Object.keys(ROOMS).forEach(k => {
        r[k] = { built: ROOMS[k].built };
      });
      return r;
    })(),
    maxCarry: 15,
    xp: 0,
    messages: [],
    currentLocation: null,
    currentRoomIndex: 0,
  };

  let data = JSON.parse(JSON.stringify(DEFAULT));

  function load() {
    try {
      const saved = localStorage.getItem('deadstreets_save');
      if (saved) {
        const parsed = JSON.parse(saved);
        data = { ...JSON.parse(JSON.stringify(DEFAULT)), ...parsed };
      }
    } catch(e) { console.warn('Save load failed', e); }
  }

  function save() {
    try {
      localStorage.setItem('deadstreets_save', JSON.stringify(data));
    } catch(e) { console.warn('Save failed', e); }
  }

  function reset() {
    data = JSON.parse(JSON.stringify(DEFAULT));
    save();
  }

  function get() { return data; }

  function addMessage(text, type = 'normal') {
    data.messages.unshift({ text, type, time: `Gün ${data.day} ${String(data.hour).padStart(2,'0')}:${String(data.minute).padStart(2,'0')}` });
    if (data.messages.length > 30) data.messages.pop();
  }

  function advanceTime(hours) {
    const totalMinutes = data.minute + Math.round(hours * 60);
    data.minute = totalMinutes % 60;
    const hoursToAdd = Math.floor(totalMinutes / 60);
    data.hour += hoursToAdd;
    while (data.hour >= 24) {
      data.hour -= 24;
      data.day += 1;
      applyDailyEffects();
    }
    save();
  }

  function applyDailyEffects() {
    data.hunger = Math.max(0, data.hunger - 15);
    data.thirst = Math.max(0, data.thirst - 20);
    data.mood   = Math.max(0, data.mood - 5);

    // Room bonuses
    if (data.rooms.bedroom?.built)       data.health = Math.min(data.maxHealth, data.health + 5);
    if (data.rooms.medStation?.built)    data.health = Math.min(data.maxHealth, data.health + 3);
    if (data.rooms.waterCollector?.built) data.thirst = Math.min(100, data.thirst + 2);
    if (data.rooms.garden?.built && data.day % 2 === 0) addItem('food', 2);

    if (data.hunger < 20) { data.health -= 5; addMessage('Çox acsan, can itirir!', 'danger'); }
    if (data.thirst < 20) { data.health -= 8; addMessage('Susuzsan, can itirir!', 'danger'); }
    data.health = Math.max(0, Math.min(data.maxHealth, data.health));
    addMessage(`Gün ${data.day} başladı.`, 'normal');
  }

  function addItem(id, qty = 1) {
    const existing = data.inventory.find(i => i.id === id);
    if (existing) { existing.qty += qty; }
    else { data.inventory.push({ id, qty }); }
    save();
  }

  function removeItem(id, qty = 1) {
    const existing = data.inventory.find(i => i.id === id);
    if (!existing || existing.qty < qty) return false;
    existing.qty -= qty;
    if (existing.qty <= 0) data.inventory = data.inventory.filter(i => i.id !== id);
    save();
    return true;
  }

  function getItemQty(id) {
    const found = data.inventory.find(i => i.id === id);
    return found ? found.qty : 0;
  }

  function getCurrentWeight() {
    return data.inventory.reduce((sum, slot) => {
      const def = ITEMS[slot.id];
      return sum + (def ? def.weight * slot.qty : 0);
    }, 0);
  }

  function buildRoom(roomId) {
    const room = ROOMS[roomId];
    if (!room || data.rooms[roomId]?.built) return false;
    for (const [item, qty] of Object.entries(room.cost)) {
      if (getItemQty(item) < qty) return false;
    }
    for (const [item, qty] of Object.entries(room.cost)) {
      removeItem(item, qty);
    }
    data.rooms[roomId].built = true;

    // apply carry bonus immediately
    if (room.effect.carryBonus) data.maxCarry += room.effect.carryBonus;

    addMessage(`${room.name} inşa edildi!`, 'good');
    save();
    return true;
  }

  function canBuildRoom(roomId) {
    const room = ROOMS[roomId];
    if (!room || data.rooms[roomId]?.built) return false;
    for (const [item, qty] of Object.entries(room.cost)) {
      if (getItemQty(item) < qty) return false;
    }
    return true;
  }

  function useConsumable(id) {
    const def = ITEMS[id];
    if (!def || def.type !== 'consumable') return false;
    if (!removeItem(id, 1)) return false;
    if (def.hunger) data.hunger = Math.min(100, data.hunger + def.hunger);
    if (def.thirst) data.thirst = Math.min(100, data.thirst + def.thirst);
    if (def.health) data.health = Math.min(data.maxHealth, data.health + def.health);
    save();
    return true;
  }

  function getEquippedWeaponDef() {
    if (!data.equippedWeapon) return null;
    return ITEMS[data.equippedWeapon] || null;
  }

  function getDamageBonus() {
    return data.rooms.weaponRack?.built ? 2 : 0;
  }

  return {
    load, save, reset, get,
    addMessage, advanceTime,
    addItem, removeItem, getItemQty, getCurrentWeight,
    buildRoom, canBuildRoom,
    useConsumable,
    getEquippedWeaponDef, getDamageBonus,
  };
})();
