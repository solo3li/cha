"use strict";

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

let activeChatId = null;

connection.on("ReceiveMessage", function (chatId, userId, displayName, avatarUrl, message, timestamp) {
    if (activeChatId == chatId) {
        appendMessage(userId, displayName, avatarUrl, message, timestamp);
        scrollToBottom();
    }
    
    // Update sidebar latest message
    const chatItem = document.querySelector(`.chat-item[data-chat-id='${chatId}']`);
    if (chatItem) {
        const preview = chatItem.querySelector('p');
        preview.textContent = userId === currentUserId ? `You: ${message}` : message;
        
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
                await connection.invoke("SendMessage", chatId, message);
                input.value = '';
                input.focus();
            } catch (err) {
                console.error(err);
            }
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
            appendMessage(m.userId, m.displayName, m.avatarUrl, m.content, m.timestamp);
        });
        
        scrollToBottom();
    }
}

function appendMessage(userId, displayName, avatarUrl, content, timestamp) {
    const messagesContainer = document.getElementById('chatMessages');
    const isMine = userId === currentUserId;
    
    const timeString = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
    const finalAvatar = avatarUrl || fallbackAvatar;

    const div = document.createElement('div');
    div.className = `message-container ${isMine ? 'mine' : 'other'}`;
    
    if (isMine) {
        div.innerHTML = `
            <div class="message message-mine">${escapeHtml(content)}</div>
            <div class="message-time">${timeString}</div>
        `;
    } else {
        div.innerHTML = `
            <div class="message-avatar-container">
                <img src="${finalAvatar}" class="message-avatar" title="${escapeHtml(displayName)}" />
                <div class="message message-other">${escapeHtml(content)}</div>
            </div>
            <div class="message-time">${timeString}</div>
        `;
    }
    
    messagesContainer.appendChild(div);
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
