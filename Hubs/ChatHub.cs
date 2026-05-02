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

    public async Task SendMessage(string chatId, string message)
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
            Timestamp = DateTime.UtcNow
        };

        _context.Messages.Add(newMessage);
        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(userId);
        
        await Clients.Group(chatId).SendAsync("ReceiveMessage", chatId, userId, user?.DisplayName ?? user?.UserName, user?.AvatarUrl, message, newMessage.Timestamp);
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
}
