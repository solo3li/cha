using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using cha.Models;

namespace cha.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        await context.Database.MigrateAsync();

        if (await userManager.Users.AnyAsync())
        {
            return; // DB has been seeded
        }

        var users = new List<ApplicationUser>
        {
            new() { UserName = "john@test.com", Email = "john@test.com", DisplayName = "John Doe", AvatarUrl = "https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff" },
            new() { UserName = "jane@test.com", Email = "jane@test.com", DisplayName = "Jane Smith", AvatarUrl = "https://ui-avatars.com/api/?name=Jane+Smith&background=F00&color=fff" },
            new() { UserName = "bob@test.com", Email = "bob@test.com", DisplayName = "Bob Builder", AvatarUrl = "https://ui-avatars.com/api/?name=Bob+Builder&background=0F0&color=fff" },
            new() { UserName = "alice@test.com", Email = "alice@test.com", DisplayName = "Alice Wonderland", AvatarUrl = "https://ui-avatars.com/api/?name=Alice+Wonderland&background=00F&color=fff" }
        };

        foreach (var user in users)
        {
            await userManager.CreateAsync(user, "Password123!");
        }

        var chat = new Chat { IsGroup = false, Id = Guid.NewGuid().ToString() };
        context.Chats.Add(chat);

        context.ChatUsers.Add(new ChatUser { ChatId = chat.Id, UserId = users[0].Id });
        context.ChatUsers.Add(new ChatUser { ChatId = chat.Id, UserId = users[1].Id });

        var msg = new Message
        {
            ChatId = chat.Id,
            UserId = users[0].Id,
            Content = "Hey Jane, how are you doing?",
            Timestamp = DateTime.UtcNow.AddMinutes(-5)
        };
        context.Messages.Add(msg);

        var msg2 = new Message
        {
            ChatId = chat.Id,
            UserId = users[1].Id,
            Content = "I'm doing well John, thanks!",
            Timestamp = DateTime.UtcNow.AddMinutes(-4)
        };
        context.Messages.Add(msg2);

        await context.SaveChangesAsync();
    }
}
