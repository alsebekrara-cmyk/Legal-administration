# دليل إعداد Firebase للتطبيق

## الخطوة 1: الحصول على إعدادات Firebase

1. افتح التطبيق الرئيسي (Electron)
2. افتح ملف `shared-config.js`
3. انسخ إعدادات Firebase من هناك

## الخطوة 2: تحديث إعدادات التطبيق

1. افتح ملف `app.js` في مجلد `lawyer-mobile-app`
2. ابحث عن السطر:
```javascript
const firebaseConfig = {
```

3. استبدل الإعدادات بإعدادات Firebase الحقيقية من `shared-config.js`

مثال:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyBXOZ...",  // من shared-config.js
    authDomain: "your-app.firebaseapp.com",
    databaseURL: "https://your-app-default-rtdb.firebaseio.com",
    projectId: "your-app",
    storageBucket: "your-app.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

## الخطوة 3: رفع التطبيق

### الطريقة 1: GitHub Pages (مجاناً)

1. أنشئ مستودع جديد على GitHub
2. ارفع ملفات التطبيق:
   - index.html
   - style.css
   - app.js
   - manifest.json
   - README.md

3. فعّل GitHub Pages من الإعدادات
4. سيكون الرابط: `https://username.github.io/repository-name`

### الطريقة 2: Netlify (مجاناً)

1. اذهب إلى [netlify.com](https://netlify.com)
2. أنشئ حساب جديد
3. اسحب مجلد `lawyer-mobile-app` إلى Netlify
4. سيتم نشر التطبيق فوراً
5. ستحصل على رابط مثل: `https://your-app-name.netlify.app`

### الطريقة 3: Firebase Hosting (موصى به)

```bash
# تثبيت Firebase CLI
npm install -g firebase-tools

# تسجيل الدخول
firebase login

# تهيئة المشروع
cd lawyer-mobile-app
firebase init hosting

# اختر:
# - استخدام مشروع Firebase الموجود
# - اجعل المجلد العام هو "."
# - لا تهيئ كتطبيق صفحة واحدة

# رفع التطبيق
firebase deploy --only hosting
```

## الخطوة 4: اختبار التطبيق

1. افتح الرابط على هاتفك
2. سجّل دخول باسم محامي موجود في النظام
3. تأكد من ظهور الدعاوى الخاصة به

## الخطوة 5: إضافة التطبيق للشاشة الرئيسية

### على Android:
1. افتح التطبيق في Chrome
2. اضغط على القائمة (⋮)
3. اختر "Add to Home screen"
4. سيعمل التطبيق كتطبيق عادي

### على iOS:
1. افتح التطبيق في Safari
2. اضغط زر المشاركة 
3. اختر "Add to Home Screen"
4. سيظهر أيقونة على الشاشة الرئيسية

## نصائح مهمة

✅ **احفظ الرابط النهائي** - شاركه مع المحامين
✅ **أضف إلى المفضلة** - لسهولة الوصول
✅ **اختبر على أجهزة مختلفة** - للتأكد من التوافق
✅ **شارك دليل الاستخدام** - مع كل محامي جديد

## استكشاف الأخطاء

### المشكلة: "الاسم أو رقم الترخيص غير صحيح"
**الحل:**
- تأكد من إضافة المحامي في التطبيق الرئيسي أولاً
- تأكد من كتابة الاسم بنفس الصيغة تماماً
- تأكد من صحة رقم الترخيص

### المشكلة: "لا توجد دعاوى"
**الحل:**
- تأكد من تعيين دعاوى للمحامي في التطبيق الرئيسي
- تأكد من أن حقل "المحامي" في الدعوى يطابق اسم المحامي تماماً

### المشكلة: البيانات لا تتحدث
**الحل:**
- تحقق من اتصال الإنترنت
- تحقق من إعدادات Firebase
- افتح Console في المتصفح وتحقق من الأخطاء

## الدعم

للمساعدة أو الاستفسارات:
1. راجع ملف README.md
2. تحقق من console المتصفح للأخطاء
3. تأكد من تطابق إعدادات Firebase

---

تم بواسطة نظام إدارة الدعاوى القضائية
