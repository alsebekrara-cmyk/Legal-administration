/**
 * Electron Preload Script
 * Bridge بين Electron والمتصفح
 */

const { contextBridge, ipcRenderer } = require('electron');

// Exposed APIs آمنة
contextBridge.exposeInMainWorld('electronAPI', {
    // فتح روابط خارجية
    openExternal: async (url) => {
        try {
            const result = await ipcRenderer.invoke('open-external', url);
            return result;
        } catch (error) {
            console.error('خطأ في فتح الرابط:', error);
            return { success: false, error: error.message };
        }
    },
    // معلومات النظام
    platform: process.platform,
    // إدارة الملفات
    saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),
    loadFile: (filename) => ipcRenderer.invoke('load-file', filename),
    // الإشعارات
    showNotification: (title, body) => {
        new Notification(title, { body });
    },
    // التحكم في النافذة من الواجهة
    windowControl: (action) => ipcRenderer.invoke('window-control', action)
});

// دوال مساعدة عامة
contextBridge.exposeInMainWorld('utils', {
    /**
     * تنسيق العملة (الدينار العراقي)
     */
    formatCurrency: (amount) => {
        if (!amount && amount !== 0) return '0 IQD';
        return new Intl.NumberFormat('ar-IQ', {
            style: 'currency',
            currency: 'IQD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    /**
     * تنسيق التاريخ
     */
    formatDate: (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('ar-IQ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * تنسيق التاريخ والوقت
     */
    formatDateTime: (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString('ar-IQ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * التحقق من صحة رقم الهاتف
     */
    validatePhone: (phone) => {
        if (!phone) return false;
        const cleaned = phone.replace(/[^\d+]/g, '');
        return cleaned.length >= 10;
    },

    /**
     * تنظيف رقم الهاتف
     */
    cleanPhone: (phone) => {
        if (!phone) return '';
        return phone.replace(/[^\d+]/g, '');
    },

    /**
     * توليد ID فريد
     */
    generateId: () => {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    },

    /**
     * نسخ نص إلى الحافظة
     */
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('فشل النسخ:', err);
            return false;
        }
    }
});

console.log('Preload script loaded successfully');
