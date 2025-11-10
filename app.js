/**
 * تطبيق الإدارة القانونية - الملف الرئيسي
 * جميع الوظائف والمنطق الأساسي للتطبيق
 */

// ==================== المتغيرات العامة ====================
let db = null;
let currentUser = null;
let data = {
    cases: [],
    defendants: [],
    lawyers: [],
    deductions: [],
    notifications: [],
    templates: [],
    chatMessages: {}
};

let selectedLawyerForChat = null;
let firebaseInitialized = false;

// ==================== تهيئة Firebase ====================
function initFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.database();
        firebaseInitialized = true;
        console.log('✅ تم تهيئة Firebase بنجاح');
        
        // بدء الاستماع للتحديثات
        setupFirebaseListeners();
        
        // تحميل البيانات من Firebase
        loadDataFromFirebase();
        
    } catch (error) {
        console.error('خطأ في تهيئة Firebase:', error);
        firebaseInitialized = false;
        showToast('تحذير', 'فشل الاتصال بالسحابة، سيتم العمل بوضع محلي فقط', 'warning');
    }
}

// ==================== إعداد مستمعي Firebase ====================
function setupFirebaseListeners() {
    if (!firebaseInitialized) return;

    // مستمع الدعاوى
    db.ref(DB_PATHS.CASES).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const cases = [];
            snapshot.forEach((child) => {
                const caseData = child.val();
                if (caseData && !caseData.deleted) {
                    // ✅ تحويل ID إلى string ووضعه بعد spread
                    cases.push({ ...caseData, id: String(child.key) });
                }
            });
            data.cases = cases;
            saveToLocalStorage();
            updateDashboard();
            renderCasesTable();
        }
    });

    // مستمع المدعى عليهم
    db.ref(DB_PATHS.DEFENDANTS).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const defendants = [];
            snapshot.forEach((child) => {
                const defendantData = child.val();
                if (defendantData && !defendantData.deleted) {
                    defendants.push({ ...defendantData, id: String(child.key) });
                }
            });
            data.defendants = defendants;
            saveToLocalStorage();
            renderDefendantsTable();
        }
    });

    // مستمع المحامين
    db.ref(DB_PATHS.LAWYERS).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const lawyers = [];
            snapshot.forEach((child) => {
                const lawyerData = child.val();
                if (lawyerData && !lawyerData.deleted) {
                    lawyers.push({ ...lawyerData, id: String(child.key) });
                }
            });
            data.lawyers = lawyers;
            saveToLocalStorage();
            renderLawyersTable();
            updateLawyerSelectOptions();
            renderLawyersChatList();
        }
    });

    // مستمع الاستقطاعات
    db.ref(DB_PATHS.DEDUCTIONS).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const deductions = [];
            snapshot.forEach((child) => {
                const deductionData = child.val();
                if (deductionData && !deductionData.deleted) {
                    deductions.push({ ...deductionData, id: String(child.key) });
                }
            });
            data.deductions = deductions;
            saveToLocalStorage();
            renderDeductionsTable();
        }
    });

    // مستمع الإشعارات
    db.ref(DB_PATHS.NOTIFICATIONS).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const notifications = [];
            snapshot.forEach((child) => {
                const notifData = child.val();
                if (notifData && !notifData.deleted) {
                    notifications.push({ ...notifData, id: String(child.key) });
                }
            });
            data.notifications = notifications;
            saveToLocalStorage();
            updateNotificationBadge();
            renderNotifications();
        }
    });

    // مستمع رسائل المحامين
    db.ref(DB_PATHS.CHAT).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const chatMessages = {};
            const previousMessages = { ...data.chatMessages }; // حفظ الرسائل القديمة
            
            snapshot.forEach((lawyerSnapshot) => {
                const lawyerId = lawyerSnapshot.key;
                const messages = [];
                lawyerSnapshot.forEach((msgSnapshot) => {
                    const msgData = msgSnapshot.val();
                    if (msgData) {
                        messages.push({ ...msgData, id: String(msgSnapshot.key) });
                    }
                });
                // ترتيب الرسائل حسب التاريخ
                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                chatMessages[lawyerId] = messages;
                
                // 🔔 التحقق من وجود رسائل جديدة من المحامي
                if (previousMessages[lawyerId]) {
                    const newMessages = messages.filter(msg => 
                        msg.sender === 'lawyer' && 
                        !previousMessages[lawyerId].find(oldMsg => oldMsg.id === msg.id)
                    );
                    
                    // إظهار إشعار للرسائل الجديدة
                    newMessages.forEach(newMsg => {
                        const lawyer = data.lawyers.find(l => l.id === lawyerId);
                        const lawyerName = lawyer ? lawyer.name : 'محامي';
                        
                        showChatNotification(lawyerName, newMsg.message, lawyerId);
                        
                        // تشغيل صوت الإشعار
                        playChatNotificationSound();
                    });
                }
            });
            
            data.chatMessages = chatMessages;
            saveToLocalStorage();
            
            // تحديث قائمة المحامين لإظهار العداد
            renderLawyersChatList();
            
            // تحديث شارة الدردشة العامة
            updateChatBadge();
            
            // تحديث عرض الرسائل إذا كان المحامي المحدد موجود
            if (selectedLawyerForChat && document.getElementById('chat-page').classList.contains('active')) {
                renderChatMessages();
            }
        }
    });

    console.log('✅ تم إعداد مستمعي Firebase');
}

// ==================== تحميل البيانات من Firebase ====================
async function loadDataFromFirebase() {
    if (!firebaseInitialized) {
        loadFromLocalStorage();
        return;
    }

    try {
        // تحميل الدعاوى
        const casesSnapshot = await db.ref(DB_PATHS.CASES).once('value');
        if (casesSnapshot.exists()) {
            data.cases = [];
            casesSnapshot.forEach((child) => {
                const caseData = child.val();
                if (!caseData.deleted) {
                    // ✅ وضع id بعد spread لضمان أن child.key له الأولوية
                    data.cases.push({ ...caseData, id: String(child.key) });
                }
            });
        }

        // تحميل المدعى عليهم
        const defendantsSnapshot = await db.ref(DB_PATHS.DEFENDANTS).once('value');
        if (defendantsSnapshot.exists()) {
            data.defendants = [];
            defendantsSnapshot.forEach((child) => {
                const defendantData = child.val();
                if (!defendantData.deleted) {
                    data.defendants.push({ ...defendantData, id: String(child.key) });
                }
            });
        }

        // تحميل المحامين
        const lawyersSnapshot = await db.ref(DB_PATHS.LAWYERS).once('value');
        if (lawyersSnapshot.exists()) {
            data.lawyers = [];
            lawyersSnapshot.forEach((child) => {
                const lawyerData = child.val();
                if (!lawyerData.deleted) {
                    data.lawyers.push({ ...lawyerData, id: String(child.key) });
                }
            });
        }

        // تحميل الاستقطاعات
        const deductionsSnapshot = await db.ref(DB_PATHS.DEDUCTIONS).once('value');
        if (deductionsSnapshot.exists()) {
            data.deductions = [];
            deductionsSnapshot.forEach((child) => {
                const deductionData = child.val();
                if (!deductionData.deleted) {
                    data.deductions.push({ ...deductionData, id: String(child.key) });
                }
            });
        }

        // تحميل الإشعارات
        const notificationsSnapshot = await db.ref(DB_PATHS.NOTIFICATIONS).once('value');
        if (notificationsSnapshot.exists()) {
            data.notifications = [];
            notificationsSnapshot.forEach((child) => {
                const notifData = child.val();
                if (!notifData.deleted) {
                    data.notifications.push({ ...notifData, id: String(child.key) });
                }
            });
        }

        saveToLocalStorage();
        console.log('✅ تم تحميل البيانات من Firebase');
        
    } catch (error) {
        console.error('خطأ في تحميل البيانات من Firebase:', error);
        loadFromLocalStorage();
    }
}

// ==================== حفظ/تحميل البيانات المحلية ====================
function saveToLocalStorage() {
    try {
        localStorage.setItem('legalAppData', JSON.stringify(data));
        localStorage.setItem('lastUpdate', new Date().toISOString());
    } catch (error) {
        console.error('خطأ في حفظ البيانات المحلية:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('legalAppData');
        if (savedData) {
            data = JSON.parse(savedData);
            
            // ✅ إصلاح IDs تلقائياً عند التحميل لجميع الكيانات
            let fixed = 0;
            
            // إصلاح IDs الدعاوى
            data.cases = data.cases.map(c => {
                if (typeof c.id !== 'string') {
                    c.id = String(c.id);
                    fixed++;
                }
                return c;
            });
            
            // إصلاح IDs المدعى عليهم
            data.defendants = data.defendants.map(d => {
                if (typeof d.id !== 'string') {
                    d.id = String(d.id);
                    fixed++;
                }
                return d;
            });
            
            // إصلاح IDs المحامين
            data.lawyers = data.lawyers.map(l => {
                if (typeof l.id !== 'string') {
                    l.id = String(l.id);
                    fixed++;
                }
                return l;
            });
            
            // إصلاح IDs الاستقطاعات
            data.deductions = data.deductions.map(d => {
                if (typeof d.id !== 'string') {
                    d.id = String(d.id);
                    fixed++;
                }
                return d;
            });
            
            if (fixed > 0) {
                console.log(`🔧 تم إصلاح ${fixed} معرّف تلقائياً`);
                localStorage.setItem('legalAppData', JSON.stringify(data));
            }
            
            console.log('✅ تم تحميل البيانات المحلية');
        }
        
        const lastUpdate = localStorage.getItem('lastUpdate');
        if (lastUpdate) {
            const lastUpdateEl = document.getElementById('last-update-time');
            if (lastUpdateEl) {
                lastUpdateEl.textContent = new Date(lastUpdate).toLocaleString('ar-IQ');
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات المحلية:', error);
    }
}

// ==================== دوال مساعدة ====================
function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatCurrency(amount) {
    if (!amount && amount !== 0) return '0 IQD';
    return new Intl.NumberFormat('ar-IQ', {
        style: 'currency',
        currency: 'IQD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ar-IQ');
}

function formatDateTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('ar-IQ');
}

// ==================== التنقل ====================
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // إخفاء جميع الصفحات
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // إظهار الصفحة المطلوبة
    document.getElementById(page + '-page').classList.add('active');
    
    // تحديث الأزرار
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-page') === page) {
            btn.classList.add('active');
        }
    });
    
    // تحديث العنوان الفرعي
    const titles = {
        'dashboard': 'لوحة التحكم',
        'cases': 'إدارة الدعاوى',
        'defendants': 'المدعى عليهم',
        'lawyers': 'المحامين',
        'deductions': 'الاستقطاعات',
        'templates': 'قوالب الدعاوى',
        'chat': 'الدردشة',
        'settings': 'الإعدادات'
    };
    
    const subtitleElement = document.getElementById('page-subtitle');
    if (subtitleElement) {
        subtitleElement.textContent = titles[page] || 'لوحة التحكم';
    }
    
    // تحديث العنوان القديم إذا كان موجوداً (للتوافق)
    const pageTitleElement = document.getElementById('page-title');
    if (pageTitleElement) {
        pageTitleElement.textContent = titles[page] || 'لوحة التحكم';
    }
    
    // تحديث المحتوى
    if (page === 'dashboard') updateDashboard();
    if (page === 'cases') renderCasesTable();
    if (page === 'defendants') renderDefendantsTable();
    if (page === 'lawyers') renderLawyersTable();
    if (page === 'deductions') renderDeductionsTable();
    if (page === 'templates') updateTemplate();
    if (page === 'chat') {
        // إعادة تعيين حالة الدردشة عند الدخول للصفحة
        backToLawyersList();
        renderLawyersChatList();
    }
}

// ==================== لوحة التحكم ====================
function updateDashboard() {
    // إحصائيات الدعاوى
    const totalCases = data.cases.length;
    const pendingCases = data.cases.filter(c => 
        c.status === 'مرفوع' || c.status === 'في المحكمة'
    ).length;
    const completedCases = data.cases.filter(c => c.status === 'مغلق').length;
    
    // إحصائيات مالية
    const totalAmount = data.cases.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const totalDeductions = data.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    
    // تحديث العرض (مع التحقق من وجود العناصر)
    const statTotalCases = document.getElementById('stat-total-cases');
    const statPendingCases = document.getElementById('stat-pending-cases');
    const statCompletedCases = document.getElementById('stat-completed-cases');
    const statTotalAmount = document.getElementById('stat-total-amount');
    
    if (statTotalCases) statTotalCases.textContent = totalCases;
    if (statPendingCases) statPendingCases.textContent = pendingCases;
    if (statCompletedCases) statCompletedCases.textContent = completedCases;
    if (statTotalAmount) statTotalAmount.textContent = formatCurrency(totalAmount);
    
    // عرض الدعاوى الأخيرة
    renderRecentCases();
    
    // عرض الجلسات القادمة
    renderUpcomingHearings();
}

function renderRecentCases() {
    const tbody = document.getElementById('recent-cases-table');
    if (!tbody) return; // العنصر غير موجود
    
    const recentCases = data.cases.slice(-5).reverse();
    
    if (recentCases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>لا توجد دعاوى حالياً</h3>
                    <p>ابدأ بإضافة دعوى جديدة</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = recentCases.map(c => {
        const statusClass = getStatusBadgeClass(c.status);
        const remaining = (parseFloat(c.amount) || 0) - 
            data.deductions.filter(d => d.caseNumber === c.caseNumber)
                .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        
        return `
            <tr onclick="showCaseDetails('${c.id}')">
                <td>${c.caseNumber}</td>
                <td>${c.plaintiffName}</td>
                <td>${c.defendantName}</td>
                <td><span class="badge ${statusClass}">${c.status}</span></td>
                <td>${formatCurrency(c.amount)}</td>
                <td>${c.nextHearing ? formatDateTime(c.nextHearing) : '-'}</td>
            </tr>
        `;
    }).join('');
}

function renderUpcomingHearings() {
    const tbody = document.getElementById('upcoming-hearings-table');
    if (!tbody) return; // العنصر غير موجود
    
    const upcoming = data.cases
        .filter(c => c.nextHearing && new Date(c.nextHearing) > new Date())
        .sort((a, b) => new Date(a.nextHearing) - new Date(b.nextHearing))
        .slice(0, 5);
    
    if (upcoming.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-calendar-alt"></i>
                    <h3>لا توجد جلسات مجدولة</h3>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = upcoming.map(c => {
        const hearingDate = new Date(c.nextHearing);
        return `
            <tr>
                <td>${c.caseNumber}</td>
                <td>${c.plaintiffName}</td>
                <td>${c.lawyerName || '-'}</td>
                <td>${formatDate(c.nextHearing)}</td>
                <td>${hearingDate.toLocaleTimeString('ar-IQ', {hour: '2-digit', minute: '2-digit'})}</td>
            </tr>
        `;
    }).join('');
}

// ==================== جدول الدعاوى ====================
function renderCasesTable() {
    const tbody = document.getElementById('cases-table');
    const cardsContainer = document.getElementById('cases-cards');
    
    if (!tbody && !cardsContainer) return; // العنصر غير موجود (ليس في صفحة الدعاوى)
    
    // عرض رسالة فارغة
    if (data.cases.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>لا توجد دعاوى</h3>
                        <p>ابدأ بإضافة دعوى جديدة من الزر أعلاه</p>
                    </td>
                </tr>
            `;
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>لا توجد دعاوى</h3>
                    <p>ابدأ بإضافة دعوى جديدة من الزر أعلاه</p>
                </div>
            `;
        }
        return;
    }
    
    // عرض الجدول على الشاشات الكبيرة
    if (tbody) {
        tbody.innerHTML = data.cases.map(c => {
            const statusClass = getStatusBadgeClass(c.status);
            const priorityClass = getPriorityBadgeClass(c.priority);
            
            const totalDeductions = data.deductions
                .filter(d => d.caseNumber === c.caseNumber)
                .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
            const remaining = (parseFloat(c.amount) || 0) - totalDeductions;
            
            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${c.caseNumber}
                            ${c.status === 'تنفيذ' && (c.executionDeduction || c.executionSeizure) ? `
                                <div style="display: flex; gap: 4px;">
                                    ${c.executionDeduction ? '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;"><i class="fas fa-money-bill-wave"></i></span>' : ''}
                                    ${c.executionSeizure ? '<span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;"><i class="fas fa-lock"></i></span>' : ''}
                                </div>
                            ` : ''}
                        </div>
                    </td>
                    <td>${c.plaintiffName}</td>
                    <td>${c.defendantName}</td>
                    <td>${c.lawyerName || '-'}</td>
                    <td><span class="badge ${statusClass}">${c.status}</span></td>
                    <td><span class="badge ${priorityClass}">${c.priority || 'عادية'}</span></td>
                    <td>${formatCurrency(c.amount)}</td>
                    <td>${formatCurrency(remaining)}</td>
                    <td>${c.nextHearing ? formatDateTime(c.nextHearing) : '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary btn-icon" onclick="showCaseDetails('${c.id}')" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-secondary btn-icon" onclick="editCase('${c.id}')" title="تحرير">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn whatsapp-btn btn-icon" onclick="sendWhatsAppToDefendant('${c.id}')" title="إرسال واتساب">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                            <button class="btn btn-danger btn-icon" onclick="deleteCase('${c.id}')" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // عرض البطاقات على الشاشات الصغيرة
    if (cardsContainer) {
        cardsContainer.innerHTML = data.cases.map(c => {
            const statusClass = getStatusBadgeClass(c.status);
            const priorityClass = getPriorityBadgeClass(c.priority);
            
            const totalDeductions = data.deductions
                .filter(d => d.caseNumber === c.caseNumber)
                .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
            const remaining = (parseFloat(c.amount) || 0) - totalDeductions;
            
            return `
                <div class="data-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fas fa-gavel"></i>
                            <span>قضية رقم ${c.caseNumber}</span>
                            ${c.status === 'تنفيذ' && (c.executionDeduction || c.executionSeizure) ? `
                                <div style="display: flex; gap: 4px; margin-right: 8px;">
                                    ${c.executionDeduction ? '<span style="background: #10b981; color: white; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;"><i class="fas fa-money-bill-wave"></i> استقطاع</span>' : ''}
                                    ${c.executionSeizure ? '<span style="background: #f59e0b; color: white; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;"><i class="fas fa-lock"></i> حجز</span>' : ''}
                                </div>
                            ` : ''}
                        </div>
                        <div class="card-badges">
                            <span class="badge ${statusClass}">${c.status}</span>
                            <span class="badge ${priorityClass}">${c.priority || 'عادية'}</span>
                        </div>
                    </div>
                    
                    <div class="card-body">
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-user"></i> المدعي:</span>
                            <span class="info-value">${c.plaintiffName}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-user-tie"></i> المدعى عليه:</span>
                            <span class="info-value">${c.defendantName}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-balance-scale"></i> المحامي:</span>
                            <span class="info-value">${c.lawyerName || '-'}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-dollar-sign"></i> المبلغ:</span>
                            <span class="info-value">${formatCurrency(c.amount)}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-money-bill-wave"></i> المتبقي:</span>
                            <span class="info-value highlight">${formatCurrency(remaining)}</span>
                        </div>
                        ${c.nextHearing ? `
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-calendar-alt"></i> الجلسة القادمة:</span>
                            <span class="info-value">${formatDateTime(c.nextHearing)}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="card-actions">
                        <button class="btn btn-primary btn-sm" onclick="showCaseDetails('${c.id}')" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i> عرض
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="editCase('${c.id}')" title="تحرير">
                            <i class="fas fa-pen"></i> تعديل
                        </button>
                        <button class="btn whatsapp-btn btn-sm" onclick="sendWhatsAppToDefendant('${c.id}')" title="إرسال واتساب">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCase('${c.id}')" title="حذف">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function getStatusBadgeClass(status) {
    const classes = {
        'مسودة': 'badge-draft',
        'مرفوع': 'badge-filed',
        'في المحكمة': 'badge-in-court',
        'صدور حكم': 'badge-judgment',
        'تنفيذ': 'badge-execution',
        'مغلق': 'badge-closed'
    };
    return classes[status] || 'badge-draft';
}

function getPriorityBadgeClass(priority) {
    const classes = {
        'عادية': 'badge-normal',
        'مهمة': 'badge-important',
        'عاجلة': 'badge-urgent',
        'طارئة': 'badge-emergency'
    };
    return classes[priority] || 'badge-normal';
}

// ==================== نوافذ الدعاوى ====================
function showNewCaseModal() {
    updateLawyerSelectOptions();
    document.getElementById('new-case-date').valueAsDate = new Date();
    
    // إخفاء خيارات التنفيذ عند فتح النموذج
    document.getElementById('execution-options-container').style.display = 'none';
    document.getElementById('execution-deduction').checked = false;
    document.getElementById('execution-seizure').checked = false;
    
    modalManager.open('new-case-modal');
}

function toggleExecutionOptions() {
    const status = document.getElementById('new-case-status').value;
    const container = document.getElementById('execution-options-container');
    
    if (status === 'تنفيذ') {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        document.getElementById('execution-deduction').checked = false;
        document.getElementById('execution-seizure').checked = false;
    }
}

function updateLawyerSelectOptions() {
    const select = document.getElementById('new-case-lawyer');
    select.innerHTML = '<option value="">اختر محامي...</option>' +
        data.lawyers.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    
    const deductionSelect = document.getElementById('new-deduction-case');
    if (deductionSelect) {
        deductionSelect.innerHTML = '<option value="">اختر دعوى...</option>' +
            data.cases.map(c => `<option value="${c.caseNumber}">${c.caseNumber} - ${c.plaintiffName}</option>`).join('');
    }
}

function saveNewCase(event) {
    event.preventDefault();
    
    const form = event.target;
    const editId = form.dataset.editId;
    const isEditing = !!editId;
    
    const caseData = {
        id: isEditing ? editId : generateId(),
        caseNumber: document.getElementById('new-case-number').value,
        filingDate: document.getElementById('new-case-date').value,
        priority: document.getElementById('new-case-priority').value,
        status: document.getElementById('new-case-status').value,
        stage: document.getElementById('new-case-stage') ? document.getElementById('new-case-stage').value : '',
        amount: document.getElementById('new-case-amount').value,
        plaintiffName: document.getElementById('new-case-plaintiff-name').value,
        plaintiffPhone: document.getElementById('new-case-plaintiff-phone').value,
        plaintiffAddress: document.getElementById('new-case-plaintiff-address') ? document.getElementById('new-case-plaintiff-address').value : '',
        defendantName: document.getElementById('new-case-defendant-name').value,
        defendantPhone: document.getElementById('new-case-defendant-phone').value,
        defendantAddress: document.getElementById('new-case-defendant-address') ? document.getElementById('new-case-defendant-address').value : '',
        lawyerName: document.getElementById('new-case-lawyer').value,
        court: document.getElementById('new-case-court').value,
        courtSection: document.getElementById('new-case-court-section') ? document.getElementById('new-case-court-section').value : '',
        nextHearing: document.getElementById('new-case-next-hearing').value,
        notes: document.getElementById('new-case-notes').value,
        executionDeduction: document.getElementById('execution-deduction').checked,
        executionSeizure: document.getElementById('execution-seizure').checked,
        createdAt: isEditing ? data.cases.find(c => c.id === editId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // حفظ في Firebase
    if (firebaseInitialized) {
        db.ref(DB_PATHS.CASES).child(caseData.id).set(caseData);
    }
    
    // حفظ محلياً
    if (isEditing) {
        const index = data.cases.findIndex(c => c.id === editId);
        if (index !== -1) {
            data.cases[index] = caseData;
        }
    } else {
        data.cases.push(caseData);
    }
    saveToLocalStorage();
    
    // إعادة تعيين النموذج
    delete form.dataset.editId;
    const modalTitle = document.querySelector('#new-case-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'دعوى جديدة';
    const submitBtn = document.querySelector('#new-case-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة الدعوى';
    
    // إغلاق النافذة وتحديث العرض
    modalManager.close('new-case-modal');
    form.reset();
    
    showToast(isEditing ? 'تم تعديل الدعوى بنجاح' : 'تم إضافة الدعوى بنجاح', 'success');
    
    updateDashboard();
    renderCasesTable();
    
    // إضافة إشعار
    if (!isEditing) {
        addNotification('دعوى جديدة', `تم إضافة دعوى جديدة رقم ${caseData.caseNumber}`, 'info', caseData.caseNumber);
    }
    
    // إرسال واتساب للمدعى عليه (فقط للدعاوى الجديدة)
    if (!isEditing && caseData.defendantPhone) {
        const phone = caseData.defendantPhone.replace(/[^\d+]/g, '');
        if (phone.length >= 10) {
            sendWhatsAppMessage(
                phone,
                `تنبيه هام: نود إعلامك بأنه تم رفع دعوى قضائية ضدك رقم ${caseData.caseNumber} باسمك (${caseData.defendantName}). المبلغ المالي المطلوب: ${formatCurrency(caseData.amount)}. يرجى زيارة الشركة في أقرب وقت ممكن لإبلاغنا باستلام هذا التنبيه ولمناقشة التفاصيل قبل اتخاذ أي إجراءات قانونية بحقك. للاستفسار أو التواصل يرجى الرد على هذه الرسالة.`
            );
        }
    }
}

// ==================== إرسال واتساب ====================
function sendWhatsAppToDefendant(caseId) {
    const caseData = data.cases.find(c => c.id === caseId);
    if (!caseData) return;
    
    if (!caseData.defendantPhone) {
        showToast('لا يوجد رقم هاتف للمدعى عليه', 'warning');
        return;
    }
    
    // تنسيق رقم الهاتف مع رمز الدولة
    const formattedPhone = formatPhoneForWhatsApp(caseData.defendantPhone);
    
    if (!formattedPhone) {
        showToast('رقم الهاتف غير صالح', 'warning');
        return;
    }
    
    const message = `تنبيه هام: نود إعلامك بأنه تم رفع دعوى قضائية ضدك رقم ${caseData.caseNumber} باسمك (${caseData.defendantName}). المبلغ المالي المطلوب: ${formatCurrency(caseData.amount)}. يرجى زيارة الشركة في أقرب وقت ممكن لإبلاغنا باستلام هذا التنبيه ولمناقشة التفاصيل قبل اتخاذ أي إجراءات قانونية بحقك. للاستفسار أو التواصل يرجى الرد على هذه الرسالة.`;
    
    sendWhatsAppMessage(formattedPhone, message);
}

/**
 * تنسيق رقم الهاتف للواتساب مع إضافة رمز الدولة العراقية تلقائياً
 */
function formatPhoneForWhatsApp(phone) {
    if (!phone) return null;
    
    // إزالة جميع المسافات والرموز الخاصة ما عدا +
    let cleanPhone = phone.replace(/[\s\-()]/g, '');
    
    // إزالة الأصفار البادئة
    cleanPhone = cleanPhone.replace(/^0+/, '');
    
    // إذا كان الرقم يبدأ بـ + فهو يحتوي على رمز الدولة
    if (cleanPhone.startsWith('+')) {
        // إزالة + وإرجاع الرقم
        return cleanPhone.substring(1);
    }
    
    // إذا كان يبدأ برمز الدولة العراقية (964)
    if (cleanPhone.startsWith('964')) {
        return cleanPhone;
    }
    
    // إذا كان رقم عراقي بدون رمز الدولة (يبدأ بـ 7)
    if (cleanPhone.startsWith('7') && cleanPhone.length === 10) {
        return '964' + cleanPhone;
    }
    
    // إذا كان رقم عراقي قديم (يبدأ بـ 07)
    if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
        return '964' + cleanPhone.substring(1);
    }
    
    // إذا كان الرقم يحتوي فقط على أرقام وطوله معقول
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
        // إذا لم يبدأ برمز دولة، أضف رمز العراق
        if (!digitsOnly.startsWith('964')) {
            return '964' + digitsOnly;
        }
        return digitsOnly;
    }
    
    // رقم غير صالح
    return null;
}

function sendWhatsAppMessage(phone, message) {
    const encodedMessage = encodeURIComponent(message);
    
    console.log('📱 الرقم بعد التنسيق:', phone);
    
    // التحقق من البيئة
    if (window.electronAPI) {
        // Electron - محاولة فتح واتساب سطح المكتب
        const whatsappDesktopUrl = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
        const whatsappWebUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
        
        console.log('🔄 محاولة فتح واتساب في Electron...');
        
        // محاولة فتح التطبيق أولاً
        window.electronAPI.openExternal(whatsappDesktopUrl)
            .then(result => {
                console.log('✅ نتيجة فتح واتساب:', result);
                if (result && result.success) {
                    showToast('تم فتح واتساب', 'success');
                } else {
                    // إذا فشل، افتح واتساب ويب
                    console.log('⚠️ فشل فتح التطبيق، محاولة فتح الويب...');
                    window.electronAPI.openExternal(whatsappWebUrl)
                        .then(() => {
                            showToast('تم فتح واتساب ويب', 'success');
                        })
                        .catch(err => {
                            console.error('❌ خطأ في فتح واتساب ويب:', err);
                            showToast('حدث خطأ في فتح واتساب', 'error');
                        });
                }
            })
            .catch(error => {
                console.error('❌ خطأ في فتح واتساب:', error);
                // محاولة أخيرة مع واتساب ويب
                window.electronAPI.openExternal(whatsappWebUrl)
                    .catch(err => console.error('❌ فشل فتح واتساب ويب:', err));
            });
    } else {
        // متصفح - فتح واتساب ويب
        const webUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
        window.open(webUrl, '_blank');
        showToast('تم فتح واتساب ويب', 'success');
    }
}

// ==================== تفاصيل الدعوى ====================
function showCaseDetails(caseId) {
    try {
        console.log('🔍 عرض تفاصيل الدعوى:', caseId);
        console.log('📊 إجمالي الدعاوى:', data.cases.length);
        console.log('🔑 أول 3 IDs:', data.cases.slice(0, 3).map(c => ({ id: c.id, number: c.caseNumber })));
        
        const caseData = data.cases.find(c => c.id === caseId);
        if (!caseData) {
            console.error('❌ الدعوى غير موجودة:', caseId);
            console.log('💡 جميع IDs المتاحة:', data.cases.map(c => c.id));
            showToast('الدعوى غير موجودة', 'error');
            return;
        }
        
        console.log('✅ تم العثور على الدعوى:', caseData.caseNumber);
        
        const totalDeductions = data.deductions
            .filter(d => d.caseNumber === caseData.caseNumber)
            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        const remaining = (parseFloat(caseData.amount) || 0) - totalDeductions;
    
    const content = document.getElementById('case-details-content');
    content.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 25px;">
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-label">رقم الدعوى</div>
                    <div class="stat-value" style="font-size: 24px;">${caseData.caseNumber}</div>
                </div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
                <div class="stat-content">
                    <div class="stat-label">المبلغ</div>
                    <div class="stat-value" style="font-size: 20px;">${formatCurrency(caseData.amount)}</div>
                </div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669);">
                <div class="stat-content">
                    <div class="stat-label">المبلغ المتبقي</div>
                    <div class="stat-value" style="font-size: 20px;">${formatCurrency(remaining)}</div>
                </div>
            </div>
        </div>
        
        <div class="form-grid">
            <div class="form-group">
                <label>الحالة</label>
                <p><span class="badge ${getStatusBadgeClass(caseData.status)}">${caseData.status}</span></p>
            </div>
            ${caseData.status === 'تنفيذ' && (caseData.executionDeduction || caseData.executionSeizure) ? `
            <div class="form-group">
                <label>خيارات التنفيذ</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${caseData.executionDeduction ? `
                        <span class="badge" style="background: linear-gradient(135deg, #10b981, #059669); display: inline-flex; align-items: center; gap: 6px; width: fit-content;">
                            <i class="fas fa-money-bill-wave"></i> تم الاستقطاع
                        </span>
                    ` : ''}
                    ${caseData.executionSeizure ? `
                        <span class="badge" style="background: linear-gradient(135deg, #f59e0b, #d97706); display: inline-flex; align-items: center; gap: 6px; width: fit-content;">
                            <i class="fas fa-lock"></i> تم الحجز
                        </span>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            <div class="form-group">
                <label>الأولوية</label>
                <p><span class="badge ${getPriorityBadgeClass(caseData.priority)}">${caseData.priority || 'عادية'}</span></p>
            </div>
            <div class="form-group">
                <label>تاريخ الرفع</label>
                <p>${caseData.filingDate ? formatDate(caseData.filingDate) : '-'}</p>
            </div>
            <div class="form-group">
                <label>المرحلة</label>
                <p>${caseData.stage || '-'}</p>
            </div>
            <div class="form-group">
                <label>المدعي</label>
                <p>${caseData.plaintiffName || '-'}</p>
            </div>
            <div class="form-group">
                <label>عنوان المدعي</label>
                <p>${caseData.plaintiffAddress || '-'}</p>
            </div>
            <div class="form-group">
                <label>المدعى عليه</label>
                <p>${caseData.defendantName || '-'}</p>
            </div>
            <div class="form-group">
                <label>عنوان المدعى عليه</label>
                <p>${caseData.defendantAddress || '-'}</p>
            </div>
            <div class="form-group">
                <label>هاتف المدعى عليه</label>
                <p>${caseData.defendantPhone || '-'}</p>
            </div>
            <div class="form-group">
                <label>المحامي</label>
                <p>${caseData.lawyerName || '-'}</p>
            </div>
            <div class="form-group">
                <label>المحكمة</label>
                <p>${caseData.court || '-'}</p>
            </div>
            <div class="form-group">
                <label>اسم الدائرة</label>
                <p>${caseData.courtSection || '-'}</p>
            </div>
            <div class="form-group">
                <label>الجلسة القادمة</label>
                <p>${caseData.nextHearing ? formatDateTime(caseData.nextHearing) : '-'}</p>
            </div>
        </div>
        
        ${caseData.notes ? `
            <div class="form-group" style="margin-top: 20px;">
                <label>الملاحظات</label>
                <p style="padding: 15px; background: var(--bg-light); border-radius: 10px;">${caseData.notes}</p>
            </div>
        ` : ''}
        
        <div class="section-divider"></div>
        
        <h4 style="margin-bottom: 15px; color: var(--primary-blue);">الاستقطاعات</h4>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>المبلغ</th>
                        <th>الطريقة</th>
                        <th>الملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.deductions.filter(d => d.caseNumber === caseData.caseNumber).length > 0 ?
                        data.deductions.filter(d => d.caseNumber === caseData.caseNumber).map(d => `
                            <tr>
                                <td>${formatDate(d.date)}</td>
                                <td>${formatCurrency(d.amount)}</td>
                                <td>${d.method}</td>
                                <td>${d.notes || '-'}</td>
                            </tr>
                        `).join('') :
                        '<tr><td colspan="4" style="text-align: center; color: var(--text-gray);">لا توجد استقطاعات</td></tr>'
                    }
                </tbody>
            </table>
        </div>
    `;
    
        console.log('✅ تم تجهيز المحتوى، فتح النافذة...');
        
        // التحقق من وجود modalManager
        if (typeof modalManager === 'undefined') {
            console.error('❌ modalManager غير معرف!');
            alert('حدث خطأ: نظام النوافذ غير متاح');
            return;
        }
        
        // التحقق من وجود النافذة المنبثقة
        const modal = document.getElementById('case-details-modal');
        if (!modal) {
            console.error('❌ النافذة case-details-modal غير موجودة في HTML');
            alert('حدث خطأ: النافذة المنبثقة غير موجودة');
            return;
        }
        
        console.log('📱 النافذة موجودة:', modal);
        const opened = modalManager.open('case-details-modal');
        console.log('📱 حالة فتح النافذة:', opened);
        
        if (!opened) {
            console.error('❌ فشل فتح النافذة');
            // محاولة فتح النافذة يدوياً
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            console.log('🔧 تم فتح النافذة يدوياً');
        }
        
    } catch (error) {
        console.error('❌ خطأ في عرض تفاصيل الدعوى:', error);
        showToast('حدث خطأ في عرض التفاصيل', 'error');
    }
}

// ==================== البحث والتصفية ====================
function searchCases() {
    const searchTerm = document.getElementById('cases-search').value.toLowerCase();
    const statusFilter = document.getElementById('cases-status-filter').value;
    const priorityFilter = document.getElementById('cases-priority-filter').value;
    
    let filteredCases = data.cases;
    
    if (searchTerm) {
        filteredCases = filteredCases.filter(c => 
            c.caseNumber.toLowerCase().includes(searchTerm) ||
            c.plaintiffName.toLowerCase().includes(searchTerm) ||
            c.defendantName.toLowerCase().includes(searchTerm) ||
            (c.lawyerName && c.lawyerName.toLowerCase().includes(searchTerm))
        );
    }
    
    if (statusFilter) {
        filteredCases = filteredCases.filter(c => c.status === statusFilter);
    }
    
    if (priorityFilter) {
        filteredCases = filteredCases.filter(c => c.priority === priorityFilter);
    }
    
    renderFilteredCases(filteredCases);
}

function filterCases() {
    searchCases();
}

function renderFilteredCases(cases) {
    const tbody = document.getElementById('cases-table');
    
    if (cases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>لا توجد نتائج</h3>
                    <p>جرب تغيير معايير البحث</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = cases.map(c => {
        const totalDeductions = data.deductions
            .filter(d => d.caseNumber === c.caseNumber)
            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        const remaining = (parseFloat(c.amount) || 0) - totalDeductions;
        
        return `
            <tr>
                <td><strong>${c.caseNumber}</strong></td>
                <td>${c.plaintiffName}</td>
                <td>${c.defendantName}</td>
                <td>${c.lawyerName || '-'}</td>
                <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
                <td><span class="badge ${getPriorityBadgeClass(c.priority || 'عادية')}">${c.priority || 'عادية'}</span></td>
                <td>${formatCurrency(c.amount)}</td>
                <td>${formatCurrency(remaining)}</td>
                <td>${c.nextHearing ? formatDate(c.nextHearing) : '-'}</td>
                <td>
                    <button class="btn-icon" onclick="showCaseDetails('${c.id}')" title="التفاصيل">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="editCase('${c.id}')" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="sendWhatsAppToDefendant('${c.id}')" title="واتساب">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteCase('${c.id}')" title="حذف" style="color: var(--error-red);">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function searchDefendants() {
    const searchTerm = document.getElementById('defendants-search').value.toLowerCase();
    
    const filtered = data.defendants.filter(d =>
        d.name.toLowerCase().includes(searchTerm) ||
        (d.phone && d.phone.includes(searchTerm)) ||
        (d.email && d.email.toLowerCase().includes(searchTerm))
    );
    
    renderFilteredDefendants(filtered);
}

function renderFilteredDefendants(defendants) {
    const tbody = document.getElementById('defendants-table');
    
    if (defendants.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>لا توجد نتائج</h3>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = defendants.map(d => `
        <tr>
            <td><strong>${d.name}</strong></td>
            <td>${d.phone || '-'}</td>
            <td>${d.email || '-'}</td>
            <td>${d.workplace || '-'}</td>
            <td>${d.address || '-'}</td>
            <td>
                <button class="btn-icon" onclick="editDefendant('${d.id}')" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteDefendant('${d.id}')" title="حذف" style="color: var(--error-red);">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== المدعى عليهم ====================
function showNewDefendantModal() {
    modalManager.open('new-defendant-modal');
}

function saveNewDefendant(event) {
    event.preventDefault();
    
    const form = event.target;
    const editId = form.dataset.editId;
    const isEditing = !!editId;
    
    const defendant = {
        id: isEditing ? editId : generateId(),
        name: document.getElementById('new-defendant-name').value,
        phone: document.getElementById('new-defendant-phone').value,
        workplace: document.getElementById('new-defendant-workplace').value,
        address: document.getElementById('new-defendant-address').value,
        createdAt: isEditing ? data.defendants.find(d => d.id === editId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (firebaseInitialized) {
        db.ref(DB_PATHS.DEFENDANTS).child(defendant.id).set(defendant);
    }
    
    if (isEditing) {
        const index = data.defendants.findIndex(d => d.id === editId);
        if (index !== -1) {
            data.defendants[index] = defendant;
        }
    } else {
        data.defendants.push(defendant);
    }
    
    saveToLocalStorage();
    renderDefendantsTable();
    
    // إعادة تعيين النموذج
    delete form.dataset.editId;
    const modalTitle = document.querySelector('#new-defendant-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'مدعى عليه جديد';
    const submitBtn = document.querySelector('#new-defendant-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة المدعى عليه';
    
    modalManager.close('new-defendant-modal');
    form.reset();
    showToast(isEditing ? 'تم تعديل المدعى عليه بنجاح' : 'تم إضافة المدعى عليه بنجاح', 'success');
}

function renderDefendantsTable() {
    const tbody = document.getElementById('defendants-table');
    const cardsContainer = document.getElementById('defendants-cards');
    
    if (!tbody && !cardsContainer) return; // العنصر غير موجود
    
    // عرض رسالة فارغة
    if (data.defendants.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>لا يوجد مدعى عليهم</h3>
                        <p>ابدأ بإضافة مدعى عليه جديد</p>
                    </td>
                </tr>
            `;
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>لا يوجد مدعى عليهم</h3>
                    <p>ابدأ بإضافة مدعى عليه جديد</p>
                </div>
            `;
        }
        return;
    }
    
    // عرض الجدول على الشاشات الكبيرة
    if (tbody) {
        tbody.innerHTML = data.defendants.map(d => {
            const casesCount = data.cases.filter(c => c.defendantName === d.name).length;
            return `
            <tr onclick="showDefendantCases('${d.id}')" style="cursor: pointer;">
                <td><strong>${d.name}</strong></td>
                <td>${d.phone || '-'}</td>
                <td>${d.workplace || '-'}</td>
                <td>${d.address || '-'}</td>
                <td><span class="badge badge-normal">${casesCount} قضية</span></td>
                <td onclick="event.stopPropagation();">
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-icon" onclick="editDefendant('${d.id}')" title="تعديل">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="deleteDefendant('${d.id}')" title="حذف">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
    }
    
    // عرض البطاقات على الشاشات الصغيرة
    if (cardsContainer) {
        cardsContainer.innerHTML = data.defendants.map(d => {
            const casesCount = data.cases.filter(c => c.defendantName === d.name).length;
            return `
            <div class="data-card" onclick="showDefendantCases('${d.id}')" style="cursor: pointer;">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-user-shield"></i>
                        <span>${d.name}</span>
                    </div>
                    <span class="badge badge-info">${casesCount} قضية</span>
                </div>
                
                <div class="card-body">
                    ${d.phone ? `
                    <div class="card-info-row">
                        <span class="info-label"><i class="fas fa-phone-alt"></i> الهاتف:</span>
                        <span class="info-value">${d.phone}</span>
                    </div>
                    ` : ''}
                    ${d.workplace ? `
                    <div class="card-info-row">
                        <span class="info-label"><i class="fas fa-building"></i> مكان العمل:</span>
                        <span class="info-value">${d.workplace}</span>
                    </div>
                    ` : ''}
                    ${d.address ? `
                    <div class="card-info-row">
                        <span class="info-label"><i class="fas fa-map-marker-alt"></i> العنوان:</span>
                        <span class="info-value">${d.address}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="card-actions" onclick="event.stopPropagation();">
                    <button class="btn btn-secondary btn-sm" onclick="editDefendant('${d.id}')" title="تعديل">
                        <i class="fas fa-pen"></i> تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDefendant('${d.id}')" title="حذف">
                        <i class="fas fa-trash-alt"></i> حذف
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="showDefendantCases('${d.id}')" title="عرض القضايا">
                        <i class="fas fa-gavel"></i> القضايا
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }
}

function editDefendant(id) {
    const defendant = data.defendants.find(d => d.id === id);
    if (!defendant) {
        showToast('المدعى عليه غير موجود', 'error');
        return;
    }
    
    // ملء النموذج بالبيانات الحالية
    document.getElementById('new-defendant-name').value = defendant.name || '';
    document.getElementById('new-defendant-phone').value = defendant.phone || '';
    document.getElementById('new-defendant-workplace').value = defendant.workplace || '';
    document.getElementById('new-defendant-address').value = defendant.address || '';
    
    // تغيير عنوان النافذة
    const modalTitle = document.querySelector('#new-defendant-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'تعديل المدعى عليه';
    
    // تغيير نص الزر
    const submitBtn = document.querySelector('#new-defendant-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    
    // حفظ معرف المدعى عليه المراد تعديله
    document.getElementById('new-defendant-form').dataset.editId = id;
    
    // فتح النافذة
    modalManager.open('new-defendant-modal');
}

function deleteDefendant(id) {
    if (confirm('هل أنت متأكد من حذف هذا المدعى عليه؟')) {
        if (firebaseInitialized) {
            db.ref(DB_PATHS.DEFENDANTS).child(id).remove();
        }
        
        data.defendants = data.defendants.filter(d => d.id !== id);
        saveToLocalStorage();
        renderDefendantsTable();
        showToast('تم حذف المدعى عليه', 'success');
    }
}

function showDefendantCases(defendantId) {
    const defendant = data.defendants.find(d => d.id === defendantId);
    if (!defendant) {
        showToast('المدعى عليه غير موجود', 'error');
        return;
    }
    
    // البحث عن القضايا المرتبطة بهذا المدعى عليه
    const defendantCases = data.cases.filter(c => c.defendantName === defendant.name);
    
    if (defendantCases.length === 0) {
        showToast('لا توجد قضايا لهذا المدعى عليه', 'info');
        return;
    }
    
    // الانتقال لصفحة الدعاوى
    navigateTo('cases');
    
    // تطبيق فلتر البحث
    setTimeout(() => {
        const searchInput = document.getElementById('cases-search');
        if (searchInput) {
            searchInput.value = defendant.name;
            searchCases();
        }
    }, 100);
}

// ==================== المحامين ====================
function showNewLawyerModal() {
    modalManager.open('new-lawyer-modal');
}

function saveNewLawyer(event) {
    event.preventDefault();
    
    const form = event.target;
    const editId = form.dataset.editId;
    const isEditing = !!editId;
    
    const lawyer = {
        id: isEditing ? editId : generateId(),
        name: document.getElementById('new-lawyer-name').value,
        licenseNumber: document.getElementById('new-lawyer-license').value,
        phone: document.getElementById('new-lawyer-phone').value,
        specialty: document.getElementById('new-lawyer-specialty').value,
        experience: document.getElementById('new-lawyer-experience').value,
        createdAt: isEditing ? data.lawyers.find(l => l.id === editId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (firebaseInitialized) {
        db.ref(DB_PATHS.LAWYERS).child(lawyer.id).set(lawyer);
    }
    
    if (isEditing) {
        const index = data.lawyers.findIndex(l => l.id === editId);
        if (index !== -1) {
            data.lawyers[index] = lawyer;
        }
    } else {
        data.lawyers.push(lawyer);
    }
    
    saveToLocalStorage();
    renderLawyersTable();
    updateLawyerSelectOptions();
    
    // إعادة تعيين النموذج
    delete form.dataset.editId;
    const modalTitle = document.querySelector('#new-lawyer-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'محامي جديد';
    const submitBtn = document.querySelector('#new-lawyer-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة المحامي';
    
    modalManager.close('new-lawyer-modal');
    form.reset();
    showToast(isEditing ? 'تم تعديل المحامي بنجاح' : 'تم إضافة المحامي بنجاح', 'success');
}

function renderLawyersTable() {
    const tbody = document.getElementById('lawyers-table');
    const cardsContainer = document.getElementById('lawyers-cards');
    
    if (!tbody && !cardsContainer) return; // العنصر غير موجود
    
    // عرض رسالة فارغة
    if (data.lawyers.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-user-tie"></i>
                        <h3>لا يوجد محامين</h3>
                        <p>ابدأ بإضافة محامي جديد</p>
                    </td>
                </tr>
            `;
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-tie"></i>
                    <h3>لا يوجد محامين</h3>
                    <p>ابدأ بإضافة محامي جديد</p>
                </div>
            `;
        }
        return;
    }
    
    // عرض الجدول على الشاشات الكبيرة
    if (tbody) {
        tbody.innerHTML = data.lawyers.map(l => {
            const casesCount = data.cases.filter(c => c.lawyerName === l.name).length;
            const licenseNum = l.licenseNumber || l.license || '-';
            return `
                <tr>
                    <td><strong>${l.name}</strong></td>
                    <td>${licenseNum}</td>
                    <td>${l.phone || '-'}</td>
                    <td>${l.specialty || l.specialization || '-'}</td>
                    <td>${l.experience || '-'}</td>
                    <td><span class="badge badge-normal">${casesCount}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary btn-icon" onclick="showLawyerDetails('${l.id}')" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-secondary btn-icon" onclick="editLawyer('${l.id}')" title="تعديل">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn btn-danger btn-icon" onclick="deleteLawyer('${l.id}')" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // عرض البطاقات على الشاشات الصغيرة
    if (cardsContainer) {
        cardsContainer.innerHTML = data.lawyers.map(l => {
            const casesCount = data.cases.filter(c => c.lawyerName === l.name).length;
            const licenseNum = l.licenseNumber || l.license;
            const specialty = l.specialty || l.specialization;
            return `
                <div class="data-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fas fa-balance-scale"></i>
                            <span>${l.name}</span>
                        </div>
                        <span class="badge badge-normal">${casesCount} قضية</span>
                    </div>
                    
                    <div class="card-body">
                        ${licenseNum ? `
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-id-card"></i> رقم الترخيص:</span>
                            <span class="info-value">${licenseNum}</span>
                        </div>
                        ` : ''}
                        ${l.phone ? `
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-phone-alt"></i> الهاتف:</span>
                            <span class="info-value">${l.phone}</span>
                        </div>
                        ` : ''}
                        ${specialty ? `
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-briefcase"></i> التخصص:</span>
                            <span class="info-value">${specialty}</span>
                        </div>
                        ` : ''}
                        ${l.experience ? `
                        <div class="card-info-row">
                            <span class="info-label"><i class="fas fa-award"></i> الخبرة:</span>
                            <span class="info-value">${l.experience}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="card-actions">
                        <button class="btn btn-primary btn-sm" onclick="showLawyerDetails('${l.id}')" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i> عرض
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="editLawyer('${l.id}')" title="تعديل">
                            <i class="fas fa-pen"></i> تعديل
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteLawyer('${l.id}')" title="حذف">
                            <i class="fas fa-trash-alt"></i> حذف
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function editLawyer(id) {
    const lawyer = data.lawyers.find(l => l.id === id);
    if (!lawyer) {
        showToast('المحامي غير موجود', 'error');
        return;
    }
    
    // ملء النموذج بالبيانات الحالية
    document.getElementById('new-lawyer-name').value = lawyer.name || '';
    document.getElementById('new-lawyer-license').value = lawyer.licenseNumber || lawyer.license || '';
    document.getElementById('new-lawyer-phone').value = lawyer.phone || '';
    document.getElementById('new-lawyer-specialty').value = lawyer.specialty || lawyer.specialization || '';
    document.getElementById('new-lawyer-experience').value = lawyer.experience || '';
    
    // تغيير عنوان النافذة
    const modalTitle = document.querySelector('#new-lawyer-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'تعديل المحامي';
    
    // تغيير نص الزر
    const submitBtn = document.querySelector('#new-lawyer-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    
    // حفظ معرف المحامي المراد تعديله
    document.getElementById('new-lawyer-form').dataset.editId = id;
    
    // فتح النافذة
    modalManager.open('new-lawyer-modal');
}

function deleteLawyer(id) {
    if (confirm('هل أنت متأكد من حذف هذا المحامي؟')) {
        if (firebaseInitialized) {
            db.ref(DB_PATHS.LAWYERS).child(id).remove();
        }
        
        data.lawyers = data.lawyers.filter(l => l.id !== id);
        saveToLocalStorage();
        renderLawyersTable();
        updateLawyerSelectOptions();
        showToast('تم حذف المحامي', 'success');
    }
}

function showLawyerDetails(id) {
    const lawyer = data.lawyers.find(l => l.id === id);
    if (!lawyer) {
        showToast('المحامي غير موجود', 'error');
        return;
    }
    
    const lawyerCases = data.cases.filter(c => c.lawyerName === lawyer.name);
    const totalCases = lawyerCases.length;
    const activeCases = lawyerCases.filter(c => c.status !== 'مغلق').length;
    
    const licenseNum = lawyer.licenseNumber || lawyer.license;
    const specialty = lawyer.specialty || lawyer.specialization;
    
    const content = `
        <div class="details-section">
            <h3><i class="fas fa-balance-scale"></i> المعلومات الأساسية</h3>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">الاسم:</span>
                    <span class="detail-value">${lawyer.name}</span>
                </div>
                ${licenseNum ? `
                <div class="detail-item">
                    <span class="detail-label">رقم الترخيص:</span>
                    <span class="detail-value">${licenseNum}</span>
                </div>
                ` : ''}
                ${lawyer.phone ? `
                <div class="detail-item">
                    <span class="detail-label">الهاتف:</span>
                    <span class="detail-value">${lawyer.phone}</span>
                </div>
                ` : ''}
                ${specialty ? `
                <div class="detail-item">
                    <span class="detail-label">التخصص:</span>
                    <span class="detail-value">${specialty}</span>
                </div>
                ` : ''}
                ${lawyer.experience ? `
                <div class="detail-item">
                    <span class="detail-label">سنوات الخبرة:</span>
                    <span class="detail-value">${lawyer.experience}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="details-section">
            <h3><i class="fas fa-chart-bar"></i> إحصائيات القضايا</h3>
            <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div class="stat-card" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
                    <div class="stat-content">
                        <div class="stat-label">إجمالي القضايا</div>
                        <div class="stat-value">${totalCases}</div>
                    </div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669);">
                    <div class="stat-content">
                        <div class="stat-label">القضايا النشطة</div>
                        <div class="stat-value">${activeCases}</div>
                    </div>
                </div>
            </div>
        </div>
        
        ${totalCases > 0 ? `
        <div class="details-section">
            <h3><i class="fas fa-gavel"></i> القضايا</h3>
            <div class="cases-list" id="lawyer-cases-list-${lawyer.id}">
                ${lawyerCases.slice(0, 5).map(c => `
                    <div class="case-item" onclick="showCaseDetails('${c.id}')" style="cursor: pointer; padding: 10px; border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>قضية رقم ${c.caseNumber}</strong>
                                <div style="color: var(--text-secondary); font-size: 13px;">${c.plaintiffName} ضد ${c.defendantName}</div>
                            </div>
                            <span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${totalCases > 5 ? `
                <div style="text-align: center; padding: 10px;">
                    <button class="btn btn-primary btn-sm" onclick="showAllLawyerCases('${lawyer.id}')" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
                        <i class="fas fa-list"></i> عرض جميع القضايا (${totalCases})
                    </button>
                </div>
            ` : ''}
        </div>
        ` : ''}
    `;
    
    document.getElementById('lawyer-details-content').innerHTML = content;
    modalManager.open('lawyer-details-modal');
}

function showAllLawyerCases(lawyerId) {
    const lawyer = data.lawyers.find(l => l.id === lawyerId);
    if (!lawyer) return;
    
    const lawyerCases = data.cases.filter(c => c.lawyerName === lawyer.name);
    const casesList = document.getElementById(`lawyer-cases-list-${lawyerId}`);
    
    if (!casesList) return;
    
    // عرض جميع القضايا
    casesList.innerHTML = lawyerCases.map(c => `
        <div class="case-item" onclick="showCaseDetails('${c.id}')" style="cursor: pointer; padding: 10px; border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>قضية رقم ${c.caseNumber}</strong>
                    <div style="color: var(--text-secondary); font-size: 13px;">${c.plaintiffName} ضد ${c.defendantName}</div>
                </div>
                <span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span>
            </div>
        </div>
    `).join('');
    
    // إخفاء زر "عرض جميع القضايا"
    const showAllBtn = casesList.nextElementSibling;
    if (showAllBtn && showAllBtn.querySelector('button')) {
        showAllBtn.style.display = 'none';
    }
}

// ==================== الاستقطاعات ====================
function showNewDeductionModal() {
    updateLawyerSelectOptions();
    document.getElementById('new-deduction-date').valueAsDate = new Date();
    modalManager.open('new-deduction-modal');
}

function saveNewDeduction(event) {
    event.preventDefault();
    
    const deduction = {
        id: generateId(),
        caseNumber: document.getElementById('new-deduction-case').value,
        amount: document.getElementById('new-deduction-amount').value,
        date: document.getElementById('new-deduction-date').value,
        method: document.getElementById('new-deduction-method').value,
        notes: document.getElementById('new-deduction-notes').value,
        createdAt: new Date().toISOString()
    };
    
    if (firebaseInitialized) {
        db.ref(DB_PATHS.DEDUCTIONS).push(deduction);
    }
    
    data.deductions.push(deduction);
    saveToLocalStorage();
    renderDeductionsTable();
    updateDashboard();
    
    modalManager.close('new-deduction-modal');
    document.getElementById('new-deduction-form').reset();
    showToast('تم إضافة الاستقطاع بنجاح', 'success');
    
    // إضافة إشعار للاستقطاع الجديد
    addNotification('استقطاع جديد', `تم إضافة استقطاع جديد بمبلغ ${formatCurrency(deduction.amount)} للدعوى ${deduction.caseNumber}`, 'info', null, deduction.id);
}

function renderDeductionsTable() {
    const tbody = document.getElementById('deductions-table');
    const cardsContainer = document.getElementById('deductions-cards');
    
    const totalDeductions = data.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    
    const statTotal = document.getElementById('stat-total-deductions');
    const statCount = document.getElementById('stat-deductions-count');
    if (statTotal) statTotal.textContent = formatCurrency(totalDeductions);
    if (statCount) statCount.textContent = data.deductions.length;
    
    // عرض رسالة فارغة
    if (data.deductions.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-money-bill-wave"></i>
                        <h3>لا توجد استقطاعات</h3>
                        <p>ابدأ بإضافة استقطاع جديد</p>
                    </td>
                </tr>
            `;
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-money-bill-wave"></i>
                    <h3>لا توجد استقطاعات</h3>
                    <p>ابدأ بإضافة استقطاع جديد</p>
                </div>
            `;
        }
        return;
    }
    
    // عرض الجدول على الشاشات الكبيرة
    if (tbody) {
        tbody.innerHTML = data.deductions.map(d => `
            <tr>
                <td><strong>${d.caseNumber}</strong></td>
                <td>${formatCurrency(d.amount)}</td>
                <td>${formatDate(d.date)}</td>
                <td>${d.method}</td>
                <td>${d.notes || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-icon" onclick="showDeductionDetails('${d.id}')" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-secondary btn-icon" onclick="editDeduction('${d.id}')" title="تعديل">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="deleteDeduction('${d.id}')" title="حذف">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // عرض البطاقات على الشاشات الصغيرة
    if (cardsContainer) {
        cardsContainer.innerHTML = data.deductions.map(d => `
            <div class="data-card">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-money-bill-wave"></i>
                        <span>قضية رقم ${d.caseNumber}</span>
                    </div>
                    <span class="badge badge-normal">${formatCurrency(d.amount)}</span>
                </div>
                
                <div class="card-body">
                    <div class="card-info-row">
                        <span class="info-label"><i class="fas fa-calendar"></i> التاريخ:</span>
                        <span class="info-value">${formatDate(d.date)}</span>
                    </div>
                    <div class="card-info-row">
                        <span class="info-label"><i class="fas fa-credit-card"></i> طريقة الدفع:</span>
                        <span class="info-value">${d.method}</span>
                    </div>
                    ${d.notes ? `
                    <div class="card-info-row">
                        <span class="info-label"><i class="fas fa-sticky-note"></i> ملاحظات:</span>
                        <span class="info-value">${d.notes}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="card-actions">
                    <button class="btn btn-primary btn-sm" onclick="showDeductionDetails('${d.id}')" title="عرض التفاصيل">
                        <i class="fas fa-eye"></i> عرض
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="editDeduction('${d.id}')" title="تعديل">
                        <i class="fas fa-pen"></i> تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDeduction('${d.id}')" title="حذف">
                        <i class="fas fa-trash-alt"></i> حذف
                    </button>
                </div>
            </div>
        `).join('');
    }
}

function showDeductionDetails(id) {
    const deduction = data.deductions.find(d => d.id === id);
    if (!deduction) {
        showToast('الاستقطاع غير موجود', 'error');
        return;
    }
    
    const caseData = data.cases.find(c => c.caseNumber === deduction.caseNumber);
    
    const content = `
        <div class="details-section">
            <h3><i class="fas fa-money-bill-wave"></i> تفاصيل الاستقطاع</h3>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">رقم القضية:</span>
                    <span class="detail-value"><strong>${deduction.caseNumber}</strong></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">المبلغ:</span>
                    <span class="detail-value highlight">${formatCurrency(deduction.amount)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">التاريخ:</span>
                    <span class="detail-value">${formatDate(deduction.date)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">طريقة الدفع:</span>
                    <span class="detail-value">${deduction.method}</span>
                </div>
                ${deduction.notes ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <span class="detail-label">ملاحظات:</span>
                    <span class="detail-value">${deduction.notes}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${caseData ? `
        <div class="details-section">
            <h3><i class="fas fa-gavel"></i> معلومات القضية</h3>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">المدعي:</span>
                    <span class="detail-value">${caseData.plaintiffName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">المدعى عليه:</span>
                    <span class="detail-value">${caseData.defendantName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">المبلغ الكلي:</span>
                    <span class="detail-value">${formatCurrency(caseData.amount)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">الحالة:</span>
                    <span class="detail-value"><span class="badge ${getStatusBadgeClass(caseData.status)}">${caseData.status}</span></span>
                </div>
            </div>
            <div style="margin-top: 15px;">
                <button class="btn btn-primary" onclick="showCaseDetails('${caseData.id}')">
                    <i class="fas fa-eye"></i> عرض تفاصيل القضية
                </button>
            </div>
        </div>
        ` : ''}
    `;
    
    document.getElementById('deduction-details-content').innerHTML = content;
    modalManager.open('deduction-details-modal');
}

function editDeduction(id) {
    showToast('هذه الميزة قيد التطوير', 'info');
}

function deleteDeduction(id) {
    if (confirm('هل أنت متأكد من حذف هذا الاستقطاع؟')) {
        if (firebaseInitialized) {
            db.ref(DB_PATHS.DEDUCTIONS).child(id).remove();
        }
        
        data.deductions = data.deductions.filter(d => d.id !== id);
        saveToLocalStorage();
        renderDeductionsTable();
        updateDashboard();
        showToast('تم حذف الاستقطاع', 'success');
    }
}

function editCase(id) {
    const caseData = data.cases.find(c => c.id === id);
    if (!caseData) {
        showToast('الدعوى غير موجودة', 'error');
        return;
    }
    
    // ملء النموذج بالبيانات الحالية
    document.getElementById('new-case-number').value = caseData.caseNumber || '';
    document.getElementById('new-case-date').value = caseData.filingDate || '';
    document.getElementById('new-case-priority').value = caseData.priority || 'عادية';
    document.getElementById('new-case-status').value = caseData.status || 'مسودة';
    if (document.getElementById('new-case-stage')) {
        document.getElementById('new-case-stage').value = caseData.stage || '';
    }
    document.getElementById('new-case-amount').value = caseData.amount || '';
    document.getElementById('new-case-plaintiff-name').value = caseData.plaintiffName || '';
    document.getElementById('new-case-plaintiff-phone').value = caseData.plaintiffPhone || '';
    if (document.getElementById('new-case-plaintiff-address')) {
        document.getElementById('new-case-plaintiff-address').value = caseData.plaintiffAddress || '';
    }
    document.getElementById('new-case-defendant-name').value = caseData.defendantName || '';
    document.getElementById('new-case-defendant-phone').value = caseData.defendantPhone || '';
    if (document.getElementById('new-case-defendant-address')) {
        document.getElementById('new-case-defendant-address').value = caseData.defendantAddress || '';
    }
    document.getElementById('new-case-lawyer').value = caseData.lawyerName || '';
    document.getElementById('new-case-court').value = caseData.court || '';
    if (document.getElementById('new-case-court-section')) {
        document.getElementById('new-case-court-section').value = caseData.courtSection || '';
    }
    document.getElementById('new-case-next-hearing').value = caseData.nextHearing || '';
    document.getElementById('new-case-notes').value = caseData.notes || '';
    
    // تحديث خيارات التنفيذ
    document.getElementById('execution-deduction').checked = caseData.executionDeduction || false;
    document.getElementById('execution-seizure').checked = caseData.executionSeizure || false;
    
    // إظهار خيارات التنفيذ إذا كانت الحالة "تنفيذ"
    if (caseData.status === 'تنفيذ') {
        document.getElementById('execution-options-container').style.display = 'block';
    } else {
        document.getElementById('execution-options-container').style.display = 'none';
    }
    
    // تغيير عنوان النافذة
    const modalTitle = document.querySelector('#new-case-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'تعديل الدعوى';
    
    // تغيير نص الزر
    const submitBtn = document.querySelector('#new-case-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    
    // حفظ معرف الدعوى المراد تعديلها
    document.getElementById('new-case-form').dataset.editId = id;
    
    // فتح النافذة
    modalManager.open('new-case-modal');
}

function deleteCase(id) {
    if (confirm('هل أنت متأكد من حذف هذه الدعوى؟')) {
        // حذف من Firebase
        if (firebaseInitialized) {
            db.ref(DB_PATHS.CASES).child(id).remove();
        }
        
        data.cases = data.cases.filter(c => c.id !== id);
        saveToLocalStorage();
        renderCasesTable();
        updateDashboard();
        showToast('تم حذف الدعوى', 'success');
    }
}

// ==================== الإشعارات ====================
function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    const wasActive = panel.classList.contains('active');
    
    panel.classList.toggle('active');
    
    if (!wasActive) {
        // عند فتح اللوحة: تحديد جميع الإشعارات كمقروءة فوراً
        markAllNotificationsAsRead();
        // ثم عرض الإشعارات
        renderNotifications();
    }
}

function updateNotificationBadge() {
    const unreadCount = data.notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = unreadCount;
        if (unreadCount > 0) {
            badge.classList.add('active');
        } else {
            badge.classList.remove('active');
        }
    }
}

function markAllNotificationsAsRead() {
    data.notifications.forEach(n => n.read = true);
    saveToLocalStorage();
    
    // تحديث Firebase
    if (firebaseInitialized) {
        db.ref(DB_PATHS.NOTIFICATIONS).set(data.notifications);
    }
    
    updateNotificationBadge();
}

function renderNotifications() {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;
    
    // تحديث العداد فقط
    updateNotificationBadge();
    
    const header = `
        <div class="notifications-header">
            <h3>الإشعارات</h3>
            <div style="display: flex; gap: 10px;">
                ${data.notifications.length > 0 ? '<button class="btn btn-danger" onclick="clearAllNotifications()" style="padding: 5px 12px; font-size: 13px;"><i class="fas fa-trash-alt"></i> حذف الكل</button>' : ''}
                <button class="close-btn" onclick="toggleNotifications()">&times;</button>
            </div>
        </div>
    `;
    
    if (data.notifications.length === 0) {
        panel.innerHTML = header + `
            <div class="notifications-list">
                <div class="empty-state">
                    <i class="fas fa-bell-slash"></i>
                    <h3>لا توجد إشعارات</h3>
                </div>
            </div>
        `;
        return;
    }
    
    const list = data.notifications.map(n => {
        let onclick = '';
        let actionText = '';
        
        // التحقق من نوع الإشعار والحصول على المعرف
        if (n.caseNumber) {
            // إشعار خاص بدعوى
            onclick = `onclick="handleNotificationClick('${n.id}', 'case', '${n.caseNumber}')"`;
            actionText = '<div style="margin-top: 8px; color: var(--primary-blue); font-size: 12px;"><i class="fas fa-external-link-alt"></i> انقر للذهاب إلى الدعوى</div>';
        } else if (n.deductionId) {
            // إشعار خاص باستقطاع
            onclick = `onclick="handleNotificationClick('${n.id}', 'deduction', '${n.deductionId}')"`;
            actionText = '<div style="margin-top: 8px; color: var(--primary-blue); font-size: 12px;"><i class="fas fa-external-link-alt"></i> انقر للذهاب إلى الاستقطاع</div>';
        }
        
        return `
            <div class="notification-item ${n.read ? '' : 'unread'}" style="position: relative;">
                <div ${onclick} style="cursor: ${onclick ? 'pointer' : 'default'}; padding-left: 40px;">
                    <div class="notification-title">${n.title || ''}</div>
                    <div class="notification-text">${n.text || ''}</div>
                    <div class="notification-time">${formatDateTime(n.createdAt)}</div>
                    ${actionText}
                </div>
                <button class="notification-delete-btn" onclick="event.stopPropagation(); deleteNotification('${n.id}')" title="حذف الإشعار">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
    
    panel.innerHTML = header + '<div class="notifications-list">' + list + '</div>';
}

function handleNotificationClick(notificationId, type, targetId) {
    // تحديد الإشعار كمقروء
    const notification = data.notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        saveToLocalStorage();
    }
    
    // إغلاق لوحة الإشعارات
    toggleNotifications();
    
    // الانتقال إلى الصفحة المناسبة
    if (type === 'case') {
        navigateToCase(targetId);
    } else if (type === 'deduction') {
        navigateToDeduction(targetId);
    }
    
    // تحديث عداد الإشعارات
    renderNotifications();
}

function navigateToDeduction(deductionId) {
    // الانتقال إلى صفحة الاستقطاعات
    navigateTo('deductions');
    
    // الانتظار قليلاً ثم فتح تفاصيل الاستقطاع
    setTimeout(() => {
        const deduction = data.deductions.find(d => d.id === deductionId);
        if (deduction) {
            showDeductionDetails(deductionId);
        } else {
            showToast('لم يتم العثور على الاستقطاع', 'error');
        }
    }, 300);
}

function markNotificationRead(id) {
    const notification = data.notifications.find(n => n.id === id);
    if (notification) {
        notification.read = true;
        saveToLocalStorage();
        renderNotifications();
    }
}

function deleteNotification(id) {
    data.notifications = data.notifications.filter(n => n.id !== id);
    saveToLocalStorage();
    
    // تحديث Firebase
    if (firebaseInitialized) {
        db.ref(DB_PATHS.NOTIFICATIONS).set(data.notifications);
    }
    
    renderNotifications();
    showToast('تم حذف الإشعار', 'success');
}

function clearAllNotifications() {
    if (confirm('هل أنت متأكد من حذف جميع الإشعارات؟')) {
        data.notifications = [];
        saveToLocalStorage();
        
        // تحديث Firebase
        if (firebaseInitialized) {
            db.ref(DB_PATHS.NOTIFICATIONS).remove();
        }
        
        renderNotifications();
        showToast('تم حذف جميع الإشعارات', 'success');
    }
}

function addNotification(title, text, type = 'info', caseNumber = null, deductionId = null) {
    const notification = {
        id: generateId(),
        title: title,
        text: text,
        type: type,
        read: false,
        createdAt: new Date().toISOString()
    };
    
    // إضافة معلومات الدعوى أو الاستقطاع إذا كانت متوفرة
    if (caseNumber) {
        notification.caseNumber = caseNumber;
    }
    if (deductionId) {
        notification.deductionId = deductionId;
    }
    
    data.notifications.unshift(notification);
    saveToLocalStorage();
    
    // حفظ في Firebase
    if (firebaseInitialized) {
        db.ref(DB_PATHS.NOTIFICATIONS).set(data.notifications);
    }
    
    renderNotifications();
}

// ==================== قوالب الدعاوى ====================

/**
 * تحديث القالب بناءً على المدخلات
 */
function updateTemplate() {
    const plaintiff = document.getElementById('template-plaintiff').value || 'المدعي';
    const plaintiffAddress = document.getElementById('template-plaintiff-address').value || 'اسامه علي حسن / بسكن / الهاشمية / اليوسفية';
    const defendant = document.getElementById('template-defendant').value || 'المدعى عليه';
    const defendantAddress = document.getElementById('template-defendant-address').value || 'حسن كاظم عنوان بسكن | المحكمة | الديار';
    const amount = document.getElementById('template-amount').value || '0';
    const amountText = numberToArabicWords(amount);
    const lawyer = document.getElementById('template-lawyer').value || 'حيدر علي هادي';
    const defendantLawyer = document.getElementById('template-defendant-lawyer').value || 'علي أباذر سالم';
    const evidence = document.getElementById('template-evidence').value || 'سائر البيانات القانونية';
    
    // تحديث المبلغ كتابة
    document.getElementById('template-amount-text').value = amountText;
    
    // إنشاء محتوى القالب
    const templateHTML = `
        <div class="template-header">
            <div style="text-align: right; margin-bottom: 30px; font-size: 14px;">
                <strong>السيد قاضي بداءة</strong>
                <span style="margin: 0 50px;"></span>
                <strong>المحترم</strong>
            </div>
            
            <div style="text-align: right; margin-bottom: 15px; font-size: 14px; line-height: 1.8;">
                <strong>المدعي/ ${plaintiff}</strong> يسكن/ ${plaintiffAddress}
            </div>
            
            <div style="text-align: right; margin-bottom: 25px; font-size: 14px; line-height: 1.8;">
                <strong>المدعى عليه/ ${defendant}</strong> يسكن/ ${defendantAddress}
            </div>
        </div>

        <div class="template-section">
            <h2 style="text-align: right; font-size: 15px; font-weight: bold; margin-bottom: 15px;">جهة الدعوى:</h2>
            <div class="template-content" style="text-align: right; line-height: 2; font-size: 14px;">
                <p style="text-indent: 30px;">لموكلي بذمة المدعى عليه مبلغ قدره <strong>${amountText}</strong> وذلك لأنه ممتنع عن تسديد المبلغ المذكور رغم المطالبة المستمرة و نظراً لامتناعه وتماطله فجئنا محكمتكم المرفقة ندعوه
وتستمعون اقواله وبعد المطالبة المستمرة واصراره على عدم تسديد المبلغ المذكور اعلاه وتحميله كافة الرسوم والمصاريف
و اتعـــــــــــــاب المحاماة......</p>
            </div>
        </div>

        <div class="template-section">
            <div style="text-align: center; margin: 30px 0;">
                <strong style="font-size: 14px;">ولكم فائق الشكر والتقدير-------</strong>
            </div>
        </div>

        <div class="template-section">
            <h2 style="text-align: right; font-size: 15px; font-weight: bold; margin-bottom: 10px;">الأدلة الثبوتية</h2>
            <div class="template-content" style="text-align: right; font-size: 14px;">
                <p>1- ${evidence}</p>
            </div>
        </div>

        <div class="template-footer" style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 14px;">
            <div style="text-align: center;">
                <div><strong>المحامي/${lawyer}</strong></div>
            </div>
            <div style="text-align: center;">
                <div><strong>وكيل المدعي</strong></div>
                <div style="margin-top: 10px;">${defendantLawyer}</div>
            </div>
        </div>
    `;
    
    document.getElementById('template-preview').innerHTML = templateHTML;
}

/**
 * تحويل الأرقام إلى كلمات عربية
 */
function numberToArabicWords(num) {
    if (!num || num == 0) return 'صفر دينار';
    
    const number = parseInt(num);
    
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    
    function convertThreeDigits(n) {
        let result = '';
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const o = n % 10;
        
        if (h > 0) result += hundreds[h] + ' ';
        
        if (t === 1) {
            result += teens[o];
        } else {
            if (t > 0) result += tens[t] + ' ';
            if (o > 0) result += ones[o];
        }
        
        return result.trim();
    }
    
    let result = '';
    
    // الملايين
    if (number >= 1000000) {
        const millions = Math.floor(number / 1000000);
        if (millions === 1) result += 'مليون ';
        else if (millions === 2) result += 'مليونان ';
        else result += convertThreeDigits(millions) + ' مليون ';
    }
    
    // الآلاف
    const thousands = Math.floor((number % 1000000) / 1000);
    if (thousands > 0) {
        if (thousands === 1) result += 'ألف ';
        else if (thousands === 2) result += 'ألفان ';
        else result += convertThreeDigits(thousands) + ' ألف ';
    }
    
    // المئات والعشرات والآحاد
    const remainder = number % 1000;
    if (remainder > 0) {
        result += convertThreeDigits(remainder);
    }
    
    return result.trim() + ' دينار';
}

/**
 * طباعة القالب
 */
function printTemplate() {
    // تحديث القالب قبل الطباعة
    updateTemplate();
    
    // الانتظار قليلاً لضمان تحديث DOM
    setTimeout(() => {
        window.print();
    }, 100);
}

// ==================== النسخ الاحتياطي والتصدير ====================
function backupData() {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('تم تنزيل النسخة الاحتياطية', 'success');
}

function restoreData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const restored = JSON.parse(event.target.result);
                
                console.log('📥 بدء استيراد البيانات...');
                
                // التحقق من نوع الملف
                if (restored.cases && typeof restored.cases === 'object' && !Array.isArray(restored.cases)) {
                    // ملف Firebase - تحويل البيانات
                    console.log('🔄 اكتشاف ملف Firebase - جاري التحويل...');
                    data = convertFirebaseDataToLocal(restored);
                } else if (restored.cases && Array.isArray(restored.cases)) {
                    // ملف محلي عادي
                    console.log('✅ ملف محلي - استيراد مباشر');
                    data = restored;
                } else {
                    throw new Error('تنسيق الملف غير صحيح');
                }
                
                // حفظ البيانات مباشرة
                console.log('💾 حفظ البيانات في localStorage...');
                saveToLocalStorage();
                
                // عرض الإحصائيات
                console.log('📊 تم الاستيراد بنجاح:');
                console.log('  - الدعاوى:', data.cases.length);
                console.log('  - المدعى عليهم:', data.defendants.length);
                console.log('  - المحامين:', data.lawyers.length);
                console.log('  - الاستقطاعات:', data.deductions.length);
                
                showToast(`تم استيراد ${data.cases.length} دعوى و ${data.lawyers.length} محامي بنجاح!`, 'success');
                
                console.log('🔄 إعادة تحميل الصفحة...');
                // إعادة تحميل الصفحة مباشرة لضمان قراءة البيانات من localStorage
                setTimeout(() => {
                    location.reload();
                }, 800);
                
            } catch (error) {
                console.error('❌ خطأ في استعادة البيانات:', error);
                showToast('فشل استعادة البيانات - ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ==================== تحويل بيانات Firebase ====================
function convertFirebaseDataToLocal(firebaseData) {
    console.log('🔄 بدء تحويل بيانات Firebase...');
    
    const localData = {
        cases: [],
        defendants: [],
        lawyers: [],
        deductions: [],
        notifications: [],
        templates: [],
        chatMessages: {}
    };
    
    // تحويل الدعاوى
    if (firebaseData.cases && typeof firebaseData.cases === 'object') {
        console.log('📋 تحويل الدعاوى...');
        const casesArray = Array.isArray(firebaseData.cases) 
            ? firebaseData.cases 
            : Object.values(firebaseData.cases);
            
        casesArray.forEach((c, index) => {
            if (!c) return; // تخطي القيم الفارغة
            
            const caseData = {
                id: String(c.id || generateId()), // ✅ تحويل إلى string
                caseNumber: c.caseNumber || `CASE-${index + 1}`,
                filingDate: c.fileDate || c.filingDate || c.createdAt || new Date().toISOString(),
                priority: c.priority || 'عادية',
                status: c.status || 'مسودة',
                stage: c.stage || '',
                amount: parseFloat(c.amount) || 0,
                plaintiffName: c.plaintiffName || '',
                plaintiffPhone: c.plaintiffPhone || '',
                plaintiffAddress: c.plaintiffAddress || '',
                defendantName: c.defendantName || '',
                defendantPhone: c.defendantPhone || '',
                defendantAddress: c.defendantAddress || '',
                lawyerName: c.lawyerName || '',
                court: c.courtName || c.court || '',
                courtSection: c.courtSection || '',
                nextHearing: c.nextHearing || '',
                notes: c.notes || '',
                createdAt: c.createdAt || new Date().toISOString(),
                updatedAt: c.lastModified || c.updatedAt || c.createdAt || new Date().toISOString()
            };
            
            localData.cases.push(caseData);
        });
        console.log(`  ✅ تم تحويل ${localData.cases.length} دعوى`);
    }
    
    // تحويل المدعى عليهم
    if (firebaseData.defendants && typeof firebaseData.defendants === 'object') {
        console.log('👥 تحويل المدعى عليهم...');
        const defendantsArray = Array.isArray(firebaseData.defendants) 
            ? firebaseData.defendants 
            : Object.values(firebaseData.defendants);
            
        defendantsArray.forEach(d => {
            if (!d) return;
            
            localData.defendants.push({
                id: String(d.id || generateId()), // ✅ تحويل إلى string
                name: d.name || '',
                phone: d.phone || '',
                email: d.email || '',
                workplace: d.workplace || '',
                address: d.address || '',
                createdAt: d.createdAt || d.registrationDate || new Date().toISOString()
            });
        });
        console.log(`  ✅ تم تحويل ${localData.defendants.length} مدعى عليه`);
    }
    
    // تحويل المحامين
    if (firebaseData.lawyers && typeof firebaseData.lawyers === 'object') {
        console.log('👨‍⚖️ تحويل المحامين...');
        const lawyersArray = Array.isArray(firebaseData.lawyers) 
            ? firebaseData.lawyers 
            : Object.values(firebaseData.lawyers);
            
        lawyersArray.forEach(l => {
            if (!l) return;
            
            localData.lawyers.push({
                id: String(l.id || generateId()), // ✅ تحويل إلى string
                name: l.name || '',
                licenseNumber: l.license || l.licenseNumber || '',
                phone: l.phone || '',
                specialty: l.specialization || l.specialty || '',
                experience: l.experience || '',
                address: l.address || '',
                notes: l.notes || '',
                createdAt: l.createdAt || l.registrationDate || new Date().toISOString()
            });
        });
        console.log(`  ✅ تم تحويل ${localData.lawyers.length} محامي`);
    }
    
    // تحويل الاستقطاعات
    if (firebaseData.deductions && typeof firebaseData.deductions === 'object') {
        console.log('💰 تحويل الاستقطاعات...');
        const deductionsArray = Array.isArray(firebaseData.deductions) 
            ? firebaseData.deductions 
            : Object.values(firebaseData.deductions);
            
        deductionsArray.forEach(d => {
            if (!d) return;
            
            localData.deductions.push({
                id: String(d.id || generateId()), // ✅ تحويل إلى string
                caseNumber: d.caseNumber || '',
                amount: parseFloat(d.amount) || 0,
                date: d.date || new Date().toISOString().split('T')[0],
                method: d.source || d.method || 'نقدي',
                notes: d.notes || '',
                status: d.status || '',
                plaintiffName: d.plaintiffName || '',
                createdAt: d.createdAt || new Date().toISOString()
            });
        });
        console.log(`  ✅ تم تحويل ${localData.deductions.length} استقطاع`);
    }
    
    // تحويل الإشعارات
    if (firebaseData.notifications && typeof firebaseData.notifications === 'object') {
        console.log('🔔 تحويل الإشعارات...');
        const notificationsArray = Array.isArray(firebaseData.notifications) 
            ? firebaseData.notifications 
            : Object.values(firebaseData.notifications);
            
        notificationsArray.forEach(n => {
            if (!n) return;
            
            localData.notifications.push({
                id: n.id || generateId(),
                title: n.title || 'إشعار',
                text: n.description || n.text || '',
                type: n.type || 'info',
                read: n.read || false,
                createdAt: n.timestamp || n.createdAt || new Date().toISOString()
            });
        });
        console.log(`  ✅ تم تحويل ${localData.notifications.length} إشعار`);
    }
    
    console.log('✅ اكتمل تحويل البيانات من Firebase');
    console.log('📊 الملخص النهائي:');
    console.log('  � الدعاوى:', localData.cases.length);
    console.log('  👥 المدعى عليهم:', localData.defendants.length);
    console.log('  👨‍⚖️ المحامين:', localData.lawyers.length);
    console.log('  💰 الاستقطاعات:', localData.deductions.length);
    console.log('  🔔 الإشعارات:', localData.notifications.length);
    
    return localData;
}

function exportData() {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('تم تصدير البيانات', 'success');
}

function generateReport() {
    showToast('هذه الميزة قيد التطوير', 'info');
}

// ==================== الدردشة ====================
function renderLawyersChatList() {
    const container = document.getElementById('lawyers-chat-list');
    if (!container) return;
    
    if (data.lawyers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <h3>لا يوجد محامين</h3>
                <p>أضف محامين للبدء بالدردشة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.lawyers.map(l => {
        // حساب عدد الرسائل غير المقروءة
        const unreadCount = (data.chatMessages[l.id] || []).filter(m => 
            m.sender === 'lawyer' && !m.read && !m.deletedForAdmin
        ).length;
        
        return `
        <div class="lawyer-chat-item ${selectedLawyerForChat === l.id ? 'active' : ''}" 
             onclick="selectLawyerForChat('${l.id}')"
             style="padding: 15px; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: all 0.3s; position: relative;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); 
                            display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; position: relative;">
                    ${l.name.charAt(0)}
                    ${unreadCount > 0 ? `
                        <div style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; 
                                    border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; 
                                    justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white;
                                    box-shadow: 0 2px 5px rgba(239, 68, 68, 0.5);">
                            ${unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                    ` : ''}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                        ${l.name}
                        ${unreadCount > 0 ? `
                            <span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; 
                                         font-size: 11px; font-weight: bold;">
                                ${unreadCount} جديد
                            </span>
                        ` : ''}
                    </div>
                    <div style="font-size: 12px; color: #64748b;">${l.phone || 'لا يوجد هاتف'}</div>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

function selectLawyerForChat(lawyerId) {
    console.log('🔍 اختيار محامي للدردشة:', lawyerId);
    console.log('📋 جميع المحامين:', data.lawyers.map(l => ({ id: l.id, name: l.name })));
    
    selectedLawyerForChat = lawyerId;
    renderLawyersChatList();
    renderChatMessages();
    document.getElementById('chat-input-area').style.display = 'block';
    
    // إظهار زر مسح المحادثة
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) clearChatBtn.style.display = 'inline-block';
    
    // للهواتف: إخفاء قائمة المحامين وإظهار منطقة الدردشة
    const chatPage = document.getElementById('chat-page');
    const backBtn = document.getElementById('chat-back-btn');
    const chatTitle = document.getElementById('chat-page-title');
    const lawyer = data.lawyers.find(l => l.id === lawyerId);
    
    console.log('👨‍⚖️ المحامي المختار:', lawyer);
    
    if (window.innerWidth <= 768) {
        chatPage.classList.add('chat-active');
        if (backBtn) backBtn.style.display = 'inline-flex';
        if (chatTitle && lawyer) chatTitle.textContent = `دردشة مع ${lawyer.name}`;
    }
}

function backToLawyersList() {
    const chatPage = document.getElementById('chat-page');
    const backBtn = document.getElementById('chat-back-btn');
    const chatTitle = document.getElementById('chat-page-title');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    
    chatPage.classList.remove('chat-active');
    if (backBtn) backBtn.style.display = 'none';
    if (chatTitle) chatTitle.textContent = 'الدردشة مع المحامين';
    if (clearChatBtn) clearChatBtn.style.display = 'none';
    
    // إخفاء منطقة الإدخال
    document.getElementById('chat-input-area').style.display = 'none';
    selectedLawyerForChat = null;
    renderLawyersChatList();
}

/**
 * مسح المحادثة الحالية
 */
function clearCurrentChat() {
    if (selectedLawyerForChat) {
        const lawyer = data.lawyers.find(l => l.id === selectedLawyerForChat);
        const lawyerName = lawyer ? lawyer.name : 'المحامي';
        
        if (confirm(`هل أنت متأكد من حذف جميع الرسائل مع ${lawyerName}؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            clearChatMessages(selectedLawyerForChat);
        }
    }
}

function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container || !selectedLawyerForChat) return;
    
    const lawyer = data.lawyers.find(l => l.id === selectedLawyerForChat);
    if (!lawyer) return;
    
    const messages = data.chatMessages[selectedLawyerForChat] || [];
    
    // تصفية الرسائل المحذوفة للإدارة
    const visibleMessages = messages.filter(m => !m.deletedForAdmin);
    
    if (visibleMessages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comment-dots"></i>
                <h3>لا توجد رسائل</h3>
                <p>ابدأ محادثة مع ${lawyer.name}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = visibleMessages.map((m, index) => {
        const isAdmin = m.sender === 'admin';
        const senderName = isAdmin ? 'الإدارة' : (m.senderName || lawyer.name);
        const messageId = m.id || index;
        
        // حالة المشاهدة
        let readStatus = '';
        if (isAdmin) {
            if (m.lawyerRead) {
                readStatus = '<i class="fas fa-check-double" style="color: #10b981; margin-right: 5px;" title="تم المشاهدة"></i>';
            } else if (m.read) {
                readStatus = '<i class="fas fa-check-double" style="opacity: 0.5; margin-right: 5px;" title="تم التسليم"></i>';
            } else {
                readStatus = '<i class="fas fa-check" style="opacity: 0.5; margin-right: 5px;" title="تم الإرسال"></i>';
            }
        }
        
        return `
            <div class="chat-message-wrapper" style="margin-bottom: 15px; display: flex; ${isAdmin ? 'justify-content: flex-end' : 'justify-content: flex-start'};">
                <div class="chat-message-container" style="max-width: 70%; position: relative; group;">
                    <!-- قائمة الخيارات -->
                    <div class="message-options" style="position: absolute; top: -8px; ${isAdmin ? 'left: -8px' : 'right: -8px'}; 
                                display: none; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                                padding: 5px; z-index: 10;">
                        <button onclick="copyMessage('${messageId}')" title="نسخ" 
                                style="background: none; border: none; color: #6366f1; padding: 5px 8px; cursor: pointer; border-radius: 5px;">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="deleteMessage('${messageId}', '${selectedLawyerForChat}')" title="حذف" 
                                style="background: none; border: none; color: #ef4444; padding: 5px 8px; cursor: pointer; border-radius: 5px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    
                    <div class="chat-bubble" 
                         onmouseenter="this.parentElement.querySelector('.message-options').style.display='flex'" 
                         onmouseleave="this.parentElement.querySelector('.message-options').style.display='none'"
                         style="padding: 12px 16px; border-radius: 12px; 
                                background: ${isAdmin ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f1f5f9'}; 
                                color: ${isAdmin ? 'white' : '#1e293b'}; cursor: pointer;">
                        <div style="font-size: 11px; opacity: 0.8; margin-bottom: 5px; font-weight: bold;">
                            ${senderName}
                        </div>
                        <div class="message-text" data-message-id="${messageId}">${m.message}</div>
                        <div style="font-size: 11px; opacity: 0.7; margin-top: 5px; display: flex; align-items: center; justify-content: ${isAdmin ? 'flex-start' : 'flex-end'}; gap: 5px;">
                            ${formatDateTime(m.timestamp)}
                            ${readStatus}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
    
    // تحديث حالة القراءة للرسائل غير المقروءة من المحامي
    visibleMessages.forEach((m, index) => {
        if (m.sender !== 'admin' && !m.read) {
            const messageId = m.id || index;
            markMessageAsRead(messageId, selectedLawyerForChat);
        }
    });
}

function sendChatMessage() {
    if (!selectedLawyerForChat) {
        showToast('الرجاء اختيار محامي أولاً', 'warning');
        return;
    }
    
    const input = document.getElementById('chat-message-input');
    const message = input.value.trim();
    
    if (!message) {
        showToast('الرجاء كتابة رسالة', 'warning');
        return;
    }

    const lawyer = data.lawyers.find(l => l.id === selectedLawyerForChat);
    if (!lawyer) {
        console.error('❌ لم يتم العثور على المحامي:', selectedLawyerForChat);
        console.log('📋 المحامين المتاحين:', data.lawyers.map(l => ({ id: l.id, name: l.name })));
        showToast('لم يتم العثور على المحامي', 'error');
        return;
    }
    
    console.log('📤 إرسال رسالة إلى المحامي:', lawyer.name);
    console.log('🔑 معرف المحامي:', selectedLawyerForChat);
    
    const chatMessage = {
        sender: 'admin',
        senderName: 'الإدارة',
        message: message,
        timestamp: new Date().toISOString(),
        read: false,
        lawyerId: selectedLawyerForChat,
        lawyerName: lawyer.name,
        lawyerRead: false  // لم يقرأ المحامي الرسالة بعد
    };
    
    console.log('💬 بيانات الرسالة:', chatMessage);
    
    // حفظ محلياً
    if (!data.chatMessages[selectedLawyerForChat]) {
        data.chatMessages[selectedLawyerForChat] = [];
    }
    
    data.chatMessages[selectedLawyerForChat].push(chatMessage);
    
    // حفظ في Firebase
    if (firebaseInitialized) {
        const chatPath = `${DB_PATHS.CHAT}/${selectedLawyerForChat}`;
        console.log('🔥 حفظ في Firebase:', chatPath);
        
        db.ref(chatPath).push(chatMessage)
            .then(() => {
                console.log('✅ تم إرسال الرسالة إلى Firebase بنجاح');
            })
            .catch(error => {
                console.error('❌ خطأ في إرسال الرسالة:', error);
                showToast('فشل إرسال الرسالة، حاول مرة أخرى', 'error');
            });
    } else {
        console.warn('⚠️ Firebase غير مفعل');
    }
    
    saveToLocalStorage();
    renderChatMessages();
    
    input.value = '';
    showToast('تم إرسال الرسالة', 'success');
}

// ==================== دوال إدارة الرسائل ====================

/**
 * نسخ نص الرسالة
 */
function copyMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) {
        showToast('فشل نسخ الرسالة', 'error');
        return;
    }
    
    const messageText = messageElement.textContent;
    
    // نسخ النص إلى الحافظة
    navigator.clipboard.writeText(messageText).then(() => {
        showToast('تم نسخ الرسالة', 'success');
    }).catch(err => {
        console.error('فشل النسخ:', err);
        showToast('فشل نسخ الرسالة', 'error');
    });
}

/**
 * حذف رسالة
 */
function deleteMessage(messageId, lawyerId) {
    // عرض خيارات الحذف
    const deleteOptions = confirm(
        'اختر نوع الحذف:\n\n' +
        'موافق (OK) = حذف للجميع\n' +
        'إلغاء (Cancel) = حذف لي فقط'
    );
    
    if (deleteOptions === null) return; // ألغى المستخدم
    
    const deleteForEveryone = deleteOptions; // true = للجميع, false = لي فقط
    
    if (deleteForEveryone) {
        // حذف للطرفين - حذف من Firebase
        if (firebaseInitialized) {
            db.ref(`${DB_PATHS.CHAT}/${lawyerId}`).once('value', (snapshot) => {
                const messages = snapshot.val();
                if (messages) {
                    Object.keys(messages).forEach(key => {
                        const msg = messages[key];
                        const msgId = msg.id || key;
                        if (msgId == messageId) {
                            db.ref(`${DB_PATHS.CHAT}/${lawyerId}/${key}`).remove()
                                .then(() => {
                                    showToast('تم حذف الرسالة للجميع', 'success');
                                })
                                .catch(error => {
                                    console.error('خطأ في الحذف:', error);
                                    showToast('فشل حذف الرسالة', 'error');
                                });
                        }
                    });
                }
            });
        }
        
        // حذف محلياً
        if (data.chatMessages[lawyerId]) {
            const messageIndex = data.chatMessages[lawyerId].findIndex((m, index) => (m.id || index) == messageId);
            if (messageIndex !== -1) {
                data.chatMessages[lawyerId].splice(messageIndex, 1);
                saveToLocalStorage();
            }
        }
    } else {
        // حذف لي فقط - تحديث الرسالة في Firebase
        if (firebaseInitialized) {
            db.ref(`${DB_PATHS.CHAT}/${lawyerId}`).once('value', (snapshot) => {
                const messages = snapshot.val();
                if (messages) {
                    Object.keys(messages).forEach(key => {
                        const msg = messages[key];
                        const msgId = msg.id || key;
                        if (msgId == messageId) {
                            // وضع علامة محذوف للإدارة
                            db.ref(`${DB_PATHS.CHAT}/${lawyerId}/${key}`).update({ 
                                deletedForAdmin: true 
                            })
                            .then(() => {
                                showToast('تم حذف الرسالة لك فقط', 'success');
                                renderChatMessages();
                            })
                            .catch(error => {
                                console.error('خطأ في الحذف:', error);
                                showToast('فشل حذف الرسالة', 'error');
                            });
                        }
                    });
                }
            });
        }
        
        // حذف محلياً فقط
        if (data.chatMessages[lawyerId]) {
            const message = data.chatMessages[lawyerId].find((m, index) => (m.id || index) == messageId);
            if (message) {
                message.deletedForAdmin = true;
                saveToLocalStorage();
                renderChatMessages();
            }
        }
    }
}

/**
 * تحديد رسالة كمقروءة
 */
function markMessageAsRead(messageId, lawyerId) {
    // تحديث محلياً
    if (data.chatMessages[lawyerId]) {
        const message = data.chatMessages[lawyerId].find((m, index) => (m.id || index) == messageId);
        if (message && message.sender !== 'admin') {
            message.read = true;
            saveToLocalStorage();
            updateChatBadge(); // تحديث الشارة
        }
    }
    
    // تحديث في Firebase
    if (firebaseInitialized) {
        db.ref(`${DB_PATHS.CHAT}/${lawyerId}`).once('value', (snapshot) => {
            const messages = snapshot.val();
            if (messages) {
                Object.keys(messages).forEach(key => {
                    const msg = messages[key];
                    const msgId = msg.id || key;
                    if (msgId == messageId && msg.sender !== 'admin') {
                        db.ref(`${DB_PATHS.CHAT}/${lawyerId}/${key}`).update({ read: true });
                    }
                });
            }
        });
    }
}

/**
 * مسح جميع رسائل المحادثة
 */
function clearChatMessages(lawyerId) {
    if (!confirm('هل أنت متأكد من حذف جميع الرسائل مع هذا المحامي؟ لا يمكن التراجع عن هذا الإجراء.')) {
        return;
    }
    
    // حذف محلياً
    data.chatMessages[lawyerId] = [];
    saveToLocalStorage();
    
    // حذف من Firebase
    if (firebaseInitialized) {
        db.ref(`${DB_PATHS.CHAT}/${lawyerId}`).remove()
            .then(() => {
                showToast('تم حذف جميع الرسائل', 'success');
                renderChatMessages();
            })
            .catch(error => {
                console.error('خطأ في حذف الرسائل:', error);
                showToast('فشل حذف الرسائل', 'error');
            });
    } else {
        renderChatMessages();
        showToast('تم حذف جميع الرسائل', 'success');
    }
}

/**
 * إظهار إشعار الرسالة الجديدة
 */
function showChatNotification(lawyerName, messageText, lawyerId) {
    // تجاهل الإشعار إذا كان المستخدم يشاهد المحادثة حالياً
    if (selectedLawyerForChat === lawyerId && document.getElementById('chat-page').classList.contains('active')) {
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = 'chat-notification';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        padding: 15px 20px;
        min-width: 320px;
        max-width: 400px;
        z-index: 99999;
        animation: slideInRight 0.4s ease;
        cursor: pointer;
        border-left: 4px solid #10b981;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); 
                        display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0;">
                ${lawyerName.charAt(0)}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: #1e293b; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <span>${lawyerName}</span>
                    <i class="fas fa-comment-dots" style="font-size: 12px; color: #10b981;"></i>
                </div>
                <div style="font-size: 14px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0; font-size: 18px;">
                ×
            </button>
        </div>
    `;
    
    // فتح المحادثة عند النقر
    notification.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON') {
            showPage('chat');
            selectLawyerForChat(lawyerId);
            notification.remove();
        }
    };
    
    document.body.appendChild(notification);
    
    // إزالة الإشعار تلقائياً بعد 5 ثوانٍ
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.4s ease';
            setTimeout(() => notification.remove(), 400);
        }
    }, 5000);
}

/**
 * تشغيل صوت الإشعار
 */
function playChatNotificationSound() {
    // إنشاء نغمة إشعار بسيطة باستخدام Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('لا يمكن تشغيل صوت الإشعار:', error);
    }
}

/**
 * تحديث شارة الدردشة العامة على القائمة الجانبية
 */
function updateChatBadge() {
    const chatBadge = document.getElementById('chat-badge');
    if (!chatBadge) return;
    
    // حساب إجمالي الرسائل غير المقروءة من جميع المحامين
    let totalUnread = 0;
    
    Object.keys(data.chatMessages).forEach(lawyerId => {
        const messages = data.chatMessages[lawyerId] || [];
        const unreadCount = messages.filter(m => 
            m.sender === 'lawyer' && !m.read && !m.deletedForAdmin
        ).length;
        totalUnread += unreadCount;
    });
    
    // تحديث الشارة
    if (totalUnread > 0) {
        chatBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
        chatBadge.style.display = 'inline-block';
    } else {
        chatBadge.style.display = 'none';
    }
}

// ==================== Toast Notifications ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== التهيئة عند التحميل ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 بدء تحميل التطبيق...');
    
    // تحميل البيانات المحلية
    loadFromLocalStorage();
    
    // تهيئة Firebase
    initFirebase();
    
    // إعداد التنقل
    setupNavigation();
    
    // إعداد القائمة للهواتف
    setupMobileMenu();
    
    // تحديث جميع الجداول
    console.log('📊 تحديث الواجهة...');
    updateDashboard();
    renderCasesTable();
    renderDefendantsTable();
    renderLawyersTable();
    renderDeductionsTable();
    
    // عرض الإشعارات
    renderNotifications();
    
    console.log('✅ تم تحميل التطبيق بنجاح');
    console.log('📈 الإحصائيات:', {
        cases: data.cases.length,
        defendants: data.defendants.length,
        lawyers: data.lawyers.length,
        deductions: data.deductions.length
    });
    
    // مراقبة تغيير حجم الشاشة لإعادة ضبط واجهة الدردشة
    window.addEventListener('resize', () => {
        const chatPage = document.getElementById('chat-page');
        const backBtn = document.getElementById('chat-back-btn');
        
        if (window.innerWidth > 768) {
            // على الشاشات الكبيرة: إزالة وضع الهاتف
            if (chatPage) chatPage.classList.remove('chat-active');
            if (backBtn) backBtn.style.display = 'none';
        } else if (window.innerWidth <= 768 && selectedLawyerForChat) {
            // على الهاتف: إذا كان هناك محامي محدد، إظهار زر العودة
            if (chatPage) chatPage.classList.add('chat-active');
            if (backBtn) backBtn.style.display = 'inline-flex';
        }
    });
});

// ==================== القائمة للهواتف ====================
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!menuToggle || !sidebar || !overlay) return;
    
    // فتح/إغلاق القائمة
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    });
    
    // إغلاق عند النقر على الـ overlay
    overlay.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // إغلاق القائمة عند اختيار صفحة (للهواتف فقط)
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                setTimeout(() => {
                    menuToggle.classList.remove('active');
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }, 300);
            }
        });
    });
}

// ==================== الانتقال إلى دعوى من الإشعار ====================
function navigateToCase(caseNumber) {
    // إغلاق لوحة الإشعارات
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        panel.classList.remove('active');
    }
    
    // الانتقال إلى صفحة الدعاوى
    navigateTo('cases');
    
    // البحث عن الدعوى
    const caseData = data.cases.find(c => c.caseNumber === caseNumber);
    if (caseData) {
        // عرض تفاصيل الدعوى مباشرة
        setTimeout(() => {
            showCaseDetails(caseData.id);
        }, 300);
    } else {
        showToast('الدعوى غير موجودة', 'error');
    }
}
