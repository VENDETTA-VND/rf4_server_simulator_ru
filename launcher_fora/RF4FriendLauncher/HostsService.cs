using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
namespace RF4FriendLauncher;
public sealed class HostsService
{
 const string Marker="# rf4-friend-launcher";
 readonly string path=System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","drivers","etc","hosts");
 static readonly string[] Domains={"api.rf4game.ru","api.rf4game.com"};
 public void SetServer(string ip){if(!IPAddress.TryParse(ip.Trim(),out var a)||a.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork)throw new InvalidOperationException("Укажи корректный IPv4-адрес сервера.");Update(Domains.Select(d=>ip.Trim()+"\t"+d+" "+Marker).ToArray());Flush();}
 public void SetOfficial(){Update(Array.Empty<string>());Flush();}
 public bool Active(){if(!File.Exists(path))return false;var i=Info();return Regex.IsMatch(File.ReadAllText(path,i.enc),@"^\s*\d{1,3}(?:\.\d{1,3}){3}\s+api\.rf4game\.(?:ru|com)\s+# rf4-friend-launcher\s*$",RegexOptions.Multiline);}
 void Update(string[] add){var i=Info();var lines=Regex.Split(File.ReadAllText(path,i.enc),"\r\n|\n|\r").ToList();lines.RemoveAll(x=>Regex.IsMatch(x,@"^\s*\d{1,3}(?:\.\d{1,3}){3}\s+api\.rf4game\.(?:ru|com)\s+# rf4-friend-launcher\s*$"));if(i.end&&lines.Count>0&&lines[^1]=="")lines.RemoveAt(lines.Count-1);lines.AddRange(add);var s=string.Join(i.nl,lines);if(i.end||add.Length>0)s+=i.nl;File.WriteAllText(path,s,i.enc);}
 (Encoding enc,string nl,bool end) Info(){var b=File.ReadAllBytes(path);Encoding e=Encoding.Default;if(b.Length>=3&&b[0]==239&&b[1]==187&&b[2]==191)e=new UTF8Encoding(true);else if(b.Length>=2&&b[0]==255&&b[1]==254)e=Encoding.Unicode;else if(b.Length>=2&&b[0]==254&&b[1]==255)e=Encoding.BigEndianUnicode;var s=File.ReadAllText(path,e);return(e,s.Contains("\r\n")?"\r\n":s.Contains("\n")?"\n":s.Contains("\r")?"\r":Environment.NewLine,s.EndsWith("\n")||s.EndsWith("\r"));}
 static void Flush(){using var p=Process.Start(new ProcessStartInfo("ipconfig.exe","/flushdns"){CreateNoWindow=true,UseShellExecute=false});p?.WaitForExit(5000);}
}
