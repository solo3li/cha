using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using cha.Data;
using cha.Models;
using System.Security.Claims;

namespace cha.Hubs;

public class ChatHub : Hub
{
    private readonly ApplicationDbContext _context;

    public ChatHub(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task SendMessage(string chatId, string message, string? audioUrl = null, string? imageUrl = null)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return;

        var chatUser = await _context.ChatUsers.FirstOrDefaultAsync(cu => cu.ChatId == chatId && cu.UserId == userId);
        if (chatUser == null) return; // User not in this chat

        var newMessage = new Message
        {
            ChatId = chatId,
            UserId = userId,
            Content = message,
            AudioUrl = audioUrl,
            ImageUrl = imageUrl,
            Timestamp = DateTime.UtcNow
        };

        _context.Messages.Add(newMessage);
        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(userId);
        
        await Clients.Group(chatId).SendAsync("ReceiveMessage", chatId, userId, user?.DisplayName ?? user?.UserName, user?.AvatarUrl, message, audioUrl, imageUrl, newMessage.Timestamp);
    }

    public async Task JoinChat(string chatId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return;

        var chatUser = await _context.ChatUsers.FirstOrDefaultAsync(cu => cu.ChatId == chatId && cu.UserId == userId);
        if (chatUser != null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
        }
    }

    public async Task LeaveChat(string chatId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, chatId);
    }

    // WebRTC Signaling
    public async Task InitiateCall(string targetUserId, string chatId, string callerName, string callerAvatar, string offer)
    {
        var callerId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerId == null) return;
        await Clients.User(targetUserId).SendAsync("ReceiveCall", callerId, chatId, callerName, callerAvatar, offer);
    }

    public async Task AcceptCall(string targetUserId, string answer)
    {
        var responderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (responderId == null) return;
        await Clients.User(targetUserId).SendAsync("CallAccepted", responderId, answer);
    }

    public async Task RejectCall(string targetUserId)
    {
        var responderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (responderId == null) return;
        await Clients.User(targetUserId).SendAsync("CallRejected", responderId);
    }

    public async Task SendIceCandidate(string targetUserId, string candidate)
    {
        var senderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (senderId == null) return;
        await Clients.User(targetUserId).SendAsync("ReceiveIceCandidate", senderId, candidate);
    }

    public async Task EndCall(string targetUserId)
    {
        var senderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (senderId == null) return;
        await Clients.User(targetUserId).SendAsync("CallEnded", senderId);
    }
}
