/**
 * data.js — 校园AI营养师 · 数据与规则定义
 * 菜品营养为估算值（面向演示），真实场景应接入权威营养数据库/食堂后厨数据。
 */

// ============ 营养目标（按诉求映射，单位：千卡/克/毫克） ============
// 以 2000 千卡日摄入为基准的每日目标模板
const DAILY_TARGETS = {
  'default': { kcal: 2000, protein: 65, fat: 60, carb: 260, sodium: 2000 },
  '减脂':    { kcal: 1600, protein: 75, fat: 45, carb: 200, sodium: 1800 },
  '增肌':    { kcal: 2400, protein: 110, fat: 70, carb: 300, sodium: 2200 },
  '控糖':    { kcal: 1900, protein: 75, fat: 55, carb: 210, sodium: 1900 },
};

// ============ 健康诉求 → 饮食策略 ============
// preferTags / avoidTags 匹配菜品的 tag（如 '高蛋白'、'油炸'、'辛辣'）
const NEED_STRATEGIES = {
  '调理皮肤': {
    label: '皮肤调理',
    preferTags: ['高蛋白', '富含维C', '富含维A'],
    avoidTags: ['油炸', '高糖', '辛辣', '高脂'],
    tips: ['多选富含维生素C和A的蔬果，帮助皮肤抗氧化', '避开油炸和辛辣刺激，减少皮肤炎症反应'],
  },
  '调理肠胃': {
    label: '肠胃调理',
    preferTags: ['清淡', '易消化', '富含纤维'],
    avoidTags: ['辛辣', '油炸', '高脂', '高糖'],
    tips: ['以蒸煮、炖汤类为主，少油少辣', '细嚼慢咽，避免冷热交替刺激肠胃'],
  },
  '熬夜恢复': {
    label: '熬夜恢复',
    preferTags: ['高蛋白', '富含B族', '清淡'],
    avoidTags: ['油炸', '高糖', '高盐'],
    tips: ['补充优质蛋白与B族维生素，帮助神经修复', '减少高糖高油，避免加重身体负担'],
  },
  '减脂': {
    label: '减脂',
    preferTags: ['高蛋白', '低脂', '富含纤维'],
    avoidTags: ['油炸', '高糖', '高脂', '高盐'],
    tips: ['每餐保证优质蛋白，主食粗细搭配', '避开油炸和勾芡浓汁，控油控盐是核心'],
  },
  '增肌': {
    label: '增肌',
    preferTags: ['高蛋白'],
    avoidTags: [],
    tips: ['三餐都安排足量优质蛋白，正餐后可加牛奶/酸奶补蛋白', '训练日适当加餐，避免空腹训练'],
  },
  '控糖': {
    label: '控糖',
    preferTags: ['低GI', '高蛋白', '富含纤维'],
    avoidTags: ['高糖', '油炸', '高GI'],
    tips: ['主食优先粗粮，避免精制糖和含糖饮料', '餐后散步帮助平稳血糖'],
  },
};

// ============ 忌口 ============
const ALLERGY_LABELS = {
  '辣':       '不吃辣',
  '海鲜':     '海鲜过敏',
  '花生':     '花生过敏',
  '牛羊肉':   '不吃牛羊肉',
  '香菜':     '不吃香菜',
  '豆制品':   '豆制品忌口',
};

// ============ 食堂菜品库 ============
// 字段：name 菜名, price 价格(元), kcal 千卡, protein/fat/carb 克, sodium 钠(毫克)
// cook 烹饪方式: 清炒/红烧/油炸/蒸煮/汤/凉拌/烤制
// tags: 营养特征标签；dishes 忌口标签（'辣'/'海鲜'/'花生'/'牛羊肉'/'香菜'/'豆制品'）
// fakeHealth: true 表示“伪健康菜”（看着清淡实则高油高盐）
// portion: 参考份量(克)
const DISHES = [
  // ---- 荤菜 ----
  { name: '红烧肉', price: 5.0, kcal: 480, protein: 22, fat: 36, carb: 18, sodium: 720, cook: '红烧', tags: ['高蛋白', '高脂', '高盐'], allergies: [], fakeHealth: false, portion: 200, desc: '肥瘦相间，油脂和盐分都偏高，偶尔解馋可以，减脂期慎点。' },
  { name: '糖醋里脊', price: 5.5, kcal: 420, protein: 18, fat: 22, carb: 38, sodium: 620, cook: '油炸', tags: ['油炸', '高糖'], allergies: [], fakeHealth: true, portion: 200, desc: '里脊经过油炸再裹糖醋汁，属于高油高糖的“伪健康菜”。' },
  { name: '鱼香肉丝', price: 4.5, kcal: 320, protein: 16, fat: 18, carb: 28, sodium: 980, cook: '清炒', tags: ['高盐', '辛辣'], allergies: [], fakeHealth: true, portion: 180, desc: '看似普通炒菜，实则重油重盐还加糖，钠含量很高。' },
  { name: '宫保鸡丁', price: 4.5, kcal: 300, protein: 18, fat: 16, carb: 24, sodium: 760, cook: '清炒', tags: ['高盐', '辛辣', '高蛋白'], allergies: ['花生'], fakeHealth: false, portion: 180, desc: '蛋白质不错，但酱汁偏咸偏油，花生过敏的同学要避开。' },
  { name: '西红柿炒蛋', price: 4.0, kcal: 220, protein: 10, fat: 14, carb: 16, sodium: 480, cook: '清炒', tags: ['家常', '高蛋白', '富含维C'], allergies: [], fakeHealth: false, portion: 200, desc: '经典家常菜，蛋多汁少相对友好，但食堂版普遍油不少。' },
  { name: '清蒸鱼', price: 6.0, kcal: 210, protein: 28, fat: 8, carb: 2, sodium: 420, cook: '蒸煮', tags: ['高蛋白', '低脂', '清淡', '富含B族'], allergies: ['海鲜'], fakeHealth: false, portion: 180, desc: '优质蛋白的优秀来源，做法清淡，适合肠胃不适和减脂期。' },
  { name: '白灼虾', price: 7.0, kcal: 160, protein: 26, fat: 3, carb: 2, sodium: 380, cook: '蒸煮', tags: ['高蛋白', '低脂', '清淡'], allergies: ['海鲜'], fakeHealth: false, portion: 150, desc: '低脂高蛋白典范，就是价格略高，学生党偶尔改善伙食。' },
  { name: '土豆烧鸡块', price: 4.5, kcal: 350, protein: 20, fat: 16, carb: 32, sodium: 650, cook: '红烧', tags: ['高蛋白'], allergies: [], fakeHealth: false, portion: 220, desc: '蛋白质和碳水都有，红烧汤汁偏咸，可以少舀汁。' },
  { name: '香辣鸡腿', price: 5.0, kcal: 380, protein: 20, fat: 24, carb: 16, sodium: 850, cook: '油炸', tags: ['油炸', '高盐', '辛辣', '高蛋白'], allergies: [], fakeHealth: true, portion: 180, desc: '炸鸡腿配辣椒，香是真香，油盐也是真的高。' },
  { name: '卤牛肉', price: 6.5, kcal: 260, protein: 32, fat: 12, carb: 3, sodium: 780, cook: '卤制', tags: ['高蛋白', '低脂', '高盐'], allergies: ['牛羊肉'], fakeHealth: false, portion: 120, desc: '高蛋白低脂，但卤汁钠含量高，一次别吃太多。' },
  { name: '香煎鸡胸', price: 5.5, kcal: 260, protein: 32, fat: 10, carb: 5, sodium: 520, cook: '烤制', tags: ['高蛋白', '低脂', '清淡'], allergies: [], fakeHealth: false, portion: 180, desc: '食堂里的“健身菜”，蛋白质高油盐适中，减脂增肌都合适。' },
  { name: '青椒肉丝', price: 4.0, kcal: 240, protein: 16, fat: 14, carb: 12, sodium: 560, cook: '清炒', tags: ['高蛋白', '富含维C'], allergies: [], fakeHealth: false, portion: 180, desc: '青椒富含维C，肉丝提供蛋白质，中规中矩的好选择。' },
  // ---- 素菜 ----
  { name: '地三鲜', price: 3.5, kcal: 310, protein: 6, fat: 22, carb: 28, sodium: 780, cook: '油炸', tags: ['油炸', '高脂', '高盐'], allergies: [], fakeHealth: true, portion: 200, desc: '土豆茄子青椒先过油炸再烧，素菜里的“热量刺客”。' },
  { name: '干煸豆角', price: 3.5, kcal: 280, protein: 8, fat: 20, carb: 22, sodium: 820, cook: '油炸', tags: ['油炸', '高盐', '辛辣'], allergies: [], fakeHealth: true, portion: 200, desc: '干煸=油炸，豆角吸油厉害，隐形油大户。' },
  { name: '炒时蔬', price: 2.5, kcal: 120, protein: 4, fat: 7, carb: 12, sodium: 380, cook: '清炒', tags: ['清淡', '富含纤维', '富含维C', '低脂'], allergies: [], fakeHealth: false, portion: 180, desc: '绿叶菜补充纤维和维生素，让阿姨少放油更佳。' },
  { name: '凉拌黄瓜', price: 2.0, kcal: 90, protein: 3, fat: 4, carb: 12, sodium: 420, cook: '凉拌', tags: ['清淡', '低脂', '富含维C'], allergies: ['香菜'], fakeHealth: false, portion: 150, desc: '清爽低卡，适合夏天和清淡需求，注意蒜汁可能偏咸。' },
  { name: '麻婆豆腐', price: 3.0, kcal: 260, protein: 14, fat: 16, carb: 14, sodium: 900, cook: '红烧', tags: ['高盐', '辛辣', '高蛋白'], allergies: ['豆制品'], fakeHealth: false, portion: 180, desc: '豆腐蛋白不错，但麻婆做法油盐都重，钠含量很高。' },
  { name: '蒸蛋羹', price: 3.0, kcal: 140, protein: 12, fat: 8, carb: 4, sodium: 320, cook: '蒸煮', tags: ['高蛋白', '清淡', '易消化'], allergies: [], fakeHealth: false, portion: 150, desc: '好消化、蛋白优质，肠胃不适时的温柔选择。' },
  { name: '清炒西兰花', price: 3.0, kcal: 130, protein: 6, fat: 6, carb: 14, sodium: 360, cook: '清炒', tags: ['清淡', '富含纤维', '富含维C', '低脂'], allergies: [], fakeHealth: false, portion: 200, desc: '蔬菜之王，低脂高纤维，多选准没错。' },
  { name: '玉米排骨汤', price: 4.0, kcal: 220, protein: 16, fat: 10, carb: 18, sodium: 520, cook: '汤', tags: ['清淡', '高蛋白', '富含纤维', '低GI'], allergies: [], fakeHealth: false, portion: 300, desc: '汤菜结合，清淡暖胃，注意少喝浮油。' },
  // ---- 主食 ----
  { name: '米饭', price: 0.8, kcal: 230, protein: 5, fat: 1, carb: 52, sodium: 5, cook: '蒸煮', tags: ['高GI'], allergies: [], fakeHealth: false, portion: 150, desc: '基础主食，减脂控糖时建议减半并搭配粗粮。' },
  { name: '杂粮饭', price: 1.5, kcal: 210, protein: 6, fat: 2, carb: 44, sodium: 10, cook: '蒸煮', tags: ['低GI', '富含纤维'], allergies: [], fakeHealth: false, portion: 150, desc: '糙米燕麦混合，升糖慢、饱腹感强，控糖减脂优选。' },
  { name: '红薯', price: 1.5, kcal: 130, protein: 2, fat: 0, carb: 30, sodium: 10, cook: '蒸煮', tags: ['低GI', '富含纤维', '富含维A'], allergies: [], fakeHealth: false, portion: 130, desc: '优质粗粮主食，膳食纤维丰富，替代米饭的好选择。' },
  { name: '南瓜粥', price: 1.0, kcal: 110, protein: 3, fat: 1, carb: 24, sodium: 30, cook: '粥', tags: ['清淡', '易消化', '低GI'], allergies: [], fakeHealth: false, portion: 250, desc: '易消化的清淡主食，肠胃不适、熬夜后调理首选。' },
  { name: '荞麦面', price: 2.0, kcal: 280, protein: 10, fat: 4, carb: 52, sodium: 420, cook: '汤', tags: ['低GI', '高蛋白', '清淡'], allergies: [], fakeHealth: false, portion: 200, desc: '低GI面食，比白面条更适合控糖和减脂。' },
];

// ============ 便利店商品库 ============
// isStaple: 是否主食类；用于早餐搭配
const CONVENIENCE = [
  { name: '纯牛奶(盒)', price: 3.0, kcal: 130, protein: 7, fat: 5, carb: 12, sodium: 100, tags: ['高蛋白', '富含B族'], category: '乳品', portion: 250, allergies: [] },
  { name: '无糖酸奶', price: 3.5, kcal: 120, protein: 6, fat: 4, carb: 14, sodium: 90, tags: ['高蛋白', '富含B族', '低GI'], category: '乳品', portion: 200, allergies: [] },
  { name: '茶叶蛋', price: 2.0, kcal: 90, protein: 7, fat: 6, carb: 1, sodium: 350, tags: ['高蛋白'], category: '蛋类', portion: 60, allergies: [] },
  { name: '全麦面包', price: 4.0, kcal: 240, protein: 8, fat: 4, carb: 42, sodium: 320, tags: ['低GI', '富含纤维'], category: '主食', portion: 100, allergies: [] },
  { name: '香蕉', price: 2.0, kcal: 90, protein: 1, fat: 0, carb: 22, sodium: 1, tags: ['低GI', '富含纤维'], category: '水果', portion: 120, allergies: [] },
  { name: '即食鸡胸肉', price: 6.0, kcal: 130, protein: 25, fat: 3, carb: 3, sodium: 480, tags: ['高蛋白', '低脂', '清淡'], category: '蛋白质', portion: 100, allergies: [] },
  { name: '煮玉米(根)', price: 3.0, kcal: 110, protein: 3, fat: 1, carb: 24, sodium: 5, tags: ['低GI', '富含纤维'], category: '主食', portion: 150, allergies: [] },
  { name: '黄瓜(根)', price: 1.5, kcal: 20, protein: 1, fat: 0, carb: 4, sodium: 5, tags: ['清淡', '低脂', '富含维C'], category: '蔬菜', portion: 100, allergies: [] },
  { name: '坚果小包', price: 4.0, kcal: 180, protein: 6, fat: 16, carb: 6, sodium: 120, tags: ['富含B族'], category: '加餐', portion: 25, allergies: [] },
];

// ============ 身体状态上报 → 动态调整 ============
// 每个状态项：影响说明 + 建议补充/避免 + 目标营养修正
const STATUS_ADJUSTMENTS = {
  '熬夜': {
    label: '熬夜',
    advice: '熬夜后重点补充优质蛋白和B族维生素，帮助神经系统修复；减少油炸和重盐，减轻身体代谢负担。',
    adjust: { addProtein: true, addB: true, avoidFatty: true },
  },
  '压力大': {
    label: '压力大',
    advice: '压力期更要保证三餐规律，别用“吃垃圾食品”报复性解压；牛奶和坚果里的B族与镁有助于稳定情绪。',
    adjust: { regularMeals: true, addDairy: true },
  },
  '运动量大': {
    label: '运动量大',
    advice: '运动日适当增加蛋白质摄入，帮助肌肉恢复；训练前别空腹，训练后半小时内补充蛋白和碳水。',
    adjust: { addProtein: true, addCarb: true },
  },
  '肠胃不适': {
    label: '肠胃不适',
    advice: '肠胃不适时切换到“清淡软食模式”：蒸煮炖汤为主，避开辛辣油炸和生冷；少食多餐。',
    adjust: { gentle: true, avoidFatty: true, avoidSpicy: true },
  },
  '感冒/身体异常': {
    label: '感冒/身体异常',
    advice: '身体不适期间保证清淡易消化，多喝水多休息；症状持续建议及时就医，营养方案只是辅助。',
    adjust: { gentle: true, avoidSpicy: true },
  },
};

// ============ 食堂餐位定价参考（方案生成用） ============
// 早餐人均参考、午/晚两荤一素+主食的预算结构
const PLAN_REFERENCE = {
  breakfastBudget: 5,   // 早餐参考花费上限（元）
  mealBudget: 15,       // 午/晚餐参考花费上限（元）
  perDishPriceCap: 7.5, // 单菜价格上限（食堂菜价格容忍度）
};

// ============ 鼓励话术（记录页情绪价值） ============
const ENCOURAGEMENTS = [
  '坚持记录本身就是一种能力，今天也做得很好 👏',
  '身体状态没有“标准答案”，按自己的节奏来，就是在变好。',
  '不需要追求完美，比昨天规律一点点，就是进步。',
  '好好吃饭不是任务，是对自己的照顾。',
  '别拿别人的身材标准要求自己，你只需要比上周的状态好一点。',
];

// ============ 食物营养数据库（供「我的个人食堂」菜名匹配回填） ============
// 字段：name 名称, aliases 别名, type 类型(荤/素/主食/汤), defaultCook 默认烹饪方式
// kcal/protein/fat/carb/sodium 按"一份"估算（100-250g，参考食堂份量）
const FOOD_DB = [
  // ---- 荤菜 ----
  { name: '西红柿炒蛋', aliases: ['番茄炒蛋', '番茄鸡蛋'], type: '荤', defaultCook: '清炒', kcal: 220, protein: 10, fat: 14, carb: 16, sodium: 480 },
  { name: '红烧肉', aliases: ['东坡肉', '红烧五花肉'], type: '荤', defaultCook: '红烧', kcal: 480, protein: 22, fat: 36, carb: 18, sodium: 720 },
  { name: '糖醋里脊', aliases: ['糖醋排骨'], type: '荤', defaultCook: '油炸', kcal: 420, protein: 18, fat: 22, carb: 38, sodium: 620 },
  { name: '鱼香肉丝', aliases: ['鱼香肉丝盖饭'], type: '荤', defaultCook: '清炒', kcal: 320, protein: 16, fat: 18, carb: 28, sodium: 980 },
  { name: '宫保鸡丁', aliases: ['宫爆鸡丁'], type: '荤', defaultCook: '清炒', kcal: 300, protein: 18, fat: 16, carb: 24, sodium: 760 },
  { name: '清蒸鱼', aliases: ['蒸鱼', '清蒸鲈鱼'], type: '荤', defaultCook: '清蒸', kcal: 210, protein: 28, fat: 8, carb: 2, sodium: 420 },
  { name: '白灼虾', aliases: ['水煮虾', '白灼基围虾'], type: '荤', defaultCook: '清蒸', kcal: 160, protein: 26, fat: 3, carb: 2, sodium: 380 },
  { name: '土豆烧鸡块', aliases: ['土豆炖鸡', '小鸡炖土豆'], type: '荤', defaultCook: '红烧', kcal: 350, protein: 20, fat: 16, carb: 32, sodium: 650 },
  { name: '香辣鸡腿', aliases: ['炸鸡腿', '辣子鸡腿'], type: '荤', defaultCook: '油炸', kcal: 380, protein: 20, fat: 24, carb: 16, sodium: 850 },
  { name: '卤牛肉', aliases: ['酱牛肉', '卤牛腱'], type: '荤', defaultCook: '红烧', kcal: 260, protein: 32, fat: 12, carb: 3, sodium: 780 },
  { name: '香煎鸡胸', aliases: ['煎鸡胸', '鸡胸肉', '水煮鸡胸'], type: '荤', defaultCook: '清炒', kcal: 260, protein: 32, fat: 10, carb: 5, sodium: 520 },
  { name: '青椒肉丝', aliases: ['青椒炒肉'], type: '荤', defaultCook: '清炒', kcal: 240, protein: 16, fat: 14, carb: 12, sodium: 560 },
  { name: '麻婆豆腐', aliases: ['麻辣豆腐'], type: '荤', defaultCook: '红烧', kcal: 260, protein: 14, fat: 16, carb: 14, sodium: 900 },
  { name: '辣椒炒肉', aliases: ['农家小炒肉', '青椒炒肉'], type: '荤', defaultCook: '清炒', kcal: 300, protein: 18, fat: 20, carb: 12, sodium: 680 },
  { name: '可乐鸡翅', aliases: ['鸡翅', '可乐鸡翅根'], type: '荤', defaultCook: '红烧', kcal: 340, protein: 20, fat: 18, carb: 26, sodium: 580 },
  // ---- 素菜 ----
  { name: '地三鲜', aliases: ['三鲜茄子'], type: '素', defaultCook: '油炸', kcal: 310, protein: 6, fat: 22, carb: 28, sodium: 780 },
  { name: '干煸豆角', aliases: ['干煸四季豆'], type: '素', defaultCook: '油炸', kcal: 280, protein: 8, fat: 20, carb: 22, sodium: 820 },
  { name: '炒时蔬', aliases: ['清炒青菜', '炒青菜', '素炒时蔬'], type: '素', defaultCook: '清炒', kcal: 120, protein: 4, fat: 7, carb: 12, sodium: 380 },
  { name: '凉拌黄瓜', aliases: ['拍黄瓜', '黄瓜'], type: '素', defaultCook: '凉拌', kcal: 90, protein: 3, fat: 4, carb: 12, sodium: 420 },
  { name: '蒸蛋羹', aliases: ['鸡蛋羹', '蒸水蛋'], type: '素', defaultCook: '清蒸', kcal: 140, protein: 12, fat: 8, carb: 4, sodium: 320 },
  { name: '清炒西兰花', aliases: ['西兰花', '蒜蓉西兰花'], type: '素', defaultCook: '清炒', kcal: 130, protein: 6, fat: 6, carb: 14, sodium: 360 },
  { name: '炒土豆丝', aliases: ['酸辣土豆丝', '醋溜土豆丝', '土豆丝'], type: '素', defaultCook: '清炒', kcal: 200, protein: 4, fat: 10, carb: 26, sodium: 480 },
  { name: '蒜蓉油麦菜', aliases: ['油麦菜', '蒜蓉生菜'], type: '素', defaultCook: '清炒', kcal: 110, protein: 3, fat: 6, carb: 12, sodium: 340 },
  { name: '红烧茄子', aliases: ['烧茄子', '鱼香茄子'], type: '素', defaultCook: '油炸', kcal: 290, protein: 5, fat: 20, carb: 26, sodium: 700 },
  { name: '炒豆腐', aliases: ['家常豆腐', '豆腐'], type: '素', defaultCook: '清炒', kcal: 180, protein: 12, fat: 10, carb: 10, sodium: 420 },
  // ---- 主食 ----
  { name: '米饭', aliases: ['白米饭', '白饭'], type: '主食', defaultCook: '清蒸', kcal: 230, protein: 5, fat: 1, carb: 52, sodium: 5 },
  { name: '杂粮饭', aliases: ['粗粮饭', '糙米饭', '五谷饭'], type: '主食', defaultCook: '清蒸', kcal: 210, protein: 6, fat: 2, carb: 44, sodium: 10 },
  { name: '红薯', aliases: ['烤红薯', '地瓜'], type: '主食', defaultCook: '清蒸', kcal: 130, protein: 2, fat: 0, carb: 30, sodium: 10 },
  { name: '南瓜粥', aliases: ['南瓜小米粥', '小米南瓜粥'], type: '主食', defaultCook: '汤', kcal: 110, protein: 3, fat: 1, carb: 24, sodium: 30 },
  { name: '荞麦面', aliases: ['荞麦面条', '荞麦面汤面'], type: '主食', defaultCook: '汤', kcal: 280, protein: 10, fat: 4, carb: 52, sodium: 420 },
  { name: '馒头', aliases: ['白面馒头'], type: '主食', defaultCook: '清蒸', kcal: 220, protein: 7, fat: 1, carb: 46, sodium: 120 },
  // ---- 汤 ----
  { name: '玉米排骨汤', aliases: ['排骨玉米汤'], type: '汤', defaultCook: '汤', kcal: 220, protein: 16, fat: 10, carb: 18, sodium: 520 },
  { name: '紫菜蛋花汤', aliases: ['蛋花汤', '紫菜汤'], type: '汤', defaultCook: '汤', kcal: 80, protein: 5, fat: 3, carb: 6, sodium: 380 },
  { name: '冬瓜排骨汤', aliases: ['排骨冬瓜汤'], type: '汤', defaultCook: '汤', kcal: 180, protein: 12, fat: 8, carb: 10, sodium: 460 },
];

// ============ AI 估算模板（未命中营养库时用） ============
// type 荤/素/主食/汤 × cook 烹饪方式 → 一套基准营养（每份）
const AI_ESTIMATE_TEMPLATES = {
  '荤': {
    '清炒': { kcal: 280, protein: 18, fat: 16, carb: 14, sodium: 520 },
    '红烧': { kcal: 360, protein: 20, fat: 22, carb: 20, sodium: 760 },
    '油炸': { kcal: 400, protein: 18, fat: 28, carb: 18, sodium: 640 },
    '清蒸': { kcal: 240, protein: 22, fat: 10, carb: 6, sodium: 400 },
    '汤':   { kcal: 180, protein: 14, fat: 8, carb: 10, sodium: 460 },
    '凉拌': { kcal: 200, protein: 14, fat: 10, carb: 10, sodium: 420 },
  },
  '素': {
    '清炒': { kcal: 160, protein: 5, fat: 8, carb: 16, sodium: 380 },
    '红烧': { kcal: 220, protein: 7, fat: 12, carb: 20, sodium: 620 },
    '油炸': { kcal: 280, protein: 6, fat: 20, carb: 22, sodium: 720 },
    '清蒸': { kcal: 130, protein: 6, fat: 5, carb: 14, sodium: 300 },
    '汤':   { kcal: 120, protein: 6, fat: 4, carb: 12, sodium: 340 },
    '凉拌': { kcal: 110, protein: 4, fat: 5, carb: 10, sodium: 360 },
  },
  '主食': {
    '清炒': { kcal: 220, protein: 6, fat: 3, carb: 44, sodium: 60 },
    '红烧': { kcal: 240, protein: 7, fat: 4, carb: 44, sodium: 100 },
    '油炸': { kcal: 260, protein: 6, fat: 6, carb: 44, sodium: 80 },
    '清蒸': { kcal: 210, protein: 6, fat: 2, carb: 44, sodium: 50 },
    '汤':   { kcal: 200, protein: 6, fat: 2, carb: 40, sodium: 80 },
    '凉拌': { kcal: 190, protein: 5, fat: 2, carb: 38, sodium: 120 },
  },
  '汤': {
    '清炒': { kcal: 140, protein: 8, fat: 5, carb: 14, sodium: 380 },
    '红烧': { kcal: 180, protein: 10, fat: 8, carb: 16, sodium: 500 },
    '油炸': { kcal: 200, protein: 8, fat: 12, carb: 14, sodium: 480 },
    '清蒸': { kcal: 120, protein: 8, fat: 4, carb: 10, sodium: 320 },
    '汤':   { kcal: 140, protein: 8, fat: 5, carb: 12, sodium: 380 },
    '凉拌': { kcal: 120, protein: 6, fat: 4, carb: 12, sodium: 300 },
  },
};

// ============ 类型关键词（AI 估算时判断荤/素/主食） ============
const TYPE_KEYWORDS = {
  '荤': ['肉', '鸡', '鸭', '鱼', '虾', '牛', '羊', '猪', '排', '蛋', '肠', '丸', '蟹', '贝', '肝'],
  '素': ['菜', '豆', '瓜', '茄', '椒', '笋', '菇', '藕', '芹', '葱', '蒜', '萝', '苗', '花'],
  '主食': ['饭', '面', '粉', '粥', '馒头', '饼', '包', '饺', '米'],
};

// ============ 烹饪方式 → 营养修正系数（相对基准） ============
// 切换烹饪方式时对 AI 估算/库值按系数微调：油炸升油，清蒸降油盐
const COOK_ADJUST = {
  '清炒': { kcal: 1.0, fat: 1.0, sodium: 1.0 },
  '红烧': { kcal: 1.1, fat: 1.2, sodium: 1.3 },
  '油炸': { kcal: 1.2, fat: 1.5, sodium: 1.1 },
  '清蒸': { kcal: 0.9, fat: 0.7, sodium: 0.8 },
  '汤':   { kcal: 0.85, fat: 0.6, sodium: 0.9 },
  '凉拌': { kcal: 0.8, fat: 0.5, sodium: 0.9 },
};

// ============ 导出 ============
// 兼容浏览器（window）与 Node（module.exports）
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NutriData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    DAILY_TARGETS,
    NEED_STRATEGIES,
    ALLERGY_LABELS,
    DISHES,
    CONVENIENCE,
    STATUS_ADJUSTMENTS,
    PLAN_REFERENCE,
    ENCOURAGEMENTS,
    FOOD_DB,
    AI_ESTIMATE_TEMPLATES,
    TYPE_KEYWORDS,
    COOK_ADJUST,
  };
});
