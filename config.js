require('dotenv').config();

const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    AEZA_API_KEY_RU: process.env.AEZA_API_KEY_RU,
    AEZA_API_KEY_NET: process.env.AEZA_API_KEY_NET,
    AEZA_BASE_URL_RU: 'https://my.aeza.ru/api',
    AEZA_BASE_URL_NET: 'https://my.aeza.net/api',
    ALLOWED_USER_ID: process.env.ALLOWED_USER_ID,
    POLLING_OPTIONS: {
        polling: true
    }
};

if (!config.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN не установлен в переменных окружения');
    process.exit(1);
}

if (!config.AEZA_API_KEY_RU && !config.AEZA_API_KEY_NET) {
    console.error('Необходимо указать хотя бы один AEZA API ключ (AEZA_API_KEY_RU или AEZA_API_KEY_NET)');
    process.exit(1);
}

module.exports = config;