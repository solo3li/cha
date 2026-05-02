namespace cha.Models;

public class ChatUser
{
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public string ChatId { get; set; } = string.Empty;
    public Chat Chat { get; set; } = null!;
}
