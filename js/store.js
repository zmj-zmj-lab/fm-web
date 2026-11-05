/* 数据层：localStorage 持久化，接口对齐小程序的 utils/db.js */

const KEY = 'fm_web_v1'
const SEED_URL = './data/seed.json'

export const store = {
  state: null,
  _seed: null,
}

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function todayStr(d = new Date()) {
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

export function mealTypeNow(d = new Date()) {
  const h = d.getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'midnight'
}

export const MEAL_TEXT = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  midnight: '夜宵',
}

function blankState() {
  return {
    recipes: [],
    plans: [],
    wishes: [],
    shopping: [],
    fridge: [],
    profile: { id: 'me', name: '我' },
    family: {
      name: '我家',
      inviteCode: 'HOME01',
      ownerId: 'me',
      members: [
        {
          id: 'me',
          name: '我',
          role: '家里做饭的人',
          avatar: '',
          taste: { noSpicy: false, light: false, allergies: [], custom: [] },
        },
      ],
    },
  }
}

export async function init() {
  let seed = []
  try {
    const res = await fetch(SEED_URL, { cache: 'no-store' })
    seed = await res.json()
  } catch (e) {
    seed = []
  }
  store._seed = seed

  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch (e) {
    saved = null
  }

  if (saved && Array.isArray(saved.recipes) && saved.recipes.length) {
    store.state = Object.assign(blankState(), saved)
  } else {
    const s = blankState()
    s.recipes = seed.map((r) => Object.assign({}, r))
    store.state = s
    save()
  }

  if (!store.state.family) store.state.family = blankState().family
  if (!store.state.family.members || !store.state.family.members.length) {
    store.state.family.members = blankState().family.members
  }
  if (!store.state.profile) store.state.profile = { id: 'me', name: '我' }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store.state))
  } catch (e) {
    console.warn('保存失败', e)
  }
}

export function reset() {
  localStorage.removeItem(KEY)
  const s = blankState()
  s.recipes = (store._seed || []).map((r) => Object.assign({}, r))
  store.state = s
  save()
}

/* ------------------------------- 菜谱 ------------------------------- */

export function listRecipes(filter = {}) {
  let list = store.state.recipes.slice()
  if (filter.category) list = list.filter((r) => r.category === filter.category)
  if (filter.scope === 'hot') list = list.filter((r) => r.isSeed)
  if (filter.scope === 'cooked') list = list.filter((r) => (r.cookedCount || 0) > 0)
  if (filter.keyword) {
    const kw = filter.keyword.trim()
    list = list.filter((r) => (r.title + (r.tags || []).join('')).indexOf(kw) > -1)
  }
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export function getRecipe(id) {
  return store.state.recipes.find((r) => r.id === id) || null
}

export function saveRecipe(data) {
  const s = store.state
  if (data.id) {
    const idx = s.recipes.findIndex((r) => r.id === data.id)
    if (idx === -1) throw new Error('菜谱不存在')
    s.recipes[idx] = Object.assign({}, s.recipes[idx], data, { updatedAt: Date.now() })
    save()
    return s.recipes[idx]
  }
  const recipe = Object.assign(
    {
      id: uid('r'),
      title: '',
      category: '家常菜',
      tags: [],
      servings: 2,
      prepMin: 0,
      cookMin: 0,
      difficulty: 1,
      ingredients: [],
      steps: [],
      tips: '',
      notes: [],
      source: '原创',
      status: 'ready',
      cookedCount: 0,
      lastCookedAt: 0,
      rating: 0,
      isSeed: false,
      coverIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    data
  )
  s.recipes.unshift(recipe)
  save()
  return recipe
}

export function deleteRecipe(id) {
  const s = store.state
  s.recipes = s.recipes.filter((r) => r.id !== id)
  save()
}

export function markCooked(id) {
  const r = getRecipe(id)
  if (!r) return
  r.cookedCount = (r.cookedCount || 0) + 1
  r.lastCookedAt = Date.now()
  save()
}

/* ------------------------------- 菜单 ------------------------------- */

export function getPlans(date) {
  return store.state.plans
    .filter((p) => p.date === date)
    .map((p) =>
      Object.assign({}, p, {
        recipes: (p.recipeIds || []).map(getRecipe).filter(Boolean),
      })
    )
}

export function setPlan(date, mealType, recipeIds) {
  const s = store.state
  const idx = s.plans.findIndex((p) => p.date === date && p.mealType === mealType)
  if (idx > -1) s.plans[idx].recipeIds = recipeIds
  else s.plans.push({ id: uid('p'), date, mealType, recipeIds })
  save()
}

/* ------------------------------- 点菜 ------------------------------- */

export function listWishes() {
  return store.state.wishes.slice().sort((a, b) => b.createdAt - a.createdAt)
}

export function addWish(payload) {
  const wish = Object.assign(
    { id: uid('w'), status: 'pending', createdAt: Date.now(), byName: store.state.profile.name },
    payload
  )
  store.state.wishes.unshift(wish)
  save()
  return wish
}

export function resolveWish(id, status) {
  const w = store.state.wishes.find((x) => x.id === id)
  if (w) {
    w.status = status
    save()
  }
}

/* ------------------------------- 清单 ------------------------------- */

const CAT_ORDER = ['蔬菜', '肉禽蛋', '水产', '乳品', '主食', '调料', '水果', '其他']

export function guessCategory(name = '') {
  const rules = [
    [/鱼|虾|蟹|贝|紫菜|海带|虾皮/, '水产'],
    [/肉|鸡|鸭|翅|腿|排骨|牛|猪|羊|蛋|培根|火腿/, '肉禽蛋'],
    [/盐|糖|生抽|老抽|酱油|醋|料酒|蚝油|胡椒|淀粉|豆瓣酱|花椒|干辣椒|香油|油|酱|八角|孜然/, '调料'],
    [/米|面|粉丝|粉条|年糕|馒头|饺子皮|吐司|饼/, '主食'],
    [/牛奶|酸奶|奶油|芝士|黄油/, '乳品'],
    [/苹果|香蕉|橙|梨|葡萄|西瓜|草莓|柠檬|芒果/, '水果'],
    [/菜|葱|姜|蒜|番茄|土豆|青椒|茄子|黄瓜|萝卜|洋葱|蘑菇|菇|笋|豆|瓜|藕|芹|韭/, '蔬菜'],
  ]
  for (const [re, cat] of rules) if (re.test(name)) return cat
  return '其他'
}

export function listShopping() {
  return store.state.shopping.slice().sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1
    return CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)
  })
}

