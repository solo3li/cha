using System.ComponentModel.DataAnnotations;

namespace cha.Models;

public class Message
{
    public int Id { get; set; }
    public string? Content { get; set; }
    public string? AudioUrl { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public string ChatId { get; set; } = string.Empty;
    public Chat Chat { get; set; } = null!;
}
