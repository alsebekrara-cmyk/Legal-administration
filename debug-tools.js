/**
 * أدوات اختبار وتشخيص التطبيق
 */

// وظيفة فحص البيانات
function debugData() {
    console.log('🔍 === فحص البيانات الحالية ===');
    console.log('📋 عدد الدعاوى:', data.cases.length);
    console.log('👥 عدد المدعى عليهم:', data.defendants.length);
    console.log('👨‍⚖️ عدد المحامين:', data.lawyers.length);
    console.log('💰 عدد الاستقطاعات:', data.deductions.length);
    console.log('🔔 عدد الإشعارات:', data.notifications.length);
    
    console.log('\n📝 === عينة من البيانات ===');
    if (data.cases.length > 0) {
        console.log('أول دعوى:', data.cases[0]);
        console.log('🔑 نوع ID:', typeof data.cases[0].id);
        console.log('🔢 قيمة ID:', data.cases[0].id);
    }
    if (data.lawyers.length > 0) {
        console.log('أول محامي:', data.lawyers[0]);
    }
    if (data.defendants.length > 0) {
        console.log('أول مدعى عليه:', data.defendants[0]);
    }
    
    console.log('\n🔑 === IDs الدعاوى (أول 10) ===');
    data.cases.slice(0, 10).forEach((c, i) => {
        console.log(`${i + 1}. ${c.caseNumber} - ID: ${c.id} (${typeof c.id})`);
    });
    
    return {
        cases: data.cases.length,
        defendants: data.defendants.length,
        lawyers: data.lawyers.length,
        deductions: data.deductions.length,
        notifications: data.notifications.length,
        total: data.cases.length + data.defendants.length + data.lawyers.length + data.deductions.length
    };
}

// وظيفة اختبار الاستيراد
async function testImportFromFile(filePath) {
    try {
        const response = await fetch(filePath);
        const firebaseData = await response.json();
        
        console.log('📥 تحميل الملف:', filePath);
        console.log('📊 محتوى الملف:', {
            cases: firebaseData.cases ? Object.keys(firebaseData.cases).length : 0,
            defendants: firebaseData.defendants ? Object.keys(firebaseData.defendants).length : 0,
            lawyers: firebaseData.lawyers ? Object.keys(firebaseData.lawyers).length : 0,
            deductions: firebaseData.deductions ? Object.keys(firebaseData.deductions).length : 0
        });
        
        // تحويل البيانات
        const converted = convertFirebaseDataToLocal(firebaseData);
        
        console.log('✅ النتيجة بعد التحويل:', {
            cases: converted.cases.length,
            defendants: converted.defendants.length,
            lawyers: converted.lawyers.length,
            deductions: converted.deductions.length
        });
        
        return converted;
    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error);
        return null;
    }
}

// وظيفة تحديث فوري لجميع الجداول
function refreshAllTables() {
    console.log('🔄 تحديث جميع الجداول...');
    
    try {
        updateDashboard();
        console.log('  ✅ لوحة التحكم');
    } catch (e) {
        console.error('  ❌ لوحة التحكم:', e.message);
    }
    
    try {
        renderCasesTable();
        console.log('  ✅ جدول الدعاوى');
    } catch (e) {
        console.error('  ❌ جدول الدعاوى:', e.message);
    }
    
    try {
        renderDefendantsTable();
        console.log('  ✅ جدول المدعى عليهم');
    } catch (e) {
        console.error('  ❌ جدول المدعى عليهم:', e.message);
    }
    
    try {
        renderLawyersTable();
        console.log('  ✅ جدول المحامين');
    } catch (e) {
        console.error('  ❌ جدول المحامين:', e.message);
    }
    
    try {
        renderDeductionsTable();
        console.log('  ✅ جدول الاستقطاعات');
    } catch (e) {
        console.error('  ❌ جدول الاستقطاعات:', e.message);
    }
    
    console.log('✅ اكتمل تحديث جميع الجداول');
}

// وظيفة استيراد سريع للاختبار
function quickImport() {
    console.log('🚀 استيراد سريع من sample-data.json...');
    testImportFromFile('sample-data.json').then(converted => {
        if (converted) {
            data = converted;
            saveToLocalStorage();
            refreshAllTables();
            console.log('✅ تم الاستيراد والتحديث بنجاح!');
        }
    });
}

// وظيفة مسح جميع البيانات
function clearAllData() {
    if (confirm('⚠️ هل أنت متأكد من حذف جميع البيانات؟\nهذا الإجراء لا يمكن التراجع عنه!')) {
        data = {
            cases: [],
            defendants: [],
            lawyers: [],
            deductions: [],
            notifications: [],
            templates: [],
            chatMessages: {}
        };
        saveToLocalStorage();
        refreshAllTables();
        console.log('✅ تم مسح جميع البيانات');
    }
}

// وظيفة إصلاح IDs - تحويلها إلى strings
function fixIDs() {
    console.log('🔧 بدء إصلاح IDs...');
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
        console.log(`✅ تم إصلاح ${fixed} معرّف`);
        saveToLocalStorage();
        refreshAllTables();
        console.log('💾 تم حفظ التغييرات');
    } else {
        console.log('✅ جميع المعرفات بالفعل strings');
    }
    
    return fixed;
}

// جعل الوظائف متاحة globally
window.debugData = debugData;
window.testImportFromFile = testImportFromFile;
window.refreshAllTables = refreshAllTables;
window.quickImport = quickImport;
window.clearAllData = clearAllData;
window.fixIDs = fixIDs;

console.log(`
╔════════════════════════════════════════╗
║   أدوات الاختبار متاحة الآن!         ║
╠════════════════════════════════════════╣
║  debugData()       - فحص البيانات     ║
║  quickImport()     - استيراد سريع     ║
║  refreshAllTables()- تحديث الجداول    ║
║  fixIDs()          - إصلاح المعرفات   ║
║  clearAllData()    - مسح البيانات     ║
╚════════════════════════════════════════╝
`);
