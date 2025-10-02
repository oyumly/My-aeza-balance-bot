
const axios = require('axios');
const config = require('./config');

class AezaAPI {
    constructor() {
        this.apiKeyRu = config.AEZA_API_KEY_RU;
        this.apiKeyNet = config.AEZA_API_KEY_NET;
        this.baseURLRu = config.AEZA_BASE_URL_RU;
        this.baseURLNet = config.AEZA_BASE_URL_NET;
        
        // Создаем клиенты для каждого API ключа
        this.clients = {};
        
        // Система отслеживания баланса
        this.balanceHistory = {
            ru: null,
            net: null
        };
        this.monitoringEnabled = false;
        
        if (this.apiKeyRu) {
            this.clients.ru = axios.create({
                baseURL: this.baseURLRu,
                headers: {
                    'X-API-Key': this.apiKeyRu,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log(`🇷🇺 RU клиент создан для: ${this.baseURLRu}`);
        }
        
        if (this.apiKeyNet) {
            this.clients.net = axios.create({
                baseURL: this.baseURLNet,
                headers: {
                    'X-API-Key': this.apiKeyNet,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log(`🌍 NET клиент создан для: ${this.baseURLNet}`);
        }
    }

    /**
     * Выполняет запрос к API для указанного аккаунта
     * @param {string} account - Аккаунт ('ru' или 'net')
     * @param {string} method - HTTP метод
     * @param {string} endpoint - Эндпоинт API
     * @param {object} data - Данные для отправки
     * @returns {Promise<object>} Ответ от API
     */
    async makeRequest(account, method, endpoint, data = null) {
        const client = this.clients[account];
        if (!client) {
            throw new Error(`API ключ для аккаунта ${account} не настроен`);
        }
        
        const baseURL = account === 'ru' ? this.baseURLRu : this.baseURLNet;
        console.log(`🔗 API запрос (${account}): ${method} ${baseURL}${endpoint}`);
        
        try {
            const response = await client({
                method,
                url: endpoint,
                data
            });
            
            console.log(`✅ API ответ получен (${account}): ${response.status} ${response.statusText}`);
            console.log(`📊 Размер ответа: ${JSON.stringify(response.data).length} символов`);
            
            return response.data;
        } catch (error) {
            console.error(`❌ Ошибка API запроса (${account}): ${error.message}`);
            
            if (error.response) {
                // Сервер ответил с ошибкой
                console.error(`📋 HTTP статус: ${error.response.status}`);
                console.error(`📋 Ответ сервера:`, error.response.data);
                
                const errorData = error.response.data;
                if (errorData && errorData.error) {
                    throw new Error(`API Error (${account}): ${errorData.error.message || errorData.error.slug}`);
                }
                throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
            } else if (error.request) {
                // Запрос был отправлен, но ответа не получено
                console.error('📋 Нет ответа от сервера');
                throw new Error('Нет ответа от сервера AEZA');
            } else {
                // Ошибка при настройке запроса
                console.error('📋 Ошибка настройки запроса:', error.message);
                throw new Error(`Ошибка запроса: ${error.message}`);
            }
        }
    }

    /**
     * Получает баланс и основную информацию аккаунта
     * @param {string} account - Аккаунт ('ru' или 'net')
     * @returns {Promise<object>} Данные о балансе
     */
    async getBalance(account) {
        return await this.makeRequest(account, 'GET', '/desktop');
    }

    /**
     * Получает баланс для всех доступных аккаунтов
     * @returns {Promise<object>} Объединенные данные о балансе
     */
    async getAllBalances() {
        const results = {};
        
        if (this.clients.ru) {
            try {
                results.ru = await this.getBalance('ru');
            } catch (error) {
                console.error('Ошибка получения баланса RU:', error.message);
                results.ru = null;
            }
        }
        
        if (this.clients.net) {
            try {
                results.net = await this.getBalance('net');
            } catch (error) {
                console.error('Ошибка получения баланса NET:', error.message);
                results.net = null;
            }
        }
        
        return results;
    }

    /**
     * Форматирует информацию о балансе для отображения
     * @param {object} allBalances - Данные о балансе от всех аккаунтов
     * @returns {string} Отформатированное сообщение
     */
    formatBalanceInfo(allBalances) {
        try {
            let message = '💰 <b>Баланс AEZA</b>\n\n';
            
            let totalBalance = 0;
            let totalWithdrawBalance = 0;
            let totalMonthEarned = 0;
            let totalBonusBalance = 0;
            
            // Обрабатываем российский аккаунт
            if (allBalances.ru) {
                if (allBalances.ru.error) {
                    message += `🇷🇺 **Российский аккаунт (.ru)**\n`;
                    if (allBalances.ru.error.slug === 'not_auth') {
                        message += `❌ Ошибка авторизации - API ключ неверный\n`;
                    } else {
                        message += `❌ Ошибка: ${allBalances.ru.error.message}\n`;
                    }
                    message += `\n`;
                } else {
                    const account = allBalances.ru.data?.account || {};
                    const balance = account.balance || 0;
                    const referralState = account.referralState || {};
                    
                    // Для RU аккаунта данные тоже в копейках (нужно делить на 100)
                    const balanceValue = balance / 100;
                    const withdrawBalance = (account.withdrawBalance || 0) / 100;
                    const monthEarned = (referralState.monthEarned || 0) / 100;
                    const bonusBalance = (account.bonusBalance || 0) / 100;
                    
                    message += `🇷🇺 <b>Российский аккаунт (.ru)</b>\n`;
                    message += `💵 Основной баланс: <b>${balanceValue.toFixed(2)} ₽</b>\n`;
                    message += `💸 Реферальный баланс: <b>${withdrawBalance.toFixed(2)} ₽</b>\n`;
                    message += `📈 Заработано за все время: <b>${monthEarned.toFixed(2)} ₽</b>\n`;
                    
                    if (bonusBalance > 0) {
                        message += `🎁 Бонусный баланс: <b>${bonusBalance.toFixed(2)} ₽</b>\n`;
                    }
                    
                    if (referralState.state && referralState.state.current) {
                        const currentPercent = (referralState.state.current.percent * 100).toFixed(1);
                        message += `🎯 Получаемый процент: <b>${currentPercent}%</b>\n`;
                    }
                    
                    const email = account.email || 'Не указан';
                    message += `📧 Email: <tg-spoiler>${email}</tg-spoiler>\n\n`;
                }
            }
            
            // Обрабатываем международный аккаунт
            if (allBalances.net) {
                const account = allBalances.net.data?.account || {};
                const balance = account.balance || 0;
                const referralState = account.referralState || {};
                
                // Для NET аккаунта данные в копейках (нужно делить на 100)
                const balanceValue = balance / 100;
                const withdrawBalance = (account.withdrawBalance || 0) / 100;
                const monthEarned = (referralState.monthEarned || 0) / 100;
                const bonusBalance = (account.bonusBalance || 0) / 100;
                
                message += `🌍 <b>Международный аккаунт (.net)</b>\n`;
                message += `💵 Основной баланс: <b>${balanceValue.toFixed(2)} €</b>\n`;
                message += `💸 Реферальный баланс: <b>${withdrawBalance.toFixed(2)} €</b>\n`;
                message += `📈 Заработано за все время: <b>${monthEarned.toFixed(2)} €</b>\n`;
                
                if (bonusBalance > 0) {
                    message += `🎁 Бонусный баланс: <b>${bonusBalance.toFixed(2)} €</b>\n`;
                }
                
                if (referralState.state && referralState.state.current) {
                    const currentPercent = (referralState.state.current.percent * 100).toFixed(1);
                    message += `🎯 Получаемый процент: <b>${currentPercent}%</b>\n`;
                }
                
                // Скрываем email полностью с размытием (спойлер)
                const email = account.email || 'Не указан';
                message += `📧 Email: <tg-spoiler>${email}</tg-spoiler>\n\n`;
            }
            
            // Общий итог убран по запросу пользователя
            
            message += `\n🕐 Обновлено: ${this.getCurrentTime()}`;
            
            return message;
            
        } catch (error) {
            console.error('Ошибка форматирования баланса:', error);
            return `❌ Ошибка получения данных: ${error.message}`;
        }
    }

    /**
     * Форматирует информацию о балансе для одного аккаунта
     * @param {object} balanceData - Данные о балансе от API
     * @param {string} accountType - Тип аккаунта ('ru' или 'net')
     * @param {boolean} maskId - Маскировать ли ID аккаунта (по умолчанию true)
     * @returns {string} Отформатированное сообщение
     */
    formatSingleBalanceInfo(balanceData, accountType, maskId = true) {
        try {
            // Проверяем на ошибки API
            if (balanceData.error) {
                const flag = accountType === 'ru' ? '🇷🇺' : '🌍';
                const name = accountType === 'ru' ? 'Российский аккаунт (.ru)' : 'Международный аккаунт (.net)';
                const accountId = balanceData.data?.account?.id || 'N/A';
                const displayId = maskId ? this.maskAccountId(accountId) : accountId;
                
                let message = `${flag} <b>${name} #${displayId}</b>\n\n`;
                
                if (balanceData.error.slug === 'not_auth') {
                    message += `❌ Ошибка авторизации - API ключ неверный`;
                } else {
                    message += `❌ Ошибка API: ${balanceData.error.message}`;
                }
                
                return message;
            }
            
            const account = balanceData.data?.account || {};
            const balance = account.balance || 0;
            const referralState = account.referralState || {};
            
            const flag = accountType === 'ru' ? '🇷🇺' : '🌍';
            const name = accountType === 'ru' ? 'Российский аккаунт (.ru)' : 'Международный аккаунт (.net)';
            const currency = accountType === 'ru' ? '₽' : '€';
            const accountId = account.id || 'N/A';
            const displayId = maskId ? this.maskAccountId(accountId) : accountId;
            
            let message = `${flag} <b>${name} #${displayId}</b>\n\n`;
            
            if (accountType === 'ru') {
                // Для RU аккаунта данные тоже в копейках (нужно делить на 100)
                const balanceValue = balance / 100;
                const withdrawBalance = (account.withdrawBalance || 0) / 100;
                const monthEarned = (referralState.monthEarned || 0) / 100;
                const bonusBalance = (account.bonusBalance || 0) / 100;
                
                message += `💵 Основной баланс: <b>${balanceValue.toFixed(2)} ${currency}</b>\n`;
                message += `💸 Реферальный баланс: <b>${withdrawBalance.toFixed(2)} ${currency}</b>\n`;
                message += `📈 Заработано за все время: <b>${monthEarned.toFixed(2)} ${currency}</b>\n`;
                
                if (bonusBalance > 0) {
                    message += `🎁 Бонусный баланс: <b>${bonusBalance.toFixed(2)} ${currency}</b>\n`;
                }
            } else {
                // Для NET аккаунта данные в копейках (нужно делить на 100)
                const balanceValue = balance / 100;
                const withdrawBalance = (account.withdrawBalance || 0) / 100;
                const monthEarned = (referralState.monthEarned || 0) / 100;
                const bonusBalance = (account.bonusBalance || 0) / 100;
                
                message += `💵 Основной баланс: <b>${balanceValue.toFixed(2)} ${currency}</b>\n`;
                message += `💸 Реферальный баланс: <b>${withdrawBalance.toFixed(2)} ${currency}</b>\n`;
                message += `📈 Заработано за все время: <b>${monthEarned.toFixed(2)} ${currency}</b>\n`;
                
                if (bonusBalance > 0) {
                    message += `🎁 Бонусный баланс: <b>${bonusBalance.toFixed(2)} ${currency}</b>\n`;
                }
            }
            
            if (referralState.state && referralState.state.current) {
                const currentPercent = (referralState.state.current.percent * 100).toFixed(1);
                message += `🎯 Получаемый процент: <b>${currentPercent}%</b>\n`;
            }
            
            // Скрываем email полностью с размытием (спойлер)
            const email = account.email || 'Не указан';
            message += `📧 Email: <tg-spoiler>${email}</tg-spoiler>`;
            
            return message;
            
        } catch (error) {
            console.error('Ошибка форматирования баланса:', error);
            return `❌ Ошибка получения данных: ${error.message}`;
        }
    }

    /**
     * Форматирует информацию о серверах
     * @param {object} servicesData - Данные о серверах от API
     * @returns {string} Отформатированное сообщение
     */
    formatServersInfo(servicesData) {
        try {
            if (!servicesData || !servicesData.items || servicesData.items.length === 0) {
                return '📭 У вас нет активных серверов.';
            }

            const servers = servicesData.items;
            let message = '🖥️ **Ваши серверы:**\n\n';

            // Показываем максимум 10 серверов
            const serversToShow = servers.slice(0, 10);

            serversToShow.forEach(server => {
                const serverId = server.id || 'N/A';
                const name = server.name || 'Без названия';
                const status = server.status || 'unknown';

                // Эмодзи для статуса
                const statusEmoji = {
                    'active': '✅',
                    'suspended': '⏸️',
                    'installing': '⚙️',
                    'error': '❌'
                }[status] || '❓';

                message += `${statusEmoji} **${name}** (ID: ${serverId})\n`;
                message += `   Статус: ${status}\n\n`;
            });

            if (servers.length > 10) {
                message += `... и ещё ${servers.length - 10} серверов\n\n`;
            }

            message += `**Всего серверов:** ${servers.length}`;

            return message;

        } catch (error) {
            console.error('Ошибка форматирования серверов:', error);
            return `❌ Ошибка получения данных о серверах: ${error.message}`;
        }
    }

    /**
     * Экранирует специальные символы для MarkdownV2
     * @param {string} text - Текст для экранирования
     * @returns {string} Экранированный текст
     */
    escapeMarkdownV2(text) {
        // Специальные символы для MarkdownV2
        const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
        let escaped = String(text);
        
        // Экранируем каждый специальный символ
        for (const char of specialChars) {
            const regex = new RegExp('\\' + char, 'g');
            escaped = escaped.replace(regex, '\\' + char);
        }
        
        console.log(`🔧 Экранирование: "${text}" → "${escaped}"`);
        return escaped;
    }

    /**
     * Возвращает текущее время в читаемом формате
     * @returns {string} Текущее время
     */
    getCurrentTime() {
        return new Date().toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Маскирует ID аккаунта, оставляя только первые 2 и последние 2 цифры
     * @param {string|number} accountId - ID аккаунта
     * @returns {string} Замаскированный ID
     */
    maskAccountId(accountId) {
        if (!accountId || accountId === 'N/A') {
            return '****';
        }
        
        const idStr = String(accountId);
        if (idStr.length <= 4) {
            return '*'.repeat(idStr.length);
        }
        
        const firstTwo = idStr.substring(0, 2);
        const lastTwo = idStr.substring(idStr.length - 2);
        const middleStars = '*'.repeat(idStr.length - 4);
        
        return `${firstTwo}${middleStars}${lastTwo}`;
    }

    /**
     * Включает мониторинг баланса
     */
    enableMonitoring() {
        this.monitoringEnabled = true;
        console.log('🔔 Мониторинг баланса включен');
    }

    /**
     * Выключает мониторинг баланса
     */
    disableMonitoring() {
        this.monitoringEnabled = false;
        console.log('🔕 Мониторинг баланса выключен');
    }

    /**
     * Проверяет изменения в реферальном балансе
     * @returns {Array} Массив уведомлений об изменениях
     */
    async checkBalanceChanges() {
        if (!this.monitoringEnabled) {
            return [];
        }

        const notifications = [];
        
        try {
            const allBalances = await this.getAllBalances();
            
            // Проверяем RU аккаунт
            if (allBalances.ru && !allBalances.ru.error) {
                const currentBalance = this.getReferralBalance(allBalances.ru, 'ru');
                const previousBalance = this.balanceHistory.ru;
                
                if (previousBalance !== null && currentBalance !== previousBalance) {
                    const notification = this.createBalanceChangeNotification(
                        'ru', 
                        previousBalance, 
                        currentBalance, 
                        allBalances.ru.data?.account?.id
                    );
                    notifications.push(notification);
                }
                
                this.balanceHistory.ru = currentBalance;
            }
            
            // Проверяем NET аккаунт
            if (allBalances.net && !allBalances.net.error) {
                const currentBalance = this.getReferralBalance(allBalances.net, 'net');
                const previousBalance = this.balanceHistory.net;
                
                if (previousBalance !== null && currentBalance !== previousBalance) {
                    const notification = this.createBalanceChangeNotification(
                        'net', 
                        previousBalance, 
                        currentBalance, 
                        allBalances.net.data?.account?.id
                    );
                    notifications.push(notification);
                }
                
                this.balanceHistory.net = currentBalance;
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки изменений баланса:', error);
        }
        
        return notifications;
    }

    /**
     * Получает реферальный баланс из данных аккаунта
     * @param {object} balanceData - Данные баланса
     * @param {string} accountType - Тип аккаунта
     * @returns {number} Реферальный баланс
     */
    getReferralBalance(balanceData, accountType) {
        const account = balanceData.data?.account || {};
        const withdrawBalance = account.withdrawBalance || 0;
        return withdrawBalance / 100; // Конвертируем из копеек
    }

    /**
     * Создает уведомление об изменении баланса
     * @param {string} accountType - Тип аккаунта
     * @param {number} oldBalance - Старый баланс
     * @param {number} newBalance - Новый баланс
     * @param {number} accountId - ID аккаунта
     * @returns {string} Текст уведомления
     */
    createBalanceChangeNotification(accountType, oldBalance, newBalance, accountId) {
        const flag = accountType === 'ru' ? '🇷🇺' : '🌍';
        const domain = accountType === 'ru' ? 'ru' : 'net';
        const currency = accountType === 'ru' ? '₽' : '€';
        
        const oldFormatted = `${oldBalance.toFixed(2)}${currency}`;
        const newFormatted = `${newBalance.toFixed(2)}${currency}`;
        
        const maskedId = this.maskAccountId(accountId);
        
        let message = `🔔 <b>Ваш реферальный баланс изменился</b>\n\n`;
        message += `${flag} ${domain} #${maskedId}\n`;
        message += `С <s>${oldFormatted}</s> → <b>${newFormatted}</b>`;
        
        return message;
    }

    /**
     * Создает inline результат для RU аккаунта
     * @param {object} balanceData - Данные баланса
     * @returns {object} Inline результат
     */
    createInlineResultRU(balanceData) {
        if (balanceData.error) {
            return {
                type: 'article',
                id: 'ru_error',
                title: '🇷🇺 Российский аккаунт (.ru)',
                description: '❌ Ошибка авторизации',
                message_text: `🇷🇺 <b>Российский аккаунт (.ru)</b>\n\n❌ Ошибка авторизации - API ключ неверный`,
                parse_mode: 'HTML'
            };
        }

        const account = balanceData.data?.account || {};
        const referralState = account.referralState || {};
        const accountId = account.id || 'N/A';
        const maskedId = this.maskAccountId(accountId);
        
        const withdrawBalance = (account.withdrawBalance || 0) / 100;
        const monthEarned = (referralState.monthEarned || 0) / 100;
        const currentPercent = referralState.state?.current?.percent ? 
            (referralState.state.current.percent * 100).toFixed(1) : '0.0';

        const message = `🇷🇺 <b>Российский аккаунт (.ru) #${maskedId}</b>\n\n` +
            `💸 Реферальный баланс: <b>${withdrawBalance.toFixed(2)} ₽</b>\n` +
            `📈 Заработано за все время: <b>${monthEarned.toFixed(2)} ₽</b>\n` +
            `🎯 Получаемый процент: <b>${currentPercent}%</b>`;

        return {
            type: 'article',
            id: 'ru_balance',
            title: '🇷🇺 RU Баланс',
            description: `💸 ${withdrawBalance.toFixed(2)}₽ | 📈 ${monthEarned.toFixed(2)}₽ | 🎯 ${currentPercent}%`,
            message_text: message,
            parse_mode: 'HTML'
        };
    }

    /**
     * Создает inline результат для NET аккаунта
     * @param {object} balanceData - Данные баланса
     * @returns {object} Inline результат
     */
    createInlineResultNET(balanceData) {
        if (balanceData.error) {
            return {
                type: 'article',
                id: 'net_error',
                title: '🌍 Международный аккаунт (.net)',
                description: '❌ Ошибка авторизации',
                message_text: `🌍 <b>Международный аккаунт (.net)</b>\n\n❌ Ошибка авторизации - API ключ неверный`,
                parse_mode: 'HTML'
            };
        }

        const account = balanceData.data?.account || {};
        const referralState = account.referralState || {};
        const accountId = account.id || 'N/A';
        const maskedId = this.maskAccountId(accountId);
        
        const withdrawBalance = (account.withdrawBalance || 0) / 100;
        const monthEarned = (referralState.monthEarned || 0) / 100;
        const currentPercent = referralState.state?.current?.percent ? 
            (referralState.state.current.percent * 100).toFixed(1) : '0.0';

        const message = `🌍 <b>Международный аккаунт (.net) #${maskedId}</b>\n\n` +
            `💸 Реферальный баланс: <b>${withdrawBalance.toFixed(2)} €</b>\n` +
            `📈 Заработано за все время: <b>${monthEarned.toFixed(2)} €</b>\n` +
            `🎯 Получаемый процент: <b>${currentPercent}%</b>`;

        return {
            type: 'article',
            id: 'net_balance',
            title: '🌍 NET Баланс',
            description: `💸 ${withdrawBalance.toFixed(2)}€ | 📈 ${monthEarned.toFixed(2)}€ | 🎯 ${currentPercent}%`,
            message_text: message,
            parse_mode: 'HTML'
        };
    }
}

module.exports = AezaAPI;
