using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using cha.Data;
using cha.Models;

namespace cha.Controllers;

[Authorize]
public class ChatController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IWebHostEnvironment _env;

    public ChatController(ApplicationDbContext context, UserManager<ApplicationUser> userManager, IWebHostEnvironment env)
    {
        _context = context;
        _userManager = userManager;
        _env = env;
    }

    public async Task<IActionResult> Index()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        var chats = await _context.ChatUsers
            .Where(cu => cu.UserId == user.Id)
            .Include(cu => cu.Chat)
                .ThenInclude(c => c.ChatUsers)
                    .ThenInclude(cu => cu.User)
            .Include(cu => cu.Chat)
                .ThenInclude(c => c.Messages.OrderByDescending(m => m.Timestamp).Take(1))
            .Select(cu => cu.Chat)
            .ToListAsync();

        ViewBag.CurrentUser = user;
        
        // Also pass list of all users to start new chat
        ViewBag.AllUsers = await _context.Users.Where(u => u.Id != user.Id).ToListAsync();

        return View(chats);
    }

    [HttpPost]
    public async Task<IActionResult> CreateChat(string targetUserId)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null || string.IsNullOrEmpty(targetUserId)) return BadRequest();

        // Check if chat already exists
        var existingChat = await _context.Chats
            .Where(c => !c.IsGroup)
            .Where(c => c.ChatUsers.Any(cu => cu.UserId == currentUser.Id) && c.ChatUsers.Any(cu => cu.UserId == targetUserId))
            .FirstOrDefaultAsync();

        if (existingChat != null)
        {
            return Json(new { success = true, chatId = existingChat.Id });
        }

        var chat = new Chat { IsGroup = false };
        _context.Chats.Add(chat);
        await _context.SaveChangesAsync();

        _context.ChatUsers.Add(new ChatUser { ChatId = chat.Id, UserId = currentUser.Id });
        _context.ChatUsers.Add(new ChatUser { ChatId = chat.Id, UserId = targetUserId });
        await _context.SaveChangesAsync();

        return Json(new { success = true, chatId = chat.Id });
    }

    [HttpGet]
    public async Task<IActionResult> GetMessages(string chatId)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null) return Unauthorized();

        var isMember = await _context.ChatUsers.AnyAsync(cu => cu.ChatId == chatId && cu.UserId == currentUser.Id);
        if (!isMember) return Forbid();

        var messages = await _context.Messages
            .Where(m => m.ChatId == chatId)
            .Include(m => m.User)
            .OrderBy(m => m.Timestamp)
            .Select(m => new {
                id = m.Id,
                content = m.Content,
                audioUrl = m.AudioUrl,
                imageUrl = m.ImageUrl,
                timestamp = m.Timestamp,
                userId = m.UserId,
                displayName = m.User.DisplayName ?? m.User.UserName,
                avatarUrl = m.User.AvatarUrl,
                isMine = m.UserId == currentUser.Id
            })
            .ToListAsync();

        return Json(messages);
    }

    [HttpPost]
    public async Task<IActionResult> AddUserToChat(string chatId, string targetUserId)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null || string.IsNullOrEmpty(targetUserId)) return BadRequest();

        var chat = await _context.Chats
            .Include(c => c.ChatUsers)
            .FirstOrDefaultAsync(c => c.Id == chatId);

        if (chat == null) return NotFound();

        if (!chat.ChatUsers.Any(cu => cu.UserId == currentUser.Id)) return Forbid();

        if (chat.ChatUsers.Any(cu => cu.UserId == targetUserId)) 
            return Json(new { success = false, message = "User already in chat" });

        if (!chat.IsGroup)
        {
            chat.IsGroup = true;
            chat.Name = "Group Chat";
        }

        _context.ChatUsers.Add(new ChatUser { ChatId = chat.Id, UserId = targetUserId });
        await _context.SaveChangesAsync();

        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> UploadImage(IFormFile imageFile)
    {
        if (imageFile == null || imageFile.Length == 0)
        {
            return BadRequest("Invalid image file.");
        }

        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "images");
        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        var uniqueFileName = Guid.NewGuid().ToString() + Path.GetExtension(imageFile.FileName);
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await imageFile.CopyToAsync(stream);
        }

        var imageUrl = $"/uploads/images/{uniqueFileName}";
        return Json(new { success = true, imageUrl });
    }

    [HttpPost]
    public async Task<IActionResult> UploadAudio(IFormFile audioFile)
    {
        if (audioFile == null || audioFile.Length == 0)
        {
            return BadRequest("Invalid audio file.");
        }

        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        var uniqueFileName = Guid.NewGuid().ToString() + ".webm";
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await audioFile.CopyToAsync(stream);
        }

        var audioUrl = $"/uploads/{uniqueFileName}";
        return Json(new { success = true, audioUrl });
    }
}
