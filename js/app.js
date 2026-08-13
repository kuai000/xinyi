// ==================== 主应用逻辑 ====================
// 全局变量
let currentTab = 'dashboard';
let financeChart = null;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    Store.init();
    initTabBar();
    updateHeaderDate();
    renderCurrentTab();
    Store.subscribe(() => renderCurrentTab());
});

function updateHeaderDate() {
    const d = new Date();
    const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    document.getElementById('page-subtitle').textContent =
        `${y}年${m}月${day}日 ${weekday[d.getDay()]}`;
}

// ==================== Tab 切换 ====================
function initTabBar() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderCurrentTab();
}

function renderCurrentTab() {
    const titleMap = {
        dashboard: '工作台',
        orders: '订单管理',
        schedule: '智能排产',
        products: '产品工时',
        finance: '财务统计',
        settings: '系统设置'
    };
    document.getElementById('page-title').textContent = titleMap[currentTab] || '';

    const main = document.getElementById('main-content');
    const action = document.getElementById('header-action');
    action.innerHTML = '';

    switch (currentTab) {
        case 'dashboard':
            renderDashboard(main);
            break;
        case 'orders':
            renderOrders(main, action);
            break;
        case 'schedule':
            renderSchedule(main, action);
            break;
        case 'products':
            renderProducts(main, action);
            break;
        case 'finance':
            renderFinance(main);
            break;
        case 'settings':
            renderSettings(main);
            break;
    }
    window.scrollTo(0, 0);
}

// ==================== Toast 工具 ====================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    const bg = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-amber-500' : 'bg-slate-800';
    el.className = `toast ${bg} text-white px-4 py-2 rounded-lg shadow-lg text-sm mb-2 whitespace-nowrap`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

// ==================== 模态框工具 ====================
function showModal(contentHTML, options = {}) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="modal-overlay fixed inset-0 flex items-end md:items-center justify-center" id="modal-overlay">
            <div class="modal-content ${options.size === 'full' ? 'w-full h-full' : 'w-full max-h-[90vh] overflow-y-auto md:max-w-md md:rounded-2xl rounded-t-2xl'} bg-white shadow-2xl">
                ${contentHTML}
            </div>
        </div>
    `;
    container.classList.remove('hidden');
    const overlay = document.getElementById('modal-overlay');
    if (!options.disableClose) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }
    return container;
}

function closeModal() {
    document.getElementById('modal-container').classList.add('hidden');
    document.getElementById('modal-container').innerHTML = '';
}

// ============================================================
// 1. 工作台页面
// ============================================================
function renderDashboard(main) {
    const stats = Store.getDashboardStats();
    const risks = Store.getRiskOrders();
    const capacity7 = Store.get7DayCapacity();

    const today = Store.formatDate(new Date());
    // ========== 工作台制作任务：读取排产计划按日期卡片展示，与排产模块视觉一致 ==========
    // 有排产就用排产计划（多日期卡片，深色标题）；没有排产就回退用原逻辑
    let planCardsHtml = '';
    const planSource = (cachedPlan && cachedPlan.length > 0) ? cachedPlan : Store.getPlans();

    if (planSource && planSource.length > 0) {
        planCardsHtml = planSource.map(plan => {
            // 只显示今天及以后的卡片
            if (plan.date < today) return '';
            // 每个子项：timeline样式 + 工作台的操作按钮
            const itemsHtml = plan.items.map((it, idx) => {
                const o = Store.getOrder(it.orderId);
                if (!o || o.status === 'delivered') return '';
                const total = Store.getOrderTotal(o);
                const isOverdue = !!it._overdue;
                const advanced = it.placedDate && it.makeDate && it.placedDate < it.makeDate;
                return `
                    <div class="timeline-item">
                        <div class="timeline-dot ${isOverdue ? 'bg-red-500' : idx === 0 ? 'bg-rose-500' : 'bg-blue-400'}"></div>
                        <div class="bg-gray-50 rounded-lg p-3 ${isOverdue ? 'border border-red-200' : ''}">
                            <div class="flex items-start justify-between mb-1">
                                <div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="font-semibold text-gray-800">${o.customer}</span>
                                        ${priorityBadge(o.priority)}
                                        ${statusBadge(o.status)}
                                        ${it.isPartial ? '<span class="badge badge-purple">分拆</span>' : ''}
                                        ${isOverdue ? '<span class="badge badge-red">⚠️排产超时</span>' : ''}
                                        ${advanced ? '<span class="badge badge-blue">提前制作</span>' : ''}
                                    </div>
                                    <p class="text-xs text-gray-600 mt-0.5 font-medium">
                                        📅 制作：${it.placedDate || plan.date} · 交付：${o.deliveryDate}
                                    </p>
                                    ${it.makeDate && it.placedDate !== it.makeDate ? `
                                        <p class="text-xs ${isOverdue ? 'text-red-500' : 'text-blue-500'} mt-0.5">
                                            ${isOverdue ? '⚠️ 应制作日：' + it.makeDate + '，已延误' : '⏳ 应制作日：' + it.makeDate + '，提前安排'}
                                        </p>
                                    ` : ''}
                                    <p class="text-xs text-gray-500 mt-1">${it.summary}</p>
                                </div>
                                <p class="text-right">
                                    <span class="text-sm font-bold text-gray-800">¥${total}</span>
                                    <span class="block text-xs font-bold text-rose-500">${it.hours}h</span>
                                </p>
                            </div>
                            <div class="flex gap-2 mt-2">
                                ${o.status === 'pending' ? `
                                    <button class="btn flex-1 bg-rose-500 text-white text-sm py-2 rounded-lg font-medium" onclick="startProducing('${o.id}')">开始制作</button>
                                ` : ''}
                                ${o.status === 'producing' ? `
                                    <button class="btn flex-1 bg-green-500 text-white text-sm py-2 rounded-lg font-medium" onclick="completeOrder('${o.id}')">完成制作</button>
                                ` : ''}
                                ${o.status === 'completed' ? `
                                    <button class="btn flex-1 bg-slate-700 text-white text-sm py-2 rounded-lg font-medium" onclick="updateOrderStatus('${o.id}','delivered'); closeModal();">确认取货</button>
                                ` : ''}
                                <button class="btn px-3 text-sm py-2 rounded-lg bg-gray-100 text-gray-600" onclick="viewOrder('${o.id}')">详情</button>
                            </div>
                        </div>
                    </div>
                `;
            }).filter(Boolean).join('');

            return `
                <div class="card overflow-hidden">
                    <div class="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
                        <div>
                            <h4 class="font-bold">${plan.label}</h4>
                            <p class="text-xs text-slate-300">
                                制作日 ${plan.date}
                                ${plan.subLabel ? ` · ${plan.subLabel}` : ''}
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold">${plan.totalHours}<span class="text-xs font-normal ml-0.5">h</span></p>
                            <div class="flex items-center gap-1 mt-0.5">
                                <div class="w-16 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full ${plan.load > 100 ? 'bg-red-400' : plan.load > 80 ? 'bg-amber-400' : 'bg-green-400'}" style="width:${Math.min(100, plan.load)}%"></div>
                                </div>
                                <span class="text-xs ${plan.load > 100 ? 'text-red-400' : plan.load > 80 ? 'text-amber-400' : 'text-green-400'}">${plan.load}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="p-3 space-y-2">
                        ${itemsHtml || '<p class="text-center text-gray-400 text-sm py-3">已全部完成</p>'}
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');
    }

    // 回退：没有排产计划就用旧的今日制作列表样式
    if (!planCardsHtml) {
        // 兜底 todayTasks 计算（没排产时才执行）
        const todayTasks = Store.getOrders().filter(o => {
            if (o.status === 'completed' || o.status === 'delivered') return false;
            const makeDate = Store.formatDate(Store.addDays(new Date(o.deliveryDate), -1));
            return makeDate === today || o.status === 'producing' || (o.deliveryDate === today);
        });
        const sortedTasks = [...todayTasks].sort((a, b) => {
            const score = (o) => {
                let s = 0;
                if (o.deliveryDate === today && o.status !== 'completed') s += 1000;
                const makeDate = Store.formatDate(Store.addDays(new Date(o.deliveryDate), -1));
                if (makeDate === today) s += 500;
                if (o.status === 'producing') s += 100;
                s += (o.priority || 0) * 10;
                return s;
            };
            return score(b) - score(a);
        });
        planCardsHtml = todayTasks.length === 0 ? `
            <div class="card p-12 text-center">
                <div class="text-5xl mb-3 opacity-30">🍞</div>
                <p class="text-gray-400 text-sm">暂无排产计划</p>
                <p class="text-gray-400 text-sm mt-1">请先在「排产」页点「一键排产」生成计划</p>
            </div>
        ` : `
            <div class="card p-4">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="font-bold text-gray-800 flex items-center gap-1.5">
                        <svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        今日制作任务（未排产，按规则计算）
                    </h3>
                </div>
                <div class="space-y-3">
                    ${sortedTasks.map(o => {
                        const total = Store.getOrderTotal(o);
                        const labor = Store.getOrderLaborHours(o);
                        const isDeliverToday = o.deliveryDate === today && o.status !== 'completed';
                        const isMakeToday = Store.formatDate(Store.addDays(new Date(o.deliveryDate), -1)) === today;
                        return `
                        <div class="bg-gray-50 rounded-xl p-3 border ${isDeliverToday ? 'border-red-200 bg-red-50' : 'border-gray-100'}">
                            <div class="flex items-start justify-between mb-2">
                                <div>
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <p class="font-semibold text-gray-800">${o.customer}</p>
                                        ${priorityBadge(o.priority)}
                                        ${statusBadge(o.status)}
                                        ${isDeliverToday ? '<span class="badge badge-red">🚨今日需交付</span>' : isMakeToday ? '<span class="badge badge-yellow">今日制作·明日交付</span>' : ''}
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">📅 交付日：${o.deliveryDate}</p>
                                    <p class="text-xs text-gray-500 mt-0.5">
                                        ${o.items.map(i => {
                                            const p = Store.getProduct(i.productId);
                                            return p ? `${p.name}×${i.quantity}` : '';
                                        }).filter(Boolean).join('、')}
                                    </p>
                                </div>
                                <p class="text-right">
                                    <span class="text-sm font-bold text-gray-800">¥${total}</span>
                                    <span class="block text-xs text-gray-400">${labor}h</span>
                                </p>
                            </div>
                            <div class="flex gap-2">
                                ${o.status === 'pending' ? `
                                    <button class="btn flex-1 bg-rose-500 text-white text-sm py-2 rounded-lg font-medium" onclick="startProducing('${o.id}')">开始制作</button>
                                ` : ''}
                                ${o.status === 'producing' ? `
                                    <button class="btn flex-1 bg-green-500 text-white text-sm py-2 rounded-lg font-medium" onclick="completeOrder('${o.id}')">完成制作</button>
                                ` : ''}
                                ${o.status === 'completed' ? `
                                    <button class="btn flex-1 bg-slate-700 text-white text-sm py-2 rounded-lg font-medium" onclick="updateOrderStatus('${o.id}','delivered'); closeModal();">确认取货</button>
                                ` : ''}
                                <button class="btn px-3 text-sm py-2 rounded-lg bg-gray-100 text-gray-600" onclick="viewOrder('${o.id}')">详情</button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    main.innerHTML = `
        <!-- 统计卡片 -->
        <div class="grid grid-cols-2 gap-3">
            <div class="card stat-card red p-3">
                <p class="text-xs text-gray-500 mb-1">待制作订单</p>
                <p class="text-2xl font-bold text-gray-800">${stats.pendingCount}</p>
                <p class="text-xs text-gray-400 mt-1">未完成且未取货</p>
            </div>
            <div class="card stat-card blue p-3">
                <p class="text-xs text-gray-500 mb-1">今日制作工时</p>
                <p class="text-2xl font-bold text-gray-800">${stats.todayHours}<span class="text-base font-normal text-gray-500 ml-1">h</span></p>
                <p class="text-xs text-gray-400 mt-1">可用产能 ${stats.dailyCapacity} h</p>
            </div>
            <div class="card stat-card green p-3">
                <p class="text-xs text-gray-500 mb-1">今日产能负荷</p>
                <p class="text-2xl font-bold ${stats.capacityLoad > 100 ? 'text-red-500' : stats.capacityLoad > 80 ? 'text-amber-500' : 'text-gray-800'}">${stats.capacityLoad}<span class="text-base font-normal ml-1">%</span></p>
                <p class="text-xs ${stats.capacityLoad > 100 ? 'text-red-400' : 'text-gray-400'} mt-1">${stats.capacityLoad > 100 ? '超过100%！需提前安排' : '提前一天制作，明日交付'}</p>
            </div>
            <div class="card stat-card purple p-3">
                <p class="text-xs text-gray-500 mb-1">待收款订单</p>
                <p class="text-2xl font-bold text-gray-800">${stats.unpaidCount}</p>
                <p class="text-xs text-gray-400 mt-1">未支付 / 部分支付</p>
            </div>
        </div>

        <!-- 制作任务卡片：按排产日期卡片展示，和排产模块视觉一致 -->
        <div class="space-y-4">
            ${planCardsHtml}
        </div>

        <!-- 订单风险提醒 -->
        <div class="card p-4">
            <h3 class="font-bold text-gray-800 flex items-center gap-1.5 mb-3">
                <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                订单风险提醒
            </h3>
            ${risks.length === 0 ? `
                <div class="py-8 text-center">
                    <svg class="w-10 h-10 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="text-gray-400 text-sm">目前没有风险提醒 👍</p>
                </div>
            ` : `
                <div class="space-y-2">
                    ${risks.map(r => `
                        <div class="flex items-start gap-2 p-3 rounded-lg ${r.type === 'urgent' ? 'bg-red-50 border border-red-100' : r.type === 'payment' ? 'bg-amber-50 border border-amber-100' : 'bg-orange-50 border border-orange-100'}">
                            <span class="text-lg">${r.type === 'urgent' ? '🚨' : r.type === 'payment' ? '💰' : '📅'}</span>
                            <p class="text-sm text-gray-700 flex-1">${r.message}</p>
                            <button class="text-xs text-rose-600 font-medium" onclick="switchTab('orders')">查看</button>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>

        <!-- 未来7天产能（制作日视角） -->
        <div class="card p-4">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-bold text-gray-800 flex items-center gap-1.5">
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    未来7天产能
                </h3>
                <span class="text-xs text-gray-400">前一天制作，次日交付</span>
            </div>
            <div class="h-scroll">
                ${capacity7.map(d => `
                    <div class="w-[110px] card bg-gray-50 p-3 text-center">
                        <p class="text-sm font-bold text-gray-800">${d.label}</p>
                        <p class="text-xs text-blue-600 mt-0.5 font-medium">${d.subLabel || '次日交'}</p>
                        <p class="text-xs text-gray-500 mt-0.5">${d.orderCount}单 · ${d.hours}h</p>
                        <div class="capacity-bar mt-3 mb-2">
                            <div class="capacity-fill ${d.load > 100 ? 'bg-red-500' : d.load > 80 ? 'bg-amber-500' : 'bg-green-500'}" style="width:${Math.min(100, d.load)}%"></div>
                        </div>
                        <p class="text-xs font-medium ${d.load > 100 ? 'text-red-500' : d.load > 80 ? 'text-amber-500' : 'text-green-600'}">
                            ${d.status}
                        </p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function priorityBadge(p) {
    const map = [
        { cls: 'badge-gray', text: '普通' },
        { cls: 'badge-blue', text: '优先' },
        { cls: 'badge-red', text: '紧急' }
    ];
    const b = map[p] || map[0];
    return `<span class="badge ${b.cls}">${b.text}</span>`;
}

function statusBadge(s) {
    const map = {
        pending: { cls: 'badge-orange', text: '待制作' },
        producing: { cls: 'badge-blue', text: '制作中' },
        completed: { cls: 'badge-green', text: '已完成' },
        delivered: { cls: 'badge-gray', text: '已取货' }
    };
    const b = map[s] || map.pending;
    return `<span class="badge ${b.cls}">${b.text}</span>`;
}

function paymentBadge(s) {
    const map = {
        unpaid: { cls: 'badge-red', text: '未收款' },
        partial: { cls: 'badge-yellow', text: '部分收款' },
        paid: { cls: 'badge-green', text: '已收款' }
    };
    const b = map[s] || map.unpaid;
    return `<span class="badge ${b.cls}">${b.text}</span>`;
}

function startProducing(id) {
    Store.updateOrder(id, { status: 'producing' });
    showToast('已开始制作');
}

function completeOrder(id) {
    Store.updateOrder(id, { status: 'completed' });
    showToast('制作完成');
}

function viewOrder(id) {
    switchTab('orders');
    setTimeout(() => openOrderDetail(id), 50);
}

// ============================================================
// 2. 订单管理
// ============================================================
function renderOrders(main, action) {
    action.innerHTML = `
        <button class="btn bg-rose-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1" onclick="openOrderForm()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            新建
        </button>
    `;

    const allOrders = Store.getOrders();

    main.innerHTML = `
        <!-- 筛选标签 -->
        <div class="h-scroll">
            ${[
                { key: 'all', label: '全部' },
                { key: 'pending', label: '待制作' },
                { key: 'producing', label: '制作中' },
                { key: 'completed', label: '已完成' },
                { key: 'delivered', label: '已取货' }
            ].map((t, i) => `
                <button class="order-filter-btn px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${i === 0 ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600'}" data-filter="${t.key}">
                    ${t.label}
                    <span class="ml-1 text-xs opacity-70">(${countByStatus(t.key, allOrders)})</span>
                </button>
            `).join('')}
        </div>

        <div id="order-list-container">
            ${renderOrderList(allOrders)}
        </div>
    `;

    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.order-filter-btn').forEach(b => {
                b.className = 'order-filter-btn px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-gray-100 text-gray-600';
            });
            btn.className = 'order-filter-btn px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-slate-800 text-white';
            const filter = btn.dataset.filter;
            const list = filter === 'all' ? allOrders : allOrders.filter(o => o.status === filter);
            document.getElementById('order-list-container').innerHTML = renderOrderList(list);
        });
    });
}

