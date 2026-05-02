using System.ComponentModel.DataAnnotations;

namespace cha.Models;

public class Chat
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? Name { get; set; } // Can be null for 1-to-1 chats
    public bool IsGroup { get; set; }
    public ICollection<ChatUser> ChatUsers { get; set; } = new List<ChatUser>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
