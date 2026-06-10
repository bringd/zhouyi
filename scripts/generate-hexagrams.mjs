// Generate src/data/hexagrams.json with the 64 King Wen-sequenced hexagrams.
// Only structural fields are filled here — content fields (judgement, tuanzhuan,
// xiangzhuan, yaoLines text, modernInterpretation) are placeholders to be
// filled by Tasks 13 and 14.
//
// Run from project root:
//   node scripts/generate-hexagrams.mjs
//
// The script computes binaryCode from upper/lower trigram IDs using the
// standard bottom-to-top encoding:
//   trigram 1 乾☰ = 111, 2 兑☱ = 110, 3 离☲ = 101, 4 震☳ = 100,
//   trigram 5 巽☴ = 011, 6 坎☵ = 010, 7 艮☶ = 001, 8 坤☷ = 000.
// Hexagram binaryCode = lowerTrigBinary + upperTrigBinary (6 chars).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.resolve(__dirname, '..', 'src', 'data', 'hexagrams.json')

// trigBinary[id] = 3-char string (bottom-to-top)
const trigBinary = {
  1: '111', // 乾
  2: '110', // 兑
  3: '101', // 离
  4: '100', // 震
  5: '011', // 巽
  6: '010', // 坎
  7: '001', // 艮
  8: '000', // 坤
}

// Yang/yin from trigram bottom-to-top binary string
function trigYaos(trigId) {
  const bits = trigBinary[trigId]
  // index 0 = bottom yao (position 1 within the trigram)
  return [bits[0], bits[1], bits[2]].map((b) => (b === '1' ? 'yang' : 'yin'))
}

// 64-hexagram master table.
// Columns: [id, name, shortName, upperTrigramId, lowerTrigramId, palace, palaceRole, themes[], keywords[]]
// palace and palaceRole follow the standard 京房八宫 (Jing Fang Eight Palaces) system.
const TABLE = [
  [1,  '乾为天',    '乾',   1, 1, 1, '本宫卦', ['人生总论'],                   ['创造', '刚健', '主动', '自强', '领导']],
  [2,  '坤为地',    '坤',   8, 8, 8, '本宫卦', ['人生总论'],                   ['包容', '柔顺', '承载', '厚德', '孕育']],
  [3,  '水雷屯',    '屯',   6, 4, 6, '二世',   ['困境抉择'],                   ['初创', '艰难', '萌动', '积蓄', '待时']],
  [4,  '山水蒙',    '蒙',   7, 6, 3, '四世',   ['成长修养', '困境抉择'],       ['启蒙', '蒙昧', '求教', '启发', '修学']],
  [5,  '水天需',    '需',   6, 1, 8, '游魂',   ['事业行动', '顺遂归藏'],       ['等待', '蓄养', '需求', '从容', '静候']],
  [6,  '天水讼',    '讼',   1, 6, 3, '游魂',   ['事业行动', '顺遂归藏'],       ['争讼', '冲突', '止争', '诉求', '退让']],
  [7,  '地水师',    '师',   8, 6, 6, '归魂',   ['事业行动', '顺遂归藏'],       ['统帅', '军旅', '纪律', '正义', '号令']],
  [8,  '水地比',    '比',   6, 8, 8, '归魂',   ['顺遂归藏'],                   ['亲比', '团结', '辅佐', '相亲', '依附']],
  [9,  '风天小畜',  '小畜', 5, 1, 5, '一世',   ['顺遂归藏'],                   ['小积', '蓄养', '柔止', '酝酿', '渐进']],
  [10, '天泽履',    '履',   1, 2, 7, '五世',   ['事业行动', '顺遂归藏'],       ['履行', '礼节', '谨慎', '前行', '虎尾']],
  [11, '地天泰',    '泰',   8, 1, 8, '三世',   ['人生总论', '顺遂归藏'],       ['通泰', '亨通', '交感', '和谐', '兴旺']],
  [12, '天地否',    '否',   1, 8, 1, '三世',   ['人生总论', '顺遂归藏'],       ['闭塞', '否运', '不通', '退守', '隐忍']],
  [13, '天火同人',  '同人', 1, 3, 3, '归魂',   ['事业行动', '顺遂归藏'],       ['同道', '合作', '光明', '亲和', '大同']],
  [14, '火天大有',  '大有', 3, 1, 1, '归魂',   ['事业行动', '顺遂归藏'],       ['大有', '丰盛', '柔得', '光明', '富裕']],
  [15, '地山谦',    '谦',   8, 7, 2, '五世',   ['人生总论', '事业行动', '顺遂归藏'], ['谦逊', '低调', '内敛', '让贤', '尊德']],
  [16, '雷地豫',    '豫',   4, 8, 4, '一世',   ['人生总论', '事业行动', '顺遂归藏'], ['和乐', '逸豫', '顺动', '欢愉', '备豫']],
  [17, '泽雷随',    '随',   2, 4, 4, '归魂',   ['人生总论', '事业行动', '顺遂归藏'], ['随顺', '跟随', '应时', '从容', '相随']],
  [18, '山风蛊',    '蛊',   7, 5, 5, '归魂',   ['人生总论', '成长修养', '顺遂归藏'], ['整治', '革弊', '匡正', '继志', '事业']],
  [19, '地泽临',    '临',   8, 2, 8, '二世',   ['事业行动', '成长修养'],       ['临近', '督导', '亲临', '关怀', '光大']],
  [20, '风地观',    '观',   5, 8, 1, '四世',   ['事业行动', '成长修养'],       ['观察', '示范', '观仰', '审思', '风行']],
  [21, '火雷噬嗑',  '噬嗑', 3, 4, 5, '五世',   ['成长修养', '困境抉择'],       ['咬合', '断决', '刑罚', '排除', '亨通']],
  [22, '山火贲',    '贲',   7, 3, 7, '一世',   ['成长修养'],                   ['文饰', '美化', '彬彬', '装点', '修文']],
  [23, '山地剥',    '剥',   7, 8, 1, '五世',   ['成长修养', '困境抉择'],       ['剥落', '消减', '阴长', '守正', '休止']],
  [24, '地雷复',    '复',   8, 4, 8, '一世',   ['成长修养', '顺遂归藏'],       ['回归', '复始', '一阳', '反复', '新生']],
  [25, '天雷无妄',  '无妄', 1, 4, 5, '四世',   ['成长修养'],                   ['无妄', '真诚', '不虚', '自然', '随顺']],
  [26, '山天大畜',  '大畜', 7, 1, 7, '二世',   ['事业行动', '成长修养'],       ['大蓄', '畜养', '止健', '积德', '弘业']],
  [27, '山雷颐',    '颐',   7, 4, 5, '游魂',   ['成长修养'],                   ['颐养', '饮食', '言语', '滋养', '慎言']],
  [28, '泽风大过',  '大过', 2, 5, 4, '游魂',   ['困境抉择', '成长修养'],       ['大过', '非常', '栋桡', '独立', '担当']],
  [29, '坎为水',    '坎',   6, 6, 6, '本宫卦', ['困境抉择'],                   ['重险', '陷阱', '诚信', '历险', '心亨']],
  [30, '离为火',    '离',   3, 3, 3, '本宫卦', ['人生总论', '关系情感'],       ['附丽', '光明', '文明', '依存', '相照']],
  [31, '泽山咸',    '咸',   2, 7, 2, '三世',   ['关系情感'],                   ['感应', '相感', '婚配', '虚心', '交感']],
  [32, '雷风恒',    '恒',   4, 5, 4, '三世',   ['关系情感'],                   ['恒久', '持守', '不变', '夫妇', '常道']],
  [33, '天山遁',    '遁',   1, 7, 1, '二世',   ['关系情感', '人生总论'],       ['退避', '遁世', '远小', '保身', '止息']],
  [34, '雷天大壮',  '大壮', 4, 1, 8, '四世',   ['关系情感', '事业行动'],       ['大壮', '强盛', '刚动', '守正', '勿亢']],
  [35, '火地晋',    '晋',   3, 8, 1, '游魂',   ['关系情感', '事业行动'],       ['晋升', '进取', '光明', '受赐', '荣显']],
  [36, '地火明夷',  '明夷', 8, 3, 6, '游魂',   ['关系情感', '困境抉择'],       ['晦藏', '伤明', '内文', '韬晦', '坚贞']],
  [37, '风火家人',  '家人', 5, 3, 5, '二世',   ['关系情感'],                   ['家庭', '齐家', '内外', '亲和', '伦理']],
  [38, '火泽睽',    '睽',   3, 2, 7, '四世',   ['关系情感', '困境抉择'],       ['乖违', '差异', '求同', '小事', '异中']],
  [39, '水山蹇',    '蹇',   6, 7, 2, '四世',   ['困境抉择'],                   ['艰难', '险阻', '止行', '反身', '济困']],
  [40, '雷水解',    '解',   4, 6, 4, '二世',   ['困境抉择', '顺遂归藏'],       ['解散', '舒解', '除难', '宽宥', '雷雨']],
  [41, '山泽损',    '损',   7, 2, 7, '三世',   ['成长修养'],                   ['损益', '减损', '惩忿', '修身', '简约']],
  [42, '风雷益',    '益',   5, 4, 5, '三世',   ['事业行动', '顺遂归藏'],       ['增益', '助益', '迁善', '改过', '利往']],
  [43, '泽天夬',    '夬',   2, 1, 8, '五世',   ['事业行动', '困境抉择'],       ['决断', '果决', '夬决', '刚决', '号令']],
  [44, '天风姤',    '姤',   1, 5, 1, '一世',   ['关系情感', '困境抉择'],       ['相遇', '邂逅', '柔遇', '勿娶', '不期']],
  [45, '泽地萃',    '萃',   2, 8, 2, '二世',   ['事业行动', '顺遂归藏'],       ['聚集', '荟萃', '亨聚', '献享', '王格']],
  [46, '地风升',    '升',   8, 5, 4, '四世',   ['事业行动', '顺遂归藏'],       ['上升', '升进', '柔升', '南征', '渐进']],
  [47, '泽水困',    '困',   2, 6, 2, '一世',   ['困境抉择'],                   ['困穷', '受困', '坚守', '尚口', '砺志']],
  [48, '水风井',    '井',   6, 5, 4, '五世',   ['困境抉择', '成长修养'],       ['井养', '汲水', '泽人', '改邑', '修井']],
  [49, '泽火革',    '革',   2, 3, 6, '四世',   ['困境抉择', '事业行动'],       ['变革', '革故', '改命', '时义', '虎变']],
  [50, '火风鼎',    '鼎',   3, 5, 3, '二世',   ['困境抉择', '事业行动'],       ['鼎新', '烹饪', '正位', '凝命', '崇贤']],
  [51, '震为雷',    '震',   4, 4, 4, '本宫卦', ['困境抉择'],                   ['震动', '惊雷', '警惕', '修省', '不丧']],
  [52, '艮为山',    '艮',   7, 7, 7, '本宫卦', ['困境抉择', '成长修养'],       ['止静', '艮止', '思安', '不获', '修身']],
  [53, '风山渐',    '渐',   5, 7, 7, '归魂',   ['关系情感', '顺遂归藏'],       ['渐进', '婚嫁', '循序', '居贤', '善俗']],
  [54, '雷泽归妹',  '归妹', 4, 2, 2, '归魂',   ['关系情感'],                   ['归妹', '婚嫁', '少女', '永终', '知敝']],
  [55, '雷火丰',    '丰',   4, 3, 6, '五世',   ['顺遂归藏'],                   ['丰大', '盛明', '日中', '亨通', '勿忧']],
  [56, '火山旅',    '旅',   3, 7, 3, '一世',   ['困境抉择', '顺遂归藏'],       ['旅行', '羁旅', '小亨', '慎刑', '寄居']],
  [57, '巽为风',    '巽',   5, 5, 5, '本宫卦', ['事业行动', '关系情感'],       ['随顺', '入伏', '申命', '行事', '柔顺']],
  [58, '兑为泽',    '兑',   2, 2, 2, '本宫卦', ['关系情感', '顺遂归藏'],       ['和悦', '愉悦', '朋讲', '说人', '利贞']],
  [59, '风水涣',    '涣',   5, 6, 3, '五世',   ['困境抉择', '成长修养'],       ['涣散', '离散', '涣群', '济涣', '王居']],
  [60, '水泽节',    '节',   6, 2, 6, '一世',   ['困境抉择', '成长修养'],       ['节制', '节度', '苦节', '安节', '甘节']],
  [61, '风泽中孚',  '中孚', 5, 2, 7, '游魂',   ['困境抉择', '成长修养'],       ['中孚', '诚信', '化邦', '议狱', '虚中']],
  [62, '雷山小过',  '小过', 4, 7, 2, '游魂',   ['困境抉择'],                   ['小过', '稍越', '宜下', '小事', '飞鸟']],
  [63, '水火既济',  '既济', 6, 3, 6, '三世',   ['困境抉择', '顺遂归藏'],       ['既济', '已成', '初吉', '终乱', '思患']],
  [64, '火水未济',  '未济', 3, 6, 3, '三世',   ['困境抉择', '成长修养'],       ['未济', '未成', '小狐', '濡尾', '慎进']],
]

// Sanity assertion: every Theme value used here must match the spec's union.
const VALID_THEMES = new Set([
  '人生总论', '事业行动', '关系情感', '成长修养', '困境抉择', '顺遂归藏',
])
const VALID_ROLES = new Set([
  '本宫卦', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂',
])

function buildHexagram(row) {
  const [
    id, name, shortName, upperTrigramId, lowerTrigramId,
    palace, palaceRole, themes, keywords,
  ] = row

  // Validate palette
  if (!VALID_ROLES.has(palaceRole)) {
    throw new Error(`Invalid palaceRole for #${id}: ${palaceRole}`)
  }
  for (const t of themes) {
    if (!VALID_THEMES.has(t)) {
      throw new Error(`Invalid theme for #${id}: ${t}`)
    }
  }
  if (themes.length < 1 || themes.length > 3) {
    throw new Error(`#${id} themes must be 1-3, got ${themes.length}`)
  }
  if (keywords.length < 4 || keywords.length > 6) {
    throw new Error(`#${id} keywords must be 4-6, got ${keywords.length}`)
  }

  // binaryCode = lowerTrigBinary + upperTrigBinary (bottom-to-top)
  const binaryCode = trigBinary[lowerTrigramId] + trigBinary[upperTrigramId]
  if (binaryCode.length !== 6) {
    throw new Error(`#${id} binaryCode length != 6`)
  }

  // yaoLines: 6 positions, type derived from binaryCode bottom-to-top
  const lowerYaos = trigYaos(lowerTrigramId)
  const upperYaos = trigYaos(upperTrigramId)
  const allYaos = [...lowerYaos, ...upperYaos] // index 0 = position 1 (bottom)
  const yaoLines = allYaos.map((type, i) => ({
    position: i + 1,
    type,
    originalText: '',
    explanation: '',
    modernMeaning: '',
  }))

  return {
    id,
    number: id,
    name,
    shortName,
    upperTrigramId,
    lowerTrigramId,
    binaryCode,
    palace,
    palaceRole,
    theme: themes,
    judgement: '',
    tuanzhuan: '',
    xiangzhuan: {
      daXiang: '',
      xiaoXiang: ['', '', '', '', '', ''],
    },
    yaoLines,
    keywords,
    modernInterpretation: '',
    relations: { opposite: 0, inverse: 0, nuclear: 0 },
  }
}

