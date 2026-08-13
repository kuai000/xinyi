// ==================== 智能排产算法 ====================
const Scheduler = (function () {

    // 制作日 = 交付日 - 1天（提前一天制作）
    function getMakeDate(deliveryDate) {
        return Store.formatDate(Store.addDays(new Date(deliveryDate), -1));
    }

    // 字符串日期加N天
    function addDaysStr(dateStr, n) {
        return Store.formatDate(Store.addDays(new Date(dateStr), n));
    }

        /**
         * 核心排产算法（严格按订单自身的制作日期分配到对应日期卡片）
         * 规则：
         * 0. 订单严格落到自己的"应制作日"（交付日前一天）对应卡片 → 卡片日期 = 订单制作日期
         * 1. 若应制作日容量不够 → 当天继续塞（负荷>100%红条提示），只有当天完全塞不下的大订单才拆分往后顺延
         * 2. 【禁止往前提前】：不得为了腾位置把订单提前塞到更早的制作日卡片（否则卡片日期和订单制作日不匹配）
         * 3. 顺延到 makeDate 之后的日期才是真正"⚠️排产超时"（可能影响次日交付）
         */
        function generatePlan() {
            const settings = Store.getSettings();
            const rules = settings.schedulingRules;
            const dailyCapacity = settings.dailyCapacity;

            const orders = Store.getOrders().filter(o => o.status === 'pending' || o.status === 'producing');
            if (orders.length === 0) return { plans: [], summary: { totalOrders: 0, totalHours: 0, days: 0 } };

            const today = Store.formatDate(new Date());

            // 1. 给每个订单打标签：总工时、应制作日
            orders.forEach(o => {
                o._laborHours = Store.getOrderLaborHours(o);
                o._makeDate = getMakeDate(o.deliveryDate);
                // 今天交付没做 / 应制作日已经过去 → 归到今天制作卡片
                if ((o.deliveryDate === today && o.status !== 'completed') || o._makeDate < today) {
                    o._makeDate = today;
                }
                o._daysToMakeDate = Math.max(0, Math.ceil((new Date(o._makeDate) - new Date(today)) / (1000 * 60 * 60 * 24)));
            });

            // 2. 按规则给订单排序（决定【同一张卡片】内的顺序，不改变卡片归属）
            const sorted = [...orders].sort((a, b) => {
                let scoreA = 0, scoreB = 0;
                if (rules.urgencyFirst) {
                    scoreA += (30 - Math.min(a._daysToMakeDate, 30)) * 10;
                    scoreB += (30 - Math.min(b._daysToMakeDate, 30)) * 10;
                }
                if (rules.inProgressFirst) {
                    if (a.status === 'producing') scoreA += 100;
                    if (b.status === 'producing') scoreB += 100;
                }
                if (rules.priorityFirst) {
                    scoreA += (a.priority || 0) * 50;
                    scoreB += (b.priority || 0) * 50;
                }
                return scoreB - scoreA;
            });

            // 3. 同类集中（只在"同一张制作日卡片"或相邻制作日才集中）
            if (rules.sameCategoryGroup) {
                const grouped = [];
                const used = new Set();
                sorted.forEach(o => {
                    if (used.has(o.id)) return;
                    const mainItem = o.items[0];
                    const product = mainItem ? Store.getProduct(mainItem.productId) : null;
                    const cat = product ? product.category : '';
                    grouped.push(o);
                    used.add(o.id);
                    sorted.forEach(o2 => {
                        if (used.has(o2.id)) return;
                        const mainItem2 = o2.items[0];
                        const product2 = mainItem2 ? Store.getProduct(mainItem2.productId) : null;
                        const cat2 = product2 ? product2.category : '';
                        if (cat && cat2 && cat === cat2 && Math.abs(o._daysToMakeDate - o2._daysToMakeDate) <= 1) {
                            grouped.push(o2);
                            used.add(o2.id);
                        }
                    });
                });
                sorted.length = 0;
                sorted.push(...grouped);
            }

            // 4. 日期容器
            const dayBuckets = new Map();
            function getBucket(dateStr) {
                if (!dayBuckets.has(dateStr)) {
                    dayBuckets.set(dateStr, { hours: 0, items: [] });
                }
                return dayBuckets.get(dateStr);
            }
            function availableOn(dateStr) {
                return Math.max(0, dailyCapacity - getBucket(dateStr).hours);
            }

            // —— 放置策略（关键改动）——
            // 规则 A：【不准提前】！子项 placedDate 绝不早于订单 makeDate，保证黑框日期=订单制作日期
            // 规则 B：先放在 makeDate，哪怕已经超出负荷（用户会看到红条，合理，因为那一天就是要做那么多）
            // 规则 C：只有"超大单（>单日容量）"或"当天已经真的塞不下"才拆分"向后顺延"一段
            function placeOrder(order, makeDate) {
                const orderHours = order._laborHours;
                const itemsSummary = order.items.map(i => {
                    const p = Store.getProduct(i.productId);
                    return `${p ? p.name : '未知'} x${i.quantity}`;
                }).join('、');
                const baseInfo = {
                    orderId: order.id,
                    customer: order.customer,
                    deliveryDate: order.deliveryDate,
                    makeDate: makeDate,           // 应制作日（卡片上的日期应该就是这个）
                    priority: order.priority,
                    status: order.status,
                    summary: itemsSummary,
                    totalOrderHours: orderHours
                };

                let remaining = orderHours;
                let firstChunk = true;
                // 第一站：先放到 makeDate，塞多少算多少（超容也塞，因为这一天本来就该做这个订单）
                (function tryFill(dateStr, isFirstDay) {
                    if (remaining <= 0.001) return true;
                    const bk = getBucket(dateStr);
                    // 第一天：直接放（哪怕超出日容量，负荷红条给用户提示）
                    // 之后顺延的日子：尊重容量，不再超容
                    let chunk;
                    if (isFirstDay) {
                        chunk = remaining; // 第一天全塞进去（超容无所谓）
                    } else {
                        const avail = availableOn(dateStr);
                        if (avail <= 0.05) return false;
                        chunk = Math.min(remaining, avail);
                    }
                    const overdue = dateStr > makeDate;
                    bk.items.push({
                        ...baseInfo,
                        hours: Store.round1(chunk),
                        placedDate: dateStr,
                        isPartial: !firstChunk || remaining - chunk > 0.001,
                        _overdue: overdue
                    });
                    bk.hours += chunk;
                    remaining -= chunk;
                    firstChunk = false;
                    return remaining <= 0.001;
                })(makeDate, true);

                // 第二天及以后：顺延向后找空位（>单日容量的大订单拆分用；或第一天超太多…但我们第一天已经塞了，所以通常拆分只在大订单时出现）
                if (remaining > 0.001) {
                    let searchFrom = addDaysStr(makeDate, 1);
                    let guard = 0;
                    while (remaining > 0.001 && guard < 90) {
                        const done = (function tryFill(dateStr) {
                            const avail = availableOn(dateStr);
                            if (avail <= 0.05) return false;
                            const chunk = Math.min(remaining, avail);
                            const bk = getBucket(dateStr);
                            const overdue = dateStr > makeDate;
                            bk.items.push({
                                ...baseInfo,
                                hours: Store.round1(chunk),
                                placedDate: dateStr,
                                isPartial: true,
                                _overdue: overdue
                            });
                            bk.hours += chunk;
                            remaining -= chunk;
                            return true;
                        })(searchFrom);
                        if (remaining <= 0.001) break;
                        searchFrom = addDaysStr(searchFrom, 1);
                        guard++;
                    }
                }
            }

            // 5. 每个订单分配到它自己的"应制作日卡片"（绝不往更早的日期塞）
            sorted.forEach(order => placeOrder(order, order._makeDate));

            // 6. buckets → plans 数组，按日期升序
            const sortedDates = Array.from(dayBuckets.keys()).sort();
            const plans = sortedDates.map(dateStr => {
                const bucket = dayBuckets.get(dateStr);
                const d = new Date(dateStr);
                const deliveryDay = Store.addDays(d, 1);
                // 卡片负荷：允许超过100%，真实反映这一天要做多少工时
                const loadRaw = dailyCapacity > 0 ? (bucket.hours / dailyCapacity) * 100 : 0;
                return {
                    date: dateStr,
                    label: formatDateLabel(d),
                    subLabel: `${deliveryDay.getMonth() + 1}/${deliveryDay.getDate()} 交付`,
                    items: bucket.items.map(it => {
                        // 顺延（placedDate > makeDate）才是真正的"超时"
                        if (it.placedDate > it.makeDate && !it._overdue) it._overdue = true;
                        return it;
                    }),
                    totalHours: Store.round1(bucket.hours),
                    load: dailyCapacity > 0 ? Math.round(loadRaw) : 0, // 真实显示>100%
                    makeDate: dateStr,
                    deliveryDate: Store.formatDate(deliveryDay)
                };
            });

            // 7. 汇总
            let totalHours = 0;
            let overdueCount = 0;
            plans.forEach(p => {
                totalHours += p.totalHours;
                p.items.forEach(it => { if (it._overdue) overdueCount++; });
            });

            return {
                plans,
                summary: {
                    totalOrders: sorted.length,
                    totalHours: Store.round1(totalHours),
                    days: plans.length,
                    overdueWarning: overdueCount
                }
            };
        }

    // 日期卡片标题：直接写"X月X日制作"，不再用"今天制作"这种相对词
    function formatDateLabel(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
        if (diff === 0) return `${date.getMonth() + 1}月${date.getDate()}日制作（今天）`;
        if (diff === 1) return `${date.getMonth() + 1}月${date.getDate()}日制作（明天）`;
        if (diff === 2) return `${date.getMonth() + 1}月${date.getDate()}日制作（后天）`;
        return `${date.getMonth() + 1}月${date.getDate()}日制作`;
    }

    return {
        generatePlan
    };
})();
