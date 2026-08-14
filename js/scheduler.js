// ============ 排产 & 统计逻辑模块 ============

const Scheduler = (function () {

    function calcOrderWorkHours(order) {
        if (!order || !order.items) return 0;
        let total = 0;
        order.items.forEach(item => {
            const product = Store.getProductById(item.productId);
            if (product) {
                total += (parseFloat(product.workHours) || 0) * (parseFloat(item.qty) || 0);
            }
        });
        return Math.round(total * 100) / 100;
    }

    function calcOrderAmount(order) {
        if (!order || !order.items) return 0;
        let total = 0;
        order.items.forEach(item => {
            const product = Store.getProductById(item.productId);
            if (product) {
                const price = parseFloat(product.price) || 0;
                const qty = parseFloat(item.qty) || 0;
                total += price * qty;
            }
        });
        return Math.round(total * 100) / 100;
    }

    function calcProductWorkCost(product, qty) {
        const wh = parseFloat(product.workHours) || 0;
        const q = parseFloat(qty) || 0;
        return wh * q;
    }

    // 订单排产排序（按截图规则：交付紧迫度+制作中优先+订单优先级+同类集中）
    function sortOrdersForSchedule(orders) {
        const priorityRank = { urgent: 0, priority: 1, normal: 2 };
        const statusRank = { producing: 0, pending: 1, ready: 9, done: 9, cancelled: 9 };
        return [...orders].sort((a, b) => {
            // 1. 制作中优先
            const sr = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
            if (sr !== 0) return sr;
            // 2. 订单优先级（紧急>优先>普通）
            const pr = (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
            if (pr !== 0) return pr;
            // 3. 交货日期越近越前
            return (a.deliveryDate || '').localeCompare(b.deliveryDate || '');
        });
    }

    function generateSchedule(startDate, daysCount, ordersToSchedule) {
        const settings = Store.getSettings();
        const workHoursPerDay = parseFloat(settings.workHoursPerDay) || 8;
        const workers = parseInt(settings.workers) || 1;
        const dailyCapacity = workHoursPerDay * workers;

        let orders = ordersToSchedule || Store.getOrders().filter(o => o.status === 'pending' || o.status === 'producing');
        orders = sortOrdersForSchedule(orders);

        const schedule = [];
        let currentDayIndex = 0;
        let remainingCapacity = dailyCapacity;

        orders.forEach(order => {
            const neededHours = calcOrderWorkHours(order);
            let hoursLeft = neededHours;
            while (hoursLeft > 0.001) {
                if (currentDayIndex >= daysCount) break;
                const useHours = Math.min(hoursLeft, remainingCapacity);
                const date = Store.formatDate(Store.addDays(new Date(startDate), currentDayIndex));
                schedule.push({
                    date,
                    orderId: order.id,
                    orderCustomer: order.customer,
                    hoursAllocated: Math.round(useHours * 100) / 100,
                    percent: Math.round((useHours / Math.max(neededHours, 0.01)) * 100),
                    priority: order.priority || 'normal',
                    items: order.items
                });
                hoursLeft -= useHours;
                remainingCapacity -= useHours;
                if (remainingCapacity <= 0.001) {
                    currentDayIndex++;
                    remainingCapacity = dailyCapacity;
                }
            }
        });
        return schedule;
    }

    function getDateRange(startDate, daysCount) {
        const list = [];
        const start = new Date(startDate);
        for (let i = 0; i < daysCount; i++) {
            const d = Store.addDays(start, i);
            list.push({
                date: Store.formatDate(d),
                weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
                day: d.getDate(),
                month: d.getMonth() + 1,
                isToday: Store.formatDate(d) === Store.formatDate(new Date())
            });
        }
        return list;
    }

    // ============ 工作台统计 ============
    function getDashboardStats() {
        const orders = Store.getOrders();
        const products = Store.getProducts();
        const today = Store.formatDate(new Date());

        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const producingOrders = orders.filter(o => o.status === 'producing').length;
        const todayDelivery = orders.filter(o => o.deliveryDate === today).length;

        let todayOutput = 0;
        orders.filter(o => o.deliveryDate === today).forEach(o => {
            todayOutput += calcOrderAmount(o);
        });

        let pendingWorkHours = 0;
        orders.filter(o => o.status === 'pending' || o.status === 'producing').forEach(o => {
            pendingWorkHours += calcOrderWorkHours(o);
        });

        return {
            totalProducts: products.length,
            totalOrders: orders.length,
            pendingOrders,
            producingOrders,
            todayDelivery,
            todayOutput: Math.round(todayOutput * 100) / 100,
            pendingWorkHours: Math.round(pendingWorkHours * 100) / 100
        };
    }

    // ============ 财务统计（4张卡片数据） ============
    function getFinanceStats() {
        const orders = Store.getOrders();
        let totalRevenue = 0;   // 总营收：所有订单合计
        let totalReceived = 0;  // 已收款：paid=true 的订单合计
        let pendingReceive = 0; // 待收款
        let paidOrderCount = 0;

        orders.forEach(o => {
            const amt = calcOrderAmount(o);
            totalRevenue += amt;
            if (o.paid) {
                totalReceived += amt;
                paidOrderCount++;
            } else {
                pendingReceive += amt;
            }
        });

        const paybackRate = totalRevenue > 0 ? Math.round((totalReceived / totalRevenue) * 100) : 0;

        return {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalReceived: Math.round(totalReceived * 100) / 100,
            pendingReceive: Math.round(pendingReceive * 100) / 100,
            paybackRate,
            totalOrders: orders.length,
            paidOrderCount
        };
    }

    // 未来25天营收趋势（当前日期往后）
    function getLast30DaysTrend() {
        const labels = [];
        const revenueArr = [];
        const receivedArr = [];
        const orders = Store.getOrders();

        const today = new Date();
        for (let i = 0; i < 25; i++) {
            const d = Store.addDays(today, i);
            const dateStr = Store.formatDate(d);
            const labelShort = (d.getMonth() + 1) + '-' + String(d.getDate()).padStart(2, '0');
            labels.push(labelShort);

            let rev = 0, rec = 0;
            // 以交货日期作为归属日
            orders.filter(o => o.deliveryDate === dateStr).forEach(o => {
                const amt = calcOrderAmount(o);
                rev += amt;
                if (o.paid) rec += amt;
            });
            revenueArr.push(Math.round(rev * 100) / 100);
            receivedArr.push(Math.round(rec * 100) / 100);
        }
        return { labels, revenue: revenueArr, received: receivedArr };
    }

    // 待收款订单列表
    function getPendingReceiveOrders() {
        return Store.getOrders()
            .filter(o => !o.paid)
            .map(o => ({
                id: o.id,
                customer: o.customer,
                phone: o.phone,
                deliveryDate: o.deliveryDate,
                amount: calcOrderAmount(o)
            }))
            .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
    }

    // 排产概览（3块统计卡 + 按日分组排产，含制作日=交付日前一天，优先读持久化排产）
    // 当 useSaved=true 且已持久化排产数据时，按持久化的 orderIds 渲染（保证手动保存后的稳定）
    function getScheduleOverview(daysCount, useSaved) {
        const days = daysCount || 7;
        const orders = Store.getOrders().filter(o => o.status !== 'cancelled');
        const ordersToShow = Store.getOrders().filter(o => o.status === 'pending' || o.status === 'producing');
        const totalHours = ordersToShow.reduce((s, o) => s + calcOrderWorkHours(o), 0);

        const savedMap = useSaved ? Store.getScheduleMap() : {};

        const today = new Date();
        const todayStr = Store.formatDate(today);

        // 清理过期排产（早于今天的）
        if (useSaved) {
            Store.removeScheduleBefore(todayStr);
        }

        const dates = [];
        for (let i = 0; i < days; i++) {
            const d = Store.addDays(today, i);
            const dateStr = Store.formatDate(d);
            let items = [];

            if (useSaved && savedMap[dateStr] && savedMap[dateStr].orderIds && savedMap[dateStr].orderIds.length) {
                // 从持久化恢复
                savedMap[dateStr].orderIds.forEach(oid => {
                    const o = Store.getOrderById(oid);
                    if (o && o.status !== 'cancelled') {
                        items.push({
                            orderId: o.id,
                            customer: o.customer,
                            priority: o.priority || 'normal',
                            status: o.status,
                            hours: calcOrderWorkHours(o),
                            items: o.items,
                            deliveryDate: o.deliveryDate,
                            makeDate: dateStr
                        });
                    }
                });
                // 同类优先集中 + 优先级排序
                items = sortOrdersForSchedule(items.map(it => ({
                    ...Store.getOrderById(it.orderId),
                    _makeDate: it.makeDate
                }))).map(o => {
                    const src = items.find(x => x.orderId === o.id);
                    return src;
                }).filter(Boolean);
            } else {
                // 无持久化时回退：按 制作日=交付日前一天 规则计算
                const itemsOnDay = ordersToShow.filter(o => {
                    const deliv = new Date(o.deliveryDate);
                    const makeDay = Store.addDays(deliv, -1);
                    const makeDayStr = Store.formatDate(makeDay);
                    return makeDayStr === dateStr;
                }).map(o => ({
                    orderId: o.id,
                    customer: o.customer,
                    priority: o.priority || 'normal',
                    status: o.status,
                    hours: calcOrderWorkHours(o),
                    items: o.items,
                    deliveryDate: o.deliveryDate,
                    makeDate: dateStr
                }));
                items = sortOrdersForSchedule(itemsOnDay.map(x => ({
                    ...Store.getOrderById(x.orderId),
                    _makeDate: x.makeDate
                }))).map(o => {
                    const src = itemsOnDay.find(x => x.orderId === o.id);
                    return src;
                }).filter(Boolean);
            }

            const totalDayHours = Math.round(items.reduce((s, x) => s + x.hours, 0) * 100) / 100;
            dates.push({
                date: dateStr,
                isToday: todayStr === dateStr,
                dayNum: d.getDate(),
                monthNum: d.getMonth() + 1,
                weekday: ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()],
                items,
                totalHours: totalDayHours,
                generatedAt: savedMap[dateStr] ? savedMap[dateStr].generatedAt : null,
                hasSaved: !!(savedMap[dateStr] && savedMap[dateStr].orderIds && savedMap[dateStr].orderIds.length)
            });
        }

        const settings = Store.getSettings();
        const capacity = (parseFloat(settings.workHoursPerDay) || 8) * (parseInt(settings.workers) || 1);
        const daysNeeded = capacity > 0 ? Math.max(1, Math.ceil(totalHours / capacity)) : 1;

        return {
            pendingOrderCount: ordersToShow.length,
            totalHours: Math.round(totalHours * 100) / 100,
            daysNeeded,
            dates
        };
    }

    // 一键排产（把未来 days 天的制作日排产，保存到持久化；可更新重算）
    // 算法：
    // 1) 找出所有待制作/制作中且未完成的订单，按 sortOrdersForSchedule 排序
    // 2) 按「建议制作日=交付日前一天」的日期桶，容量受每日产能限制
    // 3) 超产能溢出的订单（同一制作日超出日产能）往后顺延
    function autoSchedule(days, opts) {
        const daysCount = days || 7;
        const options = opts || {};
        const settings = Store.getSettings();
        const capacity = (parseFloat(settings.workHoursPerDay) || 8) * (parseInt(settings.workers) || 1);

        // 取出可排的订单（未取消、且状态=pending或producing）
        const allCandidates = Store.getOrders()
            .filter(o => o && o.status !== 'cancelled' && o.status !== 'done')
            .filter(o => (o.status === 'pending' || o.status === 'producing'));

        // 每个订单的建议制作日 = 交付日前一天
        // 已经处于制作中的订单：如果它的「建议制作日」在排产窗口内，就放到那一天（不溢出）
        const sorted = sortOrdersForSchedule(allCandidates);

        const today = new Date();
        const todayStr = Store.formatDate(today);

        // 初始化未来 daysCount 天的容量桶
        const buckets = [];
        for (let i = 0; i < daysCount; i++) {
            const d = Store.addDays(today, i);
            buckets.push({
                date: Store.formatDate(d),
                remaining: capacity,
                orderIds: []
            });
        }

        // 已取消：移除
        // 先清空旧的排产（仅影响未来排产窗口）
        if (options.keepManualTweaks !== true) {
            // 默认重建所有排产
        }

        // 分配：先按建议日分配，不够再顺延
        sorted.forEach(order => {
            const hours = calcOrderWorkHours(order);
            const deliv = new Date(order.deliveryDate);
            const suggestedMakeDay = Store.addDays(deliv, -1);
            const suggestedStr = Store.formatDate(suggestedMakeDay);

            // 找建议日所在桶的索引
            let startIdx = buckets.findIndex(b => b.date === suggestedStr);
            if (startIdx < 0) {
                // 建议日在窗口之前：把它塞到最早可排的那天（>=today）
                if (suggestedStr < todayStr) startIdx = 0;
                else startIdx = buckets.length - 1; // 建议日在窗口之后，只能放在最后一天
            }

            // 订单不可分 → 找第一个能放得下的天
            if (options.allowSplit !== true) {
                let placedIdx = -1;
                for (let i = startIdx; i < buckets.length; i++) {
                    if (buckets[i].remaining + 0.001 >= hours) {
                        placedIdx = i;
                        break;
                    }
                }
                if (placedIdx === -1) {
                    // 所有天都放不下 → 放到最后一天
                    placedIdx = buckets.length - 1;
                }
                buckets[placedIdx].orderIds.push(order.id);
                buckets[placedIdx].remaining = Math.max(0, buckets[placedIdx].remaining - hours);
            } else {
                // 允许拆分（默认不启用，预留路径）
                let left = hours;
                let cur = startIdx;
                while (left > 0.001 && cur < buckets.length) {
                    if (buckets[cur].remaining > 0.001) {
                        buckets[cur].orderIds.push(order.id);
                        const used = Math.min(left, buckets[cur].remaining);
                        buckets[cur].remaining = Math.max(0, buckets[cur].remaining - used);
                        left -= used;
                    }
                    cur++;
                }
            }
        });

        // 写入 Store 持久化
        const updatedDates = [];
        buckets.forEach(b => {
            Store.setScheduleForDate(b.date, b.orderIds);
            updatedDates.push(b.date);
        });

        return {
            capacity,
            updatedDates,
            orderCount: sorted.length,
            buckets
        };
    }

    return {
        calcOrderWorkHours,
        calcOrderAmount,
        calcProductWorkCost,
        generateSchedule,
        getDateRange,
        getDashboardStats,
        sortOrdersForSchedule,
        // Finance
        getFinanceStats,
        getLast30DaysTrend,
        getPendingReceiveOrders,
        // Schedule overview
        getScheduleOverview,
        autoSchedule
    };
})();