function countByStatus(status, orders) {
    if (status === 'all') return orders.length;
    return orders.filter(o => o.status === status).length;
}

function renderOrderList(orders) {
    if (orders.length === 0) {
        return `
            <div class="card p-12 text-center">
                <div class="text-5xl mb-3 opacity-30">📋</div>
                <p class="text-gray-400">暂无订单</p>
                <p class="text-gray-400 text-sm mt-1">点击右上角「新建」添加订单</p>
            </div>
        `;
    }

    return orders.map(o => {
        const total = Store.getOrderTotal(o);
        const labor = Store.getOrderLaborHours(o);
        return `
        <div class="card p-4 mb-3" onclick="openOrderDetail('${o.id}')">
            <div class="flex items-start justify-between mb-2">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-bold text-gray-800">${o.customer}</span>
                        ${priorityBadge(o.priority)}
                        ${statusBadge(o.status)}
                    </div>
                    <p class="text-xs text-gray-500">📅 ${o.deliveryDate} 交货 · ⏱ ${labor}小时</p>
                </div>
                <p class="text-right">
                    <span class="font-bold text-gray-800">¥${total}</span>
                    <span class="block text-xs">${paymentBadge(o.paymentStatus)}</span>
                </p>
            </div>
            <div class="bg-gray-50 rounded-lg p-2 mb-2">
                <p class="text-xs text-gray-600">
                    ${o.items.map(i => {
                        const p = Store.getProduct(i.productId);
                        return p ? `• ${p.name} × ${i.quantity}` : '';
                    }).filter(Boolean).join('<br>')}
                </p>
            </div>
            ${o.remark ? `<p class="text-xs text-gray-500">📝 ${o.remark}</p>` : ''}
        </div>
        `;
    }).join('');
}

// 新建/编辑订单
function openOrderForm(id = null) {
    const products = Store.getProducts();
    const order = id ? Store.getOrder(id) : null;
    const isEdit = !!order;
    const today = Store.formatDate(new Date());
    const tomorrow = Store.formatDate(Store.addDays(new Date(), 1));

    showModal(`
        <div class="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h3 class="font-bold text-lg">${isEdit ? '编辑订单' : '新建订单'}</h3>
            <button class="text-gray-400 p-1" onclick="closeModal()">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <form id="order-form" class="p-4 space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">客户姓名 *</label>
                <input type="text" name="customer" value="${order?.customer || ''}" required class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="请输入客户姓名">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input type="tel" name="phone" value="${order?.phone || ''}" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="请输入联系电话">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">产品明细 *</label>
                <div id="order-items" class="space-y-2">
                    ${(order?.items || [{ productId: '', quantity: 1 }]).map((it, idx) => renderOrderItem(idx, it, products)).join('')}
                </div>
                <button type="button" class="mt-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm font-medium" onclick="addOrderItem()">
                    + 添加产品
                </button>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">交货日期 *</label>
                    <input type="date" name="deliveryDate" value="${order?.deliveryDate || tomorrow}" required min="${today}" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                    <select name="priority" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                        <option value="0" ${order?.priority === 0 ? 'selected' : ''}>普通</option>
                        <option value="1" ${order?.priority === 1 ? 'selected' : ''}>优先</option>
                        <option value="2" ${order?.priority === 2 ? 'selected' : ''}>紧急</option>
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">收款状态</label>
                    <select name="paymentStatus" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                        <option value="unpaid" ${order?.paymentStatus === 'unpaid' ? 'selected' : ''}>未收款</option>
                        <option value="partial" ${order?.paymentStatus === 'partial' ? 'selected' : ''}>部分收款</option>
                        <option value="paid" ${order?.paymentStatus === 'paid' ? 'selected' : ''}>已收款</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">已收金额</label>
                    <input type="number" name="paidAmount" value="${order?.paidAmount ?? 0}" min="0" step="0.01" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="0.00">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea name="remark" rows="2" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="订单备注，如交货时间、特殊要求等">${order?.remark || ''}</textarea>
            </div>
            <button type="submit" class="btn w-full bg-rose-500 text-white py-3 rounded-xl font-bold">
                ${isEdit ? '保存修改' : '确认创建'}
            </button>
        </form>
    `, { size: 'full' });

    document.getElementById('order-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        // 收集 items
        const items = [];
        document.querySelectorAll('.order-item-row').forEach(row => {
            const pId = row.querySelector('.item-product').value;
            const qty = parseInt(row.querySelector('.item-qty').value) || 0;
            if (pId && qty > 0) items.push({ productId: pId, quantity: qty });
        });
        if (items.length === 0) {
            showToast('请至少添加一个产品', 'error');
            return;
        }
        data.items = items;

        if (isEdit) {
            Store.updateOrder(id, data);
            showToast('订单已更新');
        } else {
            Store.addOrder(data);
            showToast('订单创建成功');
        }
        closeModal();
    });
}

function renderOrderItem(idx, item, products) {
    return `
    <div class="order-item-row flex gap-2 items-center bg-gray-50 p-2 rounded-lg">
        <select class="item-product flex-1 px-2 py-2 rounded-md border border-gray-200 text-xs bg-white">
            <option value="">选择产品</option>
            ${products.map(p => `<option value="${p.id}" ${item.productId === p.id ? 'selected' : ''}>${p.name} (¥${p.price}/${p.laborHours}h)</option>`).join('')}
        </select>
        <input type="number" class="item-qty w-16 px-2 py-2 rounded-md border border-gray-200 text-xs text-center" value="${item.quantity || 1}" min="1" placeholder="数量">
        <button type="button" class="text-gray-400 hover:text-red-500 p-1" onclick="this.closest('.order-item-row').remove()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"></path></svg>
        </button>
    </div>
    `;
}

function addOrderItem() {
    const container = document.getElementById('order-items');
    const div = document.createElement('div');
    div.innerHTML = renderOrderItem(0, {}, Store.getProducts());
    container.appendChild(div.firstElementChild);
}

// 订单详情
function openOrderDetail(id) {
    const o = Store.getOrder(id);
    if (!o) return;
    const total = Store.getOrderTotal(o);
    const labor = Store.getOrderLaborHours(o);
    const unpaid = Math.max(0, total - (o.paidAmount || 0));

    showModal(`
        <div class="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
            <h3 class="font-bold text-lg">订单详情</h3>
            <button class="text-gray-400 p-1" onclick="closeModal()">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <div class="p-4 space-y-4">
            <div class="card p-4">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-bold text-gray-800">${o.customer}</h4>
                    <div class="flex gap-1">${priorityBadge(o.priority)}${statusBadge(o.status)}</div>
                </div>
                <div class="space-y-2 text-sm text-gray-600">
                    <p>📞 ${o.phone || '未留电话'}</p>
                    <p>📅 交货日期：<span class="font-medium">${o.deliveryDate}</span></p>
                    <p>⏱ 所需工时：<span class="font-medium">${labor} 小时</span></p>
                </div>
            </div>

            <div class="card p-4">
                <h4 class="font-bold text-gray-800 mb-3">产品明细</h4>
                <div class="space-y-2">
                    ${o.items.map(i => {
                        const p = Store.getProduct(i.productId);
                        const subtotal = p ? p.price * i.quantity : 0;
                        const h = p ? p.laborHours * i.quantity : 0;
                        return `
                        <div class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                            <div>
                                <p class="font-medium text-gray-800 text-sm">${p?.name || '未知产品'} × ${i.quantity}</p>
                                <p class="text-xs text-gray-400">¥${p?.price || 0} · ${p?.laborHours || 0}h/个 · 合计 ${h}h</p>
                            </div>
                            <span class="font-bold text-gray-800">¥${subtotal}</span>
                        </div>`;
                    }).join('')}
                </div>
                <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span class="text-gray-600 font-medium">订单总额</span>
                    <span class="text-xl font-bold text-rose-500">¥${total}</span>
                </div>
            </div>

            <div class="card p-4">
                <h4 class="font-bold text-gray-800 mb-3">收款情况</h4>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-gray-500">收款状态</span>${paymentBadge(o.paymentStatus)}</div>
                    <div class="flex justify-between"><span class="text-gray-500">已收金额</span><span class="font-bold text-green-600">¥${o.paidAmount || 0}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">待收金额</span><span class="font-bold ${unpaid > 0 ? 'text-red-500' : 'text-gray-400'}">¥${unpaid}</span></div>
                </div>
            </div>

            ${o.remark ? `
            <div class="card p-4">
                <h4 class="font-bold text-gray-800 mb-2">备注</h4>
                <p class="text-sm text-gray-600">${o.remark}</p>
            </div>` : ''}

            <div class="space-y-2 pt-2">
                ${o.status === 'pending' ? `
                    <button class="btn w-full bg-blue-500 text-white py-3 rounded-xl font-medium" onclick="updateOrderStatus('${o.id}','producing')">开始制作</button>
                ` : ''}
                ${o.status === 'producing' ? `
                    <button class="btn w-full bg-green-500 text-white py-3 rounded-xl font-medium" onclick="updateOrderStatus('${o.id}','completed')">完成制作</button>
                ` : ''}
                ${o.status === 'completed' ? `
                    <button class="btn w-full bg-slate-700 text-white py-3 rounded-xl font-medium" onclick="updateOrderStatus('${o.id}','delivered')">确认取货</button>
                ` : ''}
                <div class="grid grid-cols-2 gap-2">
                    <button class="btn bg-amber-500 text-white py-3 rounded-xl font-medium" onclick="closeModal(); openOrderForm('${o.id}')">编辑</button>
                    <button class="btn bg-white border-2 border-red-200 text-red-500 py-3 rounded-xl font-medium" onclick="deleteOrderConfirm('${o.id}')">删除订单</button>
                </div>
            </div>
        </div>
    `, { size: 'full' });
}

function updateOrderStatus(id, status) {
    Store.updateOrder(id, { status });
    const labels = { pending: '待制作', producing: '制作中', completed: '已完成', delivered: '已取货' };
    showToast(`已更新为「${labels[status]}」`);
    closeModal();
}

function deleteOrderConfirm(id) {
    if (confirm('确定要删除这个订单吗？此操作不可恢复。')) {
        Store.deleteOrder(id);
        showToast('订单已删除');
        closeModal();
    }
}

// ============================================================
// 3. 智能排产
// ============================================================
let cachedPlan = null;

function renderSchedule(main, action) {
    action.innerHTML = `
        <button class="btn bg-rose-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1" onclick="runScheduler()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            一键排产
        </button>
    `;

    if (!cachedPlan) {
        cachedPlan = Store.getPlans();
    }

    const rules = Store.getSettings().schedulingRules;
    const hasPending = Store.getOrders().some(o => o.status === 'pending' || o.status === 'producing');

    main.innerHTML = `
        <!-- 排产规则 -->
        <div class="card p-4">
            <h3 class="font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                排产规则
            </h3>
            <p class="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
                📌 排产逻辑：<strong>前一天制作，次日交付</strong>（交付日期的前一天是制作日）
            </p>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-center gap-1.5 ${rules.urgencyFirst ? 'text-green-600' : 'text-gray-400'}">
                    <span>${rules.urgencyFirst ? '✅' : '⭕'}</span>
                    <span>① 制作紧迫度优先</span>
                </div>
                <div class="flex items-center gap-1.5 ${rules.inProgressFirst ? 'text-green-600' : 'text-gray-400'}">
                    <span>${rules.inProgressFirst ? '✅' : '⭕'}</span>
                    <span>② 制作中优先</span>
                </div>
                <div class="flex items-center gap-1.5 ${rules.priorityFirst ? 'text-green-600' : 'text-gray-400'}">
                    <span>${rules.priorityFirst ? '✅' : '⭕'}</span>
                    <span>③ 订单优先级</span>
                </div>
                <div class="flex items-center gap-1.5 ${rules.sameCategoryGroup ? 'text-green-600' : 'text-gray-400'}">
                    <span>${rules.sameCategoryGroup ? '✅' : '⭕'}</span>
                    <span>④ 同类集中制作</span>
                </div>
            </div>
        </div>

        ${cachedPlan && cachedPlan.length > 0 ? renderPlans(cachedPlan) : `
            <div class="card p-12 text-center">
                <div class="text-5xl mb-4 opacity-30">🗓️</div>
                ${!hasPending ? `
                    <p class="text-gray-400 font-medium">暂无待排产订单</p>
                    <p class="text-gray-400 text-sm mt-1">先去创建订单吧</p>
                ` : `
                    <p class="text-gray-400 font-medium">尚未生成排产计划</p>
                    <p class="text-gray-400 text-sm mt-1 mb-4">点击右上角「一键排产」智能生成</p>
                    <button class="btn bg-rose-500 text-white px-6 py-2.5 rounded-xl font-medium inline-flex items-center gap-1.5" onclick="runScheduler()">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        开始智能排产
                    </button>
                `}
            </div>
        `}
    `;
}

function renderPlans(plans) {
    let totalHours = 0;
    let totalOrders = new Set();
    let overdueCount = 0;
    plans.forEach(p => {
        totalHours += p.totalHours;
        p.items.forEach(it => {
            totalOrders.add(it.orderId);
            if (it._overdue) overdueCount++;
        });
    });

    return `
        <div class="card p-4 bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-100">
            <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                    <p class="text-2xl font-bold text-rose-600">${totalOrders.size}</p>
                    <p class="text-xs text-gray-500">待排订单</p>
                </div>
                <div>
                    <p class="text-2xl font-bold text-orange-600">${Store.round1(totalHours)}</p>
                    <p class="text-xs text-gray-500">总工时(h)</p>
                </div>
                <div>
                    <p class="text-2xl font-bold text-purple-600">${plans.length}</p>
                    <p class="text-xs text-gray-500">需排天数</p>
                </div>
            </div>
            ${overdueCount > 0 ? `
                <div class="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600">
                    ⚠️ 有 <strong>${overdueCount}</strong> 个订单排产晚于应制作日，可能影响交付！建议提高产能或提前制作。
                </div>
            ` : ''}
        </div>

        <div class="space-y-4">
            ${plans.map(plan => `
                <div class="card overflow-hidden">
                    <div class="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
                        <div>
                            <h4 class="font-bold">${plan.label}</h4>
                            <p class="text-xs text-slate-300">
                                制作日 ${plan.date}
                                ${plan.subLabel ? ` · ${plan.subLabel}` : ''}
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold">${plan.totalHours}<span class="text-xs font-normal ml-0.5">h</span></p>
                            <div class="flex items-center gap-1 mt-0.5">
                                <div class="w-16 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full ${plan.load > 100 ? 'bg-red-400' : plan.load > 80 ? 'bg-amber-400' : 'bg-green-400'}" style="width:${Math.min(100, plan.load)}%"></div>
                                </div>
                                <span class="text-xs ${plan.load > 100 ? 'text-red-400' : plan.load > 80 ? 'text-amber-400' : 'text-green-400'}">${plan.load}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="p-3 space-y-2">
                        ${plan.items.map((it, idx) => `
                            <div class="timeline-item">
                                <div class="timeline-dot ${it._overdue ? 'bg-red-500' : idx === 0 ? 'bg-rose-500' : 'bg-blue-400'}"></div>
                                <div class="bg-gray-50 rounded-lg p-3 ${it._overdue ? 'border border-red-200' : ''}">
                                    <div class="flex items-start justify-between mb-1">
                                        <div>
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                                <span class="font-semibold text-gray-800">${it.customer}</span>
                                                ${priorityBadge(it.priority)}
                                                ${it.isPartial ? '<span class="badge badge-purple">分拆</span>' : ''}
                                                ${it._overdue ? '<span class="badge badge-red">⚠️排产超时</span>' : ''}
                                                ${!it._overdue && it.placedDate && it.placedDate < it.makeDate ? '<span class="badge badge-blue">提前制作</span>' : ''}
                                            </div>
                                            <p class="text-xs text-gray-600 mt-0.5 font-medium">
                                                📅 制作：${it.placedDate || plan.date} · 交付：${it.deliveryDate}
                                            </p>
                                            ${it.makeDate && it.placedDate !== it.makeDate ? `
                                                <p class="text-xs ${it._overdue ? 'text-red-500' : 'text-blue-500'} mt-0.5">
                                                    ${it._overdue ? '⚠️ 应制作日：' + it.makeDate + '，已延误' : '⏳ 应制作日：' + it.makeDate + '，提前安排'}
                                                </p>
                                            ` : ''}
                                            <p class="text-xs text-gray-500 mt-1">${it.summary}</p>
                                        </div>
                                        <span class="font-bold text-rose-500 text-sm">${it.hours}h</span>
                                    </div>
                                    <button class="mt-1 text-xs text-blue-600 font-medium" onclick="viewOrder('${it.orderId}')">查看订单 →</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="pt-2">
            <button class="btn w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-medium" onclick="runScheduler()">
                🔄 重新生成排产
            </button>
        </div>
    `;
}

function runScheduler() {
    const result = Scheduler.generatePlan();
    cachedPlan = result.plans;
    Store.savePlans(result.plans);
    const warn = result.summary.overdueWarning || 0;
    showToast(`排产完成！共${result.summary.totalOrders}单 · ${result.summary.totalHours}h · ${result.summary.days}天${warn > 0 ? '，⚠️' + warn + '单超时' : ''}`);
    renderCurrentTab();
}

// ============================================================
// 4. 产品工时管理
// ============================================================
function renderProducts(main, action) {
    action.innerHTML = `
        <button class="btn bg-rose-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1" onclick="openProductForm()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            新增
        </button>
    `;

    const products = Store.getProducts();
    // 按类别分组
    const grouped = {};
    products.forEach(p => {
        const cat = p.category || '其他';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    main.innerHTML = `
        <div class="card p-4 bg-blue-50 border border-blue-100">
            <p class="text-sm text-blue-700">
                💡 产品的<strong>工时</strong>直接影响排产准确性，<br>请准确填写每个产品的平均制作时间。
            </p>
        </div>

        ${Object.keys(grouped).length === 0 ? `
            <div class="card p-12 text-center">
                <div class="text-5xl mb-3 opacity-30">🍰</div>
                <p class="text-gray-400">暂无产品</p>
                <p class="text-gray-400 text-sm mt-1">点击右上角「新增」添加产品</p>
            </div>
        ` : Object.entries(grouped).map(([cat, list]) => `
            <div class="card overflow-hidden">
                <div class="bg-slate-100 px-4 py-2 flex items-center justify-between">
                    <span class="font-bold text-gray-700 text-sm">${cat}</span>
                    <span class="text-xs text-gray-500">${list.length}个产品</span>
                </div>
                <div>
                    ${list.map(p => `
                        <div class="px-4 py-3 list-item flex items-center justify-between" onclick="openProductForm('${p.id}')">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-semibold text-gray-800">${p.name}</span>
                                    <span class="badge badge-purple">${cat}</span>
                                </div>
                                <div class="flex items-center gap-4 text-xs text-gray-500">
                                    <span>⏱ ${p.laborHours}h/个</span>
                                    <span>💰 ¥${p.price}</span>
                                </div>
                            </div>
                            <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    `;
}

function openProductForm(id = null) {
    const p = id ? Store.getProduct(id) : null;
    const isEdit = !!p;
    const categories = ['传统', '祝寿', '婚庆', '满月', '儿童', '果蔬', '其他'];

    showModal(`
        <div class="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h3 class="font-bold text-lg">${isEdit ? '编辑产品' : '新增产品'}</h3>
            <button class="text-gray-400 p-1" onclick="closeModal()">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <form id="product-form" class="p-4 space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">产品名称 *</label>
                <input type="text" name="name" value="${p?.name || ''}" required class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="如：寿桃馒头">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">产品分类</label>
                <select name="category" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                    ${categories.map(c => `<option value="${c}" ${p?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">单个工时(小时) *</label>
                    <input type="number" name="laborHours" value="${p?.laborHours ?? ''}" required step="0.1" min="0" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="如：0.5">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">单价(元) *</label>
                    <input type="number" name="price" value="${p?.price ?? ''}" required step="1" min="0" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" placeholder="如：15">
                </div>
            </div>
            <button type="submit" class="btn w-full bg-rose-500 text-white py-3 rounded-xl font-bold">
                ${isEdit ? '保存修改' : '确认新增'}
            </button>
            ${isEdit ? `
                <button type="button" class="btn w-full bg-white border border-red-200 text-red-500 py-3 rounded-xl font-medium" onclick="deleteProductConfirm('${id}')">
                    删除产品
                </button>
            ` : ''}
        </form>
    `);

    document.getElementById('product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        if (isEdit) {
            Store.updateProduct(id, data);
            showToast('产品已更新');
        } else {
            Store.addProduct(data);
            showToast('产品添加成功');
        }
        closeModal();
    });
}

function deleteProductConfirm(id) {
    if (confirm('确定要删除这个产品吗？（已存在的订单不受影响）')) {
        Store.deleteProduct(id);
        showToast('产品已删除');
        closeModal();
    }
}

// ============================================================
// 5. 财务统计
// ============================================================
function renderFinance(main) {
    const stats = Store.getFinanceStats(30);

    main.innerHTML = `
        <!-- 核心指标 -->
        <div class="grid grid-cols-2 gap-3">
            <div class="card stat-card green p-4">
                <p class="text-xs text-gray-500 mb-1">总营收</p>
                <p class="text-2xl font-bold text-gray-800">¥${stats.totalRevenue}</p>
                <p class="text-xs text-gray-400 mt-1">全部订单合计</p>
            </div>
            <div class="card stat-card blue p-4">
                <p class="text-xs text-gray-500 mb-1">已收款</p>
                <p class="text-2xl font-bold text-green-600">¥${stats.totalReceived}</p>
                <p class="text-xs text-gray-400 mt-1">${stats.orderCount} 笔订单</p>
            </div>
            <div class="card stat-card red p-4">
                <p class="text-xs text-gray-500 mb-1">待收款</p>
                <p class="text-2xl font-bold text-red-500">¥${stats.totalUnpaid}</p>
                <p class="text-xs text-gray-400 mt-1">请及时催收</p>
            </div>
            <div class="card stat-card purple p-4">
                <p class="text-xs text-gray-500 mb-1">回款率</p>
                <p class="text-2xl font-bold text-gray-800">${stats.totalRevenue > 0 ? Math.round((stats.totalReceived / stats.totalRevenue) * 100) : 0}<span class="text-base font-normal ml-1">%</span></p>
                <p class="text-xs text-gray-400 mt-1">已收/总营收</p>
            </div>
        </div>

        <!-- 图表 -->
        <div class="card p-4">
            <h3 class="font-bold text-gray-800 mb-3">近30天营收趋势</h3>
            <div class="chart-container">
                <canvas id="finance-chart"></canvas>
            </div>
        </div>

        <!-- 待收款订单列表 -->
        <div class="card p-4">
            <h3 class="font-bold text-gray-800 mb-3 flex items-center justify-between">
                <span>待收款订单</span>
                <span class="text-sm font-normal text-red-500">¥${stats.totalUnpaid}</span>
            </h3>
            ${renderUnpaidOrders()}
        </div>
    `;

    // 渲染图表
    setTimeout(() => {
        const ctx = document.getElementById('finance-chart');
        if (!ctx) return;
        if (financeChart) financeChart.destroy();
        financeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: stats.labels,
                datasets: [
                    {
                        label: '营收',
                        data: stats.revenues,
                        borderColor: '#e11d48',
                        backgroundColor: 'rgba(225, 29, 72, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        borderWidth: 2
                    },
                    {
                        label: '已收款',
                        data: stats.received,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } }
                },
                scales: {
                    x: { ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }, grid: { display: false } },
                    y: { beginAtZero: true, ticks: { font: { size: 10 }, callback: v => '¥' + v } }
                }
            }
        });
    }, 30);
}

function renderUnpaidOrders() {
    const unpaid = Store.getOrders().filter(o => {
        const total = Store.getOrderTotal(o);
        return (total - (o.paidAmount || 0)) > 0;
    });
    if (unpaid.length === 0) {
        return `<p class="text-center text-gray-400 py-6 text-sm">🎉 全部款项已收齐</p>`;
    }
    return unpaid.map(o => {
        const total = Store.getOrderTotal(o);
        const unpaidAmt = total - (o.paidAmount || 0);
        return `
        <div class="py-3 list-item flex items-center justify-between" onclick="openOrderDetail('${o.id}')">
            <div>
                <p class="font-medium text-gray-800 text-sm">${o.customer}</p>
                <p class="text-xs text-gray-500">总 ¥${total} · 已收 ¥${o.paidAmount || 0} · ${o.deliveryDate}</p>
            </div>
            <span class="font-bold text-red-500 text-sm">+¥${unpaidAmt}</span>
        </div>
        `;
    }).join('');
}

// ============================================================
// 6. 系统设置
// ============================================================
function renderSettings(main) {
    const s = Store.getSettings();
    const r = s.schedulingRules;

    main.innerHTML = `
        <div class="card p-4">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow">鑫</div>
                <div>
                    <h3 class="font-bold text-gray-800 text-lg">${s.brandName}</h3>
                    <p class="text-xs text-gray-500">高效 · 简洁 · 智慧</p>
                </div>
            </div>
        </div>

        <!-- 基础设置 -->
        <div class="card overflow-hidden">
            <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <h4 class="font-bold text-gray-700 text-sm">基础设置</h4>
            </div>
            <div class="p-4 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">店铺名称</label>
                    <input type="text" id="setting-brandName" value="${s.brandName}" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">每日可用产能（小时）</label>
                    <input type="number" id="setting-dailyCapacity" value="${s.dailyCapacity}" step="0.5" min="1" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
                    <p class="text-xs text-gray-400 mt-1">用于计算每日产能负荷，一般为8小时</p>
                </div>
            </div>
        </div>

        <!-- 排产规则 -->
        <div class="card overflow-hidden">
            <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <h4 class="font-bold text-gray-700 text-sm flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    排产规则
                </h4>
            </div>
            <div class="p-4 space-y-3">
                ${[
                    { key: 'urgencyFirst', title: '交付紧迫度优先', desc: '距离交货日期越近，排产越靠前' },
                    { key: 'inProgressFirst', title: '制作中优先', desc: '已经开始制作的订单优先排产' },
                    { key: 'priorityFirst', title: '订单优先级', desc: '紧急 > 优先 > 普通' },
                    { key: 'sameCategoryGroup', title: '同类集中制作', desc: '同类产品排在一起，减少切换成本' }
                ].map((item, idx) => `
                    <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
                        <input type="checkbox" id="rule-${item.key}" ${r[item.key] ? 'checked' : ''} class="mt-0.5 w-5 h-5 text-rose-500 rounded border-gray-300 focus:ring-rose-500">
                        <div class="flex-1">
                            <p class="font-medium text-gray-800 text-sm flex items-center gap-1.5">
                                <span class="text-xs text-white bg-slate-600 rounded px-1.5 py-0.5">${idx + 1}</span>
                                ${item.title}
                            </p>
                            <p class="text-xs text-gray-500 mt-1">${item.desc}</p>
                        </div>
                    </label>
                `).join('')}
            </div>
        </div>

        <!-- 数据管理 -->
        <div class="card overflow-hidden">
            <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <h4 class="font-bold text-gray-700 text-sm flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path></svg>
                    数据管理 & 多设备同步
                </h4>
            </div>
            <div class="p-4 space-y-3">
                <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 leading-relaxed">
                    💡 <strong>手机电脑同步方法：</strong>在本设备点「导出备份」→ 把文件发送到另一台设备 → 另一台设备点「导入恢复」。<br>
                    两台设备访问同一网址（GitHub Pages等），数据不会自动同步，需要手动导入导出。
                </div>
                <button class="btn w-full py-2.5 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm" onclick="exportData()">
                    📤 导出备份（当前数据下载为JSON文件）
                </button>
                <button class="btn w-full py-2.5 rounded-lg bg-green-50 text-green-600 font-medium text-sm" onclick="importData()">
                    📥 导入恢复（选择备份JSON文件）
                </button>
                <input type="file" id="import-file-input" accept=".json,application/json" class="hidden">
                <button class="btn w-full py-2.5 rounded-lg bg-amber-50 text-amber-600 font-medium text-sm" onclick="clearPlansBtn()">
                    🔄 清空排产计划（保留订单/产品）
                </button>
                <button class="btn w-full py-2.5 rounded-lg bg-red-50 text-red-600 font-medium text-sm" onclick="resetAllData()">
                    ⚠️ 重置为初始示例数据
                </button>
            </div>
        </div>

        <!-- 保存 -->
        <button class="btn w-full bg-rose-500 text-white py-3.5 rounded-xl font-bold text-base" onclick="saveSettings()">
            保存设置
        </button>

        <p class="text-center text-xs text-gray-400 pb-4">
            智能排产系统 v1.0 · 本地运行，数据自动保存
        </p>
    `;
}

function saveSettings() {
    const brandName = document.getElementById('setting-brandName').value.trim();
    const dailyCapacity = parseFloat(document.getElementById('setting-dailyCapacity').value) || 8;
    const rules = {
        urgencyFirst: document.getElementById('rule-urgencyFirst').checked,
        inProgressFirst: document.getElementById('rule-inProgressFirst').checked,
        priorityFirst: document.getElementById('rule-priorityFirst').checked,
        sameCategoryGroup: document.getElementById('rule-sameCategoryGroup').checked
    };
    Store.updateSettings({ brandName, dailyCapacity, schedulingRules: rules });
    showToast('设置已保存');
}

function clearPlansBtn() {
    if (confirm('确定清空所有排产计划吗？订单数据保留。')) {
        Store.clearPlans();
        cachedPlan = null;
        showToast('排产计划已清空');
    }
}

function resetAllData() {
    if (confirm('确定重置为初始示例数据吗？当前所有数据将被覆盖！')) {
        localStorage.removeItem('xinyi_scheduling_data_v1');
        Store.init();
        cachedPlan = null;
        showToast('数据已重置');
        renderCurrentTab();
    }
}

function exportData() {
    const data = localStorage.getItem('xinyi_scheduling_data_v1');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    a.download = `鑫意排产备份_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('备份已导出，请发送到另一台设备');
}

function importData() {
    const input = document.getElementById('import-file-input');
    if (!input) return;
    input.click();
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                // 简单校验格式
                if (!json.products || !json.orders || !json.settings) {
                    throw new Error('文件格式不正确');
                }
                const mode = confirm(
                    '选择导入方式：\n\n' +
                    '【确定 = 合并导入】把备份中的订单/产品合并到当前数据（按ID去重）\n' +
                    '【取消 = 覆盖导入】用备份完全覆盖当前数据（先清空再导入）'
                );
                if (mode) {
                    // 合并：按ID去重
                    const current = JSON.parse(localStorage.getItem('xinyi_scheduling_data_v1') || '{}');
                    const merged = {
                        products: mergeById(current.products || [], json.products),
                        orders: mergeById(current.orders || [], json.orders),
                        settings: current.settings || json.settings,
                        plans: json.plans || current.plans || []
                    };
                    localStorage.setItem('xinyi_scheduling_data_v1', JSON.stringify(merged));
                    Store.init();
                    cachedPlan = null;
                    renderCurrentTab();
                    showToast(`合并完成：新增${countNew(current.products, json.products)}个产品、${countNew(current.orders, json.orders)}个订单`);
                } else {
                    if (!confirm('确定覆盖当前数据吗？现有订单/产品会全部替换为备份内容！')) return;
                    localStorage.setItem('xinyi_scheduling_data_v1', JSON.stringify(json));
                    Store.init();
                    cachedPlan = null;
                    renderCurrentTab();
                    showToast('导入成功，数据已恢复');
                }
            } catch (err) {
                showToast('导入失败：' + (err.message || '文件格式错误'), 'error');
            }
            input.value = '';
        };
        reader.readAsText(file);
    };
}

function mergeById(a, b) {
    const map = new Map();
    a.forEach(it => map.set(it.id, it));
    b.forEach(it => map.set(it.id, it)); // 备份中的同ID会覆盖当前
    return Array.from(map.values());
}

function countNew(oldArr, newArr) {
    const oldIds = new Set(oldArr.map(o => o.id));
    return newArr.filter(o => !oldIds.has(o.id)).length;
}

// 暴露全局函数
window.switchTab = switchTab;
window.startProducing = startProducing;
window.completeOrder = completeOrder;
window.viewOrder = viewOrder;
window.openOrderForm = openOrderForm;
window.openOrderDetail = openOrderDetail;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrderConfirm = deleteOrderConfirm;
window.addOrderItem = addOrderItem;
window.runScheduler = runScheduler;
window.openProductForm = openProductForm;
window.deleteProductConfirm = deleteProductConfirm;
window.saveSettings = saveSettings;
window.clearPlansBtn = clearPlansBtn;
window.resetAllData = resetAllData;
window.exportData = exportData;
window.importData = importData;
window.closeModal = closeModal;
