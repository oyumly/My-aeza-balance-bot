const axios = require('axios');
const config = require('./config');

class AezaAPI {
    constructor() {
        this.apiKeyRu = config.AEZA_API_KEY_RU;
        this.apiKeyNet = config.AEZA_API_KEY_NET;
        this.baseURLRu = config.AEZA_BASE_URL_RU;
        this.baseURLNet = config.AEZA_BASE_URL_NET;
        
        this.clients = {};
        
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
                }
            });
        }
        
        if (this.apiKeyNet) {
            this.clients.net = axios.create({
                baseURL: this.baseURLNet,
                headers: {
                    'X-API-Key': this.apiKeyNet,
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    async makeRequest(endpoint, account = 'net') {
        try {
            const client = this.clients[account];
            if (!client) {
                throw new Error(`API клиент для аккаунта ${account} не настроен`);
            }

            console.log(`🔄 Запрос к ${account} API: ${endpoint}`);
            const response = await client.get(endpoint);
            console.log(`✅ Ответ от ${account} API получен:`, response.status);
            
            return response.data;
        } catch (error) {
            console.error(`❌ Ошибка запроса к ${account} API:`, error.message);
            
            if (error.response) {
                console.error(`📋 Статус ответа: ${error.response.status}`);
                console.error(`📋 Данные ответа:`, error.response.data);
                
                return {
                    error: {
                        status: error.response.status,
                        message: error.response.data?.message || 'Неизвестная ошибка API',
                        slug: error.response.data?.slug || 'unknown_error',
                        data: error.response.data?.data || {}
                    }
                };
            }
            
            throw error;
        }
    }

    async getBalance(account = 'net') {
        try {
            console.log(`💰 Запрашиваю баланс для ${account} аккаунта...`);
            const balanceData = await this.makeRequest('/desktop', account);
            
            if (balanceData.error) {
                console.error(`❌ Ошибка получения баланса для ${account}:`, balanceData.error);
                return balanceData;
            }
            
            console.log(`✅ Баланс для ${account} получен успешно`);
            return balanceData;
        } catch (error) {
            console.error(`❌ Критическая ошибка получения баланса для ${account}:`, error);
            return {
                error: {
                    message: error.message,
                    slug: 'critical_error'
                }
            };
        }
    }

    async getAllBalances() {
        const results = {};
        
        if (this.apiKeyRu) {
            console.log('🇷🇺 Получаю баланс RU аккаунта...');
            results.ru = await this.getBalance('ru');
        }
        
        if (this.apiKeyNet) {
            console.log('🌍 Получаю баланс NET аккаунта...');
            results.net = await this.getBalance('net');
        }
        
        return results;
    }

    formatSingleBalanceInfo(balanceData, accountType, maskId = true) {
        try {
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

            
            const email = account.email || 'Не указан';
            message += `📧 Email: <tg-spoiler>${email}</tg-spoiler>`;
            
            return message;
            
        } catch (error) {
            console.error('Ошибка форматирования баланса:', error);
            return `❌ Ошибка получения данных: ${error.message}`;
        }
    }


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

    enableMonitoring() {
        this.monitoringEnabled = true;
        console.log('🔔 Мониторинг баланса включен');
    }

    disableMonitoring() {
        this.monitoringEnabled = false;
        console.log('🔕 Мониторинг баланса выключен');
    }

    async checkBalanceChanges() {
        if (!this.monitoringEnabled) {
            return [];
        }

        const notifications = [];
        
        try {
            const allBalances = await this.getAllBalances();
            
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

    getReferralBalance(balanceData, accountType) {
        const account = balanceData.data?.account || {};
        const withdrawBalance = account.withdrawBalance || 0;
        return withdrawBalance / 100;
    }

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