using System.Text;
using System.Text.Json;
namespace RF4FriendLauncher;
public static class SessionService
{
 public static void Save(string user,string token,long ts)
 {
  var dir=System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"RussianFishingLLC","RussianFishing4");
  Directory.CreateDirectory(dir);
  var path=System.IO.Path.Combine(dir,"Session.dat");
  var version="4.0.25034";
  try{if(File.Exists(path)){using var d=JsonDocument.Parse(File.ReadAllText(path));if(d.RootElement.TryGetProperty("version",out var v))version=v.GetString()??version;}}catch{}
  var json=JsonSerializer.Serialize(new Dictionary<string,object>{{"version",version},{"login",user},{"login_token",token},{"token_timestamp",ts}});
  File.WriteAllText(path+".tmp",json,new UTF8Encoding(false)); File.Move(path+".tmp",path,true);
 }
}
