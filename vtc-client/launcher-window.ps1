param([string]$ScreenshotPath = '')
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,Microsoft.VisualBasic
$ErrorActionPreference = 'Stop'
$Base = 'http://127.0.0.1:27110'

function Api([string]$Path,[string]$Method='GET',$Body=$null) {
  $params = @{Uri="$Base$Path";Method=$Method;TimeoutSec=8}
  if ($null -ne $Body) { $params.ContentType='application/json'; $params.Body=($Body|ConvertTo-Json -Compress) }
  Invoke-RestMethod @params
}
function Wait-Client {
  foreach($i in 1..30){try{Api '/api/status'|Out-Null;return}catch{Start-Sleep -Milliseconds 250}}
  [System.Windows.MessageBox]::Show('Der lokale VTC-Dienst konnte nicht gestartet werden.','VTC Truck Hub','OK','Error')|Out-Null;exit 1
}
Wait-Client

[xml]$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="VTC Truck Hub" Width="1120" Height="720" MinWidth="920" MinHeight="620" WindowStartupLocation="CenterScreen" Background="#F5F5F5" FontFamily="Segoe UI">
 <Grid>
  <Grid.RowDefinitions><RowDefinition Height="92"/><RowDefinition Height="*"/><RowDefinition Height="78"/></Grid.RowDefinitions>
  <Border Grid.Row="0" Background="White" BorderBrush="#C62026" BorderThickness="0,0,0,3">
   <Grid Margin="25,0"><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
    <StackPanel Orientation="Horizontal" VerticalAlignment="Center"><TextBlock Text="🚛" FontSize="45"/><StackPanel Margin="12,0"><TextBlock Text="VTC TRUCK HUB" FontSize="28" FontWeight="Bold" Foreground="#151515"/><TextBlock Text="COMMUNITY LAUNCHER" FontSize="11" FontWeight="Bold" Foreground="#C62026"/></StackPanel></StackPanel>
    <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center"><Button Name="NewsButton" Content="NEUIGKEITEN" Style="{StaticResource {x:Static ToolBar.ButtonStyleKey}}" Padding="18"/><Button Name="StatusButton" Content="SERVERSTATUS" Style="{StaticResource {x:Static ToolBar.ButtonStyleKey}}" Padding="18"/><TextBlock Name="AccountText" Text="Nicht angemeldet" Margin="24,0,0,0" VerticalAlignment="Center" FontWeight="SemiBold"/></StackPanel>
   </Grid>
  </Border>
  <Grid Grid.Row="1">
   <Grid.ColumnDefinitions><ColumnDefinition Width="205"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
   <Border Background="#FFFFFF" BorderBrush="#DDDDDD" BorderThickness="0,0,1,0"><StackPanel Margin="14,28"><Button Name="PlayNav" Content="▶  SPIELEN" Height="52" HorizontalContentAlignment="Left" Padding="18,0" Background="#F8E9EA" Foreground="#B71D22" FontWeight="Bold" BorderThickness="0"/><Button Name="EventsNav" Content="▣  EVENTS" Height="52" HorizontalContentAlignment="Left" Padding="18,0" Background="Transparent" BorderThickness="0"/><Button Name="VersionsNav" Content="☁  VERSIONEN" Height="52" HorizontalContentAlignment="Left" Padding="18,0" Background="Transparent" BorderThickness="0"/><Button Name="SettingsNav" Content="⚙  EINSTELLUNGEN" Height="52" HorizontalContentAlignment="Left" Padding="18,0" Background="Transparent" BorderThickness="0"/></StackPanel></Border>
   <Grid Grid.Column="1" Margin="34,28">
    <Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="*"/></Grid.RowDefinitions>
    <StackPanel><TextBlock Text="Willkommen beim VTC Truck Hub" FontSize="30" FontWeight="SemiBold"/><TextBlock Text="Starte ETS2 oder ATS, melde dich sicher mit Steam an und wähle danach deinen VTC-Server." Foreground="#666" FontSize="15" Margin="0,7,0,22"/></StackPanel>
    <Grid Grid.Row="1"><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition/></Grid.ColumnDefinitions>
     <Border Margin="0,0,10,0" CornerRadius="8" Background="#152631" Padding="28"><StackPanel VerticalAlignment="Center"><TextBlock Text="EURO TRUCK SIMULATOR 2" Foreground="White" FontSize="23" FontWeight="Bold"/><TextBlock Text="Europa · Standardkarte und ProMods" Foreground="#B8CBD5" Margin="0,8,0,0"/><TextBlock Text="🚚" FontSize="105" HorizontalAlignment="Center" Margin="0,30"/><TextBlock Name="EtsState" Text="Installation wird geprüft …" Foreground="#54D96B" HorizontalAlignment="Center"/></StackPanel></Border>
     <Border Grid.Column="1" Margin="10,0,0,0" CornerRadius="8" Background="#56321F" Padding="28"><StackPanel VerticalAlignment="Center"><TextBlock Text="AMERICAN TRUCK SIMULATOR" Foreground="White" FontSize="23" FontWeight="Bold"/><TextBlock Text="USA · Standardkarte und ProMods" Foreground="#E1C5B4" Margin="0,8,0,0"/><TextBlock Text="🚛" FontSize="105" HorizontalAlignment="Center" Margin="0,30"/><TextBlock Name="AtsState" Text="Installation wird geprüft …" Foreground="#54D96B" HorizontalAlignment="Center"/></StackPanel></Border>
    </Grid>
   </Grid>
  </Grid>
  <Border Grid.Row="2" Background="White" BorderBrush="#DDD" BorderThickness="0,1,0,0"><Grid Margin="25,10"><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="360"/><ColumnDefinition Width="180"/></Grid.ColumnDefinitions>
   <StackPanel Orientation="Horizontal" VerticalAlignment="Center"><Ellipse Name="InstallDot" Width="22" Height="22" Fill="#29B765"/><TextBlock Name="InstallText" Text="Installation wird geprüft" Margin="10,0" FontWeight="SemiBold" VerticalAlignment="Center"/></StackPanel>
   <ComboBox Name="GameSelect" Grid.Column="1" Height="48" Margin="12,0" VerticalContentAlignment="Center" FontSize="16"><ComboBoxItem Tag="ets2">Euro Truck Simulator 2</ComboBoxItem><ComboBoxItem Tag="ats">American Truck Simulator</ComboBoxItem></ComboBox>
   <Button Name="PlayButton" Grid.Column="2" Content="▶  SPIELEN" Background="#BE2026" Foreground="White" BorderThickness="0" FontSize="16" FontWeight="Bold"/>
  </Grid></Border>
 </Grid>
</Window>
'@
$reader=New-Object System.Xml.XmlNodeReader $xaml;$window=[Windows.Markup.XamlReader]::Load($reader)
function C($n){$window.FindName($n)}
$gameSelect=C 'GameSelect';$gameSelect.SelectedIndex=0;$play=C 'PlayButton';$account=C 'AccountText'
$status=$null
function Refresh-State {
  $script:status=Api '/api/status';$account.Text=if($status.account){"$($status.account.displayName) · Steam verbunden"}else{'Nicht angemeldet'}
  $ets=$status.games|Where-Object id -eq ets2;$ats=$status.games|Where-Object id -eq ats
  (C 'EtsState').Text=if($ets.installed){'Installiert und startbereit'}else{'Nicht installiert'}
  (C 'AtsState').Text=if($ats.installed){'Installiert und startbereit'}else{'Nicht installiert'}
  (C 'InstallText').Text='Launcher ist aktuell · Version 0.6.0-test'
}
function Selected-Game { (($gameSelect.SelectedItem).Tag).ToString() }
function Steam-Login {
  $choice=[System.Windows.MessageBox]::Show('Hast du bereits ein freigegebenes VTC-Fahrerkonto?`n`nJa = anmelden`nNein = neu registrieren','VTC Truck Hub','YesNoCancel','Question')
  if($choice -eq 'Cancel'){return $false}
  if($choice -eq 'No'){$name=[Microsoft.VisualBasic.Interaction]::InputBox('Gewünschter Fahrername für die Registrierliste:','VTC-Fahrerkonto registrieren','');if([string]::IsNullOrWhiteSpace($name)){return $false};$start=Api '/api/client/register' 'POST' @{displayName=$name}}
  else{$start=Api '/api/auth/steam' 'POST' @{}}
  Start-Process $start.verificationUri
  $dialog=New-Object Windows.Window -Property @{Title='Steam-Anmeldung';Width=440;Height=230;WindowStartupLocation='CenterOwner';Owner=$window;ResizeMode='NoResize';Background='#FFFFFF'}
  $stack=New-Object Windows.Controls.StackPanel -Property @{Margin='28'}
  $title=New-Object Windows.Controls.TextBlock -Property @{Text='Steam-Anmeldung läuft';FontSize=23;FontWeight='Bold'}
  $copy=New-Object Windows.Controls.TextBlock -Property @{Text="Bestätige Steam im sicheren Browserfenster. Der Launcher übernimmt anschließend automatisch.`n`nGerätecode: $($start.userCode)";TextWrapping='Wrap';Margin='0,15,0,0'}
  $stack.Children.Add($title)|Out-Null;$stack.Children.Add($copy)|Out-Null;$dialog.Content=$stack
  $timer=New-Object Windows.Threading.DispatcherTimer -Property @{Interval=[TimeSpan]::FromSeconds(2)}
  $timer.Add_Tick({try{$result=Api '/api/auth/poll' 'POST' @{};if($result.account){$timer.Stop();$dialog.DialogResult=$true;$dialog.Close()}}catch{}})
  $dialog.Add_Closed({$timer.Stop()});$timer.Start();$ok=$dialog.ShowDialog();if($ok){Refresh-State;return $true};return $false
}
function Select-Server([string]$game) {
  $data=Api "/api/servers?game=$game";if(-not $data.servers){[Windows.MessageBox]::Show('Für dieses Spiel ist noch kein VTC-Server eingerichtet.','VTC Truck Hub')|Out-Null;return $null}
  $dialog=New-Object Windows.Window -Property @{Title='VTC-Server auswählen';Width=650;Height=410;WindowStartupLocation='CenterOwner';Owner=$window;Background='#F7F7F7'}
  $grid=New-Object Windows.Controls.Grid -Property @{Margin='24'};$grid.RowDefinitions.Add((New-Object Windows.Controls.RowDefinition -Property @{Height='Auto'}));$grid.RowDefinitions.Add((New-Object Windows.Controls.RowDefinition));$grid.RowDefinitions.Add((New-Object Windows.Controls.RowDefinition -Property @{Height='64'}))
  $heading=New-Object Windows.Controls.TextBlock -Property @{Text='Server auswählen';FontSize=27;FontWeight='Bold';Margin='0,0,0,18'};[Windows.Controls.Grid]::SetRow($heading,0);$grid.Children.Add($heading)|Out-Null
  $list=New-Object Windows.Controls.ListBox -Property @{FontSize=17};foreach($s in $data.servers){$item=New-Object Windows.Controls.ListBoxItem -Property @{Content="$($s.name)     $($s.host):$($s.port)";Tag=$s.id;Padding='15';Margin='0,3'};$list.Items.Add($item)|Out-Null};$list.SelectedIndex=0;[Windows.Controls.Grid]::SetRow($list,1);$grid.Children.Add($list)|Out-Null
  $join=New-Object Windows.Controls.Button -Property @{Content='SERVER BEITRETEN UND SPIEL STARTEN';Background='#BE2026';Foreground='White';FontWeight='Bold';BorderThickness='0';Margin='0,12,0,0'};[Windows.Controls.Grid]::SetRow($join,2);$grid.Children.Add($join)|Out-Null;$join.Add_Click({if($list.SelectedItem){$dialog.Tag=$list.SelectedItem.Tag;$dialog.DialogResult=$true;$dialog.Close()}});$dialog.Content=$grid
  if($dialog.ShowDialog()){return $dialog.Tag};return $null
}
$play.Add_Click({try{$game=Selected-Game;$installed=$status.games|Where-Object id -eq $game;if(-not $installed.installed){[Windows.MessageBox]::Show("$($game.ToUpper()) wurde auf diesem PC nicht gefunden.",'VTC Truck Hub')|Out-Null;return};if(-not $status.account){if(-not (Steam-Login)){return}};$server=Select-Server $game;if($server){Api '/api/game/launch' 'POST' @{game=$game;serverId=$server}|Out-Null;$window.WindowState='Minimized'}}catch{[Windows.MessageBox]::Show($_.Exception.Message,'VTC Truck Hub','OK','Error')|Out-Null}})
(C 'StatusButton').Add_Click({Start-Process 'https://ets-server.vtc-truck-hub.de'})
Refresh-State
if ($ScreenshotPath) {
  $window.Show()
  $window.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::ApplicationIdle)
  $window.Measure([Windows.Size]::new($window.Width,$window.Height))
  $window.Arrange([Windows.Rect]::new(0,0,$window.Width,$window.Height))
  $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap([int]$window.Width,[int]$window.Height,96,96,[Windows.Media.PixelFormats]::Pbgra32)
  $bitmap.Render($window)
  $encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
  $stream=[IO.File]::Open($ScreenshotPath,[IO.FileMode]::Create)
  $encoder.Save($stream);$stream.Dispose();$window.Close()
} else {
  $window.ShowDialog()|Out-Null
}
