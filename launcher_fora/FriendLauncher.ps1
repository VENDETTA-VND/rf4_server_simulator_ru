# RF4 Friend Launcher — клиентский лаунчер. Не запускает серверные службы.
# Требуется Windows PowerShell 5.1+ и права администратора для изменения hosts.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:ConfigPath = Join-Path $script:Root 'config.json'
$script:HostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$script:Domains = @('api.rf4game.ru', 'api.rf4game.com')
$script:Marker = '# rf4-friend-launcher'

# Поднимаем права до показа окна, иначе запись hosts завершится отказом в доступе.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $args = '-NoProfile -ExecutionPolicy Bypass -File "' + $MyInvocation.MyCommand.Path + '"'
    Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Verb RunAs
    exit
}

$script:Cfg = @{ server_ip = ''; game_path = ''; game_region = 'CN' }
if (Test-Path $script:ConfigPath) {
    try {
        $loaded = Get-Content -LiteralPath $script:ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($loaded.server_ip) { $script:Cfg.server_ip = [string]$loaded.server_ip }
        if ($loaded.game_path) { $script:Cfg.game_path = [string]$loaded.game_path }
        if ($loaded.game_region) { $script:Cfg.game_region = [string]$loaded.game_region }
    } catch { [System.Windows.Forms.MessageBox]::Show("Не удалось прочитать config.json: $($_.Exception.Message)", 'RF4 Friend Launcher') | Out-Null }
}

function Save-Config {
    $script:Cfg.server_ip = $ipBox.Text.Trim()
    $script:Cfg.game_path = $gameBox.Text.Trim()
    $script:Cfg.game_region = $regionBox.Text.Trim()
    $script:Cfg | ConvertTo-Json | Set-Content -LiteralPath $script:ConfigPath -Encoding UTF8
}
function Save-GameSession {
    param([string]$Username, [string]$LoginToken, [long]$TokenTimestamp)
    $sessionDir = Join-Path $env:APPDATA 'RussianFishingLLC\RussianFishing4'
    if (-not (Test-Path -LiteralPath $sessionDir)) {
        New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null
    }
    $sessionPath = Join-Path $sessionDir 'Session.dat'
    $version = '4.0.25034'
    if (Test-Path -LiteralPath $sessionPath) {
        try {
            $oldSession = Get-Content -LiteralPath $sessionPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($oldSession.version) { $version = [string]$oldSession.version }
        } catch { }
    }
    $session = [ordered]@{
        version = $version
        login = $Username
        login_token = $LoginToken
        token_timestamp = $TokenTimestamp
    }
    $tmp = $sessionPath + '.tmp'
    $session | ConvertTo-Json | Set-Content -LiteralPath $tmp -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $sessionPath -Force
}
function Invoke-AccountAction {
    param([ValidateSet('register','login')][string]$Action)
    $username = $usernameBox.Text.Trim()
    $password = $passwordBox.Text
    if ([string]::IsNullOrWhiteSpace($username) -or [string]::IsNullOrEmpty($password)) {
        throw 'Введи имя аккаунта и пароль.'
    }
    $body = @{ username = $username; password = $password } | ConvertTo-Json -Compress
    $uri = "https://api.rf4game.ru/account/$Action"
    try {
        $result = Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 20
    } catch {
        throw "Не удалось выполнить $Action. Проверь адрес сервера, HTTPS-сертификат и доступность API. $($_.Exception.Message)"
    }
    if (-not $result.ok -or [string]::IsNullOrWhiteSpace([string]$result.login_token)) {
        throw 'Сервер не выдал игровой токен.'
    }
    Save-GameSession -Username $username -LoginToken ([string]$result.login_token) -TokenTimestamp ([long]$result.token_timestamp)
    $passwordBox.Clear()
    $statusLabel.Text = "Аккаунт '$username' авторизован (UID $($result.uid)); токен сохранён."
}
function Get-HostsTextInfo {
    if (-not (Test-Path -LiteralPath $script:HostsPath)) { throw "Не найден hosts: $script:HostsPath" }
    $bytes = [IO.File]::ReadAllBytes($script:HostsPath)
    # Сохраняем исходную кодировку (включая BOM), чтобы не перекодировать
    # пользовательский hosts-файл при переключении режима.
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $encoding = New-Object System.Text.UTF8Encoding($true)
    } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $encoding = [System.Text.Encoding]::Unicode
    } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $encoding = [System.Text.Encoding]::BigEndianUnicode
    } else {
        $encoding = [System.Text.Encoding]::Default
    }
    $content = [IO.File]::ReadAllText($script:HostsPath, $encoding)
    $newline = [Environment]::NewLine
    if ($content -match "`r`n") { $newline = "`r`n" }
    elseif ($content -match "`n") { $newline = "`n" }
    elseif ($content -match "`r") { $newline = "`r" }
    return [pscustomobject]@{
        Content = $content
        Encoding = $encoding
        Newline = $newline
        EndsWithNewline = ($content.EndsWith("`n") -or $content.EndsWith("`r"))
    }
}
function Get-HostsLines {
    $info = Get-HostsTextInfo
    return ,([regex]::Split($info.Content, "`r`n|`n|`r"))
}
function Update-OwnedHostsEntries {
    param([string[]]$AddLines)
    $info = Get-HostsTextInfo
    $lines = New-Object 'System.Collections.Generic.List[string]'
    foreach ($line in ([regex]::Split($info.Content, "`r`n|`n|`r"))) {
        # Удаляем исключительно строки, созданные этим лаунчером:
        # IP + один из двух доменов + точный маркер в конце строки.
        # Любые другие строки, даже содержащие похожий текст, остаются без изменений.
        if ($line -notmatch '^\s*\d{1,3}(?:\.\d{1,3}){3}\s+api\.rf4game\.(?:ru|com)\s+# rf4-friend-launcher\s*$') {
            $lines.Add([string]$line)
        }
    }

    # Если исходный файл заканчивался переводом строки, убираем служебный
    # пустой элемент перед добавлением новых записей, чтобы не плодить пустые строки.
    if ($info.EndsWithNewline -and $lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') {
        $lines.RemoveAt($lines.Count - 1)
    }
    foreach ($line in $AddLines) { $lines.Add([string]$line) }

    $updated = [string]::Join($info.Newline, $lines.ToArray())
    if ($info.EndsWithNewline -or $AddLines.Count -gt 0) { $updated += $info.Newline }
    [IO.File]::WriteAllText($script:HostsPath, $updated, $info.Encoding)
}
function Set-ServerHosts {
    $ip = $ipBox.Text.Trim()
    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse($ip, [ref]$parsed) -or $parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
        throw 'Укажи корректный внешний IPv4-адрес сервера (например, 203.0.113.10).'
    }
    $add = @()
    foreach ($domain in $script:Domains) { $add += "$ip`t$domain $script:Marker" }
    Update-OwnedHostsEntries -AddLines $add
    ipconfig.exe /flushdns | Out-Null
    Save-Config
    $statusLabel.Text = "Режим: мой сервер ($ip)"
}
function Set-OfficialHosts {
    Update-OwnedHostsEntries -AddLines @()
    ipconfig.exe /flushdns | Out-Null
    Save-Config
    $statusLabel.Text = 'Режим: официальная игра (удалены только записи лаунчера)'
}
function Launch-Game {
    $path = $gameBox.Text.Trim().Trim('"')
    if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or [IO.Path]::GetFileName($path) -ine 'rf4_x64.exe') {
        throw 'Выбери существующий файл rf4_x64.exe.'
    }
    $region = $regionBox.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($region)) { $region = 'CN' }
    if ($region -notmatch '^[A-Za-z0-9_-]+$') { throw 'Регион может содержать только латинские буквы, цифры, _ и -.' }
    Save-Config
    Start-Process -FilePath $path -ArgumentList @('-region', $region) -WorkingDirectory (Split-Path -Parent $path)
    $statusLabel.Text = 'Игра запущена. Используется выбранный выше режим подключения.'
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'RF4 — лаунчер для друзей'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(590, 505)
$form.MinimumSize = New-Object System.Drawing.Size(590, 505)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 250)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Подключение к Русскому серверу RF4'
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 15)
$title.Location = New-Object System.Drawing.Point(22, 18)
$title.Size = New-Object System.Drawing.Size(530, 32)
$form.Controls.Add($title)

$ipLabel = New-Object System.Windows.Forms.Label
$ipLabel.Text = 'Внешний IP моего сервера:'
$ipLabel.Location = New-Object System.Drawing.Point(25, 70)
$ipLabel.Size = New-Object System.Drawing.Size(220, 24)
$form.Controls.Add($ipLabel)
$ipBox = New-Object System.Windows.Forms.TextBox
$ipBox.Location = New-Object System.Drawing.Point(250, 67)
$ipBox.Size = New-Object System.Drawing.Size(290, 27)
$ipBox.Text = $script:Cfg.server_ip
$form.Controls.Add($ipBox)

$accountLabel = New-Object System.Windows.Forms.Label
$accountLabel.Text = 'Аккаунт:'
$accountLabel.Location = New-Object System.Drawing.Point(25, 110)
$accountLabel.Size = New-Object System.Drawing.Size(80, 24)
$form.Controls.Add($accountLabel)
$usernameBox = New-Object System.Windows.Forms.TextBox
$usernameBox.Location = New-Object System.Drawing.Point(110, 107)
$usernameBox.Size = New-Object System.Drawing.Size(180, 27)
$usernameBox.PlaceholderText = 'Логин'
$form.Controls.Add($usernameBox)
$passwordBox = New-Object System.Windows.Forms.TextBox
$passwordBox.Location = New-Object System.Drawing.Point(300, 107)
$passwordBox.Size = New-Object System.Drawing.Size(240, 27)
$passwordBox.UseSystemPasswordChar = $true
$passwordBox.PlaceholderText = 'Пароль'
$form.Controls.Add($passwordBox)
$registerButton = New-Object System.Windows.Forms.Button
$registerButton.Text = 'Регистрация'
$registerButton.Location = New-Object System.Drawing.Point(110, 137)
$registerButton.Size = New-Object System.Drawing.Size(180, 25)
$form.Controls.Add($registerButton)
$loginButton = New-Object System.Windows.Forms.Button
$loginButton.Text = 'Войти в аккаунт'
$loginButton.Location = New-Object System.Drawing.Point(300, 137)
$loginButton.Size = New-Object System.Drawing.Size(240, 25)
$form.Controls.Add($loginButton)
$serverButton = New-Object System.Windows.Forms.Button
$serverButton.Text = 'Играть на моём сервере'
$serverButton.Location = New-Object System.Drawing.Point(25, 165)
$serverButton.Size = New-Object System.Drawing.Size(250, 42)
$serverButton.BackColor = [System.Drawing.Color]::FromArgb(35, 110, 190)
$serverButton.ForeColor = [System.Drawing.Color]::White
$serverButton.FlatStyle = 'Flat'
$form.Controls.Add($serverButton)
$officialButton = New-Object System.Windows.Forms.Button
$officialButton.Text = 'Обычная / официальная игра'
$officialButton.Location = New-Object System.Drawing.Point(290, 165)
$officialButton.Size = New-Object System.Drawing.Size(250, 42)
$officialButton.FlatStyle = 'Flat'
$form.Controls.Add($officialButton)

$gameLabel = New-Object System.Windows.Forms.Label
$gameLabel.Text = 'Путь к игре (rf4_x64.exe):'
$gameLabel.Location = New-Object System.Drawing.Point(25, 230)
$gameLabel.Size = New-Object System.Drawing.Size(230, 24)
$form.Controls.Add($gameLabel)
$gameBox = New-Object System.Windows.Forms.TextBox
$gameBox.Location = New-Object System.Drawing.Point(25, 257)
$gameBox.Size = New-Object System.Drawing.Size(420, 27)
$gameBox.Text = $script:Cfg.game_path
$form.Controls.Add($gameBox)
$browseButton = New-Object System.Windows.Forms.Button
$browseButton.Text = 'Обзор…'
$browseButton.Location = New-Object System.Drawing.Point(455, 255)
$browseButton.Size = New-Object System.Drawing.Size(85, 30)
$form.Controls.Add($browseButton)

$regionLabel = New-Object System.Windows.Forms.Label
$regionLabel.Text = 'Регион:'
$regionLabel.Location = New-Object System.Drawing.Point(25, 300)
$regionLabel.Size = New-Object System.Drawing.Size(65, 24)
$form.Controls.Add($regionLabel)
$regionBox = New-Object System.Windows.Forms.TextBox
$regionBox.Location = New-Object System.Drawing.Point(95, 297)
$regionBox.Size = New-Object System.Drawing.Size(90, 27)
$regionBox.Text = $script:Cfg.game_region
$form.Controls.Add($regionBox)
$launchButton = New-Object System.Windows.Forms.Button
$launchButton.Text = 'ЗАПУСТИТЬ ИГРУ'
$launchButton.Location = New-Object System.Drawing.Point(355, 294)
$launchButton.Size = New-Object System.Drawing.Size(185, 38)
$launchButton.BackColor = [System.Drawing.Color]::FromArgb(35, 145, 90)
$launchButton.ForeColor = [System.Drawing.Color]::White
$launchButton.FlatStyle = 'Flat'
$form.Controls.Add($launchButton)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Режим: не выбран (системный hosts не изменён)'
$statusLabel.Location = New-Object System.Drawing.Point(25, 355)
$statusLabel.Size = New-Object System.Drawing.Size(535, 55)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(70, 80, 95)
$form.Controls.Add($statusLabel)

$browseButton.Add_Click({
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = 'RF4 executable (rf4_x64.exe)|rf4_x64.exe|Executable (*.exe)|*.exe'
    $dialog.Title = 'Выбери rf4_x64.exe'
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $gameBox.Text = $dialog.FileName; Save-Config }
})
$registerButton.Add_Click({ try { Invoke-AccountAction -Action 'register' } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Регистрация не выполнена', 'OK', 'Error') | Out-Null } })
$loginButton.Add_Click({ try { Invoke-AccountAction -Action 'login' } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Вход не выполнен', 'OK', 'Error') | Out-Null } })
$serverButton.Add_Click({ try { Set-ServerHosts } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Не удалось переключить hosts', 'OK', 'Error') | Out-Null } })
$officialButton.Add_Click({ try { Set-OfficialHosts } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Не удалось вернуть официальный режим', 'OK', 'Error') | Out-Null } })
$launchButton.Add_Click({ try { Launch-Game } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Не удалось запустить игру', 'OK', 'Error') | Out-Null } })

# Показываем активный режим только если найдены именно наши помеченные строки.
try {
    $current = Get-HostsLines
    $ours = @($current | Where-Object { $_ -match '^\s*\d{1,3}(?:\.\d{1,3}){3}\s+api\.rf4game\.(?:ru|com)\s+# rf4-friend-launcher\s*$' })
    if ($ours.Count -gt 0) { $statusLabel.Text = 'Режим: мой сервер (записи лаунчера активны)' }
} catch { }
[void]$form.ShowDialog()
