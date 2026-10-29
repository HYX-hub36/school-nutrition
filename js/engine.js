/**
 * engine.js — 校园AI营养师 · 规则引擎（纯函数，不依赖 DOM）
 * 所有函数输入/输出皆为普通对象，便于单元测试与后续替换为真实 AI 接口。
 *
 * 预留的真实 AI 替换点：
 *   analyzeDish()      → 可替换为视觉识别 + 大模型营养估算
 *   generatePlan()     → 可替换为 LLM 生成个性化方案
 *   adjustForStatus()  → 可替换为 LLM 结合历史记录的动态建议
 * 保持函数签名不变，上层 UI 无需改动。
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./data.js'));
  } else {
    root.NutriEngine = factory(root.NutriData);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {

  // ============ 基础计算 ============

  /** 营养达标评估：返回 {ok, ratio, label} */
  function evaluateTarget(actual, target, key) {
    if (!target[key]) return { ok: true, ratio: 1, label: '-' };
    var ratio = actual[key] / target[key];
    var ok = ratio >= 0.8 && ratio <= 1.2;
    return { ok: ok, ratio: ratio, label: Math.round(ratio * 100) + '%' };
  }

  /** 将若干菜品的营养合计为一份摘要 */
  function sumItems(items) {
    var s = { kcal: 0, protein: 0, fat: 0, carb: 0, sodium: 0, price: 0 };
    items.forEach(function (it) {
      s.kcal += it.kcal;
      s.protein += it.protein;
      s.fat += it.fat;
      s.carb += it.carb;
      s.sodium += it.sodium;
      s.price += it.price;
    });
    // 数值保留 1 位小数
    Object.keys(s).forEach(function (k) { s[k] = Math.round(s[k] * 10) / 10; });
    return s;
  }

  /** 逐个菜品分析（模拟“拍菜/输入菜名 → AI 分析”） */
  function analyzeDish(dish, profile) {
    var warnings = [];
    var tips = [];

    // 坑检测
    if (dish.fat >= 18) warnings.push('高油');
    if (dish.sodium >= 700) warnings.push('高盐');
    if (dish.tags.indexOf('高糖') >= 0) warnings.push('高糖');
    if (dish.fakeHealth) {
      warnings.push('伪健康菜');
      tips.push('看着清淡，实际油/糖/盐都不低，别被外表骗了');
    }
    if (dish.cook === '油炸') tips.push('油炸做法油脂吸收率高，热量容易超标');

    // 忌口过滤
    var allergyHits = [];
    if (profile && profile.allergies) {
      (dish.allergies || []).forEach(function (a) {
        if (profile.allergies.indexOf(a) >= 0) allergyHits.push(D.ALLERGY_LABELS[a] || a);
      });
    }
    if (allergyHits.length) {
      warnings.push('忌口');
      tips.push('含' + allergyHits.join('、') + '，建议避开');
    }

    // 诉求匹配
    if (profile && profile.needs) {
      profile.needs.forEach(function (n) {
        var st = D.NEED_STRATEGIES[n];
        if (!st) return;
        var hitAvoid = st.avoidTags.some(function (t) { return dish.tags.indexOf(t) >= 0; });
        if (hitAvoid) tips.push('该菜含有「' + n + '」建议避免的食材/做法');
        var hitPrefer = st.preferTags.some(function (t) { return dish.tags.indexOf(t) >= 0; });
        if (hitPrefer) tips.push('该菜符合「' + n + '」的营养偏好');
      });
    }

    // 去重
    tips = tips.filter(function (t, i) { return tips.indexOf(t) === i; });
    warnings = warnings.filter(function (w, i) { return warnings.indexOf(w) === i; });

    return {
      dish: dish,
      calories: dish.kcal,
      protein: dish.protein,
      fat: dish.fat,
      carb: dish.carb,
      sodium: dish.sodium,
      price: dish.price,
      warnings: warnings,
      tips: tips,
      suitable: warnings.indexOf('忌口') < 0, // 忌口则不适合
    };
  }

  // ============ 方案生成 ============

  /** 过滤：排除忌口菜 */
  function filterByAllergy(list, allergies) {
    if (!allergies || !allergies.length) return list.slice();
    return list.filter(function (d) {
      return !(d.allergies || []).some(function (a) { return allergies.indexOf(a) >= 0; });
    });
  }

  /** 过滤：排除诉求 avoid 的菜，优先 prefer 的菜 */
  function rankByNeed(list, needs) {
    var preferScore = {}, avoidScore = {};
    needs.forEach(function (n) {
      var st = D.NEED_STRATEGIES[n];
      if (!st) return;
      st.preferTags.forEach(function (t) { preferScore[t] = (preferScore[t] || 0) + 1; });
      st.avoidTags.forEach(function (t) { avoidScore[t] = (avoidScore[t] || 0) + 1; });
    });
    return list
      .filter(function (d) {
        return !d.tags.some(function (t) { return (avoidScore[t] || 0) > 0; });
      })
      .sort(function (a, b) {
        var sa = dScore(a, preferScore), sb = dScore(b, preferScore);
        return sb - sa;
      });
    function dScore(d, score) {
      return d.tags.reduce(function (sum, t) { return sum + (score[t] || 0); }, 0);
    }
  }

  /** 挑菜：在候选里按“得分”选 n 道，得分 = 需求匹配 + 蛋白/卡比 */
  function pickBest(list, n, opts) {
    opts = opts || {};
    var scored = list.map(function (d) {
      var score = 0;
      if (opts.needScore) score += opts.needScore(d);
      // 蛋白性价比
      score += Math.min(d.protein / Math.max(d.price, 0.1), 8) * 1.5;
      // 油盐扣分
      if (d.fat >= 18) score -= 1;
      if (d.sodium >= 700) score -= 1;
      if (d.fakeHealth) score -= 1.5;
      return { d: d, score: score };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, n).map(function (x) { return x.d; });
  }

  /** 早餐：便利店为主 */
  function buildBreakfast(profile, budget) {
    var out = [];
    var cv = D.CONVENIENCE;
    var candidate = cv.filter(function (c) {
      // 忌口
      if (c.name.indexOf('奶') >= 0 && profile.allergies.indexOf('豆制品') >= 0) return false; // 保守：乳糖/奶类默认允许
      return true;
    });
    // 主食类 + 蛋白质类 + 水果
    var staple = candidate.filter(function (c) { return c.category === '主食'; });
    var protein = candidate.filter(function (c) { return c.category === '乳品' || c.category === '蛋类'; });
    var fruit = candidate.filter(function (c) { return c.category === '水果'; });

    function pickByNeed(list, needTag) {
      if (!profile.needs.length) return list[0];
      // 找符合第一个诉求 prefer 的
      for (var i = 0; i < list.length; i++) {
        if (list[i].tags.some(function (t) { return needTag.indexOf(t) >= 0; })) return list[i];
      }
      return list[0];
    }
    var staplePick = staple[0];
    if (profile.needs.length) {
      var need = D.NEED_STRATEGIES[profile.needs[0]];
      if (need) staplePick = staple.filter(function (c) {
        return need.preferTags.some(function (t) { return c.tags.indexOf(t) >= 0; });
      })[0] || staplePick;
    }
    out.push(staplePick);
    out.push(protein[0]);
    if (fruit.length) out.push(fruit[0]);
    return out;
  }

  /** 午/晚餐：食堂菜 + 便利店补位 */
  function buildMeal(profile, budget, needTag) {
    var dishes = rankByNeed(filterByAllergy(D.DISHES, profile.allergies), profile.needs);
    // 主食
    var staples = dishes.filter(function (d) { return ['米饭', '杂粮饭', '红薯', '荞麦面'].indexOf(d.name) >= 0; });
    // 荤菜（tags 含 高蛋白 或 cook 非素）
    var meats = dishes.filter(function (d) { return d.tags.indexOf('高蛋白') >= 0 || d.cook === '卤制'; });
    var vegs = dishes.filter(function (d) { return !meats.includes(d) && d.name !== '米饭' && d.name !== '杂粮饭' && d.name !== '红薯' && d.name !== '南瓜粥' && d.name !== '荞麦面'; });
    var staple = staples[0] || dishes[0];
    var meat1 = pickBest(meats, 1, { needScore: function (d) { return needScore(d, profile); } })[0];
    var meat2 = pickBest(meats, 2, { needScore: function (d) { return needScore(d, profile); } })[1];
    var veg = pickBest(vegs, 1, { needScore: function (d) { return needScore(d, profile); } })[0];
    var items = [staple, meat1, veg];
    if (meat2 && items.reduce(function (s, x) { return s + x.price; }, 0) + meat2.price <= budget) {
      items.push(meat2);
    }
    // 超预算时削减：去掉最贵的非必需菜（保留主食+肉+菜）
    while (items.reduce(function (s, x) { return s + x.price; }, 0) > budget && items.length > 3) {
      var removed = items.filter(function (d) { return d.name !== staple.name; })
        .sort(function (a, b) { return b.price - a.price; })[0];
      items.splice(items.indexOf(removed), 1);
    }
    return items;
    function needScore(d, profile) {
      var s = 0;
      profile.needs.forEach(function (n) {
        var st = D.NEED_STRATEGIES[n];
        if (!st) return;
        if (st.preferTags.some(function (t) { return d.tags.indexOf(t) >= 0; })) s += 2;
        if (st.avoidTags.some(function (t) { return d.tags.indexOf(t) >= 0; })) s -= 3;
      });
      return s;
    }
  }

  /**
   * 生成一日三餐方案
   * @param {object} profile  个人档案（allergies/needs/budget 等）
   * @param {object} status   当日状态（可选，用于动态调整）
   * @returns {object} { meals, total, summary, notes }
   */
  function generatePlan(profile, status) {
    profile = profile || {};
    profile.needs = profile.needs || [];
    profile.allergies = profile.allergies || [];

    var adjusted = status ? adjustForStatus(profile, status) : null;
    var applied = adjusted ? adjusted.applied : {};

    var dailyBudget = profile.dailyBudget || 25;
    var mealBudget = Math.floor(dailyBudget / 3);

    var breakfast = buildBreakfast(profile, Math.min(D.PLAN_REFERENCE.breakfastBudget, mealBudget));
    var lunch = buildMeal(profile, Math.min(D.PLAN_REFERENCE.mealBudget, mealBudget), 'lunch');
    var dinner = buildMeal(profile, Math.min(D.PLAN_REFERENCE.mealBudget, mealBudget), 'dinner');

    // 动态调整对三餐的微调
    if (applied.gentle) {
      // 肠胃不适 → 全部换成清淡软食
      breakfast = [D.CONVENIENCE.filter(function (c) { return c.category === '蛋类'; })[0],
                   D.CONVENIENCE.filter(function (c) { return c.name === '煮玉米(根)'; })[0]];
      lunch = [D.DISHES.filter(function (d) { return d.name === '南瓜粥'; })[0],
               D.DISHES.filter(function (d) { return d.name === '蒸蛋羹'; })[0],
               D.DISHES.filter(function (d) { return d.name === '清炒西兰花'; })[0]];
      dinner = [D.DISHES.filter(function (d) { return d.name === '南瓜粥'; })[0],
                D.DISHES.filter(function (d) { return d.name === '清蒸鱼'; })[0],
                D.DISHES.filter(function (d) { return d.name === '凉拌黄瓜'; })[0]];
    }
    if (applied.addProtein) {
      // 各餐补一份蛋白来源（便利店鸡胸或茶叶蛋），保证全天总价不超日均预算
      var proteinSnack = D.CONVENIENCE.filter(function (c) { return c.category === '蛋白质'; })[0];
      var baseTotal = breakfast.concat(lunch).concat(dinner)
        .reduce(function (s, x) { return s + x.price; }, 0);
      if (proteinSnack) {
        // 优先午餐补，若仍有余量再补晚餐
        if (baseTotal + proteinSnack.price <= dailyBudget) {
          lunch = lunch.concat([proteinSnack]);
          baseTotal += proteinSnack.price;
        }
        if (baseTotal + proteinSnack.price <= dailyBudget) {
          dinner = dinner.concat([proteinSnack]);
        }
      }
    }

    var meals = [
      { name: '早餐', items: breakfast },
      { name: '午餐', items: lunch },
      { name: '晚餐', items: dinner },
    ].map(function (m) {
      var sum = sumItems(m.items);
      return { name: m.name, items: m.items, sum: sum };
    });

    var total = sumItems(meals.reduce(function (acc, m) { return acc.concat(m.items); }, []));
    var target = D.DAILY_TARGETS[profile.needs.indexOf('减脂') >= 0 ? '减脂' : (profile.needs.indexOf('增肌') >= 0 ? '增肌' : (profile.needs.indexOf('控糖') >= 0 ? '控糖' : 'default'))];
    var summary = {
      kcal: evaluateTarget(total, target, 'kcal'),
      protein: evaluateTarget(total, target, 'protein'),
      fat: evaluateTarget(total, target, 'fat'),
      sodium: evaluateTarget(total, target, 'sodium'),
    };

    var notes = [];
    if (applied.gentle) notes.push('已按「肠胃/身体不适」切换为清淡软食模式');
    if (applied.addProtein) notes.push('已按「运动量大/熬夜」增加蛋白质摄入');
    if (applied.regularMeals) notes.push('已按「压力大」保持三餐规律，每餐均衡');
    profile.needs.forEach(function (n) {
      var st = D.NEED_STRATEGIES[n];
      if (st && st.tips) notes.push(st.tips[0]);
    });
    if (adjusted && adjusted.advice) notes.push(adjusted.advice);
    notes = notes.filter(function (t, i) { return notes.indexOf(t) === i; }).slice(0, 4);

    return { meals: meals, total: total, summary: summary, notes: notes, target: target };
  }

  // ============ 动态调整 ============

  /**
   * 根据每日上报的状态，输出调整建议（纯规则）
   * @returns {object} { advice, applied }
   */
  function adjustForStatus(profile, status) {
    var applied = {};
    var advice = [];
    status = status || {};

    if (status.lateNight) {
      applied.addProtein = true;
      applied.addB = true;
      applied.avoidFatty = true;
      advice.push(D.STATUS_ADJUSTMENTS['熬夜'].advice);
    }
    if (status.stress) {
      applied.regularMeals = true;
      applied.addDairy = true;
      advice.push(D.STATUS_ADJUSTMENTS['压力大'].advice);
    }
    if (status.exercise) {
      applied.addProtein = true;
      applied.addCarb = true;
      advice.push(D.STATUS_ADJUSTMENTS['运动量大'].advice);
    }
    if (status.upset || status.sick) {
      applied.gentle = true;
      advice.push(D.STATUS_ADJUSTMENTS[status.sick ? '感冒/身体异常' : '肠胃不适'].advice);
    }
    return { advice: advice, applied: applied };
  }

  /** 从自由文本里粗提取状态关键词（演示用，真实场景交给大模型） */
  function extractStatus(text) {
    var s = { lateNight: false, stress: false, exercise: false, upset: false, sick: false };
    if (!text) return s;
    if (/熬夜|失眠|睡得晚|睡眠不足/.test(text)) s.lateNight = true;
    if (/压力|焦虑|紧张|烦躁|考试|论文/.test(text)) s.stress = true;
    if (/运动|跑|健身|打球|训练|锻炼/.test(text)) s.exercise = true;
    if (/胃|腹泻|拉肚子|胀|恶心|肚子疼/.test(text)) s.upset = true;
    if (/感冒|发烧|咳嗽|头疼|流涕/.test(text)) s.sick = true;
    return s;
  }

  // ============ 记录与情绪价值 ============

  /** 生成一段正向鼓励（避免身材焦虑措辞） */
  function encouragement(streak) {
    var list = D.ENCOURAGEMENTS;
    var idx = (streak || 0) % list.length;
    var extra = '';
    if (streak && streak > 0 && streak % 7 === 0) {
      extra = '你已经连续记录 ' + streak + ' 天，这份坚持比任何标准都珍贵。';
    }
    return { text: list[idx], extra: extra };
  }

  // ============ 个人食堂：营养匹配 / AI 估算 / 参考均价 ============

  /** 按菜名匹配营养数据库（精确 → 包含 → 别名） */
  function matchFoodByName(name) {
    if (!name) return { matched: false };
    var n = String(name).replace(/\s/g, '');
    // 1. 精确匹配
    for (var i = 0; i < D.FOOD_DB.length; i++) {
      if (D.FOOD_DB[i].name === n) return { matched: true, food: D.FOOD_DB[i], confidence: 'high' };
    }
    // 2. 名称包含（输入含库名，或库名含输入）
    for (var j = 0; j < D.FOOD_DB.length; j++) {
      if (n.indexOf(D.FOOD_DB[j].name) >= 0 || D.FOOD_DB[j].name.indexOf(n) >= 0) {
        return { matched: true, food: D.FOOD_DB[j], confidence: 'medium' };
      }
    }
    // 3. 别名匹配
    for (var k = 0; k < D.FOOD_DB.length; k++) {
      var al = D.FOOD_DB[k].aliases || [];
      for (var a = 0; a < al.length; a++) {
        if (n.indexOf(al[a]) >= 0 || al[a].indexOf(n) >= 0) {
          return { matched: true, food: D.FOOD_DB[k], confidence: 'medium' };
        }
      }
    }
    return { matched: false };
  }

  /** 判断菜名属于荤/素/主食/汤（AI 估算用） */
  function guessType(name) {
    if (!name) return '荤';
    var n = String(name);
    var scores = { '荤': 0, '素': 0, '主食': 0 };
    Object.keys(D.TYPE_KEYWORDS).forEach(function (type) {
      D.TYPE_KEYWORDS[type].forEach(function (kw) {
        if (n.indexOf(kw) >= 0) scores[type] += 1;
      });
    });
    // 启发式判定，顺序重要：
    // 1) 末字为 面/粉/粥/饼 → 主食（"牛肉面"是面不是荤菜）
    var last = n.charAt(n.length - 1);
    if (['面', '粉', '粥', '饼'].indexOf(last) >= 0) return '主食';
    // 2) 末字为 饭：含 ≥2 个荤词则是炒饭/盖饭（荤），否则主食
    if (last === '饭') return scores['荤'] >= 2 ? '荤' : '主食';
    // 3) 完整主食词（馒头等）
    if (/馒头|杂粮|粗粮/.test(n)) return '主食';
    // 4) 荤素分
    if (scores['荤'] > scores['素']) return '荤';
    if (scores['素'] > scores['荤']) return '素';
    return '荤'; // 无法判断默认荤
  }

  /** AI 估算营养（未命中库时）：类型 × 烹饪方式查模板 */
  function estimateByAI(name, cook) {
    var type = guessType(name);
    cook = cook || '清炒';
    var tpl = (D.AI_ESTIMATE_TEMPLATES[type] && D.AI_ESTIMATE_TEMPLATES[type][cook]) || D.AI_ESTIMATE_TEMPLATES['荤']['清炒'];
    return {
      name: name, type: type, cook: cook,
      kcal: tpl.kcal, protein: tpl.protein, fat: tpl.fat, carb: tpl.carb, sodium: tpl.sodium,
      source: 'ai',
    };
  }

  /** 烹饪方式营养修正：把基准营养按 cook 系数调整 */
  function applyCookAdjustment(base, cook) {
    var adj = D.COOK_ADJUST[cook];
    if (!adj) return base;
    return {
      kcal: Math.round(base.kcal * adj.kcal),
      protein: base.protein,
      fat: Math.round(base.fat * adj.fat),
      carb: base.carb,
      sodium: Math.round(base.sodium * adj.sodium),
    };
  }

  /** 同类菜参考均价：从系统菜+用户菜里取同 type 的均价 */
  function avgPriceByType(type, userDishes) {
    var pool = D.DISHES.concat(userDishes || []).filter(function (d) {
      if (!d.price) return false;
      // 用 cook 或 tags 粗判类型：含肉/蛋为荤，主食名称为主食，否则素
      var t = guessDishType(d);
      return t === type;
    });
    if (!pool.length) {
      // 兜底：全库均价
      pool = D.DISHES.concat(userDishes || []).filter(function (d) { return d.price; });
    }
    if (!pool.length) return { price: 3.5, note: '参考均价' };
    var sum = pool.reduce(function (s, d) { return s + d.price; }, 0);
    return { price: Math.round(sum / pool.length * 10) / 10, note: '参考均价' };
  }

  /** 从菜品字段粗判类型（均价用） */
  function guessDishType(dish) {
    if (!dish) return '素';
    var name = dish.name || '';
    if (D.TYPE_KEYWORDS['主食'].some(function (k) { return name.indexOf(k) >= 0; })) return '主食';
    if (name === '米饭' || name === '杂粮饭' || name === '红薯' || name === '南瓜粥' || name === '荞麦面') return '主食';
    if (dish.tags && dish.tags.indexOf('高蛋白') >= 0) return '荤';
    if (D.TYPE_KEYWORDS['荤'].some(function (k) { return name.indexOf(k) >= 0; })) return '荤';
    if (D.TYPE_KEYWORDS['素'].some(function (k) { return name.indexOf(k) >= 0; })) return '素';
    return '荤';
  }

  return {
    evaluateTarget: evaluateTarget,
    sumItems: sumItems,
    analyzeDish: analyzeDish,
    filterByAllergy: filterByAllergy,
    rankByNeed: rankByNeed,
    generatePlan: generatePlan,
    adjustForStatus: adjustForStatus,
    extractStatus: extractStatus,
    encouragement: encouragement,
    matchFoodByName: matchFoodByName,
    guessType: guessType,
    estimateByAI: estimateByAI,
    applyCookAdjustment: applyCookAdjustment,
    avgPriceByType: avgPriceByType,
    guessDishType: guessDishType,
  };
});
