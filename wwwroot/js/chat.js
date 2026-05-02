"use strict";

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

let activeChatId = null;

connection.on("ReceiveMessage", function (chatId, userId, displayName, avatarUrl, message, audioUrl, imageUrl, timestamp) {
    if (activeChatId == chatId) {
        appendMessage(userId, displayName, avatarUrl, message, audioUrl, imageUrl, timestamp);
        scrollToBottom(true);
    }
    
    // Update sidebar latest message
    const chatItem = document.querySelector(`.chat-item[data-chat-id='${chatId}']`);
    if (chatItem) {
        const preview = chatItem.querySelector('p');
        let displayMsg = message;
        if (audioUrl) displayMsg = "🎤 Voice message";
        else if (imageUrl) displayMsg = "🖼️ Image";
        preview.textContent = userId === currentUserId ? `You: ${displayMsg}` : displayMsg;
        
        // Move to top
        const chatList = document.querySelector('.chat-list');
        chatList.prepend(chatItem);
    }
});

connection.start().then(function () {
    console.log("Connected to SignalR hub");
}).catch(function (err) {
    return console.error(err.toString());
});

document.addEventListener("DOMContentLoaded", () => {
    const chatItems = document.querySelectorAll('.chat-item');
    const mainChat = document.querySelector('.main-chat');
    
    chatItems.forEach(item => {
        item.addEventListener('click', async () => {
            chatItems.forEach(c => c.classList.remove('active'));
            item.classList.add('active');
            
            const chatId = item.getAttribute('data-chat-id');
            const chatName = item.querySelector('h6').textContent;
            const chatAvatar = item.querySelector('img').src;
            
            await loadChat(chatId, chatName, chatAvatar);
        });
    });

    document.getElementById('messageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        const chatId = document.getElementById('currentChatId').value;
        
        if (message && chatId) {
            try {
                await connection.invoke("SendMessage", chatId, message, null, null);
                input.value = '';
                input.focus();
            } catch (err) {
                console.error(err);
            }
        }
    });

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let recordingTimerInterval;
    let recordingSeconds = 0;

    document.getElementById('recordButton').addEventListener('click', async () => {
        const input = document.getElementById('messageInput');
        
        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            document.getElementById('recordButton').classList.remove('recording-active');
            input.disabled = false;
            input.placeholder = "Type a message...";
            clearInterval(recordingTimerInterval);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioChunks = [];
                
                // Upload to server
                const formData = new FormData();
                formData.append('audioFile', audioBlob, 'voice.webm');
                
                const response = await fetch('/Chat/UploadAudio', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const chatId = document.getElementById('currentChatId').value;
                        if (chatId) {
                            try {
                                await connection.invoke("SendMessage", chatId, "", data.audioUrl, null);
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }
                }
            };

            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            document.getElementById('recordButton').classList.add('recording-active');
            
            input.disabled = true;
            recordingSeconds = 0;
            input.placeholder = "Recording... 0s";
            
            recordingTimerInterval = setInterval(() => {
                recordingSeconds++;
                input.placeholder = `Recording... ${recordingSeconds}s`;
            }, 1000);
            
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone.');
        }
    });

    // Image Upload Logic
    document.getElementById('imageButton').addEventListener('click', () => {
        document.getElementById('imageInput').click();
    });

    document.getElementById('imageInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const chatId = document.getElementById('currentChatId').value;
        if (!chatId) return;

        const formData = new FormData();
        formData.append('imageFile', file);

        try {
            const response = await fetch('/Chat/UploadImage', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    await connection.invoke("SendMessage", chatId, "", null, data.imageUrl);
                }
            }
        } catch (err) {
            console.error('Error uploading image:', err);
        } finally {
            e.target.value = ''; // Reset input
        }
    });
});

async function loadChat(chatId, name, avatarUrl) {
    if (activeChatId) {
        try {
            await connection.invoke("LeaveChat", activeChatId);
        } catch (err) { console.error(err); }
    }
    
    activeChatId = chatId;
    document.getElementById('currentChatId').value = chatId;
    
    document.getElementById('activeChatName').textContent = name;
    document.getElementById('activeChatAvatar').src = avatarUrl;
    
    const mainChat = document.querySelector('.main-chat');
    mainChat.classList.remove('d-none');
    
    // Join SignalR group
    try {
        await connection.invoke("JoinChat", chatId);
    } catch (err) { console.error(err); }

    // Load message history
    const response = await fetch(`/Chat/GetMessages?chatId=${chatId}`);
    if (response.ok) {
        const messages = await response.json();
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = ''; // Clear
        
        messages.forEach(m => {
            appendMessage(m.userId, m.displayName, m.avatarUrl, m.content, m.audioUrl, m.imageUrl, m.timestamp);
        });
        
        scrollToBottom(false);
    }
}

