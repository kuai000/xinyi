// ============ 鑫意花样馒头 - 主应用逻辑 ============
let currentTab = 'dashboard';
let orderCurrentStatus = 'all';
let orderSearchKeyword = '';

// ============ 工具函数 ============
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function formatMoney(v) {
    const num = parseFloat(v) || 0;
    return num.toFixed(2);
}
function fmtDate(d) {
    if (!d) return '';
    return String(d).replace(/-/g, '/');
}
function copyText(text) {
    try {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        showToast('已复制');
    } catch (e) {
        showToast('复制失败');
    }
}

function showToast(msg, type) {
    const container = $('#toast-container');
    const t = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-gray-800';
    const div = document.createElement('div');
    div.className = `${t} text-white px-4 py-2 rounded-lg shadow-lg text-sm mb-2 animate-slide-up`;
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 1800);
}

function todayTitle() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const wk = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
    const wkCn = ['日','一','二','三','四','五','六'][d.getDay()];
    return { full: `${y}年${m}月${day}日 ${wk}`, cn: `${y}年${m}月${day}日 周${wkCn}`, shortMd: `${m}月${day}日`, weekCn: `周${wkCn}` };
}

// ============ 公历 → 农历 换算（1900-2100 查表算法） ============
(function () {
    // 每年一个整数，低 4 位=闰月月份(0=无闰)，其余 12/13 位每月大小(1=大30天，0=小29天)，高位=闰月大小
    const LUNAR_INFO = [
        0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
        0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
        0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
        0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
        0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
        0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
        0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
        0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
        0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
        0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
        0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
        0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
        0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
        0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
        0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
        0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
        0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
        0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
        0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
        0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
        0x0d520
    ];
    const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const ANIMALS = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const LUNAR_MONTHS = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
    const LUNAR_DAYS_1 = ['初','十','廿','卅'];
    const LUNAR_DAYS_2 = ['一','二','三','四','五','六','七','八','九','十'];

    function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
    function leapDays(y) { return leapMonth(y) ? (LUNAR_INFO[y - 1900] & 0x10000 ? 30 : 29) : 0; }
    function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
    function yearDays(y) {
        let sum = 348;
        for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
        return sum + leapDays(y);
    }
    function dayStr(d) {
        if (d === 10) return '初十';
        if (d === 20) return '二十';
        if (d === 30) return '三十';
        return LUNAR_DAYS_1[Math.floor(d / 10)] + LUNAR_DAYS_2[(d - 1) % 10];
    }

    /**
     * 公历 Date → 农历对象
     * 返回 { year, month, day, monthCn, dayCn, fullCn, ganzhi, animal }
     */
    window.getLunarDate = function (date) {
        const baseDate = new Date(1900, 0, 31); // 1900-01-31 = 农历 1900-01-01
        let offset = Math.floor((date - baseDate) / 86400000);
        if (offset < 0) return { monthCn: '正月', dayCn: '初一', fullCn: '正月初一' };

        let y = 1900;
        let temp = 0;
        for (; y < 2100 && offset > 0; y++) {
            temp = yearDays(y);
            offset -= temp;
        }
        if (offset < 0) { offset += temp; y--; }

        const leap = leapMonth(y);
        let isLeap = false;
        let m = 1;
        for (; m < 13 && offset > 0; m++) {
            if (leap > 0 && m === leap + 1 && !isLeap) {
                --m; isLeap = true; temp = leapDays(y);
            } else {
                temp = monthDays(y, m);
            }
            if (isLeap && m === leap + 1) isLeap = false;
            offset -= temp;
        }
        if (offset === 0 && leap > 0 && m === leap + 1) {
            if (isLeap) { isLeap = false; } else { isLeap = true; --m; }
        }
        if (offset < 0) { offset += temp; --m; }
        const d = offset + 1;

        const mCn = (isLeap ? '闰' : '') + LUNAR_MONTHS[m - 1] + '月';
        const dCn = dayStr(d);
        const gzIdx = (y - 1900 + 36) % 60;
        return {
            year: y, month: m, day: d, isLeap,
            monthCn: mCn, dayCn: dCn,
            fullCn: mCn + dCn,
            ganzhi: GAN[gzIdx % 10] + ZHI[gzIdx % 12],
            animal: ANIMALS[(y - 1900) % 12]
        };
    };
    /**
     * 简单取农历短字符串（七月初二 / 正月十五）
     */
    window.getLunarShort = function (date) {
        try { return getLunarDate(date).fullCn; } catch (e) { return ''; }
    };
})();

// ============ 状态优先级枚举 ============
const STATUS_MAP = {
    pending:   { text: '待制作',   cls: 'text-orange-500', bg: 'bg-orange-50 text-orange-600' },
    producing: { text: '制作中',   cls: 'text-blue-600',   bg: 'bg-blue-50 text-blue-600' },
    ready:     { text: '未取货',   cls: 'text-purple-600', bg: 'bg-purple-50 text-purple-600' },
    done:      { text: '已取货',   cls: 'text-green-600',  bg: 'bg-green-50 text-green-600' },
    cancelled: { text: '已取消',   cls: 'text-gray-500',   bg: 'bg-gray-100 text-gray-500' }
};
const PRIORITY_MAP = {
    urgent:   { text: '紧急', color: 'bg-rose-500',  ring: 'ring-rose-100' },
    priority: { text: '优先', color: 'bg-amber-500', ring: 'ring-amber-100' },
    normal:   { text: '普通', color: 'bg-slate-400', ring: 'ring-slate-100' }
};

// ============ 页面标题切换 ============
const TITLES = {
    dashboard: ['工作台', todayTitle().full],
    orders:    ['订单管理', todayTitle().cn],
    schedule:  ['排产计划', todayTitle().cn],
    products:  ['工时管理', todayTitle().cn],
    finance:   ['财务',     todayTitle().cn],
    settings:  ['设置',     todayTitle().cn]
};

function setHeader(tabKey) {
    const t = TITLES[tabKey];
    $('#page-title').textContent = t[0];
    $('#page-subtitle').textContent = t[1];
    $('#header-action').innerHTML = '';
}

// ============ Tab 切换 ============
function switchTab(tab) {
    currentTab = tab;
    $$('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    setHeader(tab);
    const map = {
        dashboard: renderDashboard,
        orders: renderOrders,
        schedule: renderSchedule,
        products: renderProducts,
        finance: renderFinance,
        settings: renderSettings
    };
    (map[tab] || renderDashboard)();
}

$$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ============ 1. 工作台 ============
function renderDashboard() {
    const s = Scheduler.getDashboardStats();
    const settings = Store.getSettings();

    $('#main-content').innerHTML = `
        <!-- 欢迎卡片 -->
        <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
            <div class="text-sm opacity-80 mb-1">你好，${settings.shopName || '老板'}</div>
            <div class="text-2xl font-bold">${todayTitle().shortMd} · ${todayTitle().weekCn}</div>
            <div class="grid grid-cols-3 gap-3 mt-5">
                <div class="bg-white/10 rounded-xl p-3 backdrop-blur">
                    <div class="text-xs opacity-80">待制作</div>
                    <div class="text-2xl font-bold mt-1">${s.pendingOrders}</div>
                </div>
                <div class="bg-white/10 rounded-xl p-3 backdrop-blur">
                    <div class="text-xs opacity-80">制作中</div>
                    <div class="text-2xl font-bold mt-1 text-amber-300">${s.producingOrders}</div>
                </div>
                <div class="bg-white/10 rounded-xl p-3 backdrop-blur">
                    <div class="text-xs opacity-80">今日交付</div>
                    <div class="text-2xl font-bold mt-1 text-emerald-300">${s.todayDelivery}</div>
                </div>
            </div>
            <div class="mt-5 pt-4 border-t border-white/10 flex justify-between items-center">
                <div>
                    <div class="text-xs opacity-80">今日预计产值</div>
                    <div class="text-xl font-bold mt-1">¥${formatMoney(s.todayOutput)}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs opacity-80">待完工时</div>
                    <div class="text-xl font-bold mt-1">${s.pendingWorkHours}h</div>
                </div>
            </div>
        </div>

        <!-- 快捷入口 -->
        <div class="grid grid-cols-4 gap-3">
            <button onclick="switchTab('orders')" class="bg-white rounded-xl p-3 shadow-sm flex flex-col items-center gap-1.5 hover:shadow-md transition">
                <div class="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-lg">📋</div>
                <div class="text-xs">订单管理</div>
            </button>
            <button onclick="switchTab('schedule')" class="bg-white rounded-xl p-3 shadow-sm flex flex-col items-center gap-1.5 hover:shadow-md transition">
                <div class="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-lg">🗓️</div>
                <div class="text-xs">排产计划</div>
            </button>
            <button onclick="switchTab('products')" class="bg-white rounded-xl p-3 shadow-sm flex flex-col items-center gap-1.5 hover:shadow-md transition">
                <div class="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-lg">⏰</div>
                <div class="text-xs">工时管理</div>
            </button>
            <button onclick="switchTab('finance')" class="bg-white rounded-xl p-3 shadow-sm flex flex-col items-center gap-1.5 hover:shadow-md transition">
                <div class="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-lg">💰</div>
                <div class="text-xs">财务统计</div>
            </button>
        </div>

        <!-- 今日排产（制作） -->
        <div id="today-schedule-wrap"></div>
    `;

    // 用排产模块取今日制作日的订单（优先读持久化排产）
    const savedMap = Store.getScheduleMap();
    const todayStr = Store.formatDate(new Date());
    const anySaved = Object.keys(savedMap).some(k => k >= todayStr);
    const sv = Scheduler.getScheduleOverview(1, anySaved);
    const todayDg = sv.dates[0];

    if (!todayDg || !todayDg.items.length) {
        const now = new Date();
        const lunarStr = getLunarShort(now);
        $('#today-schedule-wrap').innerHTML = `
        <div class="rounded-2xl overflow-hidden shadow-sm">
            <div class="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-4 py-3 flex items-center justify-between">
                <div>
                    <div class="text-[11px] opacity-70">排产日程表 · 制作日</div>
                    <div class="font-bold text-base mt-0.5">
                        <span class="inline-block mr-1.5 px-2 py-0.5 rounded-full bg-yellow-400/90 text-slate-900 text-[10px] font-bold align-middle" style="box-shadow:0 1px 3px rgba(0,0,0,.2)">今</span>
                        ${todayTitle().shortMd} · ${todayTitle().weekCn}
                    </div>
                    ${lunarStr ? `<div class="text-[11px] opacity-80 mt-0.5">农历 · ${lunarStr}</div>` : ''}
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold leading-none">${now.getDate()}</div>
                    <div class="text-[11px] opacity-80 mt-0.5">${todayTitle().shortMd.replace('月','')} · 总工时 0h</div>
                </div>
            </div>
            <div class="bg-slate-50/80 p-3">
                <div class="py-10 text-center text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">📭 今日暂无排产安排</div>
            </div>
        </div>`;
        return;
    }

    // 构造和排产页完全一致的日期块
    const headerBg = 'bg-gradient-to-r from-slate-800 to-slate-700';
    const todayTitle2 = todayTitle();
    const lunarStr = getLunarShort(new Date());
    const todayBadge = `<span class="inline-block mr-1.5 px-2 py-0.5 rounded-full bg-yellow-400/90 text-slate-900 text-[10px] font-bold align-middle" style="box-shadow:0 1px 3px rgba(0,0,0,.2)">今</span>`;
    const title = `${todayBadge}${todayDg.monthNum}月${todayDg.dayNum}日 · ${todayDg.weekday}`;
    const titleLunar = lunarStr ? `<div class="text-[11px] opacity-80 mt-0.5">农历 · ${lunarStr}</div>` : '';

    const cardHtml = todayDg.items.map(it => {
        const st = STATUS_MAP[it.status] || STATUS_MAP.pending;
        const pri = PRIORITY_MAP[it.priority] || PRIORITY_MAP.normal;
        const itemsList = (it.items || []).map(x => {
            const p = Store.getProductById(x.productId);
            return `<li>${p ? p.name : (x.name || '产品')} × ${x.qty}</li>`;
        }).join('');
        let actionBtn = '';
        if (it.status === 'pending') {
            actionBtn = `<button onclick="startProduce(${it.orderId})" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-blue-600 font-medium">📝 开始制作</button>`;
        } else if (it.status === 'producing') {
            actionBtn = `<button onclick="completeProduce(${it.orderId})" class="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-purple-600 font-medium">✅ 制作完成</button>`;
        } else if (it.status === 'ready') {
            actionBtn = `<button onclick="pickupOrder(${it.orderId})" class="px-4 py-2 bg-green-500 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-green-600 font-medium">📦 确认取货</button>`;
        } else {
            actionBtn = `<button onclick="openOrderModal(${it.orderId})" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">查看</button>`;
        }
        return `
        <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                    <span class="${pri.color} text-white text-[10px] px-2 py-0.5 rounded-full shrink-0">${pri.text}</span>
                    <div class="font-semibold text-gray-800 text-sm truncate">${it.customer}</div>
                </div>
                <div class="text-right shrink-0 ml-2">
                    <div class="text-xs text-gray-400">需工时</div>
                    <div class="text-sm font-bold text-blue-600">${it.hours}h</div>
                </div>
            </div>
            ${itemsList ? `<ul class="dot-list mt-2">${itemsList}</ul>` : ''}
            <div class="mt-2.5 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between text-[11px]">
                <span class="text-gray-500">📦 交付日：${fmtDate(it.deliveryDate)}</span>
                <span class="${st.bg} px-2 py-0.5 rounded-md">${st.text}</span>
            </div>
            <div class="mt-3 flex justify-end">
                ${actionBtn}
            </div>
        </div>`;
    }).join('');

    $('#today-schedule-wrap').innerHTML = `
    <div class="rounded-2xl overflow-hidden shadow-sm">
        <div class="${headerBg} text-white px-4 py-3 flex items-center justify-between">
            <div>
                <div class="text-[11px] opacity-70">排产日程表 · 制作日</div>
                <div class="font-bold text-base mt-0.5">${title}</div>
                ${titleLunar}
            </div>
            <div class="text-right">
                <div class="text-2xl font-bold leading-none">${todayDg.dayNum}</div>
                <div class="text-[11px] opacity-80 mt-0.5">${todayDg.monthNum}月 · 总工时 ${todayDg.totalHours}h</div>
            </div>
        </div>
        <div class="bg-slate-50/80 p-3 space-y-2.5">
            ${cardHtml}
        </div>
    </div>`;
}

// ============ 2. 订单管理 ============
function renderOrders() {
    // 头部：右侧搜索栏
    $('#header-action').innerHTML = `
        <div class="relative w-full max-w-xs">
            <input type="text" id="order-search-input" placeholder="搜索客户姓名/电话..."
                value="${orderSearchKeyword}"
                class="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-700/60 border border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent">
            <span class="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
        </div>
    `;
    setTimeout(() => {
        const el = $('#order-search-input');
        if (el) el.addEventListener('input', e => {
            orderSearchKeyword = e.target.value;
            renderOrderList();
        });
    }, 0);

    const orders = Store.getOrders();
    const counts = {
        all: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        producing: orders.filter(o => o.status === 'producing').length,
        ready: orders.filter(o => o.status === 'ready').length,
        done: orders.filter(o => o.status === 'done').length
    };

    const tabs = [
        { k: 'all',       name: '全部' },
        { k: 'pending',   name: '待制作' },
        { k: 'producing', name: '制作中' },
        { k: 'ready',     name: '未取货' },
        { k: 'done',      name: '已取货' }
    ];

    $('#main-content').innerHTML = `
        <!-- 状态筛选Tab -->
        <div class="flex bg-slate-100 rounded-xl p-1 gap-1 overflow-x-auto">
            ${tabs.map(t => `
                <button data-ost="${t.k}" class="order-tab flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-sm transition
                    ${orderCurrentStatus === t.k ? 'bg-slate-900 text-white font-semibold shadow' : 'text-gray-600 hover:bg-slate-200'}">
                    ${t.name}
                    <span class="ml-1 text-[11px] ${orderCurrentStatus === t.k ? 'text-slate-300' : 'text-gray-400'}">${counts[t.k] || 0}</span>
                </button>
            `).join('')}
        </div>

        <!-- 浮动添加按钮 -->
        <button id="fab-add-order" class="fixed right-5 bottom-24 z-40 bg-rose-500 text-white px-4 py-2.5 rounded-full shadow-xl flex items-center gap-1.5 text-sm font-semibold hover:bg-rose-600 active:scale-95 transition">
            <span>＋</span>新增订单
        </button>

        <!-- 订单列表 -->
        <div id="order-list" class="space-y-3"></div>
    `;

    $$('.order-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            orderCurrentStatus = btn.dataset.ost;
            renderOrders();
        });
    });
    $('#fab-add-order').addEventListener('click', () => openOrderModal());

    renderOrderList();
}

function renderOrderList() {
    let orders = Store.getOrders();
    // 状态筛选
    if (orderCurrentStatus !== 'all') orders = orders.filter(o => o.status === orderCurrentStatus);
    // 搜索
    const kw = (orderSearchKeyword || '').trim().toLowerCase();
    if (kw) {
        orders = orders.filter(o =>
            (o.customer || '').toLowerCase().includes(kw) ||
            (o.phone || '').toLowerCase().includes(kw)
        );
    }
    // 排序：制作流程从前往后：待制作=0，制作中=0，未取货=1，已取货/取消=2；同组按交付日升序
    const statusRank = { pending: 0, producing: 0, ready: 1, done: 2, cancelled: 2 };
    orders.sort((a, b) => {
        const r = statusRank[a.status] - statusRank[b.status];
        if (r !== 0) return r;
        return (a.deliveryDate || '').localeCompare(b.deliveryDate || '');
    });

    const box = $('#order-list');
    if (!orders.length) {
        box.innerHTML = `<div class="py-16 text-center text-gray-400">
            <div class="text-5xl mb-3">📭</div>
            <div class="text-sm">${kw ? '没有匹配的客户订单' : '暂无订单'}</div>
            ${kw ? `<div class="text-xs mt-1 text-gray-400">关键词：${orderSearchKeyword}</div>` : ''}
        </div>`;
        return;
    }

    box.innerHTML = orders.map(o => {
        const st = STATUS_MAP[o.status] || STATUS_MAP.pending;
        const pri = PRIORITY_MAP[o.priority] || PRIORITY_MAP.normal;
        const amount = Scheduler.calcOrderAmount(o);

        // 产品列表
        const itemsHtml = o.items.map(it => {
            const p = Store.getProductById(it.productId);
            const name = p ? p.name : (it.name || '未知产品');
            return `<li>${name} × ${it.qty}</li>`;
        }).join('');

        // 底部操作按钮：根据状态变化
        let actionBtn = '';
        if (o.status === 'pending') {
            actionBtn = `<button onclick="startProduce(${o.id})" class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-blue-600">📝 开始制作</button>`;
        } else if (o.status === 'producing') {
            actionBtn = `<button onclick="completeProduce(${o.id})" class="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-purple-600">✅ 制作完成</button>`;
        } else if (o.status === 'ready') {
            actionBtn = `<button onclick="pickupOrder(${o.id})" class="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-green-600">📦 确认取货</button>`;
        } else {
            actionBtn = `<button onclick="openOrderModal(${o.id})" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200">查看</button>`;
        }

        return `
        <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <!-- 卡片顶部：客户/金额 -->
            <div class="p-4 pb-0">
                <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-gray-800 text-base">${o.customer}</div>
                        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span class="${pri.color} text-white text-[11px] px-2 py-0.5 rounded-full ring-2 ${pri.ring}">${pri.text}</span>
                            <span class="text-xs text-gray-500">📦 ${fmtDate(o.deliveryDate)} 交付</span>
                            <span class="text-xs ${st.bg} px-2 py-0.5 rounded-md">${st.text}</span>
                        </div>
                    </div>
                    <div class="text-right ml-3 shrink-0">
                        <div class="text-lg font-bold text-rose-500">¥${formatMoney(amount)}</div>
                        <div class="text-xs mt-1 flex items-center gap-0.5 justify-end ${o.paid ? 'text-green-600' : 'text-red-500'}">
                            ${o.paid ? '✅ 已收款' : '⚠️ 待收款'}
                        </div>
                    </div>
                </div>
            </div>
            <!-- 产品列表 -->
            <div class="px-4 pt-3 pb-2">
                <ul class="dot-list">${itemsHtml || '<li class="text-gray-400">（无产品）</li>'}</ul>
                ${o.remark ? `<div class="mt-2 text-xs text-gray-500 bg-gray-50 rounded-md px-2 py-1.5">📝 ${o.remark}</div>` : ''}
            </div>
            <!-- 底部操作 -->
            <div class="mt-1 border-t border-gray-100 bg-gray-50/50 px-3 py-2 flex items-center justify-between">
                <button onclick="copyText('${o.phone || ''}')" class="text-xs text-gray-600 flex items-center gap-1 px-2 py-1 hover:bg-white rounded-md transition">
                    📞 ${o.phone || '-'} <span class="text-slate-400">复制</span>
                </button>
                <div class="flex items-center gap-2">
                    <button onclick="openOrderModal(${o.id})" class="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">编辑</button>
                    ${actionBtn}
                </div>
            </div>
        </div>`;
    }).join('');
}

function startProduce(id) {
    const o = Store.getOrderById(id); if (!o) return;
    o.status = 'producing';
    Store.updateOrder(o);
    refreshCurrentTab();
    showToast('已开始制作', 'success');
}
function completeProduce(id) {
    const o = Store.getOrderById(id); if (!o) return;
    o.status = 'ready';   // 制作完成，等待取货
    Store.updateOrder(o);
    refreshCurrentTab();
    showToast('制作完成，待客户取货 ✓', 'success');
}
function pickupOrder(id) {
    const o = Store.getOrderById(id); if (!o) return;
    o.status = 'done';    // 已取货，最终完成
    Store.updateOrder(o);
    refreshCurrentTab();
    showToast('已确认取货，订单完成 🎉', 'success');
}
// 刷新当前 Tab 的渲染（工作台/订单/排产都调用自己的 render）
function refreshCurrentTab() {
    const map = {
        dashboard: renderDashboard,
        orders: renderOrderList,
        schedule: renderSchedule,
        products: renderProducts,
        finance: renderFinance,
        settings: renderSettings
    };
    const fn = map[currentTab];
    if (typeof fn === 'function') fn();
}

// ============ 3. 工时管理 ============
function renderProducts() {
    // 头部右侧：红色新增按钮
    $('#header-action').innerHTML = `
        <button id="btn-add-product" class="bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm">
            <span class="text-lg leading-none">+</span>
            <span>新增</span>
        </button>
    `;
    setTimeout(() => $('#btn-add-product').addEventListener('click', () => openProductModal()), 0);

    // 按分类分组
    const groups = {};
    Store.getProducts().forEach(p => {
        const cat = p.category || '其他';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
    });
    const groupKeys = Object.keys(groups);

    $('#main-content').innerHTML = `
        <!-- 顶部提示条 -->
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
            <span class="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</span>
            <div class="text-sm text-amber-800 leading-relaxed">
                工时和单价修改后将立即影响后续订单，<b>请谨慎修改</b>。修改前建议先导出数据备份。
            </div>
        </div>

        <div id="product-groups" class="space-y-4"></div>
    `;

    if (!groupKeys.length) {
        $('#product-groups').innerHTML = `<div class="py-16 text-center text-gray-400 bg-white rounded-2xl shadow-sm">
            <div class="text-5xl mb-3">📦</div>
            <div class="text-sm">暂无产品，点击右上角"+新增"添加第一个产品</div>
        </div>`;
        return;
    }

    $('#product-groups').innerHTML = groupKeys.map(cat => {
        const prods = groups[cat];
        return `
        <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <!-- 分类标题 -->
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-slate-50/60">
                <div class="font-semibold text-gray-800 text-sm">${cat}</div>
                <div class="text-xs text-gray-500 bg-white px-2.5 py-1 rounded-full border border-gray-200">${prods.length}个</div>
            </div>
            <!-- 产品列表 -->
            <div class="divide-y divide-gray-50">
                ${prods.map(p => renderProductItem(p)).join('')}
            </div>
        </div>`;
    }).join('');
}

function renderProductItem(p) {
    // 先兜底，保证不会因 p.price 问题报错（之前"新增产品"无响应的根因）
    const price = p && p.price != null ? parseFloat(p.price) || 0 : 0;
    const wh = p && p.workHours != null ? parseFloat(p.workHours) || 0 : 0;
    const priceStr = price ? `¥${price.toFixed(price % 1 === 0 ? 0 : 2)}` : '¥0.00';
    const whStr = wh ? (wh % 1 === 0 ? `${wh}工时/个` : `${wh.toFixed(1)}工时/个`) : '0工时/个';

    return `
    <div class="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition">
        <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center shrink-0 text-lg">🥟</div>
            <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <div class="font-medium text-gray-800 text-sm truncate">${p.name}</div>
                    ${p.isDefault ? '<span class="tag-purple">默认产品</span>' : ''}
                </div>
                <div class="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                    <span class="text-rose-500 font-medium">${priceStr}</span>
                    <span class="text-sky-600 font-medium">${whStr}</span>
                </div>
            </div>
        </div>
        <div class="flex items-center gap-1 shrink-0 ml-2">
            <button onclick="openProductModal(${p.id})" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-slate-700 hover:bg-gray-100 rounded-lg transition">✏️</button>
            <button onclick="deleteProduct(${p.id})" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">🗑️</button>
        </div>
    </div>`;
}

function deleteProduct(id) {
    if (!confirm('确定删除该产品吗？此操作不可恢复。')) return;
    try {
        Store.deleteProduct(id);
        showToast('已删除', 'success');
        renderProducts();
    } catch (e) {
        showToast('删除失败：' + e.message, 'error');
    }
}

// ============ 4. 设置页 ============
function renderSettings() {
    const s = Store.getSettings();

    $('#main-content').innerHTML = `
        <!-- 店铺卡片 -->
        <div class="bg-gradient-to-br from-rose-500 via-rose-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
            <div class="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full"></div>
            <div class="absolute -right-5 bottom-0 w-24 h-24 bg-white/5 rounded-full"></div>
            <div class="relative flex items-center gap-4">
                <div class="w-16 h-16 rounded-2xl bg-white text-rose-500 flex items-center justify-center text-2xl font-bold shadow-xl">鑫</div>
                <div class="flex-1">
                    <div class="font-bold text-xl">${s.shopName || '鑫意花样馒头'}</div>
                    <div class="text-sm text-white/80 mt-1 line-clamp-2">${s.shopDesc || '专业花样馒头、喜饽饽定制 · 用心做好每一单'}</div>
                </div>
                <button onclick="alert('修改店铺资料（示例，可在下方「基础信息」字段编辑）')" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs backdrop-blur">修改</button>
            </div>
        </div>

        <!-- 基础信息 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3.5">
            <div class="text-sm font-bold text-gray-800 mb-1">📋 基础信息</div>

            <div class="grid grid-cols-2 gap-3">
                <label class="block">
                    <div class="text-xs text-gray-500 mb-1.5">店铺名称</div>
                    <input id="s-shopName" value="${s.shopName || ''}" class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                </label>
                <label class="block">
                    <div class="text-xs text-gray-500 mb-1.5">店主 / 联系人</div>
                    <input id="s-owner" value="${s.owner || ''}" class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                </label>
            </div>

            <label class="block">
                <div class="text-xs text-gray-500 mb-1.5">店铺简介</div>
                <textarea id="s-shopDesc" rows="2" class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none">${s.shopDesc || ''}</textarea>
            </label>

            <div class="grid grid-cols-3 gap-3">
                <label class="block">
                    <div class="text-xs text-gray-500 mb-1.5">每日工作时长(h)</div>
                    <input id="s-workHoursPerDay" type="number" step="0.5" value="${s.workHoursPerDay}" class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                </label>
                <label class="block">
                    <div class="text-xs text-gray-500 mb-1.5">工人数量(人)</div>
                    <input id="s-workers" type="number" step="1" value="${s.workers}" class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                </label>
                <label class="block">
                    <div class="text-xs text-gray-500 mb-1.5">每日产能(h)</div>
                    <input id="s-dailyCapacity" type="number" step="0.1" value="${s.dailyCapacity}" class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-gray-500" readonly title="工作时长 × 工人数量，自动计算">
                </label>
            </div>
        </div>

        <!-- 排产规则 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <div class="text-sm font-bold text-gray-800">⚙️ 排产规则</div>
                <span class="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">已启用</span>
            </div>
            <div class="space-y-3">
                ${[
                    ['1️⃣', '优先级优先',   '按订单优先级（紧急→优先→普通）分配制作顺序'],
                    ['2️⃣', '产能饱和预警', '当日待排工时超过日产能时自动延后并提示'],
                    ['3️⃣', '交付紧急度',   '距离交货日期越近的订单越优先安排制作'],
                    ['4️⃣', '同类集中',     '同分类产品集中制作，减少换模与清洁时间']
                ].map(([icon, title, desc]) => `
                <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                    <div class="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-base shadow-sm shrink-0">${icon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-semibold text-gray-800">${title}</div>
                        <div class="text-xs text-gray-500 mt-0.5 leading-relaxed">${desc}</div>
                    </div>
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-3 shrink-0"></div>
                </div>`).join('')}
            </div>
        </div>

        <!-- 数据管理 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <div class="text-sm font-bold text-gray-800 mb-3">💾 数据管理</div>
            <div class="space-y-2.5">
                <button onclick="exportData()" class="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-gray-200 hover:bg-slate-50 transition">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">📤</div>
                        <div class="text-left">
                            <div class="text-sm font-medium">导出数据</div>
                            <div class="text-xs text-gray-500">下载 JSON 数据备份</div>
                        </div>
                    </div>
                    <div class="text-gray-400">›</div>
                </button>

                <button onclick="resetAll()" class="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-red-100 hover:bg-red-50 transition">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">🗑️</div>
                        <div class="text-left">
                            <div class="text-sm font-medium text-red-600">恢复默认数据</div>
                            <div class="text-xs text-gray-500">清空订单/产品，重置为示例数据</div>
                        </div>
                    </div>
                    <div class="text-red-400">›</div>
                </button>
            </div>
        </div>

        <!-- 保存按钮 -->
        <div class="pt-2 pb-4">
            <button onclick="saveSettings()" class="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold shadow-lg hover:bg-slate-800 active:scale-[0.99] transition">
                保存设置
            </button>
            <div class="text-center text-xs text-gray-400 mt-3">v1.0 · 鑫意花样馒头排产系统</div>
        </div>
    `;

    // 联动：每日产能 = 工作时长 × 工人
    const compute = () => {
        const wh = parseFloat($('#s-workHoursPerDay').value) || 0;
        const w = parseInt($('#s-workers').value) || 0;
        $('#s-dailyCapacity').value = (wh * w).toFixed(1);
    };
    $('#s-workHoursPerDay').addEventListener('input', compute);
    $('#s-workers').addEventListener('input', compute);
}

function saveSettings() {
    const settings = {
        shopName: $('#s-shopName').value.trim() || '鑫意花样馒头',
        owner: $('#s-owner').value.trim(),
        shopDesc: $('#s-shopDesc').value.trim(),
        workHoursPerDay: parseFloat($('#s-workHoursPerDay').value) || 8,
        workers: parseInt($('#s-workers').value) || 1,
        dailyCapacity: parseFloat($('#s-dailyCapacity').value) || 8
    };
    Store.saveSettings(settings);
    showToast('设置已保存 ✓', 'success');
}

function exportData() {
    const data = {
        products: Store.getProducts(),
        orders: Store.getOrders(),
        settings: Store.getSettings(),
        exportAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `鑫意数据备份_${Store.formatDate(new Date())}.json`;
    a.click();
    showToast('已导出数据', 'success');
}

function resetAll() {
    if (!confirm('⚠️ 确定清空所有数据并恢复默认？此操作不可撤销！')) return;
    Store.init(true);
    showToast('已恢复默认数据', 'success');
    setTimeout(() => switchTab(currentTab), 500);
}

// ============ 5. 财务页 ============
function renderFinance() {
    const fs = Scheduler.getFinanceStats();

    $('#main-content').innerHTML = `
        <!-- 4张统计卡 -->
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl p-4 text-white shadow-sm">
                <div class="text-xs opacity-80">总营收</div>
                <div class="text-2xl font-bold mt-1.5">¥${formatMoney(fs.totalRevenue)}</div>
                <div class="text-[11px] mt-1 opacity-80">累计 ${fs.totalOrders} 单</div>
            </div>
            <div class="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-4 text-white shadow-sm">
                <div class="text-xs opacity-80">已收款</div>
                <div class="text-2xl font-bold mt-1.5">¥${formatMoney(fs.totalReceived)}</div>
                <div class="text-[11px] mt-1 opacity-80">${fs.paidOrderCount} 单已回款</div>
            </div>
            <div class="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-sm">
                <div class="text-xs opacity-80">待收款</div>
                <div class="text-2xl font-bold mt-1.5">¥${formatMoney(fs.pendingReceive)}</div>
                <div class="text-[11px] mt-1 opacity-80">${fs.totalOrders - fs.paidOrderCount} 单待回款</div>
            </div>
            <div class="bg-gradient-to-br from-sky-500 to-indigo-500 rounded-2xl p-4 text-white shadow-sm">
                <div class="text-xs opacity-80">回款率</div>
                <div class="text-2xl font-bold mt-1.5">${fs.paybackRate}<span class="text-base font-normal">%</span></div>
                <div class="w-full h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                    <div class="h-full bg-white rounded-full transition-all" style="width:${Math.min(fs.paybackRate, 100)}%"></div>
                </div>
            </div>
        </div>

        <!-- 近30天营收趋势 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <div>
                    <div class="font-bold text-gray-800 text-sm">📈 近30天营收趋势</div>
                    <div class="text-xs text-gray-400 mt-0.5">（按交货日期归属）</div>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <span class="flex items-center gap-1 text-gray-600"><span class="w-2 h-2 rounded-full bg-rose-500"></span>总营收</span>
                    <span class="flex items-center gap-1 text-gray-600"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>已收款</span>
                </div>
            </div>
            <div class="relative h-56 w-full">
                <canvas id="finance-chart"></canvas>
            </div>
        </div>

        <!-- 待收款订单 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <div class="font-bold text-gray-800 text-sm">⚠️ 待收款订单</div>
                <span class="text-xs text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">${Scheduler.getPendingReceiveOrders().length} 单</span>
            </div>
            <div id="pending-pay-list" class="divide-y divide-gray-50"></div>
        </div>
    `;

    // 渲染Chart
    setTimeout(() => {
        const ctx = document.getElementById('finance-chart');
        if (ctx && typeof Chart !== 'undefined') {
            const trend = Scheduler.getLast30DaysTrend();
            try {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: trend.labels,
                        datasets: [
                            {
                                label: '总营收',
                                data: trend.revenue,
                                borderColor: '#f43f5e',
                                backgroundColor: 'rgba(244,63,94,0.08)',
                                fill: true,
                                tension: 0.35,
                                pointRadius: 0,
                                pointHitRadius: 8,
                                borderWidth: 2
                            },
                            {
                                label: '已收款',
                                data: trend.received,
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16,185,129,0.06)',
                                fill: true,
                                tension: 0.35,
                                pointRadius: 0,
                                pointHitRadius: 8,
                                borderWidth: 2,
                                borderDash: []
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => ` ${ctx.dataset.label}: ¥${Number(ctx.raw || 0).toFixed(2)}`
                                }
                            }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 }, color: '#9ca3af' } },
                            y: {
                                beginAtZero: true,
                                grid: { color: '#f3f4f6' },
                                ticks: {
                                    font: { size: 10 },
                                    color: '#9ca3af',
                                    callback: (v) => '¥' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
                                }
                            }
                        }
                    }
                });
            } catch (e) {
                console.error('Chart渲染失败', e);
            }
        }
    }, 20);

    // 待收款列表
    const list = Scheduler.getPendingReceiveOrders();
    const box = $('#pending-pay-list');
    if (!list.length) {
        box.innerHTML = `<div class="py-6 text-center text-gray-400 text-sm">🎉 全部回款完成，暂无待收款订单</div>`;
    } else {
        box.innerHTML = list.map(x => `
            <div class="py-3 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-sm shrink-0">👤</div>
                    <div class="min-w-0">
                        <div class="font-medium text-sm text-gray-800 truncate">${x.customer}</div>
                        <div class="text-xs text-gray-500 mt-0.5">📞 ${x.phone || '-'} · 📦 ${fmtDate(x.deliveryDate)}</div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div class="font-bold text-rose-500">¥${formatMoney(x.amount)}</div>
                    <button onclick="markPaid(${x.id})" class="mt-1 text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-md">标记已收款</button>
                </div>
            </div>
        `).join('');
    }
}

function markPaid(id) {
    const o = Store.getOrderById(id);
    if (!o) return;
    o.paid = true;
    Store.updateOrder(o);
    showToast('已标记为已收款 ✓', 'success');
    renderFinance();
}

// ============ 6. 排产页 ============
function renderSchedule() {
    // 显示 7 天，已点击过一键排产就用持久化数据；否则回退到按制作日=交付日前一天展示
    const savedMap = Store.getScheduleMap();
    const todayStr = Store.formatDate(new Date());
    const anySaved = Object.keys(savedMap).some(k => k >= todayStr);
    const sv = Scheduler.getScheduleOverview(7, anySaved);

    // 按钮区：从未排过→显示「一键排产」；有数据时→「更新排产」（重算）
    let headerButtons;
    if (anySaved) {
        headerButtons = `
            <button onclick="doAutoSchedule(true)" class="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 shadow-sm active:scale-95 transition">
                🔄 更新排产
            </button>`;
    } else {
        headerButtons = `
            <button onclick="doAutoSchedule(false)" class="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 shadow-md active:scale-95 transition">
                ✨ 一键排产（7天）
            </button>`;
    }

    $('#main-content').innerHTML = `
        <!-- 顶栏：标题 + 操作按钮 -->
        <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
                <div class="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-lg">🗓️</div>
                <div>
                    <div class="font-bold text-gray-800">未来7天排产日程</div>
                    <div class="text-xs text-gray-400 mt-0.5">${anySaved ? `已保存 · 可点击「更新排产」重算` : `尚未排产 · 点击一键排产自动生成计划`}</div>
                </div>
            </div>
            ${headerButtons}
        </div>

        <!-- 3块统计 -->
        <div class="grid grid-cols-3 gap-2">
            <div class="bg-white rounded-2xl p-3 shadow-sm text-center">
                <div class="text-[11px] text-gray-500">待排订单</div>
                <div class="text-xl font-bold text-rose-500 mt-0.5">${sv.pendingOrderCount}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">单</div>
            </div>
            <div class="bg-white rounded-2xl p-3 shadow-sm text-center">
                <div class="text-[11px] text-gray-500">待排工时</div>
                <div class="text-xl font-bold text-blue-500 mt-0.5">${sv.totalHours}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">小时</div>
            </div>
            <div class="bg-white rounded-2xl p-3 shadow-sm text-center">
                <div class="text-[11px] text-gray-500">需排天数</div>
                <div class="text-xl font-bold text-emerald-500 mt-0.5">${sv.daysNeeded}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">工作日</div>
            </div>
        </div>

        <!-- 产能/规则小贴士 -->
        <div class="mt-3 bg-white rounded-2xl px-3 py-2.5 shadow-sm flex items-center gap-2 text-xs">
            <span class="text-base">💡</span>
            <div class="flex-1 text-gray-500 leading-relaxed">
                制作日默认 = 交付日前一天；日产能 = 人工 × 工时 = <b class="text-gray-700">${sv.capacity || (function(){const s=Store.getSettings();return (parseFloat(s.workHoursPerDay)||8)*(parseInt(s.workers)||1);})()}h</b>；超产能订单自动顺延。
            </div>
        </div>

        <!-- 排产日程 -->
        <div class="space-y-3 mt-3" id="schedule-dates"></div>
    `;

    const datesHtml = sv.dates.map((dg, i) => {
        const headerBg = dg.isToday
            ? 'bg-gradient-to-r from-slate-800 to-slate-700'
            : 'bg-gradient-to-r from-slate-700 to-slate-600';

        const cardItems = dg.items.length ? dg.items.map(item => {
            const pri = PRIORITY_MAP[item.priority] || PRIORITY_MAP.normal;
            const st = STATUS_MAP[item.status] || STATUS_MAP.pending;
            const itemsList = (item.items || []).map(it => {
                const p = Store.getProductById(it.productId);
                return `<li>${p ? p.name : (it.name || '产品')} × ${it.qty}</li>`;
            }).join('');
            // 操作按钮：和订单、工作台一致
            let actionBtn = '';
            if (item.status === 'pending') {
                actionBtn = `<button onclick="startProduce(${item.orderId})" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-blue-600 font-medium">📝 开始制作</button>`;
            } else if (item.status === 'producing') {
                actionBtn = `<button onclick="completeProduce(${item.orderId})" class="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-purple-600 font-medium">✅ 制作完成</button>`;
            } else if (item.status === 'ready') {
                actionBtn = `<button onclick="pickupOrder(${item.orderId})" class="px-4 py-2 bg-green-500 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-green-600 font-medium">📦 确认取货</button>`;
            } else {
                actionBtn = `<button onclick="openOrderModal(${item.orderId})" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">查看</button>`;
            }
            return `
            <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <span class="${pri.color} text-white text-[10px] px-2 py-0.5 rounded-full shrink-0">${pri.text}</span>
                        <div class="font-semibold text-gray-800 text-sm truncate">${item.customer}</div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                        <div class="text-xs text-gray-400">需工时</div>
                        <div class="text-sm font-bold text-blue-600">${item.hours}h</div>
                    </div>
                </div>
                ${itemsList ? `<ul class="dot-list mt-2">${itemsList}</ul>` : ''}
                <div class="mt-2.5 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between text-[11px]">
                    <span class="text-gray-500">📦 交付日：${fmtDate(item.deliveryDate)}</span>
                    <span class="${st.bg} px-2 py-0.5 rounded-md">${st.text}</span>
                </div>
                <div class="mt-2.5 flex justify-end">
                    ${actionBtn}
                </div>
            </div>`;
        }).join('') : `<div class="py-10 text-center text-gray-400 text-sm bg-slate-50/60 rounded-xl border border-dashed border-gray-200">
            📭 ${dg.isToday ? '今日' : '该日'}暂无排产
        </div>`;

        // 标题栏：具体公历日期 + 周几 + 农历日期 + 已保存小标
        let targetDate;
        try {
            const [yy, mm, dd] = dg.date.split('-').map(n => parseInt(n, 10));
            targetDate = new Date(yy, (mm || 1) - 1, dd || 1);
        } catch (e) { targetDate = new Date(); }
        const lunarStr = getLunarShort(targetDate);
        const todayBadge = dg.isToday ? `<span class="inline-block mr-1.5 px-2 py-0.5 rounded-full bg-yellow-400/90 text-slate-900 text-[10px] font-bold align-middle" style="box-shadow:0 1px 3px rgba(0,0,0,.2)">今</span>` : '';
        const savedBadge = dg.hasSaved ? `<span class="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-emerald-500/90 text-white text-[10px] align-middle">已保存</span>` : '';
        const title = `${todayBadge}${dg.monthNum}月${dg.dayNum}日 · ${dg.weekday}${savedBadge}`;
        const titleLunar = lunarStr ? `<div class="text-[11px] opacity-80 mt-0.5">农历 · ${lunarStr}</div>` : '';

        return `
        <div class="rounded-2xl overflow-hidden shadow-sm">
            <!-- 深色标题栏 -->
            <div class="${headerBg} text-white px-4 py-3 flex items-center justify-between">
                <div>
                    <div class="text-[11px] opacity-70">排产日程表 · 制作日</div>
                    <div class="font-bold text-base mt-0.5">${title}</div>
                    ${titleLunar}
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold leading-none">${dg.dayNum}</div>
                    <div class="text-[11px] opacity-80 mt-0.5">${dg.monthNum}月 · 总工时 ${dg.totalHours}h</div>
                </div>
            </div>
            <div class="bg-slate-50/80 p-3 space-y-2.5">
                ${cardItems}
            </div>
        </div>`;
    }).join('');

    $('#schedule-dates').innerHTML = datesHtml;
}

// 点击「一键排产 / 更新排产」按钮
function doAutoSchedule() {
    try {
        const res = Scheduler.autoSchedule(7);
        showToast(`✨ 排产完成 · 共 ${res.orderCount} 单 / ${res.updatedDates.length} 天`, 'success');
        renderSchedule();
    } catch (e) {
        console.error(e);
        showToast('排产失败：' + (e.message || e), 'error');
    }
}

// ============ 产品模态框 ============
function openProductModal(id) {
    const p = id ? Store.getProductById(id) : null;
    const categories = ['馒头类', '花糕类', '礼盒类', '喜庆类', '生日类', '其他'];

    showModal(`
        <div class="bg-white rounded-t-3xl w-full max-w-md mx-auto animate-slide-up" style="padding-bottom:var(--safe-bottom,0px);">
            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div class="font-bold text-lg">${p ? '编辑产品' : '新增产品'}</div>
                <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div class="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                    <label class="text-xs text-gray-500 block mb-1.5">产品名称 *</label>
                    <input id="p-name" type="text" value="${p ? p.name : ''}" placeholder="例：枣花糕" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm">
                </div>
                <div>
                    <label class="text-xs text-gray-500 block mb-1.5">产品分类</label>
                    <select id="p-category" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white">
                        ${categories.map(c => `<option ${p && p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">销售单价 (¥) *</label>
                        <input id="p-price" type="number" step="0.01" value="${p && p.price != null ? p.price : ''}" placeholder="8.5" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm">
                    </div>
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">工时 (小时/个) *</label>
                        <input id="p-wh" type="number" step="0.01" value="${p && p.workHours != null ? p.workHours : ''}" placeholder="1.5" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm">
                    </div>
                </div>
                <div class="flex items-center gap-2 pt-1">
                    <input id="p-default" type="checkbox" ${p && p.isDefault ? 'checked' : ''} class="w-4 h-4 rounded text-rose-500">
                    <label for="p-default" class="text-sm text-gray-700">设为默认产品（紫色小标签）</label>
                </div>
            </div>
            <div class="px-5 pb-8 pt-2 border-t border-gray-50 space-y-2">
                ${p ? `<button onclick="deleteProduct(${p.id});closeModal();" class="w-full py-2.5 text-sm text-red-500 bg-red-50 rounded-xl hover:bg-red-100">删除此产品</button>` : ''}
                <button id="p-save" class="w-full py-3.5 bg-slate-900 text-white text-sm font-semibold rounded-xl shadow hover:bg-slate-800 active:scale-[0.99] transition">保存</button>
            </div>
        </div>
    `);

    $('#p-save').addEventListener('click', () => {
        try {
            const name = $('#p-name').value.trim();
            if (!name) throw new Error('请输入产品名称');
            const price = parseFloat($('#p-price').value);
            if (!(price >= 0)) throw new Error('请输入有效的单价（支持小数）');
            const wh = parseFloat($('#p-wh').value);
            if (!(wh >= 0)) throw new Error('请输入有效的工时（支持小数）');

            const data = {
                name,
                category: $('#p-category').value,
                price,
                workHours: wh,
                isDefault: $('#p-default').checked
            };
            if (p) {
                data.id = p.id;
                Store.updateProduct(data);
                showToast('已更新产品 ✓', 'success');
            } else {
                Store.addProduct(data);
                showToast('已新增产品 ✓', 'success');
            }
            closeModal();
            if (currentTab === 'products') renderProducts();
        } catch (e) {
            showToast(e.message, 'error');
        }
    });
}

// ============ 订单模态框 ============
let orderModalItems = [];   // 暂存临时订单项
function openOrderModal(id) {
    const o = id ? Store.getOrderById(id) : null;
    orderModalItems = o ? JSON.parse(JSON.stringify(o.items || [])) : [];

    const tomorrow = Store.formatDate(Store.addDays(new Date(), 1));

    showModal(`
        <div class="bg-white rounded-t-3xl w-full max-w-md mx-auto animate-slide-up max-h-[92vh] flex flex-col" style="padding-bottom:var(--safe-bottom,0px);">
            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div class="font-bold text-lg">${o ? '编辑订单' : '新增订单'}</div>
                <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div class="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                <!-- 客户信息 -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">客户姓名 *</label>
                        <input id="o-customer" type="text" value="${o ? o.customer : ''}" placeholder="例：王女士" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm">
                    </div>
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">联系电话 *</label>
                        <input id="o-phone" type="tel" value="${o ? o.phone : ''}" placeholder="138xxxx" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">交货日期 *</label>
                        <div class="relative">
                            <input id="o-date-display" type="text" readonly value="${(o ? o.deliveryDate : tomorrow).replace(/-/g,'/')}" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm cursor-pointer bg-white">
                            <input id="o-date" type="date" value="${o ? o.deliveryDate : tomorrow}" class="absolute inset-0 opacity-0 cursor-pointer">
                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">📅</span>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">订单优先级</label>
                        <select id="o-priority" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white">
                            <option value="normal"   ${o && o.priority === 'normal' ? 'selected' : ''}>普通</option>
                            <option value="priority" ${o && o.priority === 'priority' ? 'selected' : ''}>优先</option>
                            <option value="urgent"   ${o && o.priority === 'urgent' ? 'selected' : ''}>紧急</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">订单状态</label>
                        <select id="o-status" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white">
                            <option value="pending"   ${!o || o.status === 'pending' ? 'selected' : ''}>待制作</option>
                            <option value="producing" ${o && o.status === 'producing' ? 'selected' : ''}>制作中</option>
                            <option value="ready"     ${o && o.status === 'ready' ? 'selected' : ''}>未取货（制作完成）</option>
                            <option value="done"      ${o && o.status === 'done' ? 'selected' : ''}>已取货（已完成）</option>
                            <option value="cancelled" ${o && o.status === 'cancelled' ? 'selected' : ''}>已取消</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-gray-500 block mb-1.5">收款状态</label>
                        <select id="o-paid" class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white">
                            <option value="true"  ${o && o.paid ? 'selected' : ''}>✅ 已收款</option>
                            <option value="false" ${!o || !o.paid ? 'selected' : ''}>⚠️ 待收款</option>
                        </select>
                    </div>
                </div>

                <!-- 产品列表 -->
                <div class="pt-1">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-xs font-semibold text-gray-700">🛒 订单产品</div>
                        <button id="o-add-item" class="text-xs bg-rose-50 text-rose-500 px-2.5 py-1 rounded-lg hover:bg-rose-100">+ 添加产品</button>
                    </div>
                    <div id="o-items-box" class="space-y-2"></div>
                </div>

                <!-- 订单金额汇总 -->
                <div id="o-summary" class="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
                    <div class="text-xs text-gray-500">订单合计</div>
                    <div class="text-xl font-bold text-rose-500" id="o-total">¥0.00</div>
                </div>

                <div>
                    <label class="text-xs text-gray-500 block mb-1.5">订单备注</label>
                    <textarea id="o-remark" rows="2" placeholder="取货时间、样式备注..." class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm resize-none">${o ? o.remark || '' : ''}</textarea>
                </div>
            </div>
            <div class="px-5 pb-8 pt-3 border-t border-gray-50 space-y-2 shrink-0">
                ${o ? `<button onclick="deleteOrder(${o.id});closeModal();" class="w-full py-2.5 text-sm text-red-500 bg-red-50 rounded-xl hover:bg-red-100">删除此订单</button>` : ''}
                <button id="o-save" class="w-full py-3.5 bg-slate-900 text-white text-sm font-semibold rounded-xl shadow hover:bg-slate-800 active:scale-[0.99] transition">保存订单</button>
            </div>
        </div>
    `);

    renderOrderModalItems();

    // 日期显示同步：原生选择器 → YYYY/MM/DD 文本显示
    const dateInput = $('#o-date');
    const dateDisplay = $('#o-date-display');
    if (dateInput && dateDisplay) {
        const syncDisplay = () => {
            if (dateInput.value) dateDisplay.value = dateInput.value.replace(/-/g, '/');
        };
        dateInput.addEventListener('change', syncDisplay);
        dateInput.addEventListener('input', syncDisplay);
    }

    $('#o-add-item').addEventListener('click', () => {
        const products = Store.getProducts();
        const defaultP = products.find(p => p.isDefault) || products[0];
        if (!defaultP) {
            showToast('请先到"工时管理"添加产品', 'error');
            return;
        }
        orderModalItems.push({ productId: defaultP.id, qty: 1 });
        renderOrderModalItems();
    });
    $('#o-save').addEventListener('click', () => {
        try {
            const customer = $('#o-customer').value.trim();
            if (!customer) throw new Error('请输入客户姓名');
            const phone = $('#o-phone').value.trim();
            if (!phone) throw new Error('请输入联系电话');
            const deliveryDate = $('#o-date').value;
            if (!deliveryDate) throw new Error('请选择交货日期');
            if (!orderModalItems.length) throw new Error('请至少添加1个产品');

            const data = {
                customer,
                phone,
                deliveryDate,
                priority: $('#o-priority').value,
                status: $('#o-status').value,
                paid: $('#o-paid').value === 'true',
                remark: $('#o-remark').value.trim(),
                items: orderModalItems
            };
            if (o) {
                data.id = o.id;
                Store.updateOrder(data);
                showToast('已更新订单 ✓', 'success');
            } else {
                Store.addOrder(data);
                showToast('已新增订单 ✓', 'success');
            }
            closeModal();
            if (currentTab === 'orders') renderOrders();
        } catch (e) {
            showToast(e.message, 'error');
        }
    });
}

function renderOrderModalItems() {
    const products = Store.getProducts();
    if (!orderModalItems.length) {
        $('#o-items-box').innerHTML = `<div class="py-5 text-center text-gray-400 text-xs bg-slate-50 rounded-xl border border-dashed border-gray-200">点击右上角"+ 添加产品"</div>`;
    } else {
        $('#o-items-box').innerHTML = orderModalItems.map((it, idx) => {
            const p = Store.getProductById(it.productId);
            const name = p ? p.name : '（已删除产品）';
            const price = p ? parseFloat(p.price) || 0 : 0;
            const subtotal = price * (parseFloat(it.qty) || 0);
            return `
            <div class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2.5">
                <select data-idx="${idx}" class="oi-pid flex-1 border-0 text-sm min-w-0 truncate bg-transparent focus:ring-0 px-0 py-1">
                    ${products.map(pp => `<option value="${pp.id}" ${it.productId === pp.id ? 'selected' : ''}>${pp.name} ¥${formatMoney(pp.price)}</option>`).join('')}
                </select>
                <input data-idx="${idx}" type="number" min="0" step="0.5" value="${it.qty}" class="oi-qty w-16 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                <div class="text-xs text-rose-500 w-16 text-right font-medium shrink-0">¥${formatMoney(subtotal)}</div>
                <button data-idx="${idx}" class="oi-del w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0">✕</button>
            </div>`;
        }).join('');

        $$('.oi-pid').forEach(el => el.addEventListener('change', e => {
            const i = +e.target.dataset.idx;
            orderModalItems[i].productId = +e.target.value;
            renderOrderModalItems();
        }));
        $$('.oi-qty').forEach(el => el.addEventListener('input', e => {
            const i = +e.target.dataset.idx;
            orderModalItems[i].qty = parseFloat(e.target.value) || 0;
            renderOrderModalItems();
        }));
        $$('.oi-del').forEach(el => el.addEventListener('click', e => {
            const i = +e.currentTarget.dataset.idx;
            orderModalItems.splice(i, 1);
            renderOrderModalItems();
        }));
    }

    // 合计
    let total = 0;
    orderModalItems.forEach(it => {
        const p = Store.getProductById(it.productId);
        total += (p ? parseFloat(p.price) || 0 : 0) * (parseFloat(it.qty) || 0);
    });
    $('#o-total').textContent = '¥' + formatMoney(total);
}

function deleteOrder(id) {
    if (!confirm('⚠️ 确定删除该订单吗？此操作不可恢复。')) return;
    Store.deleteOrder(id);
    showToast('订单已删除', 'success');
    if (currentTab === 'orders') renderOrders();
}

// ============ 模态框基础 ============
function showModal(html) {
    const c = $('#modal-container');
    c.innerHTML = `<div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" id="modal-bg" style="padding-bottom:var(--safe-bottom,0px);overflow-y:auto;-webkit-overflow-scrolling:touch;">
        ${html}
    </div>`;
    c.classList.remove('hidden');
    $('#modal-bg').addEventListener('click', e => { if (e.target.id === 'modal-bg') closeModal(); });
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    const c = $('#modal-container');
    c.classList.add('hidden');
    c.innerHTML = '';
    document.body.style.overflow = '';
}

// ============ 初始化 ============
try {
    Store.init();
} catch (e) {
    console.warn('数据初始化失败，使用默认数据', e);
}
switchTab('dashboard');
