// Реєстрація service worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

// BLE Mesh Chat логіка (mesh-режим)
const connectBtn = document.getElementById('connectBtn');
const devicesDiv = document.getElementById('devices');
const chatDiv = document.getElementById('chat');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

// Масив підключених пристроїв
let connectedDevices = [];
let chatCharacteristics = [];
let deviceNames = [];

// Для уникнення зациклення повідомлень
const seenMessages = new Set();

// Генерація унікального ID для повідомлення
function generateMsgId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

connectBtn.onclick = async () => {
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb']
    });
    deviceNames.push(device.name || device.id);
    devicesDiv.innerText = 'Підключено до: ' + deviceNames.join(', ');
    const gattServer = await device.gatt.connect();
    const service = await gattServer.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    const chatCharacteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
    await chatCharacteristic.startNotifications();
    chatCharacteristic.addEventListener('characteristicvaluechanged', handleMessage);
    connectedDevices.push(device);
    chatCharacteristics.push(chatCharacteristic);
    chatDiv.style.display = '';
  } catch (e) {
    devicesDiv.innerText = 'Помилка підключення: ' + e;
  }
};

function handleMessage(event) {
  const value = new TextDecoder().decode(event.target.value);
  let msgObj;
  try {
    msgObj = JSON.parse(value);
  } catch {
    // fallback для старих повідомлень
    addMessage('Вхідне: ' + value);
    return;
  }
  if (seenMessages.has(msgObj.id)) return; // вже бачили це повідомлення
  seenMessages.add(msgObj.id);
  addMessage((msgObj.from ? msgObj.from + ': ' : 'Вхідне: ') + msgObj.text);
  // Ретрансляція далі (mesh)
  meshRelay(msgObj);
}

function meshRelay(msgObj) {
  // Відправити всім підключеним, окрім того, від кого прийшло (немає ідентифікації, тому просто всім)
  const data = new TextEncoder().encode(JSON.stringify(msgObj));
  for (const char of chatCharacteristics) {
    char.writeValue(data).catch(()=>{});
  }
}

sendBtn.onclick = async () => {
  if (!chatCharacteristics.length) return;
  const msg = msgInput.value;
  if (!msg) return;
  const msgObj = {
    id: generateMsgId(),
    text: msg,
    from: 'Ви'
  };
  seenMessages.add(msgObj.id);
  addMessage('Ви: ' + msg);
  const data = new TextEncoder().encode(JSON.stringify(msgObj));
  for (const char of chatCharacteristics) {
    await char.writeValue(data).catch(()=>{});
  }
  msgInput.value = '';
};

function addMessage(text) {
  const div = document.createElement('div');
  div.textContent = text;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
} 