/**
 * WhatsApp Web 账号信息自动提取模块
 * 
 * 功能：
 * 1. 自动从 localStorage 提取手机号码
 * 2. 智能扫描 localStorage 提取昵称
 * 3. DOM 点击备用方案
 * 
 * @version 6.0.0 - 精简版
 */

(function WhatsAppProfileAutoExtractor() {
    'use strict';

    const CONFIG = {
        checkInterval: 3000,
        maxAttempts: 20,
        startTime: 2000,
        debug: false
    };

    let attempts = 0;
    let extracted = false;
    let checkTimer = null;

    function log(...args) {
        if (CONFIG.debug) {
            console.log('[ProfileExtractor]', ...args);
        }
    }

    // 获取带+号的号码
    function getPhoneFromLocalStorage() {
        try {
            const lastWid = localStorage.getItem('last-wid-md');
            if (lastWid) {
                const cleaned = lastWid.replace(/^["']|["']$/g, '');
                const match = cleaned.match(/^(\d+)/);
                if (match) return '+' + match[1];
            }
        } catch (e) { log('Error reading localStorage:', e); }
        return null;
    }

    // 获取纯数字号码
    function getRawPhone() {
        const lastWid = localStorage.getItem('last-wid-md');
        if (lastWid) {
            const cleaned = lastWid.replace(/^["']|["']$/g, '');
            const match = cleaned.match(/^(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    // ========== 方案1：智能 LocalStorage 扫描 ==========
    function getFromLocalStorage() {
        log('Attempting smart LocalStorage scan...');
        try {
            const excludeValues = [
                'NOT_ACCEPTED', 'ACCEPTED', 'migrated', 'true', 'false', 'null',
                'init_', 'x1', ':1'
            ];

            const excludeKeyPatterns = [
                'mutex', 'Session', 'last-wid', 'Lang', 'Lid', 'Hash', 'Secret',
                'History', 'Synced', 'banzai', 'Logging', 'Thread', 'Chunk', 'Blocklist'
            ];

            let candidates = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                let val = localStorage.getItem(key);

                if (excludeKeyPatterns.some(p => key.includes(p))) continue;

                val = val.replace(/^"|"$/g, '');

                if (val.length < 1 || val.length > 30) continue;
                if (/^\d+$/.test(val)) continue;
                if (excludeValues.some(e => val.includes(e))) continue;
                if (/[:@\[\]{}]/.test(val)) continue;

                candidates.push({ key, value: val });
            }

            if (candidates.length > 0) {
                log('Found profile name via smart LS scan:', candidates[0].value);
                return { profileName: candidates[0].value, avatarUrl: null };
            }
        } catch (e) { log('LS scan error', e); }
        return { profileName: null, avatarUrl: null };
    }

    // ========== 方案2：DOM 点击备用 ==========
    async function extractFromDOM() {
        log('Attempting DOM extraction via UI interaction...');

        const header = document.querySelector('header');
        if (!header) {
            log('DOM Fail: Header not found');
            return { profileName: null, avatarUrl: null };
        }

        const avatarImg = header.querySelector('img');
        if (!avatarImg) {
            log('DOM Fail: Header IMG not found');
            return { profileName: null, avatarUrl: null };
        }

        let clickTarget = avatarImg.closest('[role="button"]') ||
            avatarImg.closest('button') ||
            avatarImg.closest('div[tabindex]') ||
            avatarImg.parentElement;

        log('Clicking avatar to open profile...');
        (clickTarget || avatarImg).click();

        await new Promise(r => setTimeout(r, 1200));

        let name = null;
        const potentialDivs = Array.from(document.querySelectorAll('div, span'));

        for (let div of potentialDivs) {
            const txt = div.innerText ? div.innerText.trim() : '';
            if (['姓名', 'Your name', 'Name', 'Nama'].includes(txt)) {
                log(`Found label "${txt}"`);

                let sibling = div.nextElementSibling;
                if (sibling && sibling.innerText && sibling.innerText.length > 0) {
                    name = sibling.innerText.split('\n')[0];
                    log('Found name via Sibling:', name);
                    break;
                }

                const parent = div.parentElement;
                if (parent && parent.innerText.includes('\n')) {
                    const parts = parent.innerText.split('\n');
                    if (parts[0].trim() === txt && parts[1]) {
                        name = parts[1].trim();
                        log('Found name via Parent:', name);
                        break;
                    }
                }
            }
        }

        if (!name) {
            const editables = document.querySelectorAll('div[contenteditable="true"]');
            for (let ed of editables) {
                if (ed.innerText && ed.innerText.length > 0) {
                    name = ed.innerText;
                    log('Found name via contenteditable:', name);
                    break;
                }
            }
        }

        // 关闭面板
        const backBtn = document.querySelector('span[data-icon="back"]');
        if (backBtn) {
            (backBtn.closest('[role="button"]') || backBtn.parentElement)?.click();
        } else {
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 500));
        return { profileName: name, avatarUrl: null };
    }

    // ========== 头像提取（IndexedDB + 页面扫描） ==========
    function getAvatarUrl() {
        return new Promise((resolve) => {
            const rawPhone = getRawPhone();
            if (!rawPhone) { resolve(null); return; }

            try {
                const request = indexedDB.open('model-storage');
                request.onsuccess = (event) => {
                    const db = event.target.result;

                    if (db.objectStoreNames.contains('profile-pic-thumb')) {
                        const tx = db.transaction(['profile-pic-thumb'], 'readonly');
                        const store = tx.objectStore('profile-pic-thumb');
                        store.getAll().onsuccess = (e) => {
                            const pics = e.target.result || [];
                            const targetId = rawPhone + '@c.us';

                            for (const pic of pics) {
                                if (!pic || !pic.id) continue;
                                const picId = pic.id._serialized || pic.id;

                                if (picId === targetId || (typeof picId === 'string' && picId.includes(rawPhone))) {
                                    const url = pic.eurl || pic.imgFull || pic.img;
                                    if (url) {
                                        log('Found avatar URL via IDB:', url.substring(0, 50));
                                        db.close();
                                        resolve(url);
                                        return;
                                    }
                                }
                            }
                            db.close();
                            // Fallback to page scan
                            resolve(getAvatarFromPage());
                        };
                    } else {
                        db.close();
                        resolve(getAvatarFromPage());
                    }
                };
                request.onerror = () => resolve(getAvatarFromPage());
            } catch (e) {
                resolve(getAvatarFromPage());
            }
        });
    }

    function getAvatarFromPage() {
        try {
            const rawPhone = getRawPhone();
            const imgs = document.querySelectorAll('img[src*="pps.whatsapp.net"]');
            for (const img of imgs) {
                if (rawPhone && img.src.includes(rawPhone)) return img.src;
            }
        } catch (e) { }
        return null;
    }

    // ========== 发送到主进程 ==========
    async function sendToMainProcess(data) {
        log('Sending to main process:', data);
        const accountId = window.ACCOUNT_ID || 'unknown';
        const payload = { accountId, ...data };
        if (window.electronAPI?.invoke) {
            try {
                await window.electronAPI.invoke('view:update-profile', payload);
                log('Sent successfully');
                return true;
            } catch (e) {
                log('Send failed:', e);
            }
        }
        return false;
    }

    // ========== 主提取逻辑 ==========
    async function tryExtract() {
        attempts++;
        log(`Attempt ${attempts}/${CONFIG.maxAttempts}`);

        if (extracted || attempts > CONFIG.maxAttempts) {
            if (checkTimer) clearInterval(checkTimer);
            return;
        }

        const chatList = document.querySelector('[data-testid="chat-list"]') ||
            document.querySelector('#pane-side');
        if (!chatList) {
            log('Chat list not found, waiting...');
            return;
        }

        const phoneNumber = getPhoneFromLocalStorage();
        if (!phoneNumber) {
            log('Phone number not found');
            return;
        }

        // 方案1：智能 LocalStorage 扫描
        let lsResult = getFromLocalStorage();

        // 方案2：DOM 备用
        let domResult = { profileName: null, avatarUrl: null };
        if (!lsResult.profileName) {
            domResult = await extractFromDOM();
        }

        let avatarUrl = await getAvatarUrl();
        let profileName = lsResult.profileName || domResult.profileName;

        const result = {
            profileName: profileName,
            phoneNumber: phoneNumber,
            avatarUrl: avatarUrl
        };

        log('Extraction result:', result);

        if (result.phoneNumber) {
            const hasAvatar = !!result.avatarUrl;
            const sent = await sendToMainProcess(result);

            if (sent && (hasAvatar || attempts > 5)) {
                extracted = true;
                log('Extraction complete');
                if (checkTimer) clearInterval(checkTimer);
            }
        }
    }

    function start() {
        log('Starting profile extractor...');
        setTimeout(() => {
            checkTimer = setInterval(tryExtract, CONFIG.checkInterval);
        }, CONFIG.startTime);
    }

    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', start);
    }

})();
