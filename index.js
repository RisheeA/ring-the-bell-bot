// FairScale Developer Updates Bot
// "Ring the Bell" for new features and updates

import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  GROUP_CHAT_ID: process.env.GROUP_CHAT_ID,
};

// =============================================================================
// STORAGE
// =============================================================================

// Pending submissions: `${chatId}-${userId}` -> { step, data }
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
  const key = `${chatId}-${userId}`;
  
  pendingSubmissions.set(key, {
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
  const key = `${chatId}-${userId}`;
  
  if (!text || text.startsWith('/')) return;
  
  const pending = pendingSubmissions.get(key);
  if (!pending) return;
  
  switch (pending.step) {
    
    case 'feature_name':
      pending.data.featureName = text;
      pending.step = 'description';
      bot.sendMessage(chatId,
        `*Step 2/4:* What does it do? (Brief description)`,
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
      break;
    
    case 'description':
      pending.data.description = text;
      pending.step = 'improvements';
      bot.sendMessage(chatId,
        `*Step 3/4:* What improvements were made? (What's new/better)`,
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
      break;
    
    case 'improvements':
      pending.data.improvements = text;
      pending.step = 'type';
      bot.sendMessage(chatId,
        `*Step 4/4:* What type of update?\n\nReply with a number:\n1️⃣ New Feature\n2️⃣ Bug Fix\n3️⃣ Improvement\n4️⃣ Maintenance`,
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
      break;
    
    case 'type':
      const typeMap = {
        '1': { emoji: '🚀', label: 'New Feature' },
        '2': { emoji: '🐛', label: 'Bug Fix' },
        '3': { emoji: '⚡', label: 'Improvement' },
        '4': { emoji: '🔧', label: 'Maintenance' },
      };
      
      const selected = typeMap[text.trim()];
      
      if (!selected) {
        bot.sendMessage(chatId,
          `Please reply with 1, 2, 3, or 4`,
          { reply_to_message_id: msg.message_id }
        );
        return;
      }
      
      pending.data.type = selected;
      pending.step = 'confirm';
      
      const preview = formatAnnouncement(pending.data, false);
      
      bot.sendMessage(chatId,
        `*Preview:*\n\n${preview}\n\n*Send this announcement?*\n\nReply: Y to send, N to cancel`,
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
      break;
    
    case 'confirm':
      const answer = text.trim().toLowerCase();
      
      if (answer === 'y' || answer === 'yes') {
        const announcement = formatAnnouncement(pending.data, true);
        const targetChat = CONFIG.GROUP_CHAT_ID || chatId;
        
        await bot.sendMessage(targetChat, announcement, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        
        bot.sendMessage(chatId, '✅ Bell rung! Announcement sent.', { reply_to_message_id: msg.message_id });
        pendingSubmissions.delete(key);
        
      } else if (answer === 'n' || answer === 'no') {
        pendingSubmissions.delete(key);
        bot.sendMessage(chatId, '❌ Cancelled.', { reply_to_message_id: msg.message_id });
        
      } else {
        bot.sendMessage(chatId, 'Reply Y to send or N to cancel.', { reply_to_message_id: msg.message_id });
      }
      break;
  }
});

// =============================================================================
// FORMAT ANNOUNCEMENT
// =============================================================================

function formatAnnouncement(data, includePing) {
  const message = `🔔🔔🔔 *RING THE BELL* 🔔🔔🔔

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
  const key = `${msg.chat.id}-${msg.from.id}`;
  
  if (pendingSubmissions.has(key)) {
    pendingSubmissions.delete(key);
    bot.sendMessage(msg.chat.id, '❌ Cancelled.', { reply_to_message_id: msg.message_id });
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

bot.on('polling_error', console.error);
process.on('unhandledRejection', console.error);

// =============================================================================
// STARTUP
// =============================================================================

console.log('🔔 Ring the Bell Bot - Online');
