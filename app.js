import * as db from './js/store.js'

const app = document.getElementById('app')
const toastEl = document.getElementById('toast')

const CATS = ['全部', '家常菜', '硬菜', '汤', '主食', '早餐', '夜宵', '凉菜', '甜品']
const CAT_CHAR = {
  家常菜: '家',
  硬菜: '硬',
  汤: '汤',
  主食: '饭',
  早餐: '早',
  夜宵: '夜',
  凉菜: '凉',
  甜品: '甜',
}

const ui = {
  keyword: '',
  category: '',
  scope: 'all',
  wheel: { slots: [], rotation: 0, spinning: false, result: null, spins: 0, filters: { fast: false, avoid: false, noSpicy: false } },
  cook: { id: '', index: 0, timerTotal: 0, timerLeft: 0, running: false, endAt: 0, tick: null, base: 0, doneness: 1 },
  edit: { id: '', ingredients: [], steps: [] },
}

let toastTimer = null
function toast(text) {
  toastEl.textContent = text
  toastEl.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600)
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const pad2 = (n) => (n < 10 ? '0' + n : '' + n)
const today = () => db.todayStr()
const meal = () => db.mealTypeNow()
const mealText = (m) => db.MEAL_TEXT[m] || '这一餐'

function minutesText(min) {
  if (!min) return '没写耗时'
  if (min < 60) return min + ' 分钟'
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时'
}

function totalMinutes(r) {
  return (r.prepMin || 0) + (r.cookMin || 0)
}

function prettyDate(d = new Date()) {
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + w
}

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '这么晚还没睡'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function relTime(ts) {
  if (!ts) return '还没做过'
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d === 0) return '今天做过'
  if (d === 1) return '昨天做过'
  if (d < 30) return d + ' 天前'
  return new Date(ts).toLocaleDateString('zh-CN')
}

function coverHtml(r, cls = 'thumb') {
  if (r.coverIndex) {
    return `<img class="${cls}" src="./assets/dish/dish-${pad2(r.coverIndex)}.jpg" data-char="${esc(CAT_CHAR[r.category] || '菜')}" onerror="window.__imgErr(this)" alt="">`
  }
  return `<div class="${cls === 'thumb' ? 'thumb-fallback' : cls + ' cover-fb'}">${esc(CAT_CHAR[r.category] || '菜')}</div>`
}

window.__imgErr = (el) => {
  const d = document.createElement('div')
  d.className = el.className.replace(/^/, '') + ' thumb-fallback'
  d.textContent = el.dataset.char || '菜'
  el.replaceWith(d)
}

/* ------------------------------ 路由 ------------------------------ */

const routes = [
  { re: /^#\/today$/, render: renderToday, tab: 'today' },
  { re: /^#\/recipes$/, render: renderRecipes, tab: 'recipes' },
  { re: /^#\/detail\/(.+)$/, render: renderDetail },
  { re: /^#\/edit\/(.*)$/, render: renderEdit },
  { re: /^#\/wheel$/, render: renderWheel },
  { re: /^#\/cooking\/(.+)$/, render: renderCooking },
  { re: /^#\/shopping$/, render: renderShopping, tab: 'shopping' },
  { re: /^#\/fridge$/, render: renderFridge },
  { re: /^#\/mine$/, render: renderMine, tab: 'mine' },
  { re: /^#\/family$/, render: renderFamily },
]

function navigate(hash) {
  location.hash = hash
}

let booted = false

function router() {
  if (!booted) return
  const hash = location.hash || '#/today'
  for (const r of routes) {
    const m = hash.match(r.re)
    if (m) {
      app.innerHTML = r.render(m.slice(1))
      if (r.tab) app.innerHTML += tabbar(r.tab)
      bind()
      window.scrollTo(0, 0)
      return
    }
  }
  navigate('#/today')
}

function tabbar(active) {
  const items = [
    ['today', '今天', '🍚'],
    ['recipes', '菜谱', '📖'],
    ['shopping', '清单', '🧺'],
    ['mine', '我的', '🙂'],
  ]
  return `<nav class="tabbar">${items
    .map(
      ([k, label, ico]) =>
        `<a href="#/${k}" class="${active === k ? 'on' : ''}"><span class="ico">${ico}</span>${label}</a>`
    )
    .join('')}</nav>`
}

/* ------------------------------ 今天 ------------------------------ */

function renderToday() {
  const date = today()
  const plans = db.getPlans(date).filter((p) => p.mealType === meal())
  const recipes = db.listRecipes()
  const wishes = db.listWishes().filter((w) => w.status === 'pending').slice(0, 3)
  const recent = recipes
    .filter((r) => r.lastCookedAt)
    .sort((a, b) => b.lastCookedAt - a.lastCookedAt)
    .slice(0, 6)

  return `
  <header class="topbar"><h1>我家菜谱本</h1><span class="sub">${esc(prettyDate())}</span></header>
  <section class="hero">
    <div class="hello">${esc(greeting())}</div>
  </section>

  <div class="main-card">
    <div class="ask">${esc(mealText(meal()))}吃啥？</div>
    <div class="hint">${recipes.length} 道菜在册，${plans.length ? '今天已排好' : '还没排菜单'}</div>
    <div class="main-actions">
      <button class="spin-btn" data-act="nav" data-to="#/wheel">转一转</button>
      <div>
        <div class="caption">不想等动画？</div>
        <a href="#/wheel" class="sec-more">直接挑一道 ›</a>
      </div>
    </div>
    ${
      plans.length
        ? `<div class="plan-list">${plans
            .map((p) => p.recipes.map((r) => `<a class="plan-chip" href="#/detail/${r.id}">${esc(r.title)}</a>`).join(''))
            .join('')}</div>`
        : ''
    }
  </div>

  ${
    wishes.length
      ? `<section class="page"><div class="sec-head"><span class="sec-title">家人点的菜</span></div>
        <div class="card">${wishes
          .map(
            (w) => `<div class="row">
              <div class="row-main"><div class="row-title">${esc(w.recipeTitle)}</div>
              <div class="row-meta">${esc(w.byName || '家人')} 想吃</div></div>
              <button class="btn btn-soft btn-sm" data-act="wish-accept" data-id="${w.id}" data-recipe="${w.recipeId}">加入今晚</button>
            </div>`
          )
          .join('')}</div></section>`
      : ''
  }

  ${
    recent.length
      ? `<section class="sec"><div class="sec-head" style="padding:0 16px"><span class="sec-title">最近做过</span><a class="sec-more" href="#/recipes">全部 ›</a></div>
        <div class="recent">${recent
          .map(
            (r) => `<a class="recent-card" href="#/detail/${r.id}">
              ${coverHtml(r, 'thumb')}
              <div class="name">${esc(r.title)}</div>
              <div class="caption">${esc(relTime(r.lastCookedAt))}</div>
            </a>`
          )
          .join('')}</div></section>`
      : `<section class="page"><div class="empty">
          <div class="art">🍽️</div>
          <div class="title">菜谱本刚开张</div>
          <div class="desc">先存两道拿手菜，转盘才转得起来。</div>
          <a class="btn btn-primary" href="#/edit/">去添一道</a>
        </div></section>`
  }
  `
}

/* ------------------------------ 菜谱 ------------------------------ */

function renderRecipes() {
  const list = db.listRecipes({ keyword: ui.keyword, category: ui.category, scope: ui.scope })
  return `
  <header class="topbar"><h1>菜谱</h1><span class="sub">${list.length} 道</span></header>

  <div class="page" style="padding-top:0">
    <input class="input" id="search" placeholder="搜菜名或标签" value="${esc(ui.keyword)}" />
  </div>

  <div class="chips" id="scopes">
    ${[
      ['all', '全部'],
      ['hot', '热门菜'],
      ['cooked', '我做过的'],
    ]
      .map(
        ([k, label]) =>
          `<button class="chip ${ui.scope === k ? 'on' : ''}" data-act="scope" data-k="${k}">${label}</button>`
      )
      .join('')}
  </div>

  <div class="chips" id="cats">
    ${CATS.map(
      (c) =>
        `<button class="chip ${ui.category === c || (c === '全部' && !ui.category) ? 'on' : ''}" data-act="cat" data-k="${c === '全部' ? '' : c}">${c}</button>`
    ).join('')}
  </div>

  <div class="page" style="padding-top:0">
    ${
      list.length
        ? `<div class="card">${list
            .map(
              (r) => `<a class="row" href="#/detail/${r.id}">
                ${coverHtml(r)}
                <div class="row-main">
                  <div class="row-title">${esc(r.title)}</div>
                  <div class="row-meta">${esc(minutesText(totalMinutes(r)))} · ${r.servings || 2} 人份${r.cookedCount ? ' · 做过 ' + r.cookedCount + ' 次' : ''}</div>
                </div>
                ${r.status === 'draft' ? '<span class="tag">草稿</span>' : ''}
              </a>`
            )
            .join('')}</div>`
        : `<div class="empty"><div class="art">🔍</div><div class="title">没找到这道菜</div><div class="desc">换个关键词，或者现在记一道。</div><a class="btn btn-primary" href="#/edit/">记一道</a></div>`
    }
  </div>

  <a class="fab" href="#/edit/" aria-label="新增">＋</a>
  `
}

/* ------------------------------ 详情 ------------------------------ */

function renderDetail(args) {
  const r = db.getRecipe(args[0])
  if (!r) {
    return `<header class="topbar"><a class="iconbtn" href="#/recipes">‹</a><h1>菜谱</h1></header>
      <div class="empty"><div class="art">🫥</div><div class="title">这道菜不见了</div><div class="desc">可能被删掉了。</div><a class="btn btn-line" href="#/recipes">回去翻翻</a></div>`
  }
  ui.detailServings = ui.detailServings || {}
  const servings = ui.detailServings[r.id] || r.servings || 2
  const scale = servings / (r.servings || 2)

  const groups = {}
  ;(r.ingredients || []).forEach((it) => {
    const g = it.group || '主料'
    ;(groups[g] = groups[g] || []).push(it)
  })

  const notes = (r.notes && r.notes.length ? r.notes : r.note ? [r.note] : []).filter(Boolean)

  return `
  <header class="topbar"><a class="iconbtn" href="#/recipes">‹</a><h1>${esc(r.title)}</h1><a class="iconbtn" href="#/edit/${r.id}">✎</a></header>
  ${r.coverIndex ? `<img class="cover" src="./assets/dish/dish-${pad2(r.coverIndex)}.jpg" alt="">` : `<div class="cover-fb">${esc(CAT_CHAR[r.category] || '菜')}</div>`}

  <div class="detail-sheet">
    <h2>${esc(r.title)}</h2>
    <div class="meta">
      <span>${esc(minutesText(totalMinutes(r)))}</span><span>·</span>
      <span>${servings} 人份</span><span>·</span>
      <span>${['简单', '中等', '有点难'][(r.difficulty || 1) - 1]}</span>
    </div>
    ${(r.tags || []).length ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
  </div>

  <section class="page">
    <div class="sec-head">
      <span class="sec-title">配料</span>
      <div class="stepper">
        <button data-act="minus" data-id="${r.id}">−</button>
        <span>${servings} 人份</span>
        <button data-act="plus" data-id="${r.id}">＋</button>
      </div>
    </div>
    <div class="card">
      ${
        Object.keys(groups).length
          ? Object.keys(groups)
              .map(
                (g) => `<div class="group-name">${esc(g)}</div>${groups[g]
                  .map((it) => {
                    const num = parseFloat(it.amount)
                    const amount = !isNaN(num) ? String(Math.round(num * scale * 10) / 10) : it.amount
                    return `<div class="ing"><span>${esc(it.name)}</span><span>${esc(amount || '')}${esc(it.unit || '')}</span></div>`
                  })
                  .join('')}`
              )
              .join('')
          : '<div class="caption">配料还没写，点右上角编辑补上。</div>'
      }
    </div>

    <div class="sec-head" style="margin-top:20px"><span class="sec-title">做法</span><span class="caption">${(r.steps || []).length} 步</span></div>
    <div class="card">
      ${
        (r.steps || []).length
          ? r.steps
              .map(
                (s, i) => `<div class="step">
                  <div class="step-no">${i + 1}</div>
                  <div class="step-text">${esc(s.text)}
                    ${s.seconds ? `<div class="step-min">${s.seconds < 60 ? s.seconds + ' 秒' : Math.round(s.seconds / 60) + ' 分钟'}</div>` : ''}
                  </div>
                </div>`
              )
              .join('')
          : '<div class="caption">做法还没写。</div>'
      }
    </div>

    ${r.tips ? `<div class="note-box"><div class="note-head">小贴士</div>${esc(r.tips)}</div>` : ''}

    <div class="note-box rose">
      <div class="note-head"><span>做过的经验</span><span class="note-add" data-act="note-add" data-id="${r.id}">+ 记一条</span></div>
      ${notes.length ? notes.map((n, i) => `<div class="note-row" data-act="note-del" data-id="${r.id}" data-i="${i}">· ${esc(n)}</div>`).join('') : '<div class="caption">还没有。做完一次，记一句「下次少放盐」这种。</div>'}
    </div>

    <div style="margin-top:20px">
      <a class="btn btn-soft" href="#/edit/${r.id}">编辑这道菜</a>
      <div style="height:10px"></div>
      <button class="btn btn-danger" data-act="del-recipe" data-id="${r.id}">删除这道菜</button>
    </div>
    <div style="height:80px"></div>
  </section>

  <div class="actionbar">
    <button class="btn btn-primary grow" data-act="cook" data-id="${r.id}">开始做饭</button>
    <button class="btn btn-line" data-act="add-shop" data-id="${r.id}">加清单</button>
    <button class="btn btn-line" data-act="wish" data-id="${r.id}">点菜</button>
  </div>
  `
}

/* ------------------------------ 转盘 ------------------------------ */

const WHEEL_COLORS = ['#E8673C', '#F6C9A8', '#E0A32E', '#F3E4D6']

function poolRecipes() {
  const f = ui.wheel.filters
  return db.listRecipes({}).filter((r) => {
    if (f.fast && totalMinutes(r) > 30) return false
    if (f.avoid && r.lastCookedAt && Date.now() - r.lastCookedAt < 7 * 86400000) return false
    if (f.noSpicy) {
      const hay = (r.tags || []).join('') + (r.ingredients || []).map((i) => i.name).join('')
      if (/辣|花椒|豆瓣酱|剁椒/.test(hay)) return false
    }
    return true
  })
}

function pickSlots(pool) {
  const arr = pool.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr.slice(0, 8)
}

function renderWheel() {
  const pool = poolRecipes()
  if (!ui.wheel.slots.length && pool.length) ui.wheel.slots = pickSlots(pool)
  const valid = ui.wheel.slots.filter((s) => pool.some((p) => p.id === s.id))
  if (valid.length !== ui.wheel.slots.length && pool.length) ui.wheel.slots = pickSlots(pool)

  const f = ui.wheel.filters
  return `
  <header class="topbar"><a class="iconbtn" href="#/today">‹</a><h1>${esc(mealText(meal()))}吃啥</h1><span class="sub">${pool.length} 道可选</span></header>

  <div class="chips">
    ${[
      ['fast', '≤30 分钟'],
      ['avoid', '避开最近 7 天'],
      ['noSpicy', '不吃辣'],
    ]
      .map(
        ([k, label]) => `<button class="chip ${f[k] ? 'on' : ''}" data-act="filter" data-k="${k}">${label}</button>`
      )
      .join('')}
  </div>

  ${
    pool.length
      ? `<div class="wheel-wrap">
          <div class="plate">
            <canvas id="wheel" width="600" height="600"></canvas>
            <div class="pointer"></div>
            <div class="hub">转</div>
          </div>
          <button class="btn btn-primary" style="width:200px" data-act="spin" ${ui.wheel.spinning ? 'disabled' : ''}>
            ${ui.wheel.spinning ? '转着呢…' : '开始转'}
          </button>
        </div>`
      : `<div class="empty"><div class="art">🥣</div><div class="title">筛得有点狠</div><div class="desc">松一松条件，菜就回来了。</div><button class="btn btn-line" data-act="reset-filter">清掉筛选</button></div>`
  }

  ${
    ui.wheel.result
      ? `<div class="result-card">
          <div class="kicker">${ui.wheel.spins >= 3 ? '最后一次机会' : '今天就吃'}</div>
          <div class="name">${esc(ui.wheel.result.title)}</div>
          <div class="caption">${esc(minutesText(totalMinutes(ui.wheel.result)))} · ${ui.wheel.result.servings || 2} 人份</div>
          <div class="result-actions">
            <button class="btn btn-primary" data-act="accept">就它了</button>
            <button class="btn btn-line" data-act="reroll">换一批</button>
          </div>
        </div>`
      : ''
  }
  `
}

function drawWheel(rotation) {
  const canvas = document.getElementById('wheel')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const size = 600
  const c = size / 2
  const R = c - 12
  const slots = ui.wheel.slots
  const n = Math.max(slots.length, 1)

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(c, c)
  ctx.rotate((rotation * Math.PI) / 180)

  for (let i = 0; i < n; i++) {
    const start = -Math.PI / 2 + (i * Math.PI * 2) / n
    const end = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / n
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, R, start, end)
    ctx.closePath()
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(255,249,244,.9)'
  ctx.lineWidth = 4
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / n
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R)
    ctx.stroke()
  }

  slots.forEach((s, i) => {
    const mid = -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / n
    ctx.save()
    ctx.rotate(mid)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#2B2320'
    let label = s.title || '一道菜'
    if (label.length > 6) label = label.slice(0, 5) + '…'
    ctx.font = '600 26px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(label, R - 30, 0)
    ctx.restore()
  })

  ctx.restore()
}

function spinWheel() {
  if (ui.wheel.spinning || !ui.wheel.slots.length) return
  const n = ui.wheel.slots.length
  const step = 360 / n
  const winner = Math.floor(Math.random() * n)
  const targetMod = ((360 - (winner + 0.5) * step) % 360 + 360) % 360
  const cur = ((ui.wheel.rotation % 360) + 360) % 360
  const delta = (targetMod - cur + 360) % 360
  const turns = 6
  const from = ui.wheel.rotation
  const total = turns * 360 + delta
  const dur = 3600
  const start = performance.now()
  ui.wheel.spinning = true
  const btn = document.querySelector('[data-act="spin"]')
  if (btn) btn.textContent = '转着呢…'

  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur)
    const eased = 1 - Math.pow(1 - p, 3)
    ui.wheel.rotation = from + total * eased
    drawWheel(ui.wheel.rotation)
    if (p < 1) {
      requestAnimationFrame(tick)
    } else {
      ui.wheel.spinning = false
      ui.wheel.result = ui.wheel.slots[winner]
      ui.wheel.spins += 1
      if (navigator.vibrate) navigator.vibrate(30)
      router()
      if (ui.wheel.spins >= 3) toast('要不今天点外卖？')
    }
  }
  requestAnimationFrame(tick)
}

/* ------------------------------ 烹饪 ------------------------------ */

function renderCooking(args) {
  const r = db.getRecipe(args[0])
  if (!r || !(r.steps || []).length) {
    return `<div class="cook-page"><div class="empty"><div class="art">📄</div><div class="title">这道菜还没写步骤</div><a class="btn btn-line" href="#/detail/${args[0]}">回去看看</a></div></div>`
  }
  if (ui.cook.id !== r.id) {
    ui.cook = { id: r.id, index: 0, timerTotal: 0, timerLeft: 0, running: false, endAt: 0, tick: null, base: 0, doneness: 1 }
  }
  const c = ui.cook
  const step = r.steps[c.index]
  const secs = step.seconds || (step.minutes || 0) * 60

  if (c.base !== secs) {
    c.base = secs
    c.timerTotal = secs
    c.timerLeft = secs
    c.running = false
    clearInterval(c.tick)
  }

  const mm = Math.floor(c.timerLeft / 60)
  const ss = c.timerLeft % 60
  const time = pad2(mm) + ':' + pad2(ss)
  const label = secs < 60 ? secs + ' 秒' : Math.round(secs / 60) + ' 分钟'

  return `
  <div class="cook-page">
    <div class="cook-top">
      <a class="iconbtn" href="#/detail/${r.id}">✕</a>
      <span>${c.index + 1} / ${r.steps.length}</span>
      <span class="caption">${esc(r.title)}</span>
    </div>

    <div class="cook-text">${esc(step.text)}</div>
    ${step.image ? `<img class="cook-img" src="${esc(step.image)}" alt="">` : ''}

    ${
      secs
        ? `<div class="timer-card">
            <div class="timer-num">${time}</div>
            <div class="caption">${c.running ? '还剩' : c.timerLeft === 0 ? '到点了' : '共 ' + label}</div>
            <div class="timer-row">
              ${[
                [0.85, '偏硬'],
                [1, '适中'],
                [1.2, '偏软'],
              ]
                .map(
                  ([f, t]) =>
                    `<button class="mini ${c.doneness === f ? 'on' : ''}" data-act="doneness" data-f="${f}">${t}</button>`
                )
                .join('')}
            </div>
            <div class="timer-row">
              <button class="mini" data-act="timer-add" data-d="-60">−1 分</button>
              <button class="mini" data-act="timer-add" data-d="-30">−30 秒</button>
              <button class="mini" data-act="timer-add" data-d="30">+30 秒</button>
              <button class="mini" data-act="timer-add" data-d="60">+1 分</button>
            </div>
            <div class="timer-row">
              <button class="btn btn-soft" style="flex:1" data-act="timer-toggle">${c.running ? '暂停' : c.timerLeft === 0 ? '再来一次' : '开始计时'}</button>
              <button class="btn btn-line" style="flex:0 0 96px" data-act="timer-reset">重置</button>
            </div>
          </div>`
        : ''
    }
  </div>

  <div class="cook-actions">
    <button class="btn btn-line" data-act="cook-prev">上一步</button>
    <button class="btn btn-primary" data-act="cook-next">${c.index === r.steps.length - 1 ? '完成' : '下一步'}</button>
  </div>
  `
}

function startTimer() {
  const c = ui.cook
  if (!c.timerTotal) return
  if (c.timerLeft <= 0) c.timerLeft = c.timerTotal
  c.endAt = Date.now() + c.timerLeft * 1000
  c.running = true
  clearInterval(c.tick)
  c.tick = setInterval(() => {
    c.timerLeft = Math.max(0, Math.round((c.endAt - Date.now()) / 1000))
    const el = document.querySelector('.timer-num')
    if (el) {
      el.textContent = pad2(Math.floor(c.timerLeft / 60)) + ':' + pad2(c.timerLeft % 60)
    }
    if (c.timerLeft <= 0) {
      clearInterval(c.tick)
      c.running = false
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      toast('到点了')
      router()
    }
  }, 500)
  router()
}

/* ------------------------------ 清单 ------------------------------ */

function renderShopping() {
  const list = db.listShopping()
  const groups = {}
  list.forEach((it) => {
    if (it.checked) return
    ;(groups[it.category] = groups[it.category] || []).push(it)
  })
  const checked = list.filter((it) => it.checked)
  const remaining = list.length - checked.length
  const pct = list.length ? Math.round((checked.length / list.length) * 100) : 0

  return `
  <header class="topbar"><h1>购物清单</h1><a class="sub" href="#/fridge">🧊 冰箱</a></header>

  <div class="page" style="padding-top:0">
    ${
      list.length
        ? `<div class="card">
            <div style="display:flex;justify-content:space-between"><b>还差 ${remaining} 样</b><span class="caption">已买 ${checked.length}/${list.length}</span></div>
            <div style="height:8px;border-radius:4px;background:#f3e9e1;margin:10px 0 12px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--brand)"></div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-soft btn-sm" data-act="gen-plan">从今日菜单生成</button>
              <button class="btn btn-line btn-sm" data-act="clear-checked">清除已购</button>
              <button class="btn btn-danger btn-sm" data-act="clear-all">一键清空</button>
            </div>
          </div>`
        : ''
    }

    ${
      Object.keys(groups).length
        ? Object.keys(groups)
            .map(
              (g) => `<div class="sec">
                <div class="sec-head"><span class="sec-title">${esc(g)}</span><span class="caption">${groups[g].length}</span></div>
                <div class="card">${groups[g]
                  .map(
                    (it) => `<div class="row" data-act="toggle-shop" data-id="${it.id}">
                      <div style="width:20px;height:20px;border:1.5px solid var(--line);border-radius:50%"></div>
                      <div class="row-main"><div class="row-title">${esc(it.name)}${it.inFridge ? ' <span class="tag">冰箱有</span>' : ''}</div></div>
                      <span class="caption">${esc((it.amount || '') + (it.unit || ''))}</span>
                    </div>`
                  )
                  .join('')}</div></div>`
            )
            .join('')
        : `<div class="empty"><div class="art">🧺</div><div class="title">清单空着</div><div class="desc">从今晚菜单生成，或者手动加两样。</div><button class="btn btn-primary" data-act="gen-plan">从菜单生成</button></div>`
    }

    ${
      checked.length
        ? `<div class="sec"><div class="sec-head"><span class="sec-title">已买 ${checked.length} 样</span></div>
          <div class="card" style="opacity:.6">${checked
            .map(
              (it) => `<div class="row" data-act="toggle-shop" data-id="${it.id}">
                <div style="width:20px;height:20px;border-radius:50%;background:var(--green-ink);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center">✓</div>
                <div class="row-main"><div class="row-title">${esc(it.name)}</div></div>
              </div>`
            )
            .join('')}</div></div>`
        : ''
    }

    <div class="sec">
      <div class="form-row">
        <input class="input" id="shop-name" placeholder="加一样…" />
        <button class="btn btn-primary btn-sm" data-act="add-shop-item">加上</button>
      </div>
    </div>
  </div>
  `
}

/* ------------------------------ 冰箱 ------------------------------ */

function renderFridge() {
  const list = db.listFridge()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const groups = { soon: [], week: [], later: [], never: [] }

  list.forEach((it) => {
    if (!it.expireAt) {
      groups.never.push(Object.assign({}, it, { label: '不过期', tone: 'muted' }))
      return
    }
    const days = Math.round((new Date(it.expireAt).setHours(0, 0, 0, 0) - todayStart.getTime()) / 86400000)
    const row = Object.assign({}, it)
    if (days < 0) {
      row.label = '已过期 ' + -days + ' 天'
      row.tone = 'danger'
      groups.soon.push(row)
    } else if (days === 0) {
      row.label = '今天到期'
      row.tone = 'danger'
      groups.soon.push(row)
    } else if (days <= 3) {
      row.label = '还有 ' + days + ' 天'
      row.tone = 'danger'
      groups.soon.push(row)
    } else if (days <= 7) {
      row.label = '还有 ' + days + ' 天'
      row.tone = 'gold'
      groups.week.push(row)
    } else {
      row.label = '还有 ' + days + ' 天'
      row.tone = 'green'
      groups.later.push(row)
    }
  })

  const soonCount = groups.soon.length
  const titles = { soon: '3 天内', week: '本周', later: '还早', never: '不过期' }

  return `
  <header class="topbar"><a class="iconbtn" href="#/shopping">‹</a><h1>冰箱</h1></header>
  <div class="page" style="padding-top:0">
    ${soonCount ? `<div class="note-box">临期 ${soonCount} 样，先吃它们</div>` : ''}

    ${Object.keys(titles)
      .filter((k) => groups[k].length)
      .map(
        (k) => `<div class="sec">
          <div class="sec-head"><span class="sec-title">${titles[k]}</span><span class="caption">${groups[k].length}</span></div>
          <div class="card">${groups[k]
            .map(
              (it) => `<div class="row">
                <div class="row-main">
                  <div class="row-title">${esc(it.name)}</div>
                  <div class="row-meta" style="color:${it.tone === 'danger' ? 'var(--danger)' : 'var(--ink-3)'}">${esc(it.label)}</div>
                </div>
                <span class="caption">${esc((it.amount || '') + (it.unit || ''))}</span>
                <button class="iconbtn" data-act="fridge-del" data-id="${it.id}">×</button>
              </div>`
            )
            .join('')}</div></div>`
      )
      .join('')}

    ${
      list.length
        ? ''
        : `<div class="empty"><div class="art">🧊</div><div class="title">冰箱空着</div><div class="desc">买了菜顺手记一下，临期会提醒你。</div></div>`
    }

    <div class="sec">
      <div class="card">
        <div class="field"><label>名称</label><input class="input" id="fridge-name" placeholder="比如 半盒牛奶" /></div>
        <div class="field"><label>数量</label><input class="input" id="fridge-amount" placeholder="2 盒（可不填）" /></div>
        <div class="field"><label>保质期</label><input class="input" id="fridge-date" type="date" /></div>
        <div style="height:12px"></div>
        <button class="btn btn-primary" data-act="fridge-add">放进去</button>
      </div>
    </div>
  </div>
  `
}

/* ------------------------------ 我的 ------------------------------ */

function renderMine() {
  const fam = db.getFamily()
  const me = fam.members[0] || {}
  const recipes = db.listRecipes()
  const cooked = recipes.reduce((s, r) => s + (r.cookedCount || 0), 0)
  const top = recipes.filter((r) => r.cookedCount).sort((a, b) => b.cookedCount - a.cookedCount)[0]
  const nick = db.store.state.profile.name || '我'

  return `
  <header class="topbar"><h1>我的</h1></header>
  <div class="page" style="padding-top:0">
    <div class="card" style="display:flex;gap:14px;align-items:center">
      <label class="avatar-btn">
        ${
          me.avatar
            ? `<img class="avatar-img" src="${esc(me.avatar)}" alt="">`
            : `<div class="avatar-char">${esc((nick || '我').slice(0, 1))}</div>`
        }
        <span class="avatar-badge">换</span>
        <input type="file" accept="image/*" id="avatar-input" class="hidden" />
      </label>
      <div style="flex:1">
        <div style="font-size:19px;font-weight:700">${esc(nick)}</div>
        <div class="caption">${esc(fam.name)} · ${esc(me.role || '家里做饭的人')}</div>
      </div>
      <button class="btn btn-line btn-sm" data-act="edit-nick">改名</button>
    </div>

    <a class="ticket" href="#/family" style="display:block">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${esc(fam.name)}</div>
          <div class="caption">${fam.members.length} 位家人</div>
        </div>
        <span class="caption">家庭空间 ›</span>
      </div>
    </a>

    <div class="card" style="margin-top:14px">
      <div class="stat-grid">
        <div class="stat"><b>${recipes.length}</b><span>菜谱</span></div>
        <div class="stat"><b>${cooked}</b><span>做过</span></div>
        <div class="stat"><b style="font-size:15px">${esc(top ? top.title : '还没有')}</b><span>最常做</span></div>
      </div>
    </div>

    <div class="card" style="margin-top:14px;padding:0 16px">
      <div class="row" data-act="about"><div class="row-main"><div class="row-title">关于</div></div><span class="caption">›</span></div>
      <div class="row" data-act="reset"><div class="row-main"><div class="row-title" style="color:var(--danger)">清空数据</div></div><span class="caption">›</span></div>
    </div>

    <div class="caption" style="text-align:center;margin-top:18px">Web 版 · 数据只存在这台设备的浏览器里</div>
  </div>
  `
}

/* ------------------------------ 家庭 ------------------------------ */

function renderFamily() {
  const fam = db.getFamily()
  const me = fam.members[0] || {}
  const taste = me.taste || {}
  return `
  <header class="topbar"><a class="iconbtn" href="#/mine">‹</a><h1>家庭空间</h1></header>
  <div class="page" style="padding-top:0">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:12px;color:var(--ink-3)">家庭名</div><div style="font-size:19px;font-weight:700">${esc(fam.name)}</div></div>
        <button class="btn btn-line btn-sm" data-act="rename-family">改</button>
      </div>
      <div class="note-box" style="margin-top:14px">
        邀请码 <b style="letter-spacing:3px;font-size:18px">${esc(fam.inviteCode)}</b>
        <div class="caption" style="margin-top:6px">Web 版暂不支持家人加入，小程序版可以用这个码。</div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-head"><span class="sec-title">成员</span><span class="caption">${fam.members.length} 人</span></div>
      <div class="card">${fam.members
        .map((m) => {
          const tags = []
          if (m.taste && m.taste.noSpicy) tags.push('不吃辣')
          if (m.taste && m.taste.light) tags.push('清淡')
          ;((m.taste && m.taste.allergies) || []).forEach((a) => tags.push(a + '过敏'))
          ;((m.taste && m.taste.custom) || []).forEach((c) => tags.push(c))
          return `<div class="row">
            <div class="avatar-char" style="width:40px;height:40px;font-size:16px">${esc((m.name || '家').slice(0, 1))}</div>
            <div class="row-main"><div class="row-title">${esc(m.name)} ${m.id === fam.ownerId ? '<span class="tag">创建者</span>' : ''}</div>
            <div class="row-meta">${esc(m.role || '')} ${tags.length ? '· ' + esc(tags.join('、')) : ''}</div></div>
          </div>`
        })
        .join('')}</div>
    </div>

    <div class="sec">
      <div class="sec-head"><span class="sec-title">我的口味</span></div>
      <div class="card">
        <div class="field"><label>我在家里的身份</label><input class="input" id="role" value="${esc(me.role || '')}" placeholder="掌勺的、干饭人…" /></div>
        <div class="field"><label>过敏原（逗号隔开）</label><input class="input" id="allergies" value="${esc(((taste.allergies) || []).join('、'))}" placeholder="花生、虾" /></div>
        <div class="field"><label>自定义标签（逗号隔开）</label><input class="input" id="custom" value="${esc(((taste.custom) || []).join('、'))}" placeholder="爱吃香菜、不要葱" /></div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="mini ${taste.noSpicy ? 'on' : ''}" data-act="taste-toggle" data-k="noSpicy">不吃辣</button>
          <button class="mini ${taste.light ? 'on' : ''}" data-act="taste-toggle" data-k="light">清淡</button>
        </div>
        <div style="height:14px"></div>
        <button class="btn btn-primary" data-act="save-taste">保存</button>
      </div>
    </div>
  </div>
  `
}

/* ------------------------------ 编辑 ------------------------------ */

function renderEdit(args) {
  const id = args[0] || ''
  const r = id ? db.getRecipe(id) : null
  if (ui.edit.id !== id) {
    ui.edit = {
      id,
      ingredients: (r && r.ingredients ? r.ingredients.map((x) => Object.assign({}, x)) : [{ group: '主料', name: '', amount: '', unit: '' }]),
      steps: (r && r.steps ? r.steps.map((x) => Object.assign({}, x)) : [{ text: '', seconds: '' }]),
    }
  }
  const c = ui.edit

  return `
  <header class="topbar"><a class="iconbtn" href="${id ? '#/detail/' + id : '#/recipes'}">‹</a><h1>${id ? '编辑菜谱' : '记一道菜'}</h1></header>
  <div class="page" style="padding-top:0">
    <div class="card">
      <div class="field"><label>菜名</label><input class="input" id="f-title" value="${esc(r ? r.title : '')}" placeholder="比如 番茄炒蛋" /></div>
      <div class="field"><label>分类</label>
        <select class="input" id="f-category">
          ${['家常菜', '硬菜', '汤', '主食', '早餐', '夜宵', '凉菜', '甜品']
            .map((x) => `<option value="${x}" ${r && r.category === x ? 'selected' : ''}>${x}</option>`)
            .join('')}
        </select>
      </div>
      <div class="form-row" style="margin-top:14px">
        <div style="flex:1"><label class="caption">备料（分钟）</label><input class="input" id="f-prep" type="number" value="${r ? r.prepMin || 0 : 0}" /></div>
        <div style="flex:1"><label class="caption">烹饪（分钟）</label><input class="input" id="f-cook" type="number" value="${r ? r.cookMin || 0 : 0}" /></div>
        <div style="flex:1"><label class="caption">几人份</label><input class="input" id="f-serv" type="number" value="${r ? r.servings || 2 : 2}" /></div>
      </div>
      <div class="field"><label>小贴士</label><textarea class="textarea" id="f-tips" placeholder="鸡蛋刚凝固就盛出">${esc(r ? r.tips : '')}</textarea></div>
    </div>

    <div class="sec-head" style="margin-top:20px"><span class="sec-title">配料</span><button class="sec-more" data-act="add-ing">+ 添加</button></div>
    <div class="card">
      ${c.ingredients
        .map(
          (it, i) => `<div class="form-row" style="margin-bottom:8px">
            <input class="input" data-ing="${i}" data-k="name" value="${esc(it.name)}" placeholder="名称" />
            <input class="input" style="max-width:80px" data-ing="${i}" data-k="amount" value="${esc(it.amount)}" placeholder="量" />
            <input class="input" style="max-width:70px" data-ing="${i}" data-k="unit" value="${esc(it.unit)}" placeholder="单位" />
            <button class="iconbtn" data-act="del-ing" data-i="${i}">×</button>
          </div>`
        )
        .join('')}
    </div>

    <div class="sec-head" style="margin-top:20px"><span class="sec-title">做法</span><button class="sec-more" data-act="add-step">+ 添加</button></div>
    <div class="card">
      ${c.steps
        .map(
          (s, i) => `<div style="margin-bottom:12px">
            <div class="form-row">
              <span class="step-no">${i + 1}</span>
              <input class="input" data-step="${i}" data-k="text" value="${esc(s.text)}" placeholder="这一步做什么" />
              <button class="iconbtn" data-act="del-step" data-i="${i}">×</button>
            </div>
            <div class="form-row" style="margin-top:6px">
              <input class="input" style="max-width:110px" type="number" data-step="${i}" data-k="seconds" value="${esc(s.seconds || '')}" placeholder="秒" />
              <span class="caption">秒（留空表示不用等）</span>
            </div>
          </div>`
        )
        .join('')}
    </div>

    <div style="height:16px"></div>
    <button class="btn btn-primary" data-act="save-recipe">${id ? '保存修改' : '存进菜谱本'}</button>
    <div style="height:40px"></div>
  </div>
  `
}

/* ------------------------------ 事件 ------------------------------ */

function bind() {
  const search = document.getElementById('search')
  if (search) {
    search.addEventListener('input', (e) => {
      ui.keyword = e.target.value
      clearTimeout(bind._t)
      bind._t = setTimeout(() => {
        const pos = e.target.selectionStart
        router()
        const el = document.getElementById('search')
        if (el) {
          el.focus()
          el.setSelectionRange(pos, pos)
        }
      }, 200)
    })
  }

  const avatar = document.getElementById('avatar-input')
  if (avatar) {
    avatar.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      const dataUrl = await shrinkImage(file, 200)
      db.updateMember({ avatar: dataUrl })
      toast('换好了')
      router()
    })
  }

  document.querySelectorAll('[data-ing]').forEach((el) => {
    el.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.ing)
      ui.edit.ingredients[i][e.target.dataset.k] = e.target.value
    })
  })
  document.querySelectorAll('[data-step]').forEach((el) => {
    el.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.step)
      ui.edit.steps[i][e.target.dataset.k] = e.target.value
    })
  })

  if (document.getElementById('wheel')) drawWheel(ui.wheel.rotation)
}

function shrinkImage(file, max) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => resolve(reader.result)
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

const actions = {
  nav: (el) => navigate(el.dataset.to),

  minus: (el) => {
    const r = db.getRecipe(el.dataset.id)
    const cur = ui.detailServings[r.id] || r.servings || 2
    ui.detailServings[r.id] = Math.max(1, cur - 1)
    router()
  },
  plus: (el) => {
    const r = db.getRecipe(el.dataset.id)
    const cur = ui.detailServings[r.id] || r.servings || 2
    ui.detailServings[r.id] = Math.min(12, cur + 1)
    router()
  },

  cook: (el) => navigate('#/cooking/' + el.dataset.id),
  'add-shop': (el) => {
    db.buildShoppingFromRecipes([el.dataset.id])
    toast('已加入清单')
  },
  wish: (el) => {
    const r = db.getRecipe(el.dataset.id)
    db.addWish({ recipeId: r.id, recipeTitle: r.title, date: today(), mealType: meal() })
    toast('已点菜')
  },
  'wish-accept': (el) => {
    const date = today()
    const plans = db.getPlans(date).find((p) => p.mealType === meal())
    const ids = plans ? plans.recipeIds.slice() : []
    if (ids.indexOf(el.dataset.recipe) === -1) ids.push(el.dataset.recipe)
    db.setPlan(date, meal(), ids)
    db.resolveWish(el.dataset.id, 'accepted')
    toast('排上了')
    router()
  },
  'del-recipe': (el) => {
    if (!confirm('删掉这道菜？删了找不回来')) return
    db.deleteRecipe(el.dataset.id)
    toast('删掉了')
    navigate('#/recipes')
  },

  'note-add': (el) => {
    const text = prompt('记一条心得')
    if (!text) return
    const r = db.getRecipe(el.dataset.id)
    const notes = (r.notes || []).concat(text.trim())
    db.saveRecipe({ id: r.id, notes })
    router()
  },
  'note-del': (el) => {
    const r = db.getRecipe(el.dataset.id)
    const i = Number(el.dataset.i)
    const notes = (r.notes || []).slice()
    notes.splice(i, 1)
    db.saveRecipe({ id: r.id, notes })
    router()
  },

  scope: (el) => {
    ui.scope = el.dataset.k
    router()
  },
  cat: (el) => {
    ui.category = el.dataset.k
    router()
  },

  filter: (el) => {
    ui.wheel.filters[el.dataset.k] = !ui.wheel.filters[el.dataset.k]
    ui.wheel.result = null
    ui.wheel.slots = []
    router()
  },
  'reset-filter': () => {
    ui.wheel.filters = { fast: false, avoid: false, noSpicy: false }
    ui.wheel.slots = []
    router()
  },
  spin: () => spinWheel(),
  accept: () => {
    const r = ui.wheel.result
    if (!r) return
    const date = today()
    const plans = db.getPlans(date).find((p) => p.mealType === meal())
    const ids = plans ? plans.recipeIds.slice() : []
    if (ids.indexOf(r.id) === -1) ids.push(r.id)
    db.setPlan(date, meal(), ids)
    toast('排上了')
    navigate('#/cooking/' + r.id)
  },
  reroll: () => {
    const pool = poolRecipes()
    ui.wheel.slots = pickSlots(pool)
    ui.wheel.result = null
    ui.wheel.rotation = 0
    router()
  },

  'cook-prev': () => {
    if (ui.cook.index > 0) {
      ui.cook.index -= 1
      router()
    }
  },
  'cook-next': () => {
    const r = db.getRecipe(ui.cook.id)
    if (ui.cook.index >= r.steps.length - 1) {
      db.markCooked(r.id)
      clearInterval(ui.cook.tick)
      toast('做完了，辛苦')
      navigate('#/detail/' + r.id)
      return
    }
    ui.cook.index += 1
    router()
  },
  'timer-toggle': () => {
    const c = ui.cook
    if (c.running) {
      c.timerLeft = Math.max(0, Math.round((c.endAt - Date.now()) / 1000))
      c.running = false
      clearInterval(c.tick)
      router()
    } else {
      startTimer()
    }
  },
  'timer-reset': () => {
    const c = ui.cook
    clearInterval(c.tick)
    c.running = false
    c.timerLeft = c.timerTotal
    router()
  },
  'timer-add': (el) => {
    const c = ui.cook
    if (c.running) {
      toast('先暂停再调')
      return
    }
    c.timerTotal = Math.max(5, c.timerTotal + Number(el.dataset.d))
    c.timerLeft = c.timerTotal
    router()
  },
  doneness: (el) => {
    const c = ui.cook
    if (c.running) {
      toast('先暂停再调')
      return
    }
    c.doneness = Number(el.dataset.f)
    c.timerTotal = Math.max(5, Math.round((c.base * c.doneness) / 5) * 5)
    c.timerLeft = c.timerTotal
    router()
  },

  'toggle-shop': (el) => {
    db.toggleShoppingItem(el.dataset.id)
    router()
  },
  'gen-plan': () => {
    const date = today()
    const plans = db.getPlans(date)
    const ids = []
    plans.forEach((p) => (p.recipeIds || []).forEach((id) => ids.push(id)))
    if (!ids.length) {
      toast('今天还没排菜单')
      return
    }
    db.buildShoppingFromRecipes(ids)
    toast('生成了 ' + ids.length + ' 道菜的清单')
    router()
  },
  'clear-checked': () => {
    db.clearShopping(true)
    router()
  },
  'clear-all': () => {
    if (!confirm('今天不买了？修仙去！！！')) return
    db.clearShopping(false)
    toast('清单清空了')
    router()
  },
  'add-shop-item': () => {
    const input = document.getElementById('shop-name')
    const name = (input.value || '').trim()
    if (!name) {
      toast('先写个名字')
      return
    }
    const m = name.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
    db.addShoppingItems([
      { name: name.replace(/^\d+(?:\.\d+)?\s*/, '') || name, amount: m ? m[1] : '', unit: m ? m[2] : '' },
    ])
    input.value = ''
    router()
  },

  'fridge-add': () => {
    const name = (document.getElementById('fridge-name').value || '').trim()
    if (!name) {
      toast('先写个名字')
      return
    }
    const amountRaw = (document.getElementById('fridge-amount').value || '').trim()
    const m = amountRaw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
    const dateVal = document.getElementById('fridge-date').value
    db.addFridgeItem({
      name,
      amount: m ? m[1] : amountRaw,
      unit: m ? m[2] : '',
      expireAt: dateVal ? new Date(dateVal + 'T00:00:00').getTime() : 0,
    })
    toast('记下了')
    router()
  },
  'fridge-del': (el) => {
    db.removeFridgeItem(el.dataset.id)
    router()
  },

  'edit-nick': () => {
    const name = prompt('改个称呼', db.store.state.profile.name)
    if (!name || !name.trim()) return
    db.saveProfile({ name: name.trim() })
    db.updateMember({ name: name.trim() })
    router()
  },
  about: () => {
    alert('我家菜谱本 · Web 版\n数据只存在这台设备的浏览器里。')
  },
  reset: () => {
    if (!confirm('清空所有数据？菜谱会恢复成初始 100 道。')) return
    db.reset()
    toast('已恢复')
    router()
  },

  'rename-family': () => {
    const name = prompt('家庭叫啥好', db.getFamily().name)
    if (!name || !name.trim()) return
    db.renameFamily(name.trim())
    router()
  },
  'taste-toggle': (el) => {
    const fam = db.getFamily()
    const me = fam.members[0]
    const patch = {}
    patch[el.dataset.k] = !(me.taste && me.taste[el.dataset.k])
    db.updateMember({ taste: patch })
    router()
  },
  'save-taste': () => {
    const role = document.getElementById('role').value
    const allergies = document
      .getElementById('allergies')
      .value.split(/[,，、;；\s]+/)
      .filter(Boolean)
    const custom = document
      .getElementById('custom')
      .value.split(/[,，、;；\s]+/)
      .filter(Boolean)
    db.updateMember({ role: role.trim() || '家里做饭的人', taste: { allergies, custom } })
    toast('存下了')
    router()
  },

  'add-ing': () => {
    ui.edit.ingredients.push({ group: '主料', name: '', amount: '', unit: '' })
    router()
  },
  'del-ing': (el) => {
    ui.edit.ingredients.splice(Number(el.dataset.i), 1)
    router()
  },
  'add-step': () => {
    ui.edit.steps.push({ text: '', seconds: '' })
    router()
  },
  'del-step': (el) => {
    ui.edit.steps.splice(Number(el.dataset.i), 1)
    router()
  },
  'save-recipe': () => {
    const title = (document.getElementById('f-title').value || '').trim()
    if (!title) {
      toast('先给这道菜起个名字')
      return
    }
    const payload = {
      title,
      category: document.getElementById('f-category').value,
      prepMin: Number(document.getElementById('f-prep').value) || 0,
      cookMin: Number(document.getElementById('f-cook').value) || 0,
      servings: Math.max(1, Number(document.getElementById('f-serv').value) || 2),
      tips: (document.getElementById('f-tips').value || '').trim(),
      ingredients: ui.edit.ingredients
        .filter((it) => (it.name || '').trim())
        .map((it) => ({ group: it.group || '主料', name: it.name.trim(), amount: it.amount || '', unit: it.unit || '' })),
      steps: ui.edit.steps
        .filter((s) => (s.text || '').trim())
        .map((s) => ({
          text: s.text.trim(),
          seconds: Number(s.seconds) || 0,
          minutes: Math.round((Number(s.seconds) || 0) / 60),
        })),
      status: 'ready',
    }
    if (ui.edit.id) payload.id = ui.edit.id
    const saved = db.saveRecipe(payload)
    toast('存好了')
    navigate('#/detail/' + saved.id)
  },
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act
  if (actions[act]) {
    if (el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault()
    actions[act](el)
  }
})

window.addEventListener('hashchange', router)

db.init().then(() => {
  booted = true
  if (!location.hash) location.hash = '#/today'
  router()
}).catch((e) => {
  document.getElementById('app').innerHTML =
    '<div class="empty" style="padding-top:120px"><div class="art">😵</div><div class="title">没加载出来</div><div class="desc">刷新一次试试。</div></div>'
  console.error(e)
})
