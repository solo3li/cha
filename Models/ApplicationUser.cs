using Microsoft.AspNetCore.Identity;

namespace cha.Models;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public ICollection<ChatUser> ChatUsers { get; set; } = new List<ChatUser>();
}
