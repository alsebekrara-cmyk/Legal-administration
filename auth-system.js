// نظام المصادقة وإدارة المستخدمين والصلاحيات
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.users = this.loadUsers();
        this.permissions = this.loadPermissions();
        this.initializeDefaultAdmin();
    }

    // تحميل المستخدمين من localStorage
    loadUsers() {
        const saved = localStorage.getItem('legalSystem_users');
        return saved ? JSON.parse(saved) : {};
    }

    // تحميل الصلاحيات من localStorage
    loadPermissions() {
        const saved = localStorage.getItem('legalSystem_permissions');
        return saved ? JSON.parse(saved) : this.getDefaultPermissions();
    }

    // الصلاحيات الافتراضية
    getDefaultPermissions() {
        return {
            cases: { view: true, add: true, edit: true, delete: false },
            clients: { view: true, add: true, edit: true, delete: false },
            courts: { view: true, add: true, edit: true, delete: false },
            lawyers: { view: true, add: true, edit: true, delete: false },
            reports: { view: true, generate: false },
            settings: { view: false, edit: false },
            users: { view: false, add: false, edit: false, delete: false },
            admin: { full_access: false }
        };
    }

    // إنشاء المدير الافتراضي
    initializeDefaultAdmin() {
        if (!this.users['admin']) {
            this.users['admin'] = {
                id: 'admin',
                username: 'admin',
                password: this.hashPassword('osama2024'), // كلمة المرور الافتراضية
                displayName: 'السيد أسامة - المدير العام',
                role: 'admin',
                isActive: true,
                createdAt: new Date().toISOString(),
                permissions: {
                    cases: { view: true, add: true, edit: true, delete: true },
                    clients: { view: true, add: true, edit: true, delete: true },
                    courts: { view: true, add: true, edit: true, delete: true },
                    lawyers: { view: true, add: true, edit: true, delete: true },
                    reports: { view: true, generate: true },
                    settings: { view: true, edit: true },
                    users: { view: true, add: true, edit: true, delete: true },
                    admin: { full_access: true }
                }
            };
            this.saveUsers();
        }
    }

    // تشفير كلمة المرور (تشفير بسيط للعرض التوضيحي)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // تحويل إلى 32-bit integer
        }
        return hash.toString();
    }

    // تسجيل الدخول
    async login(username, password) {
        const hashedPassword = this.hashPassword(password);
        const user = this.users[username];

        if (!user) {
            throw new Error('المستخدم غير موجود');
        }

        if (!user.isActive) {
            throw new Error('المستخدم معطل');
        }

        if (user.password !== hashedPassword) {
            throw new Error('كلمة المرور خاطئة');
        }

        this.currentUser = user;
        localStorage.setItem('legalSystem_currentUser', JSON.stringify(user));
        
        // تسجيل آخر دخول
        this.users[username].lastLogin = new Date().toISOString();
        this.saveUsers();

        return user;
    }

    // تسجيل الخروج
    logout() {
        this.currentUser = null;
        localStorage.removeItem('legalSystem_currentUser');
    }

    // التحقق من تسجيل الدخول
    isLoggedIn() {
        if (!this.currentUser) {
            const saved = localStorage.getItem('legalSystem_currentUser');
            if (saved) {
                this.currentUser = JSON.parse(saved);
            }
        }
        return this.currentUser !== null;
    }

    // الحصول على المستخدم الحالي
    getCurrentUser() {
        return this.currentUser;
    }

    // التحقق من الصلاحية
    hasPermission(module, action) {
        if (!this.currentUser) return false;
        
        // المدير له صلاحية كاملة
        if (this.currentUser.role === 'admin' && this.currentUser.permissions.admin?.full_access) {
            return true;
        }

        return this.currentUser.permissions?.[module]?.[action] || false;
    }

    // إضافة مستخدم جديد
    addUser(userData) {
        if (!this.hasPermission('users', 'add')) {
            throw new Error('ليس لديك صلاحية لإضافة مستخدمين');
        }

        if (this.users[userData.username]) {
            throw new Error('اسم المستخدم موجود بالفعل');
        }

        const user = {
            id: userData.username,
            username: userData.username,
            password: this.hashPassword(userData.password),
            displayName: userData.displayName,
            role: userData.role || 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser.username,
            permissions: userData.permissions || this.getDefaultPermissions()
        };

        this.users[userData.username] = user;
        this.saveUsers();
        return user;
    }

    // تحديث مستخدم
    updateUser(username, updates) {
        if (!this.hasPermission('users', 'edit')) {
            throw new Error('ليس لديك صلاحية لتعديل المستخدمين');
        }

        if (!this.users[username]) {
            throw new Error('المستخدم غير موجود');
        }

        // تشفير كلمة المرور الجديدة إذا تم تقديمها
        if (updates.password) {
            updates.password = this.hashPassword(updates.password);
        }

        this.users[username] = { ...this.users[username], ...updates };
        this.users[username].updatedAt = new Date().toISOString();
        this.users[username].updatedBy = this.currentUser.username;

        this.saveUsers();
        return this.users[username];
    }

    // حذف مستخدم
    deleteUser(username) {
        if (!this.hasPermission('users', 'delete')) {
            throw new Error('ليس لديك صلاحية لحذف المستخدمين');
        }

        if (username === 'admin') {
            throw new Error('لا يمكن حذف المدير العام');
        }

        if (!this.users[username]) {
            throw new Error('المستخدم غير موجود');
        }

        delete this.users[username];
        this.saveUsers();
    }

    // الحصول على جميع المستخدمين
    getAllUsers() {
        if (!this.hasPermission('users', 'view')) {
            throw new Error('ليس لديك صلاحية لعرض المستخدمين');
        }

        return Object.values(this.users).map(user => ({
            ...user,
            password: undefined // إخفاء كلمة المرور
        }));
    }

    // تحديث صلاحيات مستخدم
    updateUserPermissions(username, permissions) {
        if (!this.hasPermission('users', 'edit')) {
            throw new Error('ليس لديك صلاحية لتعديل الصلاحيات');
        }

        if (!this.users[username]) {
            throw new Error('المستخدم غير موجود');
        }

        this.users[username].permissions = permissions;
        this.users[username].updatedAt = new Date().toISOString();
        this.users[username].updatedBy = this.currentUser.username;

        this.saveUsers();
        return this.users[username];
    }

    // حفظ المستخدمين
    saveUsers() {
        localStorage.setItem('legalSystem_users', JSON.stringify(this.users));
    }

    // حفظ الصلاحيات
    savePermissions() {
        localStorage.setItem('legalSystem_permissions', JSON.stringify(this.permissions));
    }

    // تغيير حالة المستخدم (تفعيل/تعطيل)
    toggleUserStatus(username) {
        if (!this.hasPermission('users', 'edit')) {
            throw new Error('ليس لديك صلاحية لتعديل حالة المستخدمين');
        }

        if (username === 'admin') {
            throw new Error('لا يمكن تعطيل المدير العام');
        }

        if (!this.users[username]) {
            throw new Error('المستخدم غير موجود');
        }

        this.users[username].isActive = !this.users[username].isActive;
        this.users[username].updatedAt = new Date().toISOString();
        this.users[username].updatedBy = this.currentUser.username;

        this.saveUsers();
        return this.users[username];
    }

    // الحصول على تقرير نشاط المستخدمين
    getUsersReport() {
        if (!this.hasPermission('reports', 'view')) {
            throw new Error('ليس لديك صلاحية لعرض التقارير');
        }

        const users = Object.values(this.users);
        return {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.isActive).length,
            inactiveUsers: users.filter(u => !u.isActive).length,
            adminUsers: users.filter(u => u.role === 'admin').length,
            regularUsers: users.filter(u => u.role === 'user').length,
            recentLogins: users
                .filter(u => u.lastLogin)
                .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
                .slice(0, 10)
        };
    }
}

// إنشاء نسخة واحدة من نظام المصادقة
window.authSystem = new AuthSystem();