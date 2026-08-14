// ============ 数据存储模块 ============
// 使用 localStorage 持久化数据

const Store = (function () {
    const KEYS = {
        PRODUCTS: 'xy_products',       // 产品/工时配置
        ORDERS: 'xy_orders',           // 订单
        SCHEDULE: 'xy_schedule',       // 排产
        FINANCE: 'xy_finance',         // 财务记录
        SETTINGS: 'xy_settings'        // 设置
    };

    // 默认产品数据（截图中有：鱼两条、两个福袋、两个小寿桃，分类"传统"，也保留小数价格）
    const DEFAULT_PRODUCTS = [
        { id: 1, name: '鱼两条',     unit: '个', price: 50,    workHours: 3,   category: '传统' },
        { id: 2, name: '两个福袋',   unit: '个', price: 15,    workHours: 1,   category: '传统' },
        { id: 3, name: '两个小寿桃', unit: '个', price: 17,    workHours: 1,   category: '传统' },
        { id: 4, name: '花式馒头-玫瑰', unit: '个', price: 1.5, workHours: 0.1, category: '花式类' },
        { id: 5, name: '千层糕',     unit: '斤', price: 7.5,   workHours: 0.8, category: '糕点类' }
    ];

    // 默认订单：匹配截图（手机号=客户名，待制作，已收款）
    const DEFAULT_ORDERS = [
        {
            id: 1,
            customer: '15937206757',    // 手机号当作客户名
            phone: '15937206757',
            deliveryDate: formatDate(addDays(new Date(), 1)),
            items: [
                { productId: 1, qty: 1 },
                { productId: 2, qty: 1 },
                { productId: 3, qty: 1 }
            ],
            status: 'pending',          // pending=待制作 / producing=制作中 / done=已完成 / cancelled=已取消
            priority: 'normal',         // urgent=紧急 / priority=优先 / normal=普通
            paid: true,                 // 是否已收款
            remark: ''
        }
    ];

    const DEFAULT_SETTINGS = {
        workHoursPerDay: 8,
        workers: 3,
        shopName: '鑫意花样馒头',
        shopSlogan: '高效 · 简洁 · 智慧',
        contact: ''
    };

    function formatDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function addDays(d, n) {
        const r = new Date(d);
        r.setDate(r.getDate() + n);
        return r;
    }

    function get(key, defaultValue) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
            return defaultValue;
        } catch (e) {
            console.error('Store.get error:', e);
            return defaultValue;
        }
    }

    function set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Store.set error:', e);
            return false;
        }
    }

    function genId(list) {
        if (!list || list.length === 0) return 1;
        return Math.max(...list.map(i => i.id || 0)) + 1;
    }

    // ============ 产品/工时 API ============
    function getProducts() {
        return get(KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    }

    function saveProducts(products) {
        return set(KEYS.PRODUCTS, products);
    }

    function addProduct(product) {
        const products = getProducts();
        product.id = genId(products);
        product.price = parseFloat(product.price) || 0;
        product.workHours = parseFloat(product.workHours) || 0;
        products.push(product);
        saveProducts(products);
        return product;
    }

    function updateProduct(id, updates) {
        // 兼容传整个对象的调用：updateProduct(productObj)
        if (typeof id === 'object' && id != null && id.id != null) {
            updates = id;
            id = id.id;
        }
        const products = getProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) return null;
        if (updates.price !== undefined) updates.price = parseFloat(updates.price) || 0;
        if (updates.workHours !== undefined) updates.workHours = parseFloat(updates.workHours) || 0;
        products[idx] = { ...products[idx], ...updates };
        saveProducts(products);
        return products[idx];
    }

    function deleteProduct(id) {
        const products = getProducts();
        const filtered = products.filter(p => p.id !== id);
        saveProducts(filtered);
        return filtered.length !== products.length;
    }

    function getProductById(id) {
        return getProducts().find(p => p.id === id);
    }

    // ============ 订单 API ============
    function getOrders() {
        // 兼容旧数据：补全 priority/paid 等字段
        const raw = get(KEYS.ORDERS, DEFAULT_ORDERS);
        return raw.map(o => ({
            priority: 'normal',
            paid: o.status === 'done',
            ...o,
            phone: o.phone || o.customer || ''
        }));
    }

    function saveOrders(orders) {
        return set(KEYS.ORDERS, orders);
    }

    function addOrder(order) {
        const orders = getOrders();
        order.id = genId(orders);
        order.createTime = new Date().toISOString();
        order.priority = order.priority || 'normal';
        if (order.paid === undefined) order.paid = false;
        order.phone = order.phone || order.customer || '';
        orders.push(order);
        saveOrders(orders);
        return order;
    }

    function updateOrder(id, updates) {
        // 兼容传整个对象的调用：updateOrder(orderObj)
        if (typeof id === 'object' && id != null && id.id != null) {
            updates = id;
            id = id.id;
        }
        const orders = getOrders();
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return null;
        orders[idx] = { ...orders[idx], ...updates };
        if (updates.customer && !updates.phone) orders[idx].phone = updates.customer;
        saveOrders(orders);
        return orders[idx];
    }

    function deleteOrder(id) {
        const orders = getOrders();
        const filtered = orders.filter(o => o.id !== id);
        saveOrders(filtered);
        return filtered.length !== orders.length;
    }

    function getOrderById(id) {
        return getOrders().find(o => o.id === id);
    }

    // ============ 排产 API ============
    function getSchedule() {
        return get(KEYS.SCHEDULE, []);
    }

    function saveSchedule(schedule) {
        return set(KEYS.SCHEDULE, schedule);
    }

    // ============ 财务 API ============
    function getFinance() {
        return get(KEYS.FINANCE, []);
    }

    function saveFinance(finance) {
        return set(KEYS.FINANCE, finance);
    }

    function addFinanceRecord(record) {
        const list = getFinance();
        record.id = genId(list);
        record.date = record.date || formatDate(new Date());
        record.amount = parseFloat(record.amount) || 0;
        list.push(record);
        saveFinance(list);
        return record;
    }

    // ============ 设置 API ============
    function getSettings() {
        // 兼容旧字段，补全 shopSlogan
        const s = get(KEYS.SETTINGS, DEFAULT_SETTINGS);
        return { ...DEFAULT_SETTINGS, ...s };
    }

    function saveSettings(settings) {
        return set(KEYS.SETTINGS, settings);
    }

    // 导出全部数据（备份）
    function exportAll() {
        return {
            version: 2,
            exportTime: new Date().toISOString(),
            products: getProducts(),
            orders: getOrders(),
            schedule: getSchedule(),
            finance: getFinance(),
            settings: getSettings()
        };
    }

    // 导入全部数据（恢复）
    function importAll(data) {
        if (!data) return false;
        if (data.products) saveProducts(data.products);
        if (data.orders) saveOrders(data.orders);
        if (data.schedule) saveSchedule(data.schedule);
        if (data.finance) saveFinance(data.finance);
        if (data.settings) saveSettings(data.settings);
        return true;
    }

    return {
        KEYS,
        formatDate,
        addDays,
        // Products
        getProducts,
        saveProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        getProductById,
        // Orders
        getOrders,
        saveOrders,
        addOrder,
        updateOrder,
        deleteOrder,
        getOrderById,
        // Schedule
        getSchedule,
        saveSchedule,
        // Finance
        getFinance,
        saveFinance,
        addFinanceRecord,
        // Settings
        getSettings,
        saveSettings,
        // Utils
        exportAll,
        importAll
    };
})();
