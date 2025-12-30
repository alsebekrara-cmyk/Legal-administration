// Modal Manager - مدير النوافذ المنبثقة
// ملف منفصل لإدارة النوافذ المنبثقة

class ModalManager {
    constructor() {
        this.activeModals = [];
        this.setupKeyboardListeners();
    }

    // إنشاء نافذة منبثقة جديدة
    createModal(title, content, actions = '') {
        // إنشاء النافذة مباشرة بدون تأخير
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay active';
        modalOverlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3><i class="fas fa-info-circle"></i> ${title}</h3>
                    <button class="modal-close" onclick="window.modalManager.closeModal(this)" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${actions ? `
                <div class="modal-footer">
                    ${actions}
                </div>
                ` : ''}
            </div>
        `;
        
        // إضافة النافذة مباشرة للصفحة
        document.body.appendChild(modalOverlay);
        this.activeModals.push(modalOverlay);
        
        // إضافة مستمع للنقر خارج النافذة
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModal(modalOverlay.querySelector('.modal-close'));
            }
        });
        
        return modalOverlay;
    }

    // إغلاق النافذة المنبثقة
    closeModal(button) {
        const modalOverlay = button.closest('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
            
            setTimeout(() => {
                if (modalOverlay.parentNode) {
                    modalOverlay.parentNode.removeChild(modalOverlay);
                }
                
                // إزالة من قائمة النوافذ النشطة
                const index = this.activeModals.indexOf(modalOverlay);
                if (index > -1) {
                    this.activeModals.splice(index, 1);
                }
            }, 300);
        }
    }

    // إغلاق جميع النوافذ المنبثقة
    closeAllModals() {
        this.activeModals.forEach(modal => {
            const closeButton = modal.querySelector('.modal-close');
            if (closeButton) {
                this.closeModal(closeButton);
            }
        });
    }

    // إعداد مستمعات لوحة المفاتيح
    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.length > 0) {
                const lastModal = this.activeModals[this.activeModals.length - 1];
                const closeButton = lastModal.querySelector('.modal-close');
                if (closeButton) {
                    this.closeModal(closeButton);
                }
            }
        });
    }

    // إنشاء نافذة تأكيد
    createConfirmModal(title, message, onConfirm, onCancel = null) {
        const content = `
            <div class="confirm-message">
                <i class="fas fa-question-circle"></i>
                <p>${message}</p>
            </div>
        `;
        
        const actions = `
            <button class="btn btn-danger" onclick="
                if (typeof arguments[0] === 'function') arguments[0]();
                window.modalManager.closeModal(this);
            ">
                <i class="fas fa-check"></i> تأكيد
            </button>
            <button class="btn btn-secondary" onclick="
                if (typeof arguments[0] === 'function') arguments[0]();
                window.modalManager.closeModal(this);
            ">
                <i class="fas fa-times"></i> إلغاء
            </button>
        `;
        
        const modal = this.createModal(title, content, actions);
        
        // ربط الأحداث
        const confirmBtn = modal.querySelector('.btn-danger');
        const cancelBtn = modal.querySelector('.btn-secondary');
        
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                if (onConfirm) onConfirm();
                this.closeModal(confirmBtn);
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (onCancel) onCancel();
                this.closeModal(cancelBtn);
            };
        }
        
        return modal;
    }

    // إنشاء نافذة تحميل
    createLoadingModal(title, message = 'جاري التحميل...') {
        const content = `
            <div class="loading-content">
                <i class="fas fa-spinner fa-spin"></i>
                <p>${message}</p>
            </div>
        `;
        
        const modal = this.createModal(title, content);
        
        // إزالة زر الإغلاق للنوافذ التحميل
        const closeButton = modal.querySelector('.modal-close');
        if (closeButton) {
            closeButton.style.display = 'none';
        }
        
        return modal;
    }

    // إنشاء نافذة نجاح
    createSuccessModal(title, message, autoClose = true) {
        const content = `
            <div class="success-message">
                <i class="fas fa-check-circle"></i>
                <p>${message}</p>
            </div>
        `;
        
        const actions = `
            <button class="btn btn-success" onclick="window.modalManager.closeModal(this)">
                <i class="fas fa-check"></i> موافق
            </button>
        `;
        
        const modal = this.createModal(title, content, actions);
        
        // إغلاق تلقائي بعد 3 ثوان
        if (autoClose) {
            setTimeout(() => {
                const closeButton = modal.querySelector('.modal-close');
                if (closeButton) {
                    this.closeModal(closeButton);
                }
            }, 3000);
        }
        
        return modal;
    }

    // إنشاء نافذة خطأ
    createErrorModal(title, message) {
        const content = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
        
        const actions = `
            <button class="btn btn-danger" onclick="window.modalManager.closeModal(this)">
                <i class="fas fa-times"></i> إغلاق
            </button>
        `;
        
        return this.createModal(title, content, actions);
    }

    // إنشاء نافذة معلومات
    createInfoModal(title, message) {
        const content = `
            <div class="info-message">
                <i class="fas fa-info-circle"></i>
                <p>${message}</p>
            </div>
        `;
        
        const actions = `
            <button class="btn btn-primary" onclick="window.modalManager.closeModal(this)">
                <i class="fas fa-check"></i> فهمت
            </button>
        `;
        
        return this.createModal(title, content, actions);
    }

    // إنشاء نافذة نموذج
    createFormModal(title, formContent, onSubmit, onCancel = null) {
        const content = `
            <form class="modal-form" onsubmit="return false;">
                ${formContent}
            </form>
        `;
        
        const actions = `
            <button type="button" class="btn btn-primary" onclick="window.modalManager.submitForm(this)">
                <i class="fas fa-save"></i> حفظ
            </button>
            <button type="button" class="btn btn-secondary" onclick="window.modalManager.closeModal(this)">
                <i class="fas fa-times"></i> إلغاء
            </button>
        `;
        
        const modal = this.createModal(title, content, actions);
        
        // ربط حدث الإرسال
        const submitBtn = modal.querySelector('.btn-primary');
        if (submitBtn) {
            submitBtn.onclick = () => {
                const form = modal.querySelector('.modal-form');
                const formData = new FormData(form);
                const data = {};
                
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                
                if (onSubmit) {
                    const result = onSubmit(data);
                    if (result !== false) {
                        this.closeModal(submitBtn);
                    }
                }
            };
        }
        
        return modal;
    }

    // إرسال النموذج
    submitForm(button) {
        const modal = button.closest('.modal-overlay');
        const form = modal.querySelector('.modal-form');
        
        if (form) {
            const event = new Event('submit', { cancelable: true });
            form.dispatchEvent(event);
        }
    }

    // إعداد نافذة بملء الشاشة
    createFullscreenModal(title, content, actions = '') {
        const modal = this.createModal(title, content, actions);
        modal.querySelector('.modal').style.cssText = `
            width: 95vw;
            height: 95vh;
            max-width: none;
            max-height: none;
            margin: 2.5vh auto;
        `;
        
        return modal;
    }

    // تحديث محتوى النافذة
    updateModalContent(modal, newContent) {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = newContent;
        }
    }

    // تحديث عنوان النافذة
    updateModalTitle(modal, newTitle) {
        const modalTitle = modal.querySelector('.modal-header h3');
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-info-circle"></i> ${newTitle}`;
        }
    }

    // إضافة CSS للتحسينات
    addModalStyles() {
        if (!document.querySelector('#modal-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-styles';
            style.textContent = `
                .confirm-message, .success-message, .error-message, .info-message {
                    text-align: center;
                    padding: 2rem;
                }
                
                .confirm-message i, .success-message i, .error-message i, .info-message i {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    display: block;
                }
                
                .confirm-message i { color: var(--warning-yellow); }
                .success-message i { color: var(--success-green); }
                .error-message i { color: var(--error-red); }
                .info-message i { color: var(--primary-blue); }
                
                .loading-content {
                    text-align: center;
                    padding: 2rem;
                }
                
                .loading-content i {
                    font-size: 2rem;
                    margin-bottom: 1rem;
                    color: var(--primary-blue);
                }
                
                .modal-form {
                    max-height: 60vh;
                    overflow-y: auto;
                }
                
                .modal-form .form-group {
                    margin-bottom: 1rem;
                }
                
                .modal-form label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: bold;
                    color: var(--text-primary);
                }
                
                .modal-form input, .modal-form select, .modal-form textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    font-size: 1rem;
                    transition: border-color 0.3s ease;
                }
                
                .modal-form input:focus, .modal-form select:focus, .modal-form textarea:focus {
                    outline: none;
                    border-color: var(--primary-blue);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// إنشاء مثيل عام من مدير النوافذ المنبثقة
window.modalManager = new ModalManager();

// إضافة التنسيقات
window.modalManager.addModalStyles();

// إنشاء دالة createModal عامة للتوافق مع الكود الحالي
window.createModal = function(title, content, actions) {
    return window.modalManager.createModal(title, content, actions);
};

// إنشاء دالة closeModal عامة للتوافق مع الكود الحالي
window.closeModal = function(button) {
    return window.modalManager.closeModal(button);
};

console.log('تم تحميل مدير النوافذ المنبثقة بنجاح');