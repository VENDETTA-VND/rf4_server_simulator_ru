using System.Text.Json.Serialization;
namespace RF4FriendLauncher;
public sealed class LauncherConfig
{
 [JsonPropertyName("server_ip")] public string ServerIp {get;set;}="";
 [JsonPropertyName("game_path")] public string GamePath {get;set;}="";
 [JsonPropertyName("game_region")] public string GameRegion {get;set;}="CN";
 [JsonPropertyName("account_username")] public string AccountUsername {get;set;}="";
 [JsonPropertyName("account_password_protected")] public string AccountPasswordProtected {get;set;}="";
 [JsonPropertyName("account_uid")] public long AccountUid {get;set;}
 [JsonPropertyName("auto_login")] public bool AutoLogin {get;set;}=true;
}
public sealed class LoginResponse
{
 [JsonPropertyName("ok")] public bool Ok {get;set;}
 [JsonPropertyName("uid")] public long Uid {get;set;}
 [JsonPropertyName("login_token")] public string LoginToken {get;set;}="";
 [JsonPropertyName("token_timestamp")] public long TokenTimestamp {get;set;}
}
