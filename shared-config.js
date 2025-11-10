/**
 * إعدادات Firebase المشتركة
 * يتم استخدامها في كل من التطبيق الرئيسي وتطبيق المحامين
 */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
// مسارات قاعدة البيانات
const DB_PATHS = {
    CASES: 'cases',
    DEFENDANTS: 'defendants',
    LAWYERS: 'lawyers',
    DEDUCTIONS: 'deductions',
    NOTIFICATIONS: 'notifications',
    CHAT: 'lawyerMessages',  // مسار الدردشة المشترك مع تطبيق المحامين
    UPDATES: 'updates',
    SYSTEM: 'system'
};

// حالات الدعوى
const CASE_STATUSES = {
    DRAFT: 'مسودة',
    FILED: 'مرفوع',
    IN_COURT: 'في المحكمة',
    JUDGMENT: 'صدور حكم',
    EXECUTION: 'تنفيذ',
    CLOSED: 'مغلق'
};

// مستويات الأولوية
const PRIORITIES = {
    NORMAL: 'عادية',
    IMPORTANT: 'مهمة',
    URGENT: 'عاجلة',
    EMERGENCY: 'طارئة'
};

// تصدير الإعدادات
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig, DB_PATHS, CASE_STATUSES, PRIORITIES };
}
