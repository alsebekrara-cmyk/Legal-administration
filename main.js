/**
 * Electron Main Process
 * نقطة الدخول الرئيسية للتطبيق
 */

const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

/**
 * إنشاء النافذة الرئيسية
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'تطبيق الإدارة القانونية',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#f8fafc',
        show: false,
        frame: false // حذف إطار النظام لإخفاء أزرار الإغلاق والتكبير والتصغير
    });

    // تحميل الملف الرئيسي
    mainWindow.loadFile('index.html');

    // معالج لفتح الروابط الخارجية (مثل واتساب)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const { shell } = require('electron');
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // إظهار النافذة عند الجاهزية
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });

    // فتح DevTools في وضع التطوير (للاختبار)
    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // إنشاء القائمة
    createMenu();
}

/**
 * إنشاء قائمة التطبيق
 */
function createMenu() {
    const template = [
        {
            label: 'ملف',
            submenu: [
                {
                    label: 'نسخ احتياطي',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => {
                        mainWindow.webContents.send('menu-backup');
                    }
                },
                {
                    label: 'استعادة',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.webContents.send('menu-restore');
                    }
                },
                { type: 'separator' },
                {
                    label: 'تصدير البيانات',
                    click: () => {
                        mainWindow.webContents.send('menu-export');
                    }
                },
                { type: 'separator' },
                {
                    label: 'إعادة تحميل',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                { type: 'separator' },
                {
                    label: 'خروج',
                    accelerator: 'Alt+F4',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'عرض',
            submenu: [
                {
                    label: 'لوحة التحكم',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => {
                        mainWindow.webContents.send('menu-navigate', 'dashboard');
                    }
                },
                {
                    label: 'الدعاوى',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => {
                        mainWindow.webContents.send('menu-navigate', 'cases');
                    }
                },
                {
                    label: 'المدعى عليهم',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => {
                        mainWindow.webContents.send('menu-navigate', 'defendants');
                    }
                },
                {
                    label: 'المحامين',
                    accelerator: 'CmdOrCtrl+4',
                    click: () => {
                        mainWindow.webContents.send('menu-navigate', 'lawyers');
                    }
                },
                { type: 'separator' },
                {
                    label: 'تكبير',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 1);
                    }
                },
                {
                    label: 'تصغير',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 1);
                    }
                },
                {
                    label: 'إعادة تعيين الحجم',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(0);
                    }
                }
            ]
        },
        {
            label: 'مساعدة',
            submenu: [
                {
                    label: 'دليل المستخدم',
                    click: () => {
                        mainWindow.webContents.send('menu-help');
                    }
                },
                {
                    label: 'حول التطبيق',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'حول التطبيق',
                            message: 'تطبيق الإدارة القانونية',
                            detail: 'الإصدار 1.1.0\n\nتطبيق إدارة قانونية متكامل\nالإبداع الرقمي © 2025',
                            buttons: ['حسناً']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * حفظ ملف
 */
ipcMain.handle('save-file', async (event, data, filename) => {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: filename,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (filePath) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return { success: true, path: filePath };
        }
        return { success: false, error: 'تم الإلغاء' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * تحميل ملف
 */
ipcMain.handle('load-file', async (event, filename) => {
    try {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        if (filePaths && filePaths[0]) {
                const data = fs.readFileSync(filePaths[0], 'utf8');
                try {
                    const jsonData = JSON.parse(data);
                    return { success: true, data: jsonData };
                } catch (err) {
                    return { success: false, error: 'فشل في استعادة بيانات الملف: الملف غير صالح أو غير صحيح' };
                }
        }
        return { success: false, error: 'تم الإلغاء' };
    } catch (error) {
            return { success: false, error: 'فشل في استعادة بيانات الملف: الملف غير صالح أو غير صحيح' };
    }
});

/**
 * فتح رابط خارجي
 */
ipcMain.handle('open-external', async (event, url) => {
    try {
        const { shell } = require('electron');
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        console.error('خطأ في فتح الرابط الخارجي:', error);
        return { success: false, error: error.message };
    }
});

// عند جاهزية التطبيق
app.whenReady().then(createWindow);

// عند إغلاق جميع النوافذ
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// عند تفعيل التطبيق
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

/**
 * التحكم في النافذة من الواجهة
 */
ipcMain.handle('window-control', async (event, action) => {
    if (!mainWindow) return;
    switch (action) {
        case 'close':
            mainWindow.close();
            break;
        case 'minimize':
            mainWindow.minimize();
            break;
        case 'maximize':
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
            break;
        case 'toggleSidebar':
            mainWindow.webContents.send('menu-navigate', 'toggleSidebar');
            break;
        default:
            break;
    }
    return { success: true };
});
