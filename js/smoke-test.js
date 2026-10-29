/**
 * 冒烟测试 — 用 Node 直接运行 engine.js 与 data.js 的纯函数逻辑
 * 运行：node js/smoke-test.js
 */
const assert = require('assert');
const D = require('./data.js');
const E = require('./engine.js');

let passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else {
    console.error('  ✗ FAIL: ' + name);
    if (extra !== undefined) console.error('    got:', JSON.stringify(extra));
    process.exitCode = 1;
  }
}

console.log('=== 数据完整性 ===');
ok('内置菜品数 >= 20', D.DISHES.length >= 20, D.DISHES.length);
ok('便利店商品数 >= 8', D.CONVENIENCE.length >= 8, D.CONVENIENCE.length);
ok('每个菜品字段完整', D.DISHES.every(d => ['name','price','kcal','protein','fat','carb','sodium','cook','tags','allergies'].every(k => k in d)));
ok('伪健康菜存在', D.DISHES.some(d => d.fakeHealth));
ok('每道菜价格合理 (0.5~8元)', D.DISHES.every(d => d.price >= 0.5 && d.price <= 8));
ok('每个诉求有策略', ['调理皮肤','调理肠胃','熬夜恢复','减脂','增肌','控糖'].every(n => D.NEED_STRATEGIES[n]));

console.log('=== 菜品分析 ===');
const profile = {
  gender: '女', age: 20, height: 162, weight: 52,
  exercise: 1, budget: 1100, dailyBudget: 36.7,
  allergies: ['辣', '海鲜'],
  needs: ['调理肠胃', '熬夜恢复'],
};
// 地三鲜：伪健康菜 → 应标 高油/伪健康
const dSanXian = D.DISHES.find(d => d.name === '地三鲜');
const a1 = E.analyzeDish(dSanXian, profile);
ok('地三鲜被标为伪健康/高油', a1.warnings.includes('伪健康菜') && a1.warnings.includes('高油'), a1.warnings);
// 清蒸鱼：海鲜忌口 → 应标 忌口，suitable=false
const fish = D.DISHES.find(d => d.name === '清蒸鱼');
const a2 = E.analyzeDish(fish, profile);
ok('清蒸鱼被标忌口(海鲜过敏)', a2.warnings.includes('忌口') && a2.suitable === false, a2);
// 清蒸鱼对无海鲜过敏的人：适合
const a3 = E.analyzeDish(fish, { allergies: ['辣'], needs: [] });
ok('清蒸鱼对无海鲜过敏者适合', a3.suitable === true && a3.warnings.length === 0, a3);
// 香煎鸡胸：符合调理肠胃的清淡偏好
const chicken = D.DISHES.find(d => d.name === '香煎鸡胸');
const a4 = E.analyzeDish(chicken, profile);
ok('香煎鸡胸提示符合调理肠胃需求', a4.tips.some(t => t.includes('调理肠胃')), a4.tips);

console.log('=== 方案生成 ===');
const plan = E.generatePlan(profile, {});
ok('生成三餐', plan.meals.length === 3, plan.meals.length);
ok('每日总价在预算内(±3)', plan.total.price <= profile.dailyBudget + 3, { price: plan.total.price, budget: profile.dailyBudget });
ok('不包含忌口菜(辣/海鲜)', !plan.meals.some(m => m.items.some(d => d.allergies.some(a => profile.allergies.includes(a)))), plan.meals.map(m => m.items.map(i => i.name)));
ok('有营养达标摘要', !!plan.summary.kcal && !!plan.summary.protein, plan.summary);
ok('有调整说明', Array.isArray(plan.notes), plan.notes);

// 动态调整：肠胃不适 → 清淡软食
const planGentle = E.generatePlan(profile, { upset: true });
ok('肠胃不适时切换清淡软食(含南瓜粥)', planGentle.meals.some(m => m.items.some(i => i.name === '南瓜粥')), planGentle.meals.map(m => m.items.map(i => i.name)));
ok('肠胃不适说明含提示', planGentle.notes.some(n => n.includes('清淡软食') || n.includes('肠胃')), planGentle.notes);

// 减脂目标
const fatProfile = { gender: '男', age: 21, height: 175, weight: 70, allergies: [], needs: ['减脂'], dailyBudget: 25 };
const planFat = E.generatePlan(fatProfile, {});
ok('减脂诉求生成减脂目标', planFat.target.kcal === 1600, planFat.target);
ok('减脂方案不含油炸菜', !planFat.meals.some(m => m.items.some(i => i.tags.includes('油炸'))), planFat.meals.map(m => m.items.map(i => i.name)));

