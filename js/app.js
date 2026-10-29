/**
 * app.js — 校园AI营养师 · 视图与交互
 * 依赖：data.js (NutriData), engine.js (NutriEngine), storage.js (NutriStorage)
 */
(function () {
  'use strict';

  var D = window.NutriData;
  var E = window.NutriEngine;
  var S = window.NutriStorage;

  var state = {
    currentView: 'order',
    currentAnalysis: {},   // 最近一次点餐分析结果（数组，含 warnings/tips）
  };

  // ============ 工具 ============

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n, digits) {
    var v = Math.round((n || 0) * 10) / 10;
    return typeof digits === 'undefined' ? v : v.toFixed(digits);
  }

  // ============ 视图切换 ============

  function switchView(name) {
    state.currentView = name;
    $$('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    $$('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + name);
    });
    if (name === 'plan') renderPlan();
    if (name === 'records') renderRecords();
    if (name === 'profile') fillProfileForm();
    if (name === 'order') renderTray();
    if (name === 'report') renderReportResult();
    if (name === 'canteen') renderCanteen();
    window.scrollTo(0, 0);
  }

  // ============ 个人档案 ============

  function collectProfileFromForm() {
    var gender = $('#pGender').value;
    var age = +$('#pAge').value || 20;
    var height = +$('#pHeight').value || 170;
    var weight = +$('#pWeight').value || 60;
    var exercise = +$('#pExercise').value || 0;
    var budget = +$('#pBudget').value || 1200;
    var allergies = $$('input[name="allergy"]:checked').map(function (c) { return c.value; });
    var needs = $$('input[name="need"]:checked').map(function (c) { return c.value; });
    // 计算 BMR（Mifflin-St Jeor 简化）
    var bmr = 10 * weight + 6.25 * height - 5 * age + (gender === '男' ? 5 : -161);
    var activity = 1.2 + exercise * 0.1;
    var tdee = Math.round(bmr * activity);
    var dailyBudget = Math.round(budget / 30 * 10) / 10; // 月生活费 ÷ 30 天
    return {
      gender: gender, age: age, height: height, weight: weight,
      exercise: exercise, budget: budget, dailyBudget: dailyBudget,
      allergies: allergies, needs: needs,
      bmr: Math.round(bmr), tdee: tdee,
      updatedAt: Date.now(),
    };
  }

  function fillProfileForm() {
    var p = S.getProfile();
    if (!p) return;
    $('#pGender').value = p.gender || '男';
    $('#pAge').value = p.age || 20;
    $('#pHeight').value = p.height || 170;
    $('#pWeight').value = p.weight || 60;
    $('#pExercise').value = String(p.exercise || 0);
    $('#pBudget').value = p.budget || 1200;
    $$('input[name="allergy"]').forEach(function (c) {
      c.checked = (p.allergies || []).indexOf(c.value) >= 0;
    });
    $$('input[name="need"]').forEach(function (c) {
      c.checked = (p.needs || []).indexOf(c.value) >= 0;
    });
  }

  function loadDemoProfile() {
    S.saveProfile({
      gender: '女', age: 20, height: 162, weight: 52,
      exercise: 1, budget: 1100, dailyBudget: 36.7,
      allergies: ['辣'], needs: ['调理肠胃', '熬夜恢复'],
      bmr: 1270, tdee: 1400, updatedAt: Date.now(),
    });
    fillProfileForm();
    toast('已载入示例档案（女/20岁/不吃辣/肠胃调理+熬夜恢复）');
    // 同步勾选
    $('#pGender').value = '女';
    $('#pAge').value = 20;
    $('#pHeight').value = 162;
    $('#pWeight').value = 52;
    $('#pExercise').value = '1';
    $('#pBudget').value = 1100;
    $$('input[name="allergy"]').forEach(function (c) { c.checked = c.value === '辣'; });
    $$('input[name="need"]').forEach(function (c) { c.checked = c.value === '调理肠胃' || c.value === '熬夜恢复'; });
  }

  // ============ 今日点餐 ============

  function allDishes() {
    // 内置菜 + 自定义菜
    var custom = S.getMenu();
    return D.DISHES.concat(custom);
  }

  function searchDishes(kw) {
    kw = (kw || '').trim().toLowerCase();
    if (!kw) return [];
    return allDishes().filter(function (d) {
      return d.name.toLowerCase().indexOf(kw) >= 0;
    });
  }

  function renderSearchResults(list, kw) {
    var box = $('#searchResults');
    if (!kw) {
      box.innerHTML = '';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="empty-small">没有找到「' + esc(kw) + '」。可以到「个人设置」里自定义添加这道菜。</div>';
      return;
    }
    box.innerHTML = list.map(function (d) {
      var a = E.analyzeDish(d, S.getProfile() || {});
      var warn = a.warnings.map(function (w) { return '<span class="tag tag-warn">' + w + '</span>'; }).join('');
      var tags = d.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
      var inTray = S.getTray().some(function (x) { return x.name === d.name; });
      var btnText = inTray ? '已在托盘' : '加入托盘';
      return '<div class="dish-card">' +
        '<div class="dish-info">' +
          '<div class="dish-name">' + esc(d.name) + '<span class="dish-price">¥' + fmt(d.price) + '</span></div>' +
          '<div class="dish-meta">' + tags + warn + '</div>' +
          '<div class="dish-nutri">🔥 ' + d.kcal + ' kcal · 蛋白 ' + d.protein + 'g · 脂肪 ' + d.fat + 'g · 钠 ' + d.sodium + 'mg</div>' +
          (d.fakeHealth ? '<div class="dish-desc fake">⚠️ ' + esc(d.desc || '') + '</div>' : '') +
        '</div>' +
        '<button class="btn btn-add" data-add="' + esc(d.name) + '" ' + (inTray ? 'disabled' : '') + '>' + btnText + '</button>' +
      '</div>';
    }).join('');
  }

  function addToTray(name) {
    var dish = allDishes().filter(function (d) { return d.name === name; })[0];
    if (!dish) return;
    var tray = S.getTray();
    if (tray.some(function (x) { return x.name === dish.name; })) { toast('这道菜已经在托盘里了'); return; }
    // 忌口检查
    var profile = S.getProfile();
    if (profile && dish.allergies.some(function (a) { return profile.allergies.indexOf(a) >= 0; })) {
      toast('⚠️ 这道菜含你的忌口成分，确定要加吗？');
    }
    tray.push(dish);
    S.saveTray(tray);
    renderTray();
    renderSearchResults(searchDishes($('#dishSearch').value), $('#dishSearch').value);
    toast('已加入托盘：' + dish.name);
  }

  function removeFromTray(name) {
    var tray = S.getTray().filter(function (x) { return x.name !== name; });
    S.saveTray(tray);
    renderTray();
    var kw = $('#dishSearch').value;
    if (kw) renderSearchResults(searchDishes(kw), kw);
  }

  function renderTray() {
    var tray = S.getTray();
    $('#trayCount').textContent = tray.length + ' 道菜';
    var box = $('#trayList');
    if (!tray.length) {
      box.innerHTML = '<div class="empty-small">托盘还是空的，先在上面搜几道菜试试。</div>';
      $('#traySummary').innerHTML = '';
      return;
    }
    box.innerHTML = tray.map(function (d) {
      var a = E.analyzeDish(d, S.getProfile() || {});
      var warn = a.warnings.length ? '<span class="badge-warn">' + a.warnings.join(' · ') + '</span>' : '';
      return '<div class="tray-item">' +
        '<div class="tray-name">' + esc(d.name) + warn + '</div>' +
        '<div class="tray-nutri">' + d.kcal + ' kcal / 蛋白 ' + d.protein + 'g / 钠 ' + d.sodium + 'mg</div>' +
        '<button class="btn btn-remove" data-remove="' + esc(d.name) + '">移除</button>' +
      '</div>';
    }).join('');

    var sum = E.sumItems(tray);
    var profile = S.getProfile();
    var html = '<div class="sum-row"><span>合计</span><span>🔥 ' + sum.kcal + ' kcal</span></div>' +
               '<div class="sum-row"><span>蛋白质</span><span>' + fmt(sum.protein) + ' g</span></div>' +
               '<div class="sum-row"><span>花费</span><span>¥' + fmt(sum.price) + '</span></div>';
    if (profile) {
      var over = sum.price > profile.dailyBudget;
      html += '<div class="sum-row ' + (over ? 'over' : 'ok') + '"><span>预算(日均)</span><span>¥' + fmt(profile.dailyBudget) + (over ? ' ⚠️ 已超' : '') + '</span></div>';
      // 蛋白达标提示
      var target = D.DAILY_TARGETS.default;
      var proteinOk = sum.protein >= target.protein * 0.8;
      html += '<div class="sum-row ' + (proteinOk ? 'ok' : 'over') + '"><span>蛋白达标(日需' + target.protein + 'g)</span><span>' + (proteinOk ? '✅ 充足' : '还需要一些蛋白') + '</span></div>';
    }
    html += '<button class="btn btn-danger" id="clearTrayBtn">清空托盘</button>';
    $('#traySummary').innerHTML = html;
  }

  // ============ 生成方案 ============

  function currentStatusFromLog() {
    // 最近一次上报的状态（若今天有）用于调整
    var logs = S.getLogs();
    if (!logs.length) return {};
    return logs[0].status || {};
  }

  function renderPlan() {
    var profile = S.getProfile();
    if (!profile) {
      $('#planEmpty').style.display = 'block';
      $('#planContent').innerHTML = '<div class="empty-small">先生成个人档案，才能生成专属方案。</div>';
      $('#planActions').style.display = 'none';
      return;
    }
    $('#planEmpty').style.display = 'none';
    var status = currentStatusFromLog();
    var plan = E.generatePlan(profile, status);
    $('#planContent').innerHTML = planHtml(plan, status);
    $('#planActions').style.display = 'flex';
    state.currentPlan = plan;
  }

  function planHtml(plan, status) {
    var target = plan.target;
    var profile = S.getProfile() || {};
    var over = profile.dailyBudget && plan.total.price > profile.dailyBudget;
    var budgetTag = over
      ? '<div class="plan-budget-warn">⚠️ 总花费 ¥' + fmt(plan.total.price) + ' 超出日均预算 ¥' + fmt(profile.dailyBudget) + '，建议减少一道菜或换更经济的搭配</div>'
      : (profile.dailyBudget ? '<div class="plan-budget-ok">✅ 总花费 ¥' + fmt(plan.total.price) + ' 在日均预算 ¥' + fmt(profile.dailyBudget) + ' 内</div>' : '');
    var head = '<div class="plan-summary-card">' +
      '<div class="plan-total">一日总计：🔥 ' + plan.total.kcal + ' kcal · 蛋白 ' + fmt(plan.total.protein) + 'g · 花费 ¥' + fmt(plan.total.price) + '</div>' +
      '<div class="plan-target">目标参考：' + (target ? (target.kcal + ' kcal / 蛋白 ' + target.protein + 'g') : '') + '</div>' +
      '<div class="plan-meter">' +
        meter('热量', plan.summary.kcal) + meter('蛋白', plan.summary.protein) + meter('脂肪', plan.summary.fat) + meter('钠', plan.summary.sodium) +
      '</div>' +
      (status && Object.keys(status).length ? '<div class="plan-adjust-tag">已根据今日上报状态调整</div>' : '') +
    '</div>' + budgetTag;

    var meals = plan.meals.map(function (m) {
      var items = m.items.map(function (it) {
        var a = E.analyzeDish(it, S.getProfile() || {});
        var warn = a.warnings.length ? '<span class="badge-warn">' + a.warnings.join('·') + '</span>' : '';
        return '<div class="plan-item"><span class="plan-item-name">' + esc(it.name) + warn + '</span>' +
          '<span class="plan-item-meta">' + it.kcal + ' kcal · ' + it.protein + 'g 蛋白 · ¥' + fmt(it.price) + '</span></div>';
      }).join('');
      return '<div class="meal-card"><h3>' + m.name + ' <span class="meal-sum">' + m.sum.kcal + ' kcal · ¥' + fmt(m.sum.price) + '</span></h3>' +
        '<div class="meal-items">' + items + '</div></div>';
    }).join('');

    var notes = (plan.notes || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    var notesHtml = notes ? '<div class="plan-notes"><h3>AI 调整说明</h3><ul>' + notes + '</ul></div>' : '';

    return head + '<div class="meal-list">' + meals + '</div>' + notesHtml;
  }

  function meter(label, ev) {
    var ok = ev.ok;
    var cls = ok ? 'meter-ok' : (ev.ratio < 0.8 ? 'meter-low' : 'meter-high');
    var width = Math.min(120, Math.max(10, Math.round(ev.ratio * 100)));
    return '<div class="meter"><span class="meter-label">' + label + '</span>' +
      '<span class="meter-bar"><span class="meter-fill ' + cls + '" style="width:' + width + '%"></span></span>' +
      '<span class="meter-val">' + ev.label + '</span></div>';
  }

  // ============ 每日上报 ============

  function collectStatusFromForm() {
    var status = {};
    $$('input[name="status"]:checked').forEach(function (c) { status[c.value] = true; });
    return status;
  }

  function renderReportResult() {
    var logs = S.getLogs();
    if (!logs.length) {
      $('#reportResult').innerHTML = '';
      return;
    }
    var last = logs[0];
    var statusText = Object.keys(last.status || {}).map(function (k) {
      return D.STATUS_ADJUSTMENTS[k] ? D.STATUS_ADJUSTMENTS[k].label : k;
    }).join('、') || '一切正常';
    var html = '<div class="report-result-card">' +
      '<h3>最近一次上报：' + esc(last.date) + '</h3>' +
      '<p>状态：' + esc(statusText) + '</p>' +
      (last.note ? '<p class="quote">"' + esc(last.note) + '"</p>' : '') +
      '<div class="report-advice">' + (last.advice || '继续保持') + '</div>' +
    '</div>';
    $('#reportResult').innerHTML = html;
  }

  function submitReport() {
    var status = collectStatusFromForm();
    var note = $('#reportNote').value.trim();
    // 自由文本关键词补充
    var extracted = E.extractStatus(note);
    Object.keys(extracted).forEach(function (k) { if (extracted[k]) status[k] = true; });

    var adjustment = E.adjustForStatus(S.getProfile() || {}, status);
    var advice = adjustment.advice.length ? adjustment.advice.join('\n') : '今天状态不错，保持规律饮食就好。';
    var log = {
      date: S.todayStr(),
      status: status,
      note: note,
      advice: advice,
    };
    S.addLog(log);

    // 存档一份当前方案（如果有）
    if (state.currentPlan) {
      S.addPlan({ date: S.todayStr(), source: 'report', summary: state.currentPlan.total });
    }

    $('#reportResult').innerHTML = '<div class="report-result-card report-new">' +
      '<h3>已记录 ✓</h3>' +
      '<div class="report-advice">' + esc(advice).replace(/\n/g, '<br>') + '</div>' +
      '<p class="report-hint">建议已生效——现在去「生成方案」页重新生成，就能看到根据今天状态调整的一日方案。</p>' +
    '</div>';
    $('#reportNote').value = '';
    $$('input[name="status"]').forEach(function (c) { c.checked = false; });
    toast('上报成功，已生成调整建议');
  }

  // ============ 我的记录 ============

  function renderRecords() {
    var logs = S.getLogs();
    var plans = S.getPlans();
    var streak = S.streakDays();

    var streakHtml = '<div class="streak-card-inner"><span class="streak-num">' + streak + '</span>' +
      '<span class="streak-text">连续记录天数</span></div>';
    $('#recordsStreak').innerHTML = streakHtml;

    var enc = E.encouragement(streak);
    $('#recordsEncourage').innerHTML = '<div class="encourage-inner">' +
      (enc.extra ? '<p class="encourage-extra">' + esc(enc.extra) + '</p>' : '') +
      '<p class="encourage-text">' + esc(enc.text) + '</p></div>';

    var box = $('#recordsList');
    if (!logs.length && !plans.length) {
      box.innerHTML = '<div class="empty-small">还没有记录。去「每日上报」提交今天的身体状态，从这里看到自己的改变。</div>';
      return;
    }
    var html = '';
    if (logs.length) {
      html += '<h3 class="records-sec-title">身体状态记录</h3>';
      html += logs.map(function (l) {
        var st = Object.keys(l.status || {}).map(function (k) {
          return D.STATUS_ADJUSTMENTS[k] ? D.STATUS_ADJUSTMENTS[k].label : k;
        });
        return '<div class="record-card">' +
          '<div class="record-head"><span>' + esc(l.date) + '</span>' +
          (st.length ? '<span class="badge-soft">' + esc(st.join('、')) + '</span>' : '<span class="badge-ok">状态良好</span>') + '</div>' +
          (l.note ? '<div class="record-note">"' + esc(l.note) + '"</div>' : '') +
          '<div class="record-advice">' + esc(l.advice).replace(/\n/g, '<br>') + '</div>' +
        '</div>';
      }).join('');
    }
    if (plans.length) {
      html += '<h3 class="records-sec-title">方案存档</h3>';
      html += plans.slice(0, 10).map(function (p) {
        return '<div class="record-card plan-record">' +
          '<div class="record-head"><span>' + esc(p.date) + '</span><span class="badge-soft">' + (p.source === 'report' ? '随上报存档' : '手动存档') + '</span></div>' +
          (p.summary ? '<div class="record-note">当日方案：' + p.summary.kcal + ' kcal · 蛋白 ' + fmt(p.summary.protein) + 'g · ¥' + fmt(p.summary.price) + '</div>' : '') +
        '</div>';
      }).join('');
    }
    box.innerHTML = html;
  }

  // ============ 我的个人食堂 ============

  var canteenEditTarget = null; // 当前编辑的菜名

  function renderCanteen() {
    var list = S.getMenu();
    $('#canteenCount').textContent = list.length + ' 道';
    var box = $('#canteenList');
    if (!list.length) {
      box.innerHTML = '<div class="empty-small">还没有录入菜品。输入菜名试试，系统会自动帮你匹配营养数据。</div>';
      return;
    }
    box.innerHTML = list.map(function (d) {
      var srcTag = d.source === 'ai' ? '<span class="badge-ai">AI 估算</span>' : '';
      var priceTag = (d.sourceNote === '参考均价') ? '<span class="badge-avg">参考均价</span>' : '';
      return '<div class="canteen-card">' +
        '<div class="canteen-card-head">' +
          '<span class="canteen-card-name">' + esc(d.name) + '</span>' + srcTag + priceTag +
        '</div>' +
        '<div class="canteen-card-nutri">🔥 ' + (d.kcal || 0) + ' kcal · 蛋白 ' + (d.protein || 0) + 'g · 脂肪 ' + (d.fat || 0) + 'g · 碳水 ' + (d.carb || 0) + 'g · 钠 ' + (d.sodium || 0) + 'mg</div>' +
        '<div class="canteen-card-meta">¥' + fmt(d.price) + ' · ' + esc(d.cook || '清炒') + '</div>' +
        '<div class="canteen-card-actions">' +
          '<button class="btn btn-outline btn-sm" data-view-dish="' + esc(d.name) + '">详情</button>' +
          '<button class="btn btn-outline btn-sm" data-edit-dish="' + esc(d.name) + '">编辑</button>' +
          '<button class="btn btn-danger btn-sm" data-del-dish="' + esc(d.name) + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /** 菜名失焦/回车：匹配营养库或 AI 估算，回填表单 */
  function autoFillByDishName() {
    var name = $('#canteenName').value.trim();
    if (!name) { $('#canteenMatchResult').innerHTML = ''; return; }
    var match = E.matchFoodByName(name);
    var base, source, note;
    if (match.matched) {
      base = match.food;
      source = 'db';
      note = '匹配营养库（' + match.food.name + '）';
    } else {
      base = E.estimateByAI(name, $('#canteenCook').value);
      source = 'ai';
      note = '未收录，已用 AI 估算（可手动修正）';
    }
    // 应用当前烹饪方式修正
    var adjusted = E.applyCookAdjustment(base, $('#canteenCook').value);
    $('#canteenKcal').value = adjusted.kcal;
    $('#canteenProtein').value = adjusted.protein;
    $('#canteenFat').value = adjusted.fat;
    $('#canteenCarb').value = adjusted.carb;
    $('#canteenSodium').value = adjusted.sodium;
    // 价格：用户没填才自动补参考均价
    if (!$('#canteenPrice').value) {
      var type = source === 'db' ? match.food.type : base.type;
      var avg = E.avgPriceByType(type, S.getMenu());
      $('#canteenPrice').value = avg.price;
      $('#canteenPriceNote').textContent = '参考均价 ¥' + avg.price;
    }
    $('#canteenMatchResult').innerHTML = '<div class="match-result-inner">' + esc(note) + '</div>';
    canteenFormSource = source;
  }

  var canteenFormSource = 'db'; // 当前表单营养来源

  /** 烹饪方式变化 → 基于当前数值修正 */
  function adjustByCookChange() {
    var kcal = +$('#canteenKcal').value || 0;
    if (!kcal) return;
    var base = {
      kcal: kcal,
      protein: +$('#canteenProtein').value || 0,
      fat: +$('#canteenFat').value || 0,
      carb: +$('#canteenCarb').value || 0,
      sodium: +$('#canteenSodium').value || 0,
    };
    var adjusted = E.applyCookAdjustment(base, $('#canteenCook').value);
    $('#canteenKcal').value = adjusted.kcal;
    $('#canteenFat').value = adjusted.fat;
    $('#canteenSodium').value = adjusted.sodium;
  }

  function saveCanteenDish() {
    var name = $('#canteenName').value.trim();
    if (!name) { toast('请输入菜名'); return; }
    var kcal = +$('#canteenKcal').value || 0;
    var protein = +$('#canteenProtein').value || 0;
    var fat = +$('#canteenFat').value || 0;
    var carb = +$('#canteenCarb').value || 0;
    var sodium = +$('#canteenSodium').value || 0;
    var price = +$('#canteenPrice').value || 0;
    var cook = $('#canteenCook').value;
    if (!kcal) { toast('请先填热量，或输入菜名自动匹配'); return; }
    var sourceNote = '';
    if (canteenFormSource === 'ai') sourceNote = 'AI 估算';
    if (!price) {
      // 用户没填价 → 补参考均价（无论营养来自库匹配还是 AI 估算）
      var matched = E.matchFoodByName(name);
      var type = matched.matched ? matched.food.type : E.guessType(name);
      var avg = E.avgPriceByType(type, S.getMenu());
      price = avg.price;
      sourceNote = '参考均价';
    }
    var dish = {
      name: name, price: price, kcal: kcal,
      protein: protein, fat: fat, carb: carb, sodium: sodium,
      cook: cook,
      tags: cook === '油炸' ? ['油炸'] : (cook === '清蒸' || cook === '汤' ? ['清淡', '易消化'] : []),
      allergies: [], fakeHealth: false, portion: 180,
      desc: canteenFormSource === 'ai' ? 'AI 估算菜品' : '个人食堂录入',
      source: canteenFormSource, sourceNote: sourceNote,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    if (S.addDish(dish)) {
      toast('已保存：' + name);
      clearCanteenForm();
      renderCanteen();
    } else {
      toast('保存失败');
    }
  }

  function clearCanteenForm() {
    $('#canteenName').value = '';
    $('#canteenKcal').value = '';
    $('#canteenProtein').value = '';
    $('#canteenFat').value = '';
    $('#canteenCarb').value = '';
    $('#canteenSodium').value = '';
    $('#canteenPrice').value = '';
    $('#canteenCook').value = '清炒';
    $('#canteenMatchResult').innerHTML = '';
    $('#canteenPriceNote').textContent = '';
    canteenFormSource = 'db';
  }

  function removeCanteenDish(name) {
    S.removeDish(name);
    renderCanteen();
    toast('已删除：' + name);
  }

  function showDishDetail(name) {
    var d = S.getMenu().filter(function (x) { return x.name === name; })[0];
    if (!d) return;
    var srcTag = d.source === 'ai' ? '<span class="badge-ai">AI 估算</span>' : '';
    var priceTag = d.sourceNote === '参考均价' ? '<span class="badge-avg">参考均价</span>' : '';
    var html = '<div class="detail-card">' +
      '<h3>' + esc(d.name) + ' ' + srcTag + ' ' + priceTag + '</h3>' +
      '<div class="detail-grid">' +
        '<div class="detail-item"><span>热量</span><b>' + d.kcal + ' kcal</b></div>' +
        '<div class="detail-item"><span>蛋白质</span><b>' + d.protein + ' g</b></div>' +
        '<div class="detail-item"><span>脂肪</span><b>' + d.fat + ' g</b></div>' +
        '<div class="detail-item"><span>碳水</span><b>' + d.carb + ' g</b></div>' +
        '<div class="detail-item"><span>钠</span><b>' + d.sodium + ' mg</b></div>' +
        '<div class="detail-item"><span>价格</span><b>¥' + fmt(d.price) + '</b></div>' +
        '<div class="detail-item"><span>烹饪方式</span><b>' + esc(d.cook || '清炒') + '</b></div>' +
      '</div>' +
      '<p class="detail-hint">录入的菜品会与系统菜一起参与【今日点餐】和【生成方案】。</p>' +
      '<button class="btn btn-outline btn-block" id="closeDetailBtn">关闭</button>' +
    '</div>';
    // 复用编辑弹层容器展示详情
    $('#editModal').style.display = 'block';
    document.querySelector('#editModal .modal-body').innerHTML = html;
    $('#closeDetailBtn').addEventListener('click', closeModal);
  }

  function openEditModal(name) {
    var d = S.getMenu().filter(function (x) { return x.name === name; })[0];
    if (!d) return;
    canteenEditTarget = name;
    $('#editName').value = d.name;
    $('#editPrice').value = d.price;
    $('#editCook').value = d.cook || '清炒';
    $('#editKcal').value = d.kcal;
    $('#editProtein').value = d.protein;
    $('#editFat').value = d.fat;
    $('#editCarb').value = d.carb;
    $('#editSodium').value = d.sodium;
    $('#editModal').style.display = 'block';
    // 恢复编辑表单结构（详情可能改过 modal-body 内容）
    ensureEditFormHtml();
  }

  function ensureEditFormHtml() {
    // 详情视图会替换 modal-body 内容，切回编辑时需恢复表单
    var body = document.querySelector('#editModal .modal-body');
    if (!body.querySelector('#editName')) {
      body.innerHTML =
        '<h3>编辑菜品</h3>' +
        '<div class="field"><label for="editName">菜品名称</label><input type="text" id="editName"></div>' +
        '<div class="field-row"><div class="field"><label for="editPrice">价格 (元)</label><input type="number" id="editPrice" min="0" step="0.5"></div>' +
        '<div class="field"><label for="editCook">烹饪方式</label><select id="editCook">' +
          '<option value="清炒">清炒</option><option value="红烧">红烧</option><option value="清蒸">清蒸</option>' +
          '<option value="油炸">油炸</option><option value="汤">汤</option><option value="凉拌">凉拌</option>' +
        '</select></div></div>' +
        '<div class="field-row"><div class="field"><label for="editKcal">热量 (kcal)</label><input type="number" id="editKcal" min="0" step="5"></div>' +
        '<div class="field"><label for="editProtein">蛋白 (g)</label><input type="number" id="editProtein" min="0" step="0.5"></div></div>' +
        '<div class="field-row"><div class="field"><label for="editFat">脂肪 (g)</label><input type="number" id="editFat" min="0" step="0.5"></div>' +
        '<div class="field"><label for="editCarb">碳水 (g)</label><input type="number" id="editCarb" min="0" step="0.5"></div></div>' +
        '<div class="field"><label for="editSodium">钠 (mg)</label><input type="number" id="editSodium" min="0" step="10"></div>' +
        '<div class="modal-actions"><button class="btn btn-primary" id="confirmEditBtn">保存</button>' +
        '<button class="btn btn-outline" id="cancelEditBtn">取消</button></div>';
      // 重新绑定编辑按钮
      $('#confirmEditBtn').addEventListener('click', confirmEditDish);
      $('#cancelEditBtn').addEventListener('click', closeModal);
    }
    // 回填
    var d = S.getMenu().filter(function (x) { return x.name === canteenEditTarget; })[0];
    if (d) {
      $('#editName').value = d.name;
      $('#editPrice').value = d.price;
      $('#editCook').value = d.cook || '清炒';
      $('#editKcal').value = d.kcal;
      $('#editProtein').value = d.protein;
      $('#editFat').value = d.fat;
      $('#editCarb').value = d.carb;
      $('#editSodium').value = d.sodium;
    }
  }

  function confirmEditDish() {
    if (!canteenEditTarget) return;
    var name = $('#editName').value.trim();
    if (!name) { toast('菜名不能为空'); return; }
    var patch = {
      name: name,
      price: +$('#editPrice').value || 0,
      cook: $('#editCook').value,
      kcal: +$('#editKcal').value || 0,
      protein: +$('#editProtein').value || 0,
      fat: +$('#editFat').value || 0,
      carb: +$('#editCarb').value || 0,
      sodium: +$('#editSodium').value || 0,
    };
    // 编辑后若原 source 是 ai 但用户修正了，仍保留标记（说明来源）
    if (S.updateDish(canteenEditTarget, patch)) {
      toast('已更新：' + name);
      closeModal();
      renderCanteen();
    } else {
      toast('更新失败');
    }
  }

  function closeModal() {
    $('#editModal').style.display = 'none';
    // 恢复编辑表单结构（下次编辑用）
    ensureEditFormHtml();
    canteenEditTarget = null;
  }

  // ============ 事件绑定 ============

  function bindEvents() {
    // 顶部导航
    $('#tabNav').addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (btn) switchView(btn.dataset.view);
    });

    // 搜索
    var searchInput = $('#dishSearch');
    $('#searchBtn').addEventListener('click', function () {
      var kw = searchInput.value;
      renderSearchResults(searchDishes(kw), kw);
    });
    searchInput.addEventListener('input', function () {
      var kw = this.value;
      renderSearchResults(searchDishes(kw), kw);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') renderSearchResults(searchDishes(this.value), this.value);
    });

    // 托盘（事件委托）
    $('#trayList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove]');
      if (btn) removeFromTray(btn.dataset.remove);
    });
    $('#traySummary').addEventListener('click', function (e) {
      if (e.target.id === 'clearTrayBtn') {
        S.clearTray();
        renderTray();
        var kw = $('#dishSearch').value;
        if (kw) renderSearchResults(searchDishes(kw), kw);
        toast('托盘已清空');
      }
    });
    $('#searchResults').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-add]');
      if (btn) addToTray(btn.dataset.add);
    });

    // 生成方案
    $('#generatePlanBtn').addEventListener('click', function () {
      if (!S.getProfile()) { toast('请先到「个人设置」建档'); switchView('profile'); return; }
      renderPlan();
      toast('已生成今日方案');
    });
    $('#regenerateBtn').addEventListener('click', function () {
      renderPlan();
      toast('已重新生成');
    });
    $('#savePlanBtn').addEventListener('click', function () {
      if (!state.currentPlan) return;
      S.addPlan({ date: S.todayStr(), source: 'manual', summary: state.currentPlan.total });
      toast('方案已存档到「我的记录」');
    });

    // 每日上报
    $('#submitReport').addEventListener('click', submitReport);

    // 个人设置
    $('#saveProfileBtn').addEventListener('click', function () {
      var p = collectProfileFromForm();
      S.saveProfile(p);
      toast('档案已保存（日均餐费 ¥' + fmt(p.dailyBudget) + '）');
    });
    $('#loadDemoBtn').addEventListener('click', loadDemoProfile);
    $('#resetBtn').addEventListener('click', function () {
      if (confirm('确定清空全部本地数据吗？此操作不可恢复。')) {
        localStorage.clear();
        location.reload();
      }
    });

    // 我的个人食堂
    $('#canteenName').addEventListener('blur', autoFillByDishName);
    $('#canteenName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') autoFillByDishName();
    });
    $('#canteenCook').addEventListener('change', function () {
      adjustByCookChange();
    });
    $('#saveDishBtn').addEventListener('click', saveCanteenDish);
    $('#clearFormBtn').addEventListener('click', clearCanteenForm);
    $('#cameraBtn').addEventListener('click', function () {
      toast('📷 拍照识别即将上线（当前为 MVP 占位）');
    });
    // 菜品列表（事件委托）
    $('#canteenList').addEventListener('click', function (e) {
      var delBtn = e.target.closest('[data-del-dish]');
      if (delBtn) { removeCanteenDish(delBtn.dataset.delDish); return; }
      var editBtn = e.target.closest('[data-edit-dish]');
      if (editBtn) { openEditModal(editBtn.dataset.editDish); return; }
      var viewBtn = e.target.closest('[data-view-dish]');
      if (viewBtn) showDishDetail(viewBtn.dataset.viewDish);
    });
    // 编辑弹层
    $('#confirmEditBtn').addEventListener('click', confirmEditDish);
    $('#cancelEditBtn').addEventListener('click', closeModal);
  }

  // ============ 初始化 ============

  function init() {
    bindEvents();
    // 未建档时给个引导
    if (!S.getProfile()) {
      $('#orderHint').textContent = '💡 首次使用：先到「个人设置」建档（或载入示例档案），AI 才能为你算预算和方案。';
    }
    renderTray();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
