/**
 * storage.js — 校园AI营养师 · 本地存储（localStorage）
 * 键名前缀 NUTRI_，集中管理，便于日后迁移到云同步/后端。
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NutriStorage = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var PREFIX = 'NUTRI_';
  var KEYS = {
    profile: PREFIX + 'profile',        // 个人档案
    menu: PREFIX + 'menu',              // 自定义食堂菜单（数组）
    logs: PREFIX + 'logs',              // 每日上报记录（数组，新在前）
    plans: PREFIX + 'plans',            // 生成过的方案存档（数组，新在前）
    tray: PREFIX + 'tray',              // 当前虚拟托盘（数组）
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(KEYS[key]);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(KEYS[key], JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    function pad(n) { return (n < 10 ? '0' : '') + n; }
  }

  // ============ 个人档案 ============
  function getProfile() {
    return read('profile', null);
  }
  function saveProfile(p) {
    return write('profile', p);
  }
  function hasProfile() {
    return !!getProfile();
  }

  // ============ 自定义食堂菜单（我的个人食堂） ============
  function getMenu() {
    var list = read('menu', []);
    // 旧数据迁移：老条目无 source 字段 → 补 source:'db'（保守归为库匹配）
    return list.map(function (d) {
      if (typeof d.source === 'undefined') d.source = 'db';
      if (typeof d.sourceNote === 'undefined') d.sourceNote = '';
      return d;
    });
  }
  function saveMenu(list) {
    return write('menu', list);
  }
  function addDish(dish) {
    var list = getMenu();
    // 同名去重：已存在则更新（覆盖）
    var idx = list.findIndex(function (d) { return d.name === dish.name; });
    if (idx >= 0) list[idx] = dish; else list.push(dish);
    return saveMenu(list);
  }
  function updateDish(name, patch) {
    var list = getMenu();
    var idx = list.findIndex(function (d) { return d.name === name; });
    if (idx < 0) return false;
    var merged = {};
    Object.keys(list[idx]).forEach(function (k) { merged[k] = list[idx][k]; });
    Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
    merged.updatedAt = Date.now();
    list[idx] = merged;
    return saveMenu(list);
  }
  function removeDish(name) {
    var list = getMenu().filter(function (d) { return d.name !== name; });
    return saveMenu(list);
  }

  // ============ 每日上报 ============
  function getLogs() {
    return read('logs', []);
  }
  /** 记录一次上报：{date, status, note, advice}，同日覆盖 */
  function addLog(log) {
    var logs = getLogs();
    var idx = logs.findIndex(function (l) { return l.date === log.date; });
    if (idx >= 0) logs[idx] = log; else logs.unshift(log);
    return write('logs', logs.slice(0, 60));
  }
  /** 连续记录天数（从今天/昨天起往前数） */
  function streakDays() {
    var logs = getLogs();
    if (!logs.length) return 0;
    var count = 0;
    var cursor = new Date();
    var seen = {};
    // 允许今天还没记录（从昨天开始算）或今天已记录
    for (var i = 0; i < logs.length; i++) {
      var d = new Date(logs[i].date + 'T00:00:00');
      var key = logs[i].date;
      if (seen[key]) continue;
      seen[key] = true;
      var diff = Math.round((cursor - d) / 86400000);
      if (diff === 0 || diff === 1) {
        // 首条允许是今天或昨天
        cursor = d;
        count++;
      } else if (diff <= -1) {
        // 未来的记录（时钟异常），跳过
        continue;
      } else {
        break;
      }
    }
    // 若今天未记录，count 可能把昨天算进来了，需要减去
    var todayHas = logs.some(function (l) { return l.date === todayStr(); });
    if (!todayHas) {
      // 首条是昨天的场景：cursor 已被设为昨天，diff 循环已计入昨天
      // 修正：若计数里包含了昨天但今天没有，应减 1（除非只有 0/1 条）
      var firstDiff = Math.round((new Date(logs[0].date + 'T00:00:00') - new Date()) / 86400000);
      if (count > 0 && firstDiff === -1 && count === 1) return 0;
    }
    return count;
  }

  // ============ 方案存档 ============
  function getPlans() {
    return read('plans', []);
  }
  function addPlan(plan) {
    var plans = getPlans();
    plans.unshift(plan);
    return write('plans', plans.slice(0, 30));
  }

  // ============ 虚拟托盘（今日点餐） ============
  function getTray() {
    return read('tray', []);
  }
  function saveTray(list) {
    return write('tray', list);
  }
  function clearTray() {
    return write('tray', []);
  }

  return {
    getProfile: getProfile,
    saveProfile: saveProfile,
    hasProfile: hasProfile,
    getMenu: getMenu,
    saveMenu: saveMenu,
    addDish: addDish,
    updateDish: updateDish,
    removeDish: removeDish,
    getLogs: getLogs,
    addLog: addLog,
    streakDays: streakDays,
    getPlans: getPlans,
    addPlan: addPlan,
    getTray: getTray,
    saveTray: saveTray,
    clearTray: clearTray,
    todayStr: todayStr,
  };
});
