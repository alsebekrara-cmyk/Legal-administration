// إعداد Firebase (استخدم نفس الإعدادات من التطبيق الرئيسي)
const firebaseConfig = {
  apiKey: "AIzaSyDpasQ80hypa5KPX7fvI3Mjd6rhPJiMwFM",
  authDomain: "legal-administration.firebaseapp.com",
  databaseURL: "https://legal-administration-default-rtdb.firebaseio.com",
  projectId: "legal-administration",
  storageBucket: "legal-administration.firebasestorage.app",
  messagingSenderId: "832835239898",
  appId: "1:832835239898:web:6060c5e8a9c684bd0c4ae3",
  measurementId: "G-RLXK2PYZLS"
};
// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// المتغيرات العامة
let currentLawyer = null;
let currentCaseId = null;
let allCases = [];
let allDeductions = [];
let currentFilter = 'all'; // لتتبع الفلتر الحالي

// نظام الإشعارات
function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toast-container');
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    const titles = {
        success: title || 'نجح',
        error: title || 'خطأ',
        warning: title || 'تحذير',
        info: title || 'معلومة'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // إزالة تلقائية بعد 4 ثواني
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// التحقق من تسجيل الدخول عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    loadThemePreference();
    
    // إغلاق الإشعارات عند النقر خارجها
    document.addEventListener('click', (e) => {
        const notifPanel = document.querySelector('.notifications-panel');
        const notifBtn = document.querySelector('.btn-notifications');
        
        if (notifPanel.classList.contains('show') && 
            !notifPanel.contains(e.target) && 
            !notifBtn.contains(e.target)) {
            notifPanel.classList.remove('show');
        }
    });
});

// تبديل الوضع الليلي/النهاري
function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('.btn-theme i');
    
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
}

// تحميل تفضيل الوضع المحفوظ
function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    const body = document.body;
    const icon = document.querySelector('.btn-theme i');
    
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        if (icon) icon.className = 'fas fa-sun';
    }
}

// التحقق من تسجيل الدخول
function checkLogin() {
    const savedLawyer = localStorage.getItem('loggedLawyer');
    if (savedLawyer) {
        currentLawyer = JSON.parse(savedLawyer);
        showMainPage();
        loadLawyerData();
        setupChatListener(); // ← إضافة مراقب الدردشة
    }
}

// تسجيل الدخول
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('lawyer-name').value.trim();
    const license = document.getElementById('lawyer-license').value.trim();
    
    // التحقق من بيانات المحامي من Firebase
    try {
        const snapshot = await database.ref('lawyers').once('value');
        const lawyers = snapshot.val();
        
        let foundLawyer = null;
        for (let id in lawyers) {
            const lawyer = lawyers[id];
            const lawyerLicense = lawyer.license || lawyer.licenseNumber || '';
            
            if (lawyer.name === name && lawyerLicense === license) {
                foundLawyer = {
                    id: id,
                    name: lawyer.name,
                    license: lawyerLicense,
                    phone: lawyer.phone || ''
                };
                break;
            }
        }
        
        if (foundLawyer) {
            currentLawyer = foundLawyer;
            localStorage.setItem('loggedLawyer', JSON.stringify(foundLawyer));
            showMainPage();
            loadLawyerData();
            setupChatListener(); // ← إضافة مراقب الدردشة
        } else {
            showError('الاسم أو رقم الترخيص غير صحيح');
        }
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showError('حدث خطأ أثناء تسجيل الدخول');
    }
});

// عرض خطأ
function showError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 3000);
}

// عرض الصفحة الرئيسية
function showMainPage() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('main-page').classList.add('active');
}

// تبديل الشريط الجانبي
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
}

// فلترة القضايا حسب الحالة
function filterCases(status, element) {
    currentFilter = status;
    console.log('filterCases called with:', status);
    
    // إغلاق الشريط الجانبي
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        console.log('Sidebar closed');
    }
    
    // التأكد من عرض صفحة القضايا
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById('cases-content').classList.add('active');
    
    // تحديث عنوان الصفحة
    const titles = {
        'all': 'جميع القضايا',
        'مسودة': 'القضايا - مسودة',
        'مرفوع': 'القضايا - مرفوع',
        'في المحكمة': 'القضايا - في المحكمة',
        'صدور حكم': 'القضايا - صدور حكم',
        'تنفيذ': 'القضايا - تنفيذ',
        'مغلق': 'القضايا - مغلق'
    };
    
    document.getElementById('page-title').textContent = titles[status] || 'جميع القضايا';
    
    // تحديث حالة العناصر النشطة
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // البحث عن العنصر الذي تم النقر عليه وتفعيله
    if (element) {
        element.classList.add('active');
    } else {
        // إذا لم يتم تمرير العنصر، ابحث عنه بناءً على الحالة
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            const onclick = item.getAttribute('onclick');
            if (onclick && onclick.includes(`filterCases('${status}'`)) {
                item.classList.add('active');
            }
        });
    }
    
    // إعادة رسم القضايا
    renderCases();
}

// التنقل بين الصفحات
function navigateTo(page, event) {
    console.log('navigateTo called with:', page);
    
    // منع الحدث الافتراضي وانتشاره
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // إغلاق الشريط الجانبي فوراً
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        console.log('Sidebar and overlay closed');
    }
    
    // إخفاء جميع المحتويات
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // إزالة الحالة النشطة من جميع عناصر القائمة
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // إظهار الصفحة المطلوبة
    const targetPage = document.getElementById(page + '-content');
    if (targetPage) {
        targetPage.classList.add('active');
        console.log('Page shown:', page);
        
        // تحديث العنوان
        const titles = {
            'deductions': 'الاستقطاعات',
            'profile': 'الملف الشخصي',
            'cases': 'جميع القضايا'
        };
        document.getElementById('page-title').textContent = titles[page] || 'القضايا';
        
        // إذا كنا نذهب للقضايا، إعادة الفلتر للكل
        if (page === 'cases') {
            currentFilter = 'all';
            renderCases();
        }
    }
}

// تبديل لوحة الإشعارات
function toggleNotifications() {
    const panel = document.querySelector('.notifications-panel');
    panel.classList.toggle('show');
}

// فتح المحادثة
function openChat() {
    const panel = document.querySelector('.chat-panel');
    panel.classList.add('show');
    loadChatMessages();
}

/**
 * إعداد مراقب الدردشة - يعمل بشكل مستمر لتحديث العداد
 */
let lastNotifiedMessageId = null; // لتجنب الإشعارات المكررة

function setupChatListener() {
    if (!currentLawyer) return;
    
    const lawyerId = currentLawyer.id || currentLawyer.license;
    const messagesRef = database.ref(`lawyerMessages/${lawyerId}`);
    
    // مراقبة مستمرة للرسائل
    messagesRef.on('value', (snapshot) => {
        const messages = snapshot.val() || {};
        
        // تصفية وترتيب الرسائل
        const sortedMessages = Object.entries(messages)
            .filter(([id, msg]) => !msg.deletedForLawyer)
            .sort((a, b) => {
                const timeA = new Date(a[1].timestamp).getTime();
                const timeB = new Date(b[1].timestamp).getTime();
                return timeA - timeB;
            });
        
        // حساب الرسائل غير المقروءة من الإدارة
        const unreadCount = sortedMessages.filter(([id, msg]) => 
            msg.sender === 'admin' && !msg.lawyerRead
        ).length;
        
        // تحديث الشارة
        updateUnreadCount(unreadCount);
        
        // إظهار إشعار للرسائل الجديدة (فقط إذا كانت المحادثة مغلقة)
        const chatPanel = document.querySelector('.chat-panel');
        const isChatOpen = chatPanel && chatPanel.classList.contains('show');
        
        if (!isChatOpen && unreadCount > 0) {
            // البحث عن آخر رسالة غير مقروءة من الإدارة
            const unreadAdminMessages = sortedMessages.filter(([id, msg]) => 
                msg.sender === 'admin' && !msg.lawyerRead
            );
            
            if (unreadAdminMessages.length > 0) {
                const [lastId, lastMsg] = unreadAdminMessages[unreadAdminMessages.length - 1];
                
                // إظهار إشعار فقط إذا كانت رسالة جديدة لم نشعر بها من قبل
                if (lastId !== lastNotifiedMessageId) {
                    lastNotifiedMessageId = lastId;
                    showChatNotification('الإدارة', lastMsg.message);
                    playChatNotificationSound();
                }
            }
        }
        
        // إعادة تعيين عند فتح المحادثة
        if (isChatOpen) {
            lastNotifiedMessageId = null;
        }
    });
}

// إغلاق المحادثة
function closeChat() {
    const panel = document.querySelector('.chat-panel');
    panel.classList.remove('show');
}

// إرسال رسالة
function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message && currentLawyer) {
        // إرسال إلى مجلد المحادثات مع تنظيم حسب معرف المحامي
        const lawyerId = currentLawyer.id || currentLawyer.license;
        const messagesRef = database.ref(`lawyerMessages/${lawyerId}`);
        
        messagesRef.push({
            message: message,
            sender: 'lawyer',
            senderName: currentLawyer.name,
            lawyerLicense: currentLawyer.license,
            lawyerId: lawyerId,
            lawyerName: currentLawyer.name,
            timestamp: new Date().toISOString(),
            read: false,
            lawyerRead: true  // المحامي قرأ رسالته بالطبع
        }).then(() => {
            input.value = '';
            showToast('تم إرسال الرسالة للإدارة', 'success');
        }).catch((error) => {
            console.error('خطأ في إرسال الرسالة:', error);
            showToast('فشل إرسال الرسالة', 'error');
        });
    }
}

