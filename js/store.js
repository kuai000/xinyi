// ==================== 数据模型与状态管理 ====================
// 使用 localStorage 进行数据持久化

const Store = (function () {
    const STORAGE_KEY = 'xinyi_scheduling_data_v1';

    // 默认产品列表
    const DEFAULT_PRODUCTS = [
        { id: 'p1', name: '传统花糕', laborHours: 0.5, price: 15, category: '传统' },
        { id: 'p2', name: '枣饽饽', laborHours: 0.3, price: 8, category: '传统' },
        { id: 'p3', name: '寿桃馒头', laborHours: 0.8, price: 25, category: '祝寿' },
        { id: 'p4', name: '生日花样馒头', laborHours: 1.2, price: 68, category: '祝寿' },
        { id: 'p5', name: '婚庆喜饽饽', laborHours: 2.0, price: 188, category: '婚庆' },
        { id: 'p6', name: '满月百天花样', laborHours: 1.5, price: 128, category: '满月' },
        { id: 'p7', name: '卡通动物馒头', laborHours: 0.6, price: 20, category: '儿童' },
        { id: 'p8', name: '果蔬彩虹馒头', laborHours: 0.4, price: 12, category: '果蔬' },
    ];

    // 默认设置
    const DEFAULT_SETTINGS = {
        brandName: '鑫意花样馒头',
        dailyCapacity: 8.0,         // 每日可用产能（小时）
        schedulingRules: {
            urgencyFirst: true,     // 交付紧迫度优先
            inProgressFirst: true,  // 制作中优先
            priorityFirst: true,    // 订单优先级
            sameCategoryGroup: true // 同类集中制作
        }
    };

    // 默认示例订单
    const DEFAULT_ORDERS = [
        {
            id: 'o' + Date.now() + '_1',
            customer: '王阿姨',
            phone: '138****1234',
            items: [{ productId: 'p3', quantity: 6 }, { productId: 'p2', quantity: 20 }],
            deliveryDate: formatDate(addDays(new Date(), 1)),
            priority: 2, // 0=普通,1=优先,2=紧急
            status: 'pending', // pending=待制作, producing=制作中, completed=已完成, delivered=已取货
            paymentStatus: 'paid', // unpaid=未付, partial=部分付, paid=已付
            paidAmount: 310,
            remark: '老人80大寿，早上9点取',
            createdAt: new Date().toISOString()
        },
        {
            id: 'o' + Date.now() + '_2',
            customer: '李小姐',
            phone: '139****5678',
            items: [{ productId: 'p5', quantity: 1 }],
            deliveryDate: formatDate(addDays(new Date(), 3)),
            priority: 1,
            status: 'pending',
            paymentStatus: 'partial',
            paidAmount: 100,
            remark: '下周六婚礼用',
            createdAt: new Date().toISOString()
        },
        {
            id: 'o' + Date.now() + '_3',
            customer: '张大哥',
            phone: '137****9012',
            items: [{ productId: 'p6', quantity: 1 }, { productId: 'p7', quantity: 10 }],
            deliveryDate: formatDate(addDays(new Date(), 2)),
            priority: 0,
            status: 'pending',
            paymentStatus: 'unpaid',
            paidAmount: 0,
            remark: '宝宝百天宴',
            createdAt: new Date().toISOString()
        }
    ];

    // ==================== 工具函数 ====================
    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function formatDate(date) {
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function uid(prefix = 'id') {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    // ==================== 状态 ====================
    let state = null;
    let listeners = [];

    function init() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                state = JSON.parse(raw);
            } catch (e) {
                state = createDefaultState();
            }
        } else {
            state = createDefaultState();
        }
        save();
    }

    function createDefaultState() {
        return {
            products: JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)),
            orders: JSON.parse(JSON.stringify(DEFAULT_ORDERS)),
            settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
            plans: [] // 排产计划
        };
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        listeners.forEach(fn => {
            try { fn(state); } catch (e) { console.error(e); }
        });
    }

    function subscribe(fn) {
        listeners.push(fn);
        return () => {
            listeners = listeners.filter(f => f !== fn);
        };
    }

    // ==================== 产品管理 ====================
    function getProducts() {
        return [...state.products];
    }

    function getProduct(id) {
        return state.products.find(p => p.id === id);
    }

    function addProduct(product) {
        const p = {
            id: uid('p'),
            name: product.name,
            laborHours: parseFloat(product.laborHours) || 0,
            price: parseFloat(product.price) || 0,
            category: product.category || '其他'
        };
        state.products.push(p);
        save();
        return p;
    }

    function updateProduct(id, data) {
        const idx = state.products.findIndex(p => p.id === id);
        if (idx >= 0) {
            state.products[idx] = { ...state.products[idx], ...data, laborHours: parseFloat(data.laborHours) || 0, price: parseFloat(data.price) || 0 };
            save();
            return state.products[idx];
        }
        return null;
    }

    function deleteProduct(id) {
        const idx = state.products.findIndex(p => p.id === id);
        if (idx >= 0) {
            state.products.splice(idx, 1);
            save();
            return true;
        }
        return false;
    }

    // ==================== 订单管理 ====================
    function getOrders(filter = {}) {
        let list = [...state.orders];
        if (filter.status) list = list.filter(o => o.status === filter.status);
        if (filter.paymentStatus) list = list.filter(o => o.paymentStatus === filter.paymentStatus);
        // 按交付日期 + 优先级排序
        list.sort((a, b) => {
            const da = new Date(a.deliveryDate).getTime();
            const db = new Date(b.deliveryDate).getTime();
            if (da !== db) return da - db;
            return (b.priority || 0) - (a.priority || 0);
        });
        return list;
    }

    function getOrder(id) {
        return state.orders.find(o => o.id === id);
    }

    function getOrderTotal(order) {
        let total = 0;
        order.items.forEach(item => {
            const p = getProduct(item.productId);
            if (p) total += p.price * item.quantity;
        });
        return total;
    }

    function getOrderLaborHours(order) {
        let h = 0;
        order.items.forEach(item => {
            const p = getProduct(item.productId);
            if (p) h += p.laborHours * item.quantity;
        });
        return h;
    }

    function addOrder(order) {
        const o = {
            id: uid('o'),
            customer: order.customer,
            phone: order.phone || '',
            items: order.items.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity) || 0 })),
            deliveryDate: order.deliveryDate,
            priority: parseInt(order.priority) || 0,
            status: 'pending',
            paymentStatus: order.paymentStatus || 'unpaid',
            paidAmount: parseFloat(order.paidAmount) || 0,
            remark: order.remark || '',
            createdAt: new Date().toISOString()
        };
        state.orders.push(o);
        save();
        return o;
    }

    function updateOrder(id, data) {
        const idx = state.orders.findIndex(o => o.id === id);
        if (idx >= 0) {
            const merged = { ...state.orders[idx], ...data };
            if (data.items) {
                merged.items = data.items.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity) || 0 }));
            }
            if (data.priority !== undefined) merged.priority = parseInt(data.priority);
            if (data.paidAmount !== undefined) merged.paidAmount = parseFloat(data.paidAmount) || 0;
            state.orders[idx] = merged;
            save();
            return state.orders[idx];
        }
        return null;
    }

    function deleteOrder(id) {
        const idx = state.orders.findIndex(o => o.id === id);
        if (idx >= 0) {
            state.orders.splice(idx, 1);
            save();
            return true;
        }
        return false;
    }

    // ==================== 排产计划 ====================
    function getPlans() {
        return [...state.plans];
    }

    function savePlans(plans) {
        state.plans = plans;
        save();
    }

    function clearPlans() {
        state.plans = [];
        save();
    }

    // ==================== 设置 ====================
    function getSettings() {
        return { ...state.settings };
    }

    function updateSettings(data) {
        state.settings = { ...state.settings, ...data };
        if (data.schedulingRules) {
            state.settings.schedulingRules = { ...state.settings.schedulingRules, ...data.schedulingRules };
        }
        state.settings.dailyCapacity = parseFloat(state.settings.dailyCapacity) || 8;
        save();
        return state.settings;
    }

    // ==================== 统计方法 ====================
    // 制作日期 = 交付日期 - 1天（提前一天制作）
    function getMakeDate(deliveryDate) {
        return formatDate(addDays(new Date(deliveryDate), -1));
    }

    function getDashboardStats() {
        const today = formatDate(new Date());
        const orders = state.orders;
        const settings = state.settings;

        const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'producing');
        const unpaidOrders = orders.filter(o => o.paymentStatus !== 'paid');

        // 今日预计工时（今天需要制作的订单：制作日=今天 或 制作中 或 今天要交付但还没做完的）
        let todayHours = 0;
        pendingOrders.forEach(o => {
            const makeDate = getMakeDate(o.deliveryDate);
            const shouldMakeToday =
                makeDate === today ||                     // 明天交付 → 今天做
                o.status === 'producing' ||               // 制作中的继续做
                (o.deliveryDate === today && o.status !== 'completed'); // 今天交付但还没完成
            if (shouldMakeToday) {
                todayHours += getOrderLaborHours(o);
            }
        });

        // 今日产能负荷
        const capacityLoad = settings.dailyCapacity > 0
            ? Math.min(999, Math.round((todayHours / settings.dailyCapacity) * 100))
            : 0;

        return {
            pendingCount: pendingOrders.length,
            todayHours: round1(todayHours),
            capacityLoad,
            dailyCapacity: settings.dailyCapacity,
            unpaidCount: unpaidOrders.length
        };
    }

    function round1(n) {
        return Math.round(n * 10) / 10;
    }

    // 获取风险订单（提前一天制作逻辑）
    function getRiskOrders() {
        const today = formatDate(new Date());
        const tomorrow = formatDate(addDays(new Date(), 1));
        const dayAfterTomorrow = formatDate(addDays(new Date(), 2));
        const risks = [];
        state.orders.forEach(o => {
            if (o.status === 'completed' || o.status === 'delivered') return;
            const makeDate = getMakeDate(o.deliveryDate);

            // 风险1: 今天交付但还没完成 → 最紧急
            if (o.deliveryDate === today && o.status !== 'completed') {
                risks.push({ id: o.id, type: 'urgent', message: `【${o.customer}】🚨今日需交付！请立即完成或提醒客户` });
            }

            // 风险2: 明天交付，但今天是制作日，订单还没开始做 → 需要立即开工
            if (makeDate === today && o.status === 'pending') {
                risks.push({ id: o.id, type: 'schedule', message: `【${o.customer}】${formatDateShort(o.deliveryDate)}交付，今日必须制作（尚未开始）` });
            }

            // 风险3: 未付款且即将制作（制作日是今天或明天）
            if (o.paymentStatus !== 'paid' && (makeDate === today || makeDate === tomorrow)) {
                risks.push({ id: o.id, type: 'payment', message: `【${o.customer}】${formatDateShort(o.deliveryDate)}交付，${paymentLabel(o.paymentStatus)}，建议收款后再制作` });
            }

            // 风险4: 明天交付但制作还没完成
            if (o.deliveryDate === tomorrow && o.status === 'producing') {
                risks.push({ id: o.id, type: 'schedule', message: `【${o.customer}】${formatDateShort(o.deliveryDate)}交付，制作中，请今天完成` });
            }
        });
        return risks;
    }

    function formatDateShort(d) {
        const date = new Date(d);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function paymentLabel(s) {
        return { unpaid: '尚未收款', partial: '部分收款', paid: '已收款' }[s] || s;
    }

    function statusLabel(s) {
        return { pending: '待制作', producing: '制作中', completed: '已完成', delivered: '已取货' }[s] || s;
    }

    function priorityLabel(p) {
        return ['普通', '优先', '紧急'][p] || '普通';
    }

    // 未来7天产能（制作日视角：提前一天制作）
    // 每个产能卡片显示的是"这天需要做什么（对应第二天交付）"
    function get7DayCapacity() {
        const result = [];
        const settings = state.settings;
        const pendingOrders = state.orders.filter(o => o.status === 'pending' || o.status === 'producing');
        const today = formatDate(new Date());

        for (let i = 0; i < 7; i++) {
            const makeDate = formatDate(addDays(new Date(), i)); // 制作日
            const deliveryDate = formatDate(addDays(new Date(makeDate), 1)); // 次日交货
            let hours = 0;
            let orderCount = 0;

            pendingOrders.forEach(o => {
                const laborH = getOrderLaborHours(o);
                const oMakeDate = getMakeDate(o.deliveryDate); // 订单应该制作的日期
                const daysDiff = Math.max(0, Math.ceil((new Date(oMakeDate) - new Date(today)) / (1000 * 60 * 60 * 24)));

                // 订单制作日正好是这天 → 全额计入
                if (oMakeDate === makeDate) {
                    hours += laborH;
                    orderCount += 1;
                } else if (oMakeDate > makeDate && i < daysDiff && o.status === 'pending') {
                    // 还没到制作日，把工时平均摊到之前的空闲日（展示"预排"效果）
                    // 只有在距离制作日还远时才平均摊
                    hours += laborH / Math.max(daysDiff, 1) * 0.3; // 预排只显示30%，避免重复计算
                }

                // 特殊：今天要交付但还没做 → 计入今天（紧急补做）
                if (i === 0 && o.deliveryDate === today && o.status !== 'completed') {
                    hours += laborH;
                    orderCount += 1;
                }
            });

            const load = settings.dailyCapacity > 0 ? (hours / settings.dailyCapacity) * 100 : 0;
            const labelPrefix = i === 0 ? '今天' : i === 1 ? '明天' : i === 2 ? '后天' : null;
            result.push({
                date: makeDate,
                label: labelPrefix || `${new Date(makeDate).getMonth() + 1}/${new Date(makeDate).getDate()}`,
                subLabel: `${new Date(deliveryDate).getMonth() + 1}/${new Date(deliveryDate).getDate()} 交`, // 下一天的交货日
                orderCount,
                hours: round1(hours),
                load: Math.min(100, Math.round(load)),
                status: load > 100 ? '过载' : load > 80 ? '紧张' : '正常'
            });
        }
        return result;
    }

    // 财务统计
    function getFinanceStats(days = 30) {
        const now = new Date();
        const startDate = addDays(now, -days + 1);
        const startStr = formatDate(startDate);

        const orders = state.orders.filter(o => {
            return o.createdAt >= new Date(startStr).toISOString() || true; // 简化：所有订单
        });

        let totalRevenue = 0;
        let totalReceived = 0;
        let totalUnpaid = 0;
        const byDate = {};

        // 初始化日期
        for (let i = days - 1; i >= 0; i--) {
            const d = formatDate(addDays(now, -i));
            byDate[d] = { revenue: 0, received: 0 };
        }

        orders.forEach(o => {
            const total = getOrderTotal(o);
            const created = formatDate(o.createdAt);
            totalRevenue += total;
            totalReceived += o.paidAmount;
            totalUnpaid += (total - o.paidAmount);
            if (byDate[created]) {
                byDate[created].revenue += total;
                byDate[created].received += o.paidAmount;
            }
        });

        const labels = Object.keys(byDate).sort();
        const revenues = labels.map(d => round1(byDate[d].revenue));
        const received = labels.map(d => round1(byDate[d].received));

        return {
            totalRevenue: round1(totalRevenue),
            totalReceived: round1(totalReceived),
            totalUnpaid: round1(totalUnpaid),
            orderCount: orders.length,
            labels: labels.map(d => d.slice(5)),
            revenues,
            received
        };
    }

    return {
        // 基础
        init, save, subscribe,
        // 产品
        getProducts, getProduct, addProduct, updateProduct, deleteProduct,
        // 订单
        getOrders, getOrder, addOrder, updateOrder, deleteOrder,
        getOrderTotal, getOrderLaborHours,
        // 排产
        getPlans, savePlans, clearPlans,
        // 设置
        getSettings, updateSettings,
        // 统计
        getDashboardStats, getRiskOrders, get7DayCapacity, getFinanceStats,
        // 工具
        formatDate, addDays, uid,
        formatDateShort, paymentLabel, statusLabel, priorityLabel, round1
    };
})();
