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

console.log('\n' + (process.exitCode ? '✗ 存在失败项' : '✓ 全部通过') + '（' + passed + ' 项断言）');