function appendMessage(userId, displayName, avatarUrl, content, audioUrl, imageUrl, timestamp) {
    const messagesContainer = document.getElementById('chatMessages');
    const isMine = userId === currentUserId;
    
    const timeString = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
    const finalAvatar = avatarUrl || fallbackAvatar;

    const div = document.createElement('div');
    div.className = `message-container ${isMine ? 'mine' : 'other'}`;
    
    let contentHtml = '';
    let paddingClass = '';
    
    if (imageUrl) {
        contentHtml = `<img src="${imageUrl}" class="message-image" alt="Image message" loading="lazy" />`;
        paddingClass = 'p-1'; // Less padding for images
    } else if (audioUrl) {
        // Custom audio player UI
        contentHtml = `
            <div class="custom-audio-player d-flex align-items-center gap-2 ${isMine ? 'mine' : 'other'}" data-audio-src="${audioUrl}">
                <button class="btn play-pause-btn shadow-sm" onclick="toggleAudio(this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-play-fill play-icon" viewBox="0 0 16 16">
                      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-pause-fill pause-icon d-none" viewBox="0 0 16 16">
                      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                    </svg>
                </button>
                <div class="audio-progress flex-grow-1" onclick="seekAudio(event, this)">
                    <div class="audio-progress-bar"></div>
                </div>
                <audio class="d-none message-audio-element" ontimeupdate="updateAudioProgress(this)" onended="resetAudioPlayer(this)"></audio>
            </div>
        `;
        paddingClass = 'p-2';
    } else if (content) {
        contentHtml = escapeHtml(content);
    }
    
    if (isMine) {
        div.innerHTML = `
            <div class="message message-mine ${paddingClass}">${contentHtml}</div>
            <div class="message-time">${timeString}</div>
        `;
    } else {
        div.innerHTML = `
            <div class="message-avatar-container">
                <img src="${finalAvatar}" class="message-avatar" title="${escapeHtml(displayName)}" />
                <div class="message message-other ${paddingClass}">${contentHtml}</div>
            </div>
            <div class="message-time">${timeString}</div>
        `;
    }
    
    messagesContainer.appendChild(div);
}

window.toggleAudio = function(btn) {
    const playerContainer = btn.closest('.custom-audio-player');
    const audioSrc = playerContainer.getAttribute('data-audio-src');
    const audioEl = playerContainer.querySelector('.message-audio-element');
    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');

    // Pause all other playing audios
    document.querySelectorAll('.message-audio-element').forEach(el => {
        if (el !== audioEl && !el.paused) {
            el.pause();
            const otherBtn = el.closest('.custom-audio-player').querySelector('.play-pause-btn');
            otherBtn.querySelector('.play-icon').classList.remove('d-none');
            otherBtn.querySelector('.pause-icon').classList.add('d-none');
        }
    });

    if (!audioEl.src || !audioEl.src.includes(audioSrc)) {
        audioEl.src = audioSrc;
    }

    if (audioEl.paused) {
        audioEl.play();
        playIcon.classList.add('d-none');
        pauseIcon.classList.remove('d-none');
    } else {
        audioEl.pause();
        playIcon.classList.remove('d-none');
        pauseIcon.classList.add('d-none');
    }
};

window.updateAudioProgress = function(audioEl) {
    const playerContainer = audioEl.closest('.custom-audio-player');
    const progressBar = playerContainer.querySelector('.audio-progress-bar');
    if (audioEl.duration) {
        const percent = (audioEl.currentTime / audioEl.duration) * 100;
        progressBar.style.width = percent + '%';
    }
};

window.seekAudio = function(e, progressContainer) {
    const audioEl = progressContainer.closest('.custom-audio-player').querySelector('.message-audio-element');
    if (!audioEl.src) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    
    if (audioEl.duration) {
        audioEl.currentTime = percent * audioEl.duration;
    }
};

window.resetAudioPlayer = function(audioEl) {
    const playerContainer = audioEl.closest('.custom-audio-player');
    const btn = playerContainer.querySelector('.play-pause-btn');
    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');
    const progressBar = playerContainer.querySelector('.audio-progress-bar');
    
    playIcon.classList.remove('d-none');
    pauseIcon.classList.add('d-none');
    progressBar.style.width = '0%';
};

function scrollToBottom(smooth = true) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

async function startChat(userId) {
    const response = await fetch('/Chat/CreateChat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `targetUserId=${userId}`
    });
    
    if (response.ok) {
        const data = await response.json();
        if (data.success) {
            // Close modal
            var modal = bootstrap.Modal.getInstance(document.getElementById('newChatModal'));
            modal.hide();
            // Reload page to reflect new chat in sidebar (simple approach)
            window.location.reload();
        }
    }
}

async function addUserToChat(userId) {
    if (!activeChatId) return;

    const response = await fetch('/Chat/AddUserToChat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `chatId=${activeChatId}&targetUserId=${userId}`
    });
    
    if (response.ok) {
        const data = await response.json();
        if (data.success) {
            var modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
            modal.hide();
            window.location.reload(); // Quick refresh to update chat name if it converted to a group
        } else {
            alert(data.message || 'Failed to add user.');
        }
    }
}
