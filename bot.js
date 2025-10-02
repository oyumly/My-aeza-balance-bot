const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const AezaAPI = require('./aeza-api');

// Инициализация бота и API клиента
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, config.POLLING_OPTIONS);
const aezaAPI = new AezaAPI();


console.log('🤖 AEZA Balance Bot запущен!');

/**
 * Проверяет доступ пользователя к боту
 * @param {number} userId - ID пользователя Telegram
 * @returns {boolean} Разрешен ли доступ
 */
function checkUserAccess(userId) {
    // Если ALLOWED_USER_ID не указан, разрешаем всем
    if (!config.ALLOWED_USER_ID) {
        return true;
    }
    
    return userId.toString() === config.ALLOWED_USER_ID;
}

/**
 * Отправляет сообщение об отказе в доступе
 * @param {number} chatId - ID чата
 */
function sendAccessDenied(chatId) {
    bot.sendMessage(chatId, 'У вас нет доступа к этому боту.', {
        parse_mode: 'HTML'
    });
}


// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!checkUserAccess(userId)) {
        console.log(`⚠️ Неавторизованный доступ от пользователя ${userId}`);
        return sendAccessDenied(chatId);
    }
    
    const welcomeMessage = `
🤖 <b>Добро пожаловать в AEZA Balance Bot!</b>

Этот бот показывает ваш баланс, реферальный баланс и автоматически отслеживает изменения.

<b>Команды:</b>
/balance - Показать баланс всех аккаунтов
/help - Показать справку

<b>О боте:</b>
Бот использует официальный API AEZA (эндпоинт GET desktop) для получения баланса.
Автоматически отслеживает изменения реферального баланса каждый час.
Разработчик @oyumly

<b>Благодарности:</b>
Спасибо @nesqdzy за указание актуальных API эндпоинтов для aeza.net и aeza.ru

📚 <a href="https://github.com/sqdzy/aeza-api-endpoints">GitHub репозиторий с API эндпоинтами</a>
    `.trim();
    
    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'HTML'
    });
    
    // Запускаем мониторинг при первом обращении
    if (!monitoringInterval) {
        startBalanceMonitoring(chatId);
    }
});


// Обработчик команды /balance
bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown';
    
    console.log(`📊 Запрос баланса от пользователя ${username} (ID: ${userId})`);
    
    if (!checkUserAccess(userId)) {
        console.log(`🚫 Доступ запрещен для пользователя ${userId}`);
        return sendAccessDenied(chatId);
    }
    
    // Запускаем мониторинг при первом обращении
    if (!monitoringInterval) {
        startBalanceMonitoring(chatId);
    }
    
    try {
        // Отправляем сообщение о загрузке
        console.log('⏳ Отправляю сообщение о загрузке...');
        const loadingMessage = await bot.sendMessage(chatId, '⏳ Получаю информацию о балансе...', {
            parse_mode: 'HTML'
        });
        
        // Получаем данные о балансе со всех аккаунтов
        console.log('🔄 Запрашиваю данные баланса из AEZA API...');
        const allBalances = await aezaAPI.getAllBalances();
        console.log('✅ Данные баланса получены:', JSON.stringify(allBalances, null, 2));
        
        // Удаляем сообщение о загрузке
        await bot.deleteMessage(chatId, loadingMessage.message_id);
        
        // Отправляем отдельные сообщения для каждого аккаунта
        if (allBalances.ru) {
            if (allBalances.ru.error) {
                const ruErrorMessage = `🇷🇺 <b>Российский аккаунт (.ru)</b>\n\n❌ Ошибка авторизации - API ключ неверный`;
                await bot.sendMessage(chatId, ruErrorMessage, {
                    parse_mode: 'HTML'
                });
            } else {
                const ruMessage = aezaAPI.formatSingleBalanceInfo(allBalances.ru, 'ru', false);
                await bot.sendMessage(chatId, ruMessage, {
                    parse_mode: 'HTML'
                });
            }
        }
        
        if (allBalances.net) {
            if (allBalances.net.error) {
                const netErrorMessage = `🌍 <b>Международный аккаунт (.net)</b>\n\n❌ Ошибка авторизации - API ключ неверный`;
                await bot.sendMessage(chatId, netErrorMessage, {
                    parse_mode: 'HTML'
                });
            } else {
                const netMessage = aezaAPI.formatSingleBalanceInfo(allBalances.net, 'net', false);
                await bot.sendMessage(chatId, netMessage, {
                    parse_mode: 'HTML'
                });
            }
        }
        
        console.log('✅ Баланс успешно отправлен пользователю отдельными сообщениями');
        
    } catch (error) {
        console.error('❌ Ошибка получения баланса:', error);
        console.error('📋 Детали ошибки:', error.stack);
        
        bot.sendMessage(chatId, `❌ **Ошибка получения баланса:**\n\n\`${error.message}\`\n\nПроверьте правильность API ключа.`, {
            parse_mode: 'HTML'
        });
    }
});





// Обработчик неизвестных команд
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    // Игнорируем известные команды
    if (text && text.startsWith('/') && !['/start', '/help', '/balance'].includes(text)) {
        if (!checkUserAccess(userId)) {
            return sendAccessDenied(chatId);
        }
        
        bot.sendMessage(chatId, '❓ Неизвестная команда. Используйте /help для просмотра команд.', {
            parse_mode: 'HTML'
        });
    }
});

// Обработчик inline запросов
bot.on('inline_query', async (query) => {
    const queryText = query.query.toLowerCase().trim();
    const results = [];
    
    console.log(`🔍 Inline запрос: "${queryText}" от пользователя ${query.from.id}`);
    
    try {

        if (queryText.includes('ru') || queryText.includes('россия')) {
            const ruBalance = await aezaAPI.getBalance('ru');
            const ruResult = aezaAPI.createInlineResultRU(ruBalance);
            results.push(ruResult);
        }
        
        // Если запрос содержит "net" - показываем NET баланс
        if (queryText.includes('net') || queryText.includes('международный') || queryText.includes('international')) {
            const netBalance = await aezaAPI.getBalance('net');
            const netResult = aezaAPI.createInlineResultNET(netBalance);
            results.push(netResult);
        }
        
        
        // Если нет результатов - показываем подсказку
        if (results.length === 0) {
            results.push({
                type: 'article',
                id: 'unknown',
                title: '❓ Неизвестная команда',
                description: 'Используйте: ru, net',
                message_text: `❓ <b>Неизвестная команда</b>\n\n` +
                    `Доступные команды:\n` +
                    `• ru - Российский аккаунт\n` +
                    `• net - Международный аккаунт`,
                parse_mode: 'HTML'
            });
        }
        
        // Отправляем результаты
        await bot.answerInlineQuery(query.id, results, {
            cache_time: 30 // Кэшируем на 30 секунд
        });
        
        console.log(`✅ Отправлено ${results.length} inline результатов`);
        
    } catch (error) {
        console.error('❌ Ошибка обработки inline запроса:', error);
        
        // Отправляем ошибку
        await bot.answerInlineQuery(query.id, [{
            type: 'article',
            id: 'error',
            title: '❌ Ошибка',
            description: 'Не удалось получить данные',
            message_text: '❌ <b>Ошибка получения данных</b>\n\nПопробуйте позже или обратитесь к администратору.',
            parse_mode: 'HTML'
        }]);
    }
});

// Обработчик ошибок
bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error);
});

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Получен сигнал SIGINT. Завершаю работу бота...');
    bot.stopPolling();
    process.exit(0);
});

// Система мониторинга баланса
let monitoringInterval = null;
let allowedChatId = null;

/**
 * Запускает мониторинг баланса
 * @param {number} chatId - ID чата для отправки уведомлений
 */
function startBalanceMonitoring(chatId) {
    if (monitoringInterval) {
        console.log('⚠️ Мониторинг уже запущен');
        return;
    }
    
    allowedChatId = chatId;
    aezaAPI.enableMonitoring();
    
    // Инициализируем историю баланса при первом запуске
    initializeBalanceHistory();
    
    // Проверяем изменения каждый час (3600000 мс)
    monitoringInterval = setInterval(async () => {
        try {
            console.log('🔍 Проверяю изменения баланса...');
            const notifications = await aezaAPI.checkBalanceChanges();
            
            if (notifications.length > 0) {
                console.log(`📢 Найдено ${notifications.length} изменений баланса`);
                
                for (const notification of notifications) {
                    await bot.sendMessage(allowedChatId, notification, {
                        parse_mode: 'HTML'
                    });
                    console.log('✅ Уведомление отправлено');
                }
            } else {
                console.log('ℹ️ Изменений баланса не обнаружено');
            }
        } catch (error) {
            console.error('❌ Ошибка мониторинга:', error);
        }
    }, 3600000); // Каждый час
    
    console.log('🔔 Мониторинг баланса запущен (проверка каждый час)');
}

/**
 * Останавливает мониторинг баланса
 */
function stopBalanceMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        aezaAPI.disableMonitoring();
        console.log('🔕 Мониторинг баланса остановлен');
    }
}

/**
 * Инициализирует историю баланса при первом запуске
 */
async function initializeBalanceHistory() {
    try {
        console.log('🔄 Инициализирую историю баланса...');
        const allBalances = await aezaAPI.getAllBalances();
        
        if (allBalances.ru && !allBalances.ru.error) {
            const ruBalance = aezaAPI.getReferralBalance(allBalances.ru, 'ru');
            aezaAPI.balanceHistory.ru = ruBalance;
            console.log(`🇷🇺 RU баланс инициализирован: ${ruBalance.toFixed(2)} ₽`);
        }
        
        if (allBalances.net && !allBalances.net.error) {
            const netBalance = aezaAPI.getReferralBalance(allBalances.net, 'net');
            aezaAPI.balanceHistory.net = netBalance;
            console.log(`🌍 NET баланс инициализирован: ${netBalance.toFixed(2)} €`);
        }
        
        console.log('✅ История баланса инициализирована');
    } catch (error) {
        console.error('❌ Ошибка инициализации истории баланса:', error);
    }
}

// Обработчик команды /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!checkUserAccess(userId)) {
        console.log(`🚫 Доступ запрещен для пользователя ${userId}`);
        return sendAccessDenied(chatId);
    }

    const helpMessage = `
🆘 <b>Справка:</b>

/start - Приветственное сообщение
/balance - Показать баланс всех аккаунтов
/help - Показать эту справку

<b>О боте:</b>
Бот использует официальный API AEZA (эндпоинт GET desktop) для получения баланса.
Автоматически отслеживает изменения реферального баланса каждый час.
Разработчик @oyumly

<b>Благодарности:</b>
Спасибо @nesqdzy за указание актуальных API эндпоинтов для aeza.net и aeza.ru

📚 <a href="https://github.com/sqdzy/aeza-api-endpoints">GitHub репозиторий с API эндпоинтами</a>
    `;

    bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'HTML'
    });
});

// Запускаем мониторинг при старте бота
// Мониторинг будет запущен при первом обращении к боту

process.on('SIGTERM', () => {
    console.log('\n🛑 Получен сигнал SIGTERM. Завершаю работу бота...');
    stopBalanceMonitoring();
    bot.stopPolling();
    process.exit(0);
});

