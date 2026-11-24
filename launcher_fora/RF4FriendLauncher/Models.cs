namespace RF4FriendLauncher;
public sealed class LauncherConfig
{
 public string ServerIp {get;set;}="";
 public string GamePath {get;set;}="";
 public string GameRegion {get;set;}="CN";
 public string AccountUsername {get;set;}="";
 public string AccountPasswordProtected {get;set;}="";
 public long AccountUid {get;set;}
 public bool AutoLogin {get;set;}=true;
}
public sealed class LoginResponse
{
 public bool Ok {get;set;}
 public long Uid {get;set;}
 public string LoginToken {get;set;}="";
 public long TokenTimestamp {get;set;}
}