export function addShoppingItems(items) {
  const map = new Map()
  store.state.shopping.forEach((it) => map.set(it.name + '|' + (it.unit || ''), it))
  ;(items || []).forEach((it) => {
    const key = it.name + '|' + (it.unit || '')
    if (map.has(key)) {
      const cur = map.get(key)
      const a = parseFloat(cur.amount)
      const b = parseFloat(it.amount)
      if (!isNaN(a) && !isNaN(b)) cur.amount = String(a + b)
      cur.checked = false
    } else {
      const row = {
        id: uid('s'),
        name: it.name,
        amount: it.amount || '',
        unit: it.unit || '',
        category: it.category || guessCategory(it.name),
        checked: false,
        inFridge: false,
      }
      store.state.shopping.push(row)
      map.set(key, row)
    }
  })
  save()
  return listShopping()
}

export function toggleShoppingItem(id) {
  const it = store.state.shopping.find((x) => x.id === id)
  if (it) {
    it.checked = !it.checked
    save()
  }
  return listShopping()
}

export function removeShoppingItem(id) {
  store.state.shopping = store.state.shopping.filter((x) => x.id !== id)
  save()
  return listShopping()
}

export function clearShopping(onlyChecked) {
  store.state.shopping = onlyChecked
    ? store.state.shopping.filter((x) => !x.checked)
    : []
  save()
  return listShopping()
}

export function buildShoppingFromRecipes(recipeIds) {
  const items = []
  ;(recipeIds || []).forEach((id) => {
    const r = getRecipe(id)
    if (!r) return
    ;(r.ingredients || []).forEach((ing) => {
      items.push({ name: ing.name, amount: ing.amount, unit: ing.unit, category: guessCategory(ing.name) })
    })
  })
  addShoppingItems(items)

  const fridgeNames = store.state.fridge.map((f) => f.name).filter(Boolean)
  store.state.shopping.forEach((it) => {
    it.inFridge = fridgeNames.some(
      (n) => n === it.name || n.indexOf(it.name) > -1 || it.name.indexOf(n) > -1
    )
  })
  save()
  return listShopping()
}

/* ------------------------------- 冰箱 ------------------------------- */

export function listFridge() {
  return store.state.fridge.slice().sort((a, b) => (a.expireAt || Infinity) - (b.expireAt || Infinity))
}

export function addFridgeItem(item) {
  store.state.fridge.push({
    id: uid('g'),
    name: item.name,
    amount: item.amount || '',
    unit: item.unit || '',
    expireAt: item.expireAt || 0,
    category: guessCategory(item.name),
  })
  save()
  return listFridge()
}

export function removeFridgeItem(id) {
  store.state.fridge = store.state.fridge.filter((x) => x.id !== id)
  save()
  return listFridge()
}

/* ------------------------------- 家庭 ------------------------------- */

export function getFamily() {
  return store.state.family
}

export function updateMember(patch) {
  const fam = store.state.family
  const me = fam.members.find((m) => m.id === store.state.profile.id) || fam.members[0]
  if (!me) return fam
  if (patch.name != null) me.name = patch.name
  if (patch.avatar != null) me.avatar = patch.avatar
  if (patch.role != null) me.role = patch.role
  if (patch.taste) me.taste = Object.assign({ custom: [] }, me.taste, patch.taste)
  save()
  return fam
}

export function renameFamily(name) {
  store.state.family.name = name
  save()
  return store.state.family
}

export function saveProfile(patch) {
  store.state.profile = Object.assign({}, store.state.profile, patch)
  save()
}

export { todayStr, uid, CAT_ORDER }
