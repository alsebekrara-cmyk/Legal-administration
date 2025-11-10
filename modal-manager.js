/**
 * Modal Manager - نظام إدارة النوافذ المنبثقة
 * يوفر واجهة موحدة لعرض وإخفاء جميع النوافذ المنبثقة
 */

class ModalManager {
    constructor() {
        this.activeModals = new Set();
        this.init();
    }

    /**
     * تهيئة النظام
     */
    init() {
        // إغلاق النافذة عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
                this.close(e.target.id);
            }
        });

        // إغلاق النافذة بضغط ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                const lastModal = Array.from(this.activeModals).pop();
                this.close(lastModal);
            }
        });

        console.log('تم تحميل مدير النوافذ المنبثقة بنجاح');
    }

    /**
     * فتح نافذة منبثقة
     */
    open(modalId) {
        console.log(`🔓 محاولة فتح النافذة: ${modalId}`);
        
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`❌ النافذة ${modalId} غير موجودة`);
            return false;
        }

        console.log(`✅ النافذة موجودة، إضافة class active...`);
        modal.classList.add('active');
        this.activeModals.add(modalId);
        document.body.style.overflow = 'hidden';

        console.log(`✅ تم فتح النافذة ${modalId} بنجاح`);

        // تركيز على أول حقل إدخال
        setTimeout(() => {
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) firstInput.focus();
        }, 100);

        return true;
    }

    /**
     * إغلاق نافذة منبثقة
     */
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        modal.classList.remove('active');
        this.activeModals.delete(modalId);

        if (this.activeModals.size === 0) {
            document.body.style.overflow = '';
        }

        return true;
    }

    /**
     * إغلاق جميع النوافذ
     */
    closeAll() {
        this.activeModals.forEach(modalId => this.close(modalId));
    }

    /**
     * التحقق من وجود نافذة مفتوحة
     */
    isOpen(modalId) {
        return this.activeModals.has(modalId);
    }

    /**
     * عرض نافذة تأكيد
     */
    confirm(title, message, confirmCallback, cancelCallback = null) {
        const modal = this.createConfirmModal(title, message, confirmCallback, cancelCallback);
        document.body.appendChild(modal);
        this.open(modal.id);
    }

    /**
     * إنشاء نافذة تأكيد
     */
    createConfirmModal(title, message, confirmCallback, cancelCallback) {
        const modalId = 'confirm-modal-' + Date.now();
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn" onclick="modalManager.close('${modalId}')">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="font-size: 16px; line-height: 1.8;">${message}</p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-secondary" onclick="modalManager.close('${modalId}')${cancelCallback ? '; (' + cancelCallback + ')()' : ''}">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                    <button class="btn-primary" onclick="modalManager.close('${modalId}'); (${confirmCallback})()">
                        <i class="fas fa-check"></i> تأكيد
                    </button>
                </div>
            </div>
        `;

        return modal;
    }
}

// إنشاء نسخة عامة
const modalManager = new ModalManager();

// تصدير للاستخدام في الوحدات
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
}