console.log('=== 文本状态提取 ===');
ok('识别熬夜', E.extractStatus('期末周熬夜复习到两点').lateNight === true);
ok('识别压力', E.extractStatus('最近论文压力好大').stress === true);
ok('识别运动', E.extractStatus('今天去跑了5公里').exercise === true);
ok('识别肠胃不适', E.extractStatus('中午吃多了有点胀').upset === true);
ok('无关键词不误报', E.extractStatus('今天心情不错').lateNight === false);

console.log('=== 情绪价值 ===');
const enc = E.encouragement(7);
ok('连续7天有特别鼓励', enc.extra.includes('7'), enc.extra);
ok('鼓励话术不涉及体重/身材焦虑', !/身材|体重|胖|瘦/.test(enc.text + enc.extra), enc);

console.log('=== 动态调整后预算约束 ===');
// 熬夜 → 加蛋白后总价仍应 ≤ 日均预算
const planAdj = E.generatePlan(profile, { lateNight: true });
ok('熬夜加蛋白后总价不超日均预算', planAdj.total.price <= profile.dailyBudget, { price: planAdj.total.price, budget: profile.dailyBudget });
ok('熬夜方案确实加了蛋白(鸡胸)', planAdj.meals.some(m => m.items.some(i => i.name === '即食鸡胸肉')), planAdj.meals.map(m => m.items.map(i => i.name)));

console.log('=== 个人食堂：营养匹配 / AI 估算 / 均价 / 烹饪修正 ===');
ok('FOOD_DB 菜品数 >= 30', D.FOOD_DB.length >= 30, D.FOOD_DB.length);
// 精确匹配
const m1 = E.matchFoodByName('西红柿炒蛋');
ok('西红柿炒蛋精确匹配', m1.matched && m1.confidence === 'high' && m1.food.kcal === 220, m1);
// 别名匹配
const m2 = E.matchFoodByName('番茄炒蛋');
ok('番茄炒蛋别名匹配', m2.matched && m2.food.name === '西红柿炒蛋', m2);
// 包含匹配
const m3 = E.matchFoodByName('西红柿炒蛋盖饭');
ok('西红柿炒蛋盖饭包含匹配', m3.matched && m3.food.name === '西红柿炒蛋', m3);
// 未命中 → AI 估算
const m4 = E.matchFoodByName('食堂秘制牛肉面');
ok('未收录菜不匹配', m4.matched === false, m4);
const est = E.estimateByAI('食堂秘制牛肉面', '清炒');
ok('AI 估算返回全套营养+source=ai', est.source === 'ai' && est.kcal > 0 && est.protein > 0 && est.fat > 0, est);
// 类型判断
ok('guessType 牛肉→荤', E.guessType('牛肉炒饭') === '荤');
ok('guessType 西兰花→素', E.guessType('蒜蓉西兰花') === '素');
ok('guessType 面条→主食', E.guessType('牛肉面') === '主食');
ok('guessType 米饭→主食', E.guessType('米饭') === '主食');
// 烹饪修正：油炸应升高脂肪
const baseAdj = { kcal: 200, protein: 10, fat: 8, carb: 15, sodium: 300 };
const fried = E.applyCookAdjustment(baseAdj, '油炸');
ok('油炸修正脂肪升高', fried.fat > baseAdj.fat, { before: baseAdj.fat, after: fried.fat });
const steamed = E.applyCookAdjustment(baseAdj, '清蒸');
ok('清蒸修正脂肪降低', steamed.fat < baseAdj.fat, { before: baseAdj.fat, after: steamed.fat });
// 参考均价
const avgMeat = E.avgPriceByType('荤', []);
ok('荤菜参考均价合理(3~8元)', avgMeat.price >= 3 && avgMeat.price <= 8 && avgMeat.note === '参考均价', avgMeat);
const avgNone = E.avgPriceByType('汤', []);
ok('汤类无参考也有兜底均价', avgNone.price > 0, avgNone);
// 用户菜参与均价
const userDish1 = { name: '食堂烤鸭', price: 12, tags: ['高蛋白'], cook: '烤制' };
const avgBase = E.avgPriceByType('荤', []);
const avgWithUser = E.avgPriceByType('荤', [userDish1]);
ok('用户高价菜抬升荤菜均价', avgWithUser.price > avgBase.price, { base: avgBase.price, withUser: avgWithUser.price });

console.log('\n' + (process.exitCode ? '✗ 存在失败项' : '✓ 全部通过') + '（' + passed + ' 项断言）');
