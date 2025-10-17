const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const engineEl = document.getElementById('engineSelect');
const langEl = document.getElementById('languageSelect');
const recordBtn = document.getElementById('recordBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const textInput = document.getElementById('textInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const audioPlayer = document.getElementById('audioPlayer');

let mediaRecorder = null;
let chunks = [];
let isRecording = false;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function addMsg(who, text) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<span class="who">${who}:</span> ${text}`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

recordBtn.addEventListener('click', async () => {
  try {
    if (!isRecording) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await sendAudio(blob, 'webm');
      };
      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = '⏹ Stop';
      setStatus('Recording...');
    } else {
      mediaRecorder.stop();
      isRecording = false;
      recordBtn.textContent = 'Record';
      setStatus('Processing...');
    }
  } catch (e) {
    console.error(e);
    setStatus('Microphone error');
  }
});

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fmt = file.name.endsWith('.wav') ? 'wav' : 'webm';
  await sendAudio(file, fmt);
});

async function sendAudio(blob, fmt) {
  try {
    const form = new FormData();
    form.append('audio_file', blob, `audio.${fmt}`);
    if (engineEl.value === 'sarvam') {
      form.append('language', langEl.value);
    }
    const url = engineEl.value === 'sarvam' ? '/api/v1/ai-test/sarvam/stt' : '/api/v1/ai-test/deepgram/stt';
    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json();
    addMsg('Transcript', data.transcript || '(empty)');

    // Reason with OpenAI
    const reasonForm = new FormData();
    reasonForm.append('text', data.transcript || '');
    const reasonRes = await fetch('/api/v1/ai-test/openai/reason', { method: 'POST', body: reasonForm });
    const reasonData = await reasonRes.json();
    const answer = reasonData.response || '';
    addMsg('OpenAI', answer);

    // TTS
    if (engineEl.value === 'sarvam' && langEl.value !== 'en-IN') {
      await playStream('/api/v1/ai-test/sarvam/tts', { text: answer, language: langEl.value });
    } else {
      await playStream('/api/v1/ai-test/deepgram/tts', { text: answer, voice: 'aura-kathleen-en' });
    }
    setStatus('Ready');
  } catch (e) {
    console.error(e);
    setStatus('Error');
  }
}

sendTextBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  if (!text) return;
  addMsg('You', text);

  const reasonForm = new FormData();
  reasonForm.append('text', text);
  const reasonRes = await fetch('/api/v1/ai-test/openai/reason', { method: 'POST', body: reasonForm });
  const reasonData = await reasonRes.json();
  const answer = reasonData.response || '';
  addMsg('OpenAI', answer);

  if (engineEl.value === 'sarvam' && langEl.value !== 'en-IN') {
    await playStream('/api/v1/ai-test/sarvam/tts', { text: answer, language: langEl.value });
  } else {
    await playStream('/api/v1/ai-test/deepgram/tts', { text: answer, voice: 'aura-kathleen-en' });
  }
});

async function playStream(url, fields) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  const res = await fetch(url, { method: 'POST', body: form });
  const buf = await res.arrayBuffer();
  const blob = new Blob([buf], { type: 'audio/wav' });
  audioPlayer.src = URL.createObjectURL(blob);
  audioPlayer.play().catch(() => {});
}

setStatus('Ready');

