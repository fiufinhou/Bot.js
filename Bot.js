const TelegramBot = require('node-telegram-bot-api');
const token = 'YOUR_BOT_TOKEN'; // استبدل بـ Token البوت الخاص بك
const bot = new TelegramBot(token, { polling: true });

let players = [];
let roles = {};
let gameStarted = false;
let phase = 'waiting';
let votes = {};
let alivePlayers = [];
let killedPlayer = null;

const allRoles = ['Loup-Garou', 'Voyante', 'Sorcière', 'Chasseur', 'Simple Villageois'];

// تابع لإرسال رسالة ترحيبية
const welcomeMessage = `
🎮 أهلاً بك في لعبة Loup Garou (الذئب المستذئب)!

قواعد اللعبة:
- كل لاعب له دور سري (Loup-Garou, Voyante…)
- الذئاب تقتل في الليل.
- العرافة تكشف دور لاعب.
- الساحرة تنقذ أو تقتل.
- في النهار: تصويت جماعي لطرد لاعب.

الأوامر:
/start - عرض القواعد
/join - الانضمام إلى اللعبة
/players - عرض اللاعبين
/startgame - بدء اللعبة
/vote @username - التصويت لطرد
/speak - إرسال رسالة صوتية للجميع
/reset - إعادة تعيين اللعبة
`;

// أوامر البوت
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, welcomeMessage);
});

bot.onText(/\/join/, (msg) => {
  if (gameStarted) return bot.sendMessage(msg.chat.id, 'اللعبة بدأت بالفعل!');
  const user = { id: msg.from.id, username: msg.from.username || msg.from.first_name };
  if (!players.find(p => p.id === user.id)) {
    players.push(user);
    bot.sendMessage(msg.chat.id, `✅ @${user.username} انضم إلى اللعبة.`);
  }
});

bot.onText(/\/players/, (msg) => {
  if (players.length === 0) return bot.sendMessage(msg.chat.id, 'لا يوجد لاعبين بعد.');
  const list = players.map(p => '• @' + p.username).join('\n');
  bot.sendMessage(msg.chat.id, `👥 قائمة اللاعبين:\n${list}`);
});

bot.onText(/\/startgame/, (msg) => {
  if (gameStarted) return bot.sendMessage(msg.chat.id, 'اللعبة بدأت مسبقًا.');
  if (players.length < 5) return bot.sendMessage(msg.chat.id, '❌ يجب أن يكون عدد اللاعبين 5 أو أكثر.');

  gameStarted = true;
  phase = 'night';
  alivePlayers = [...players];

  const shuffled = players.sort(() => 0.5 - Math.random());
  let rolePool = [...allRoles];
  while (rolePool.length < players.length) rolePool.push('Simple Villageois');

  shuffled.forEach((p, i) => {
    const role = rolePool[i];
    roles[p.id] = role;
    bot.sendMessage(p.id, `🎭 دورك هو: ${role}`);
  });

  const wolves = players.filter(p => roles[p.id] === 'Loup-Garou');
  const wolfNames = wolves.map(p => '@' + p.username).join(', ');
  wolves.forEach(w => {
    bot.sendMessage(w.id, `🩸 أنت ذئب. الذئاب معك: ${wolfNames}`);
  });

  bot.sendMessage(msg.chat.id, 'بدأت اللعبة! ندخل في مرحلة الليل...');
  startNightPhase(msg.chat.id);
});

// تابع لبدء مرحلة الليل
function startNightPhase(groupId) {
  phase = 'night';
  killedPlayer = null;
  bot.sendMessage(groupId, '🌙 بدأ الليل. الأدوار السرية تتحرك...');

  players.forEach(p => {
    const role = roles[p.id];
    if (role === 'Loup-Garou') {
      bot.sendMessage(p.id, 'من تريد قتله؟ أرسل /kill @username');
    } else if (role === 'Voyante') {
      bot.sendMessage(p.id, 'من تريد معرفة دوره؟ أرسل /vision @username');
    } else if (role === 'Sorcière') {
      bot.sendMessage(p.id, 'هل تود إنقاذ شخص؟ أرسل /heal @username أو /poison @username');
    }
  });

  setTimeout(() => {
    bot.sendMessage(groupId, 'انتهت المرحلة الليلية. ☀️ ننتقل إلى النهار.');
    startDayPhase(groupId);
  }, 40000);
}

// تابع لبدء مرحلة النهار
function startDayPhase(groupId) {
  phase = 'day';
  votes = {};
  if (killedPlayer) {
    const username = players.find(p => p.id === killedPlayer)?.username;
    alivePlayers = alivePlayers.filter(p => p.id !== killedPlayer);
    bot.sendMessage(groupId, `❌ اللاعب @${username} تم قتله خلال الليل.`);
  } else {
    bot.sendMessage(groupId, 'لم يتم قتل أي شخص هذه الليلة.');
  }

  if (checkWinner(groupId)) return;

  bot.sendMessage(groupId, 'أرسل /vote @username لطرد لاعب.');
  setTimeout(() => {
    let result = countVotes();
    if (result) {
      bot.sendMessage(groupId, `📢 تم طرد @${result}`);
      alivePlayers = alivePlayers.filter(p => p.username !== result);
    } else {
      bot.sendMessage(groupId, '🔄 لم يتم تحديد أحد.');
    }
    if (checkWinner(groupId)) return;
    startNightPhase(groupId);
  }, 30000);
}

// تابع لح 
