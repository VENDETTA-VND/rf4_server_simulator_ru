using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
namespace RF4FriendLauncher;
public sealed class AccountService
{
 readonly HttpClient http=new(){Timeout=TimeSpan.FromSeconds(20)};
 public Task<LoginResponse> RegisterAsync(string u,string p)=>Send("register",u,p);
 public Task<LoginResponse> LoginAsync(string u,string p)=>Send("login",u,p);
 async Task<LoginResponse> Send(string action,string u,string p)
 {
  using var r=await http.PostAsJsonAsync("https://api.rf4game.ru/account/"+action,new{username=u,password=p});
  var raw=await r.Content.ReadAsStringAsync();
  if(!r.IsSuccessStatusCode) throw new InvalidOperationException("HTTP "+(int)r.StatusCode+": "+raw);
  var x=JsonSerializer.Deserialize<LoginResponse>(raw,new JsonSerializerOptions{PropertyNameCaseInsensitive=true});
  if(x is null||!x.Ok||string.IsNullOrWhiteSpace(x.LoginToken)) throw new InvalidOperationException("Сервер не выдал игровой токен.");
  return x;
 }
}
public static class PasswordProtection
{
 static readonly byte[] Entropy=Encoding.UTF8.GetBytes("RF4-Friend-Launcher-v1");
 public static string Protect(string s){if(string.IsNullOrEmpty(s))return "";return Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(s),Entropy,DataProtectionScope.CurrentUser));}
 public static string Unprotect(string s){try{return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(s),Entropy,DataProtectionScope.CurrentUser));}catch{return "";}}
}