// معالجة Enter في المحادثة
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// تحميل رسائل المحادثة
function loadChatMessages() {
    if (!currentLawyer) return;
    
    const lawyerId = currentLawyer.id || currentLawyer.license;
    const messagesRef = database.ref(`lawyerMessages/${lawyerId}`);
    const messagesContainer = document.querySelector('.chat-messages');
    
    // الاستماع لجميع الرسائل الخاصة بهذا المحامي
    messagesRef.on('value', (snapshot) => {
        const messages = snapshot.val() || {};
        messagesContainer.innerHTML = '';
        
        // ترتيب الرسائل حسب الوقت وتصفية المحذوفة
        const sortedMessages = Object.entries(messages)
            .filter(([id, msg]) => !msg.deletedForLawyer) // إخفاء الرسائل المحذوفة للمحامي
            .sort((a, b) => {
                const timeA = new Date(a[1].timestamp).getTime();
                const timeB = new Date(b[1].timestamp).getTime();
                return timeA - timeB;
            });
        
        if (sortedMessages.length === 0) {
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-comments" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                    <p>لا توجد رسائل بعد</p>
                    <p style="font-size: 14px;">ابدأ محادثة مع الإدارة</p>
                </div>
            `;
            return;
        }
        
        sortedMessages.forEach(([firebaseId, msg]) => {
            const messageDiv = document.createElement('div');
            const isLawyer = msg.sender === 'lawyer';
            
            messageDiv.className = `chat-message ${isLawyer ? 'sent' : 'received'}`;
            
            const time = new Date(msg.timestamp).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const senderName = isLawyer ? 'أنت' : (msg.senderName || 'الإدارة');
            
            // حالة المشاهدة
            let readStatus = '';
            if (isLawyer) {
                if (msg.read) {
                    readStatus = '<i class="fas fa-check-double" style="color: #10b981; margin-left: 5px; font-size: 12px;" title="تم المشاهدة"></i>';
                } else {
                    readStatus = '<i class="fas fa-check" style="opacity: 0.5; margin-left: 5px; font-size: 12px;" title="تم الإرسال"></i>';
                }
            }
            
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-${isLawyer ? 'user-tie' : 'user-shield'}"></i>
                </div>
                <div class="message-content">
                    <div class="message-sender" style="font-size: 11px; opacity: 0.8; margin-bottom: 3px;">${senderName}</div>
                    <div class="message-bubble" data-firebase-id="${firebaseId}" data-message-text="${msg.message.replace(/"/g, '&quot;')}"
                         oncontextmenu="showMessageMenu(event, '${firebaseId}', '${isLawyer}'); return false;"
                         ontouchstart="handleTouchStart(event, '${firebaseId}', '${isLawyer}')"
                         ontouchend="handleTouchEnd()"
                         style="cursor: pointer; position: relative;">
                        ${msg.message}
                    </div>
                    <div class="message-time" style="display: flex; align-items: center; justify-content: flex-end; gap: 5px;">
                        ${time}
                        ${readStatus}
                    </div>
                </div>
            `;
            
            messagesContainer.appendChild(messageDiv);
            
            // تحديث حالة القراءة للرسائل المستلمة من الإدارة
            if (msg.sender === 'admin' && !msg.lawyerRead) {
                database.ref(`lawyerMessages/${lawyerId}/${firebaseId}`).update({ lawyerRead: true });
            }
        });
        
        // التمرير للأسفل
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// ==================== دوال إدارة الرسائل ====================

let touchTimer;
let messageMenuVisible = false;

/**
 * معالجة الضغط الطويل على الرسالة (للهواتف)
 */
function handleTouchStart(event, firebaseId, isLawyer) {
    touchTimer = setTimeout(() => {
        showMessageMenu(event, firebaseId, isLawyer);
    }, 500); // 500ms للضغط الطويل
}

function handleTouchEnd() {
    clearTimeout(touchTimer);
}

/**
 * عرض قائمة خيارات الرسالة - محسّنة للشاشات الصغيرة
 */
function showMessageMenu(event, firebaseId, isLawyer) {
    event.preventDefault();
    
    // إزالة القائمة القديمة إذا كانت موجودة
    const existingMenu = document.querySelector('.message-context-menu');
    if (existingMenu) existingMenu.remove();
    
    // إنشاء overlay
    const overlay = document.createElement('div');
    overlay.className = 'message-context-menu';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 99999;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;
    
    // إنشاء قائمة الخيارات
    const menu = document.createElement('div');
    menu.style.cssText = `
        background: white;
        border-radius: 20px 20px 0 0;
        width: 100%;
        max-width: 500px;
        padding: 20px;
        animation: slideUp 0.3s ease;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    `;
    
    // عنوان القائمة
    const title = document.createElement('div');
    title.textContent = 'خيارات الرسالة';
    title.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        color: #1e293b;
        margin-bottom: 20px;
        text-align: center;
        padding-bottom: 15px;
        border-bottom: 2px solid #e2e8f0;
    `;
    menu.appendChild(title);
    
    // زر نسخ الرسالة
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
            <div style="width: 45px; height: 45px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-copy" style="color: white; font-size: 18px;"></i>
            </div>
            <span style="font-size: 16px; font-weight: 600; flex: 1; text-align: right;">نسخ الرسالة</span>
        </div>
    `;
    copyBtn.style.cssText = `
        width: 100%;
        padding: 15px;
        border: none;
        background: #f8fafc;
        border-radius: 12px;
        cursor: pointer;
        margin-bottom: 12px;
        transition: all 0.2s;
    `;
    copyBtn.onclick = () => {
        copyMessage(firebaseId);
        overlay.remove();
        showToast('تم نسخ الرسالة', 'success');
    };
    copyBtn.ontouchstart = () => copyBtn.style.background = '#e2e8f0';
    copyBtn.ontouchend = () => copyBtn.style.background = '#f8fafc';
    menu.appendChild(copyBtn);
    
    // زر حذف الرسالة (فقط للرسائل المرسلة من المحامي)
    if (isLawyer === 'true' || isLawyer === true) {
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
                <div style="width: 45px; height: 45px; border-radius: 12px; background: linear-gradient(135deg, #ef4444, #dc2626); display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-trash" style="color: white; font-size: 18px;"></i>
                </div>
                <span style="font-size: 16px; font-weight: 600; flex: 1; text-align: right;">حذف الرسالة</span>
            </div>
        `;
        deleteBtn.style.cssText = `
            width: 100%;
            padding: 15px;
            border: none;
            background: #fef2f2;
            border-radius: 12px;
            cursor: pointer;
            margin-bottom: 12px;
            transition: all 0.2s;
        `;
        deleteBtn.onclick = () => {
            overlay.remove();
            deleteMessage(firebaseId);
        };
        deleteBtn.ontouchstart = () => deleteBtn.style.background = '#fee2e2';
        deleteBtn.ontouchend = () => deleteBtn.style.background = '#fef2f2';
        menu.appendChild(deleteBtn);
    }
    
    // زر إلغاء
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.style.cssText = `
        width: 100%;
        padding: 15px;
        border: 2px solid #e2e8f0;
        background: white;
        border-radius: 12px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        color: #64748b;
        margin-top: 8px;
        transition: all 0.2s;
    `;
    cancelBtn.onclick = () => overlay.remove();
    cancelBtn.ontouchstart = () => cancelBtn.style.background = '#f8fafc';
    cancelBtn.ontouchend = () => cancelBtn.style.background = 'white';
    menu.appendChild(cancelBtn);
    
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
    
    // إغلاق عند النقر على الـ overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

/**
 * نسخ نص الرسالة
 */
function copyMessage(firebaseId) {
    const messageElement = document.querySelector(`[data-firebase-id="${firebaseId}"]`);
    if (!messageElement) {
        showToast('فشل نسخ الرسالة', 'error');
        return;
    }
    
    const messageText = messageElement.getAttribute('data-message-text');
    
    // نسخ النص إلى الحافظة
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(messageText).then(() => {
            showToast('تم نسخ الرسالة', 'success');
        }).catch(err => {
            console.error('فشل النسخ:', err);
            fallbackCopy(messageText);
        });
    } else {
        fallbackCopy(messageText);
    }
}

/**
 * نسخ احتياطي للأجهزة القديمة
 */
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showToast('تم نسخ الرسالة', 'success');
    } catch (err) {
        console.error('فشل النسخ:', err);
        showToast('فشل نسخ الرسالة', 'error');
    }
    
    document.body.removeChild(textarea);
}

/**
 * حذف رسالة
 */
function deleteMessage(firebaseId) {
    // عرض خيارات الحذف
    const deleteChoice = confirm(
        'اختر نوع الحذف:\n\n' +
        'موافق (OK) = حذف للجميع\n' +
        'إلغاء (Cancel) = حذف لي فقط'
    );
    
    if (deleteChoice === null) return; // ألغى المستخدم
    
    const deleteForEveryone = deleteChoice; // true = للجميع, false = لي فقط
    
    if (!currentLawyer) return;
    
    const lawyerId = currentLawyer.id || currentLawyer.license;
    
    if (deleteForEveryone) {
        // حذف للطرفين - حذف من Firebase
        database.ref(`lawyerMessages/${lawyerId}/${firebaseId}`).remove()
            .then(() => {
                showToast('تم حذف الرسالة للجميع', 'success');
            })
            .catch(error => {
                console.error('خطأ في حذف الرسالة:', error);
                showToast('فشل حذف الرسالة', 'error');
            });
    } else {
        // حذف لي فقط - وضع علامة محذوف للمحامي
        database.ref(`lawyerMessages/${lawyerId}/${firebaseId}`).update({ 
            deletedForLawyer: true 
        })
        .then(() => {
            showToast('تم حذف الرسالة لك فقط', 'success');
        })
        .catch(error => {
            console.error('خطأ في حذف الرسالة:', error);
            showToast('فشل حذف الرسالة', 'error');
        });
    }
}

/**
 * مسح جميع رسائل المحادثة
 */
function clearAllMessages() {
    if (!confirm('هل أنت متأكد من حذف جميع الرسائل؟ لا يمكن التراجع عن هذا الإجراء.')) {
        return;
    }
    
    if (!currentLawyer) return;
    
    const lawyerId = currentLawyer.id || currentLawyer.license;
    
    database.ref(`lawyerMessages/${lawyerId}`).remove()
        .then(() => {
            showToast('تم حذف جميع الرسائل', 'success');
        })
        .catch(error => {
            console.error('خطأ في حذف الرسائل:', error);
            showToast('فشل حذف الرسائل', 'error');
        });
}

/**
 * إظهار إشعار الرسالة الجديدة
 */
function showChatNotification(senderName, messageText) {
    const notification = document.createElement('div');
    notification.className = 'chat-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        padding: 15px 20px;
        min-width: 300px;
        max-width: 90%;
        z-index: 99999;
        animation: slideDown 0.4s ease;
        border-left: 4px solid var(--primary-color);
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--primary-dark)); 
                        display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0;">
                <i class="fas fa-user-shield"></i>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: var(--text-dark); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <span>${senderName}</span>
                    <i class="fas fa-comment-dots" style="font-size: 12px; color: var(--primary-color);"></i>
                </div>
                <div style="font-size: 14px; color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0; font-size: 18px;">
                ×
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // إزالة الإشعار تلقائياً بعد 4 ثوانٍ
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideUp 0.4s ease';
            setTimeout(() => notification.remove(), 400);
        }
    }, 4000);
}

/**
 * تشغيل صوت الإشعار
 */
function playChatNotificationSound() {
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
 * تحديث عداد الرسائل الجديدة
 */
function updateUnreadCount(count) {
    // تحديث الشارة الجديدة على أيقونة الدردشة
    const chatBadge = document.querySelector('.chat-badge');
    if (chatBadge) {
        if (count > 0) {
            chatBadge.textContent = count > 9 ? '9+' : count;
            chatBadge.style.display = 'flex';
        } else {
            chatBadge.style.display = 'none';
        }
    }
}

// تحديث عدادات القضايا
function updateCaseCounts() {
    const counts = {
        all: allCases.length,
        'مسودة': allCases.filter(c => c.status === 'مسودة').length,
        'مرفوع': allCases.filter(c => c.status === 'مرفوع').length,
        'في المحكمة': allCases.filter(c => c.status === 'في المحكمة').length,
        'صدور حكم': allCases.filter(c => c.status === 'صدور حكم').length,
        'تنفيذ': allCases.filter(c => c.status === 'تنفيذ').length,
        'مغلق': allCases.filter(c => c.status === 'مغلق').length
    };
    
    // تحديث الشارات باستخدام IDs
    const countAll = document.getElementById('count-all');
    const countDraft = document.getElementById('count-draft');
    const countFiled = document.getElementById('count-filed');
    const countCourt = document.getElementById('count-court');
    const countVerdict = document.getElementById('count-verdict');
    const countExecution = document.getElementById('count-execution');
    const countClosed = document.getElementById('count-closed');
    
    if (countAll) countAll.textContent = counts.all;
    if (countDraft) countDraft.textContent = counts['مسودة'];
    if (countFiled) countFiled.textContent = counts['مرفوع'];
    if (countCourt) countCourt.textContent = counts['في المحكمة'];
    if (countVerdict) countVerdict.textContent = counts['صدور حكم'];
    if (countExecution) countExecution.textContent = counts['تنفيذ'];
    if (countClosed) countClosed.textContent = counts['مغلق'];
}

// تحميل الإشعارات
function loadNotifications() {
    const notificationsRef = database.ref(`notifications/${currentLawyer.id || currentLawyer.license}`);
    notificationsRef.limitToLast(20).on('value', (snapshot) => {
        const notifications = snapshot.val() || {};
        const list = document.querySelector('.notifications-list');
        list.innerHTML = '';
        
        const notifArray = Object.entries(notifications).reverse();
        
        if (notifArray.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;">لا توجد إشعارات</div>';
            return;
        }
        
        notifArray.forEach(([id, notif]) => {
            const time = new Date(notif.timestamp).toLocaleDateString('ar-EG', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const item = document.createElement('div');
            item.className = `notification-item ${notif.read ? '' : 'unread'}`;
            item.innerHTML = `
                <div class="notification-icon">
                    <i class="fas fa-${notif.icon || 'bell'}"></i>
                </div>
                <div class="notification-title">${notif.title}</div>
                <div class="notification-message">${notif.message}</div>
                <div class="notification-time">${time}</div>
            `;
            
            list.appendChild(item);
        });
        
        // تحديث الشارة
        const unreadCount = notifArray.filter(([, n]) => !n.read).length;
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    });
}

// تحميل بيانات المحامي
async function loadLawyerData() {
    try {
        // تحميل الدعاوى
        const casesSnapshot = await database.ref('cases').once('value');
        const allCasesData = casesSnapshot.val() || {};
        
        // فلترة الدعاوى المرتبطة بالمحامي
        allCases = Object.entries(allCasesData)
            .map(([id, caseData]) => ({id, ...caseData}))
            .filter(c => {
                const caseLawyer = (c.lawyer || c.lawyerName || c.lawyername || '').trim();
                const currentLawyerName = currentLawyer.name.trim();
                return caseLawyer === currentLawyerName || 
                       caseLawyer.toLowerCase() === currentLawyerName.toLowerCase();
            });
        
        renderCases();
        
        // تحديث العدادات
        updateCaseCounts();
        
        // تحميل الإشعارات
        loadNotifications();
        
        // تحميل الاستقطاعات
        const deductionsSnapshot = await database.ref('deductions').once('value');
        const allDeductionsData = deductionsSnapshot.val() || {};
        
        // فلترة الاستقطاعات المرتبطة بدعاوى المحامي
        const lawyerCaseNumbers = allCases.map(c => c.caseNumber);
        allDeductions = Object.entries(allDeductionsData)
            .map(([id, deduction]) => ({id, ...deduction}))
            .filter(d => lawyerCaseNumbers.includes(d.caseNumber));
        
        renderDeductions();
        updateStats();
        
        // الاستماع للتغييرات في الوقت الفعلي
        database.ref('cases').on('value', (snapshot) => {
            const casesData = snapshot.val() || {};
            allCases = Object.entries(casesData)
                .map(([id, caseData]) => ({id, ...caseData}))
                .filter(c => {
                    const caseLawyer = (c.lawyer || c.lawyerName || c.lawyername || '').trim();
                    const currentLawyerName = currentLawyer.name.trim();
                    return caseLawyer === currentLawyerName || 
                           caseLawyer.toLowerCase() === currentLawyerName.toLowerCase();
                });
            renderCases();
            updateStats();
            updateCaseCounts();
        });
        
        database.ref('deductions').on('value', (snapshot) => {
            const deductionsData = snapshot.val() || {};
            const lawyerCaseNumbers = allCases.map(c => c.caseNumber);
            allDeductions = Object.entries(deductionsData)
                .map(([id, deduction]) => ({id, ...deduction}))
                .filter(d => lawyerCaseNumbers.includes(d.caseNumber));
            renderDeductions();
            updateStats();
        });
        
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
    }
}

// عرض الدعاوى
function renderCases() {
    const casesList = document.getElementById('cases-list');
    const casesCount = document.getElementById('cases-count');
    
    // فلترة القضايا حسب الحالة
    let filteredCases = allCases;
    if (currentFilter !== 'all') {
        filteredCases = allCases.filter(c => c.status === currentFilter);
    }
    
    casesCount.textContent = `${filteredCases.length} دعوى`;
    
    if (filteredCases.length === 0) {
        casesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>لا توجد دعاوى</h3>
                <p>${currentFilter === 'all' ? 'لم يتم تعيين أي دعاوى لك حتى الآن' : `لا توجد قضايا بحالة "${currentFilter}"`}</p>
            </div>
        `;
        return;
    }
    
    casesList.innerHTML = filteredCases.map(caseData => `
        <div class="case-card">
            <div class="case-header" onclick="showCaseDetails('${caseData.id}')">
                <div class="case-number">#${caseData.caseNumber}</div>
                <div class="case-status status-${caseData.status.replace(/ /g, '_')}">${caseData.status}</div>
            </div>
            
            <div class="case-info" onclick="showCaseDetails('${caseData.id}')">
                <div class="case-info-item">
                    <i class="fas fa-user"></i>
                    <span><strong>المدعي:</strong> ${caseData.plaintiffName || caseData.plaintiff || 'غير محدد'}</span>
                </div>
                <div class="case-info-item">
                    <i class="fas fa-user-slash"></i>
                    <span><strong>المدعى عليه:</strong> ${caseData.defendantName || caseData.defendant || 'غير محدد'}</span>
                </div>
                <div class="case-info-item">
                    <i class="fas fa-money-bill"></i>
                    <span><strong>المبلغ:</strong> ${formatCurrency(caseData.amount)}</span>
                </div>
            </div>
            
            <div class="case-footer">
                <div class="case-stage" onclick="showCaseDetails('${caseData.id}')">
                    <i class="fas fa-tasks"></i>
                    ${caseData.stage || 'لم يتم تحديد المرحلة'}
                </div>
                <button class="btn-view" onclick="showCaseDetails('${caseData.id}')">
                    <i class="fas fa-eye"></i>
                    عرض
                </button>
            </div>
        </div>
    `).join('');
}

// عرض الاستقطاعات
function renderDeductions() {
    const deductionsList = document.getElementById('deductions-list');
    
    if (allDeductions.length === 0) {
        deductionsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-money-bill-wave"></i>
                <h3>لا توجد استقطاعات</h3>
                <p>لم يتم إضافة أي استقطاعات بعد</p>
            </div>
        `;
        return;
    }
    
    deductionsList.innerHTML = allDeductions.map(deduction => `
        <div class="deduction-card">
            <div class="deduction-amount">${formatCurrency(deduction.amount)}</div>
            <div class="deduction-info">
                <div class="deduction-info-item">
                    <i class="fas fa-folder"></i>
                    <span>الدعوى: #${deduction.caseNumber}</span>
                </div>
                <div class="deduction-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>التاريخ: ${deduction.date}</span>
                </div>
                ${deduction.notes ? `
                    <div class="deduction-info-item">
                        <i class="fas fa-sticky-note"></i>
                        <span>${deduction.notes}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// تحديث الإحصائيات
function updateStats() {
    const activeCases = allCases.filter(c => c.status !== 'مغلق').length;
    
    document.getElementById('total-cases').textContent = allCases.length;
    document.getElementById('active-cases').textContent = activeCases;
    document.getElementById('total-deductions').textContent = allDeductions.length;
}

// عرض تفاصيل الدعوى
function showCaseDetails(caseId) {
    // البحث مع تحويل النوع (لأن id قد يكون number أو string)
    const caseData = allCases.find(c => String(c.id) === String(caseId));
    
    if (!caseData) {
        console.error('لم يتم العثور على الدعوى:', caseId);
        showToast('لم يتم العثور على بيانات الدعوى', 'error');
        return;
    }
    
    currentCaseId = caseData.id; // حفظ الـ id الأصلي من البيانات
    renderCaseDetailsContent(caseData);
}

// عرض محتوى تفاصيل الدعوى
function renderCaseDetailsContent(caseData) {
    
    const detailsHTML = `
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-hashtag"></i> رقم الدعوى</div>
            <div class="detail-value">#${caseData.caseNumber}</div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-user"></i> المدعي</div>
            <div class="detail-value">${caseData.plaintiffName || caseData.plaintiff || 'غير محدد'}</div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-user-slash"></i> المدعى عليه</div>
            <div class="detail-value">${caseData.defendantName || caseData.defendant || 'غير محدد'}</div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-map-marker-alt"></i> اسم الدائرة</div>
            <div class="detail-value">${caseData.courtSection || 'غير محدد'}</div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-money-bill"></i> المبلغ</div>
            <div class="detail-value">${formatCurrency(caseData.amount)}</div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-info-circle"></i> الحالة</div>
            <div class="detail-value">${caseData.status}</div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-tasks"></i> المرحلة</div>
            <div class="detail-value">${caseData.stage || 'لم يتم تحديد المرحلة'}</div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label"><i class="fas fa-calendar"></i> تاريخ الرفع</div>
            <div class="detail-value">${caseData.filingDate || caseData.date || caseData.createdAt ? new Date(caseData.filingDate || caseData.date || caseData.createdAt).toLocaleDateString('ar-IQ') : 'غير محدد'}</div>
        </div>
        
        ${caseData.status === 'تنفيذ' ? `
            <div class="detail-item">
                <div class="detail-label"><i class="fas fa-check-circle"></i> حالة التنفيذ</div>
                <div class="detail-value">
                    ${caseData.executionDeduction ? '✓ تم الاستقطاع' : '✗ لم يتم الاستقطاع'}<br>
                    ${caseData.executionSeizure ? '✓ تم الحجز' : '✗ لم يتم الحجز'}
                </div>
            </div>
        ` : ''}
    `;
    
    document.getElementById('case-details').innerHTML = detailsHTML;
    document.getElementById('case-modal').classList.add('show');
}

// إغلاق مودال الدعوى
function closeCaseModal() {
    document.getElementById('case-modal').classList.remove('show');
}

// عرض نموذج تحديث الدعوى
function showUpdateCaseForm() {
    const caseData = allCases.find(c => String(c.id) === String(currentCaseId));
    
    if (!caseData) {
        console.error('لم يتم العثور على الدعوى للتحديث:', currentCaseId);
        showToast('لم يتم العثور على بيانات الدعوى', 'error');
        return;
    }
    
    document.getElementById('update-status').value = caseData.status;
    document.getElementById('update-stage').value = caseData.stage || '';
    document.getElementById('execution-deduction').checked = caseData.executionDeduction || false;
    document.getElementById('execution-seizure').checked = caseData.executionSeizure || false;
    
    // إظهار/إخفاء خيارات التنفيذ
    const executionOptions = document.getElementById('execution-options');
    if (caseData.status === 'تنفيذ') {
        executionOptions.style.display = 'block';
    } else {
        executionOptions.style.display = 'none';
    }
    
    closeCaseModal();
    document.getElementById('update-case-modal').classList.add('show');
}

// الاستماع لتغيير حالة الدعوى
document.getElementById('update-status').addEventListener('change', (e) => {
    const executionOptions = document.getElementById('execution-options');
    if (e.target.value === 'تنفيذ') {
        executionOptions.style.display = 'block';
    } else {
        executionOptions.style.display = 'none';
    }
});

// تحديث الدعوى
document.getElementById('update-case-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const status = document.getElementById('update-status').value;
    const stage = document.getElementById('update-stage').value;
    const executionDeduction = document.getElementById('execution-deduction').checked;
    const executionSeizure = document.getElementById('execution-seizure').checked;
    
    try {
        const updates = {
            status: status,
            stage: stage
        };
        
        if (status === 'تنفيذ') {
            updates.executionDeduction = executionDeduction;
            updates.executionSeizure = executionSeizure;
        }
        
        await database.ref(`cases/${currentCaseId}`).update(updates);
        
        closeUpdateCaseModal();
        showToast('تم تحديث الدعوى بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في تحديث الدعوى:', error);
        showToast('حدث خطأ أثناء تحديث الدعوى', 'error');
    }
});

// إغلاق مودال التحديث
function closeUpdateCaseModal() {
    document.getElementById('update-case-modal').classList.remove('show');
}

// عرض مودال إضافة استقطاع
function showAddDeductionModal() {
    // ملء قائمة الدعاوى
    const caseSelect = document.getElementById('deduction-case');
    caseSelect.innerHTML = '<option value="">اختر الدعوى</option>' + 
        allCases.map(c => {
            const plaintiffName = c.plaintiffName || c.plaintiff || 'غير محدد';
            const defendantName = c.defendantName || c.defendant || 'غير محدد';
            return `<option value="${c.caseNumber}">#${c.caseNumber} - ${plaintiffName} ضد ${defendantName}</option>`;
        }).join('');
    
    // تعيين التاريخ الحالي
    document.getElementById('deduction-date').valueAsDate = new Date();
    
    document.getElementById('add-deduction-modal').classList.add('show');
}

// إغلاق مودال إضافة استقطاع
function closeAddDeductionModal() {
    document.getElementById('add-deduction-modal').classList.remove('show');
    document.getElementById('add-deduction-form').reset();
}

// إضافة استقطاع
document.getElementById('add-deduction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const caseNumber = document.getElementById('deduction-case').value;
    const amount = document.getElementById('deduction-amount').value;
    const date = document.getElementById('deduction-date').value;
    const notes = document.getElementById('deduction-notes').value;
    
    try {
        const newDeduction = {
            caseNumber: caseNumber,
            amount: parseFloat(amount),
            date: date,
            notes: notes,
            addedBy: currentLawyer.name,
            addedAt: new Date().toISOString()
        };
        
        await database.ref('deductions').push(newDeduction);
        
        closeAddDeductionModal();
        showToast('تم إضافة الاستقطاع بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في إضافة الاستقطاع:', error);
        showToast('حدث خطأ أثناء إضافة الاستقطاع', 'error');
    }
});

// التنقل بين الصفحات
function navigateTo(page) {
    // تحديث أزرار التنقل
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-page') === page) {
            btn.classList.add('active');
        }
    });
    
    // إظهار الصفحة المطلوبة
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${page}-content`).classList.add('active');
}

// تسجيل الخروج
function logout() {
    localStorage.removeItem('loggedLawyer');
    currentLawyer = null;
    
    // إزالة المستمعين
    database.ref('cases').off();
    database.ref('deductions').off();
    
    document.getElementById('main-page').classList.remove('active');
    document.getElementById('login-page').classList.add('active');
    
    // إعادة تعيين النموذج
    document.getElementById('login-form').reset();
    
    showToast('تم تسجيل الخروج بنجاح', 'info', 'وداعاً');
}

// تنسيق العملة
function formatCurrency(amount) {
    if (!amount) return '0 د.ع';
    return parseFloat(amount).toLocaleString('ar-IQ') + ' د.ع';
}
