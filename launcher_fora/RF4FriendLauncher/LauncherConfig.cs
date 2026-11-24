using System.Text;
using System.Text.Json;
namespace RF4FriendLauncher;
public static class ConfigService
{
 public static string Path => System.IO.Path.Combine(AppContext.BaseDirectory,"config.json");
 public static LauncherConfig Load()
 {
  if(!File.Exists(Path)) return new LauncherConfig();
  try{return JsonSerializer.Deserialize<LauncherConfig>(File.ReadAllText(Path),new JsonSerializerOptions{PropertyNameCaseInsensitive=true})??new LauncherConfig();}catch{return new LauncherConfig();}
 }
 public static void Save(LauncherConfig c){File.WriteAllText(Path,JsonSerializer.Serialize(c,new JsonSerializerOptions{WriteIndented=true}),new UTF8Encoding(false));}
}
