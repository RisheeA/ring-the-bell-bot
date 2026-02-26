// FairScale Developer Updates Bot
// "Ring the Bell" for new features and updates

import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  GROUP_CHAT_ID: process.env.GROUP_CHAT_ID, // Your dev group chat ID
};

// =============================================================================
// STORAGE
// =============================================================================

// Pending submissions: userId -> { step, data }
const pendingSubmissions = new Map();

// =============================================================================
// BOT INITIALIZATION
// =============================================================================

const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { polling: true });

// =============================================================================
// COMMAND: /ringthebell
// =============================================================================

bot.onText(/\/ringthebell/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Start the form flow
  pendingSubmissions.set(userId, {
    step: 'feature_name',
    data: {
      submittedBy: msg.from.username || msg.from.first_name,
      submittedAt: new Date().toISOString(),
    }
  });
  
  bot.sendMessage(chatId, 
    `🔔 *Ring the Bell!*\n\nLet's announce your update.\n\n*Step 1/4:* What's the feature name?`,
    { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
  );
});

// =============================================================================
// HANDLE FORM RESPONSES
// =============================================================================

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  // Skip commands
  if (!text || text.startsWith('/')) return;
  
  // Check if user has pending submission
  const pending = pendingSubmissions.get(userId);
  if (!pending) return;
  
  switch (pending.step) {
    
    // Step 1: Feature name
    case 'feature_name':
      pending.data.featureName = text;
      pending.step = 'description';
      bot.sendMessage(chatId,
        `*Step 2/4:* What does it do? (Brief description)`,
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
      break;
    
    // Step 2: Description
    case 'description':
      pending.data.description = text;
      pending.step = 'improvements';
      bot.sendMessage(chatId,
        `*Step 3/4:* What improvements were made? (What's new/better)`,
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
      break;
    
    // Step 3: Improvements
    case 'improvements':
      pending.data.improvements = text;
      pending.step = 'type';
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🚀 New Feature', callback_data: 'type_feature' },
            { text: '🐛 Bug Fix', callback_data: 'type_bugfix' },
          ],
          [
            { text: '⚡ Improvement', callback_data: 'type_improvement' },
            { text: '🔧 Maintenance', callback_data: 'type_maintenance' },
          ],
        ]
      };
      
      bot.sendMessage(chatId,
        `*Step 4/4:* What type of update is this?`,
        { parse_mode: 'Markdown', reply_markup: keyboard, reply_to_message_id: msg.message_id }
      );
      break;
  }
});

// =============================================================================
// HANDLE TYPE SELECTION
// =============================================================================

bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  
  const pending = pendingSubmissions.get(userId);
  if (!pending || pending.step !== 'type') return;
  
  const typeMap = {
    'type_feature': { emoji: '🚀', label: 'New Feature' },
    'type_bugfix': { emoji: '🐛', label: 'Bug Fix' },
    'type_improvement': { emoji: '⚡', label: 'Improvement' },
    'type_maintenance': { emoji: '🔧', label: 'Maintenance' },
  };
  
  const selected = typeMap[query.data];
  pending.data.type = selected;
  
  // Remove keyboard
  bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
    chat_id: chatId,
    message_id: query.message.message_id
  });
  
  // Show preview
  const preview = formatAnnouncement(pending.data, false);
  
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: '✅ Ring the Bell!', callback_data: 'confirm_send' },
        { text: '❌ Cancel', callback_data: 'confirm_cancel' },
      ],
    ]
  };
  
  bot.sendMessage(chatId,
    `*Preview:*\n\n${preview}\n\n_Send this announcement?_`,
    { parse_mode: 'Markdown', reply_markup: confirmKeyboard }
  );
  
  pending.step = 'confirm';
  
  bot.answerCallbackQuery(query.id);
});

// =============================================================================
// HANDLE CONFIRMATION
// =============================================================================

bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  
  const pending = pendingSubmissions.get(userId);
  if (!pending || pending.step !== 'confirm') return;
  
  if (query.data === 'confirm_cancel') {
    pendingSubmissions.delete(userId);
    bot.editMessageText('❌ Cancelled.', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  if (query.data === 'confirm_send') {
    // Format and send the announcement
    const announcement = formatAnnouncement(pending.data, true);
    
    // Send to group with @everyone ping
    const targetChat = CONFIG.GROUP_CHAT_ID || chatId;
    
    await bot.sendMessage(targetChat, announcement, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    
    // Confirm to user
    bot.editMessageText('✅ Bell rung! Announcement sent.', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    
    pendingSubmissions.delete(userId);
  }
  
  bot.answerCallbackQuery(query.id);
});

// =============================================================================
// FORMAT ANNOUNCEMENT
// =============================================================================

function formatAnnouncement(data, includePing) {
  const ping = includePing ? '@everyone\n\n' : '';
  
  const message = `${ping}🔔🔔🔔 *RING THE BELL* 🔔🔔🔔

${data.type.emoji} *${data.type.label}*

*${data.featureName}*

📝 *What it does:*
${data.description}

✨ *What's new:*
${data.improvements}

_Shipped by @${data.submittedBy}_`;

  return message;
}

// =============================================================================
// COMMAND: /cancel
// =============================================================================

bot.onText(/\/cancel/, async (msg) => {
  const userId = msg.from.id;
  
  if (pendingSubmissions.has(userId)) {
    pendingSubmissions.delete(userId);
    bot.sendMessage(msg.chat.id, '❌ Cancelled.', { reply_to_message_id: msg.message_id });
  }
});

// =============================================================================
// COMMAND: /help
// =============================================================================

bot.onText(/\/help/, async (msg) => {
  const help = `🔔 *Ring the Bell Bot*

*Commands:*
/ringthebell - Announce a new feature or update
/cancel - Cancel current submission
/help - Show this message

*How it works:*
1. Run /ringthebell
2. Answer 4 quick questions
3. Preview your announcement
4. Ring the bell!

Your update gets posted with @everyone ping.`;

  bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

bot.on('polling_error', console.error);
process.on('unhandledRejection', console.error);

// =============================================================================
// STARTUP
// =============================================================================

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║            🔔 Ring the Bell Bot - Online                           ║
╠════════════════════════════════════════════════════════════════════╣
║  Commands:                                                         ║
║    /ringthebell  - Start announcement flow                         ║
║    /cancel       - Cancel submission                               ║
║    /help         - Show help                                       ║
╚════════════════════════════════════════════════════════════════════╝
`);