const hexagrams = TABLE.map(buildHexagram)

// Final sanity checks
if (hexagrams.length !== 64) {
  throw new Error(`Expected 64 hexagrams, got ${hexagrams.length}`)
}
const ids = hexagrams.map((h) => h.id)
const uniqueIds = new Set(ids)
if (uniqueIds.size !== 64) {
  throw new Error('Duplicate hexagram IDs detected')
}
for (let i = 0; i < 64; i++) {
  if (ids[i] !== i + 1) {
    throw new Error(`Hexagram at index ${i} has id ${ids[i]} (expected ${i + 1})`)
  }
}

// Verify each pure-trigram hexagram has the expected binaryCode
const pureExpected = {
  1: '111111',  // 乾
  2: '000000',  // 坤
  29: '010010', // 坎
  30: '101101', // 离
  51: '100100', // 震
  52: '001001', // 艮
  57: '011011', // 巽
  58: '110110', // 兑
}
for (const [id, expected] of Object.entries(pureExpected)) {
  const h = hexagrams[Number(id) - 1]
  if (h.binaryCode !== expected) {
    throw new Error(`#${id} (${h.shortName}) binaryCode = ${h.binaryCode}, expected ${expected}`)
  }
}

// Spot-check 屯 (#3): upper 坎 lower 震 → bottom=震(100), top=坎(010) → 100010
if (hexagrams[2].binaryCode !== '100010') {
  throw new Error(`#3 屯 binaryCode = ${hexagrams[2].binaryCode}, expected 100010`)
}

fs.writeFileSync(outPath, JSON.stringify(hexagrams, null, 2) + '\n', 'utf8')
console.log(`Wrote ${hexagrams.length} hexagrams to ${outPath}`)
console.log(`File size: ${fs.statSync(outPath).size} bytes`)
