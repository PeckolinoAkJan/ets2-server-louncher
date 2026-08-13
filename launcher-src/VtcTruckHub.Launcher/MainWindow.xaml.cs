using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;

namespace VtcTruckHub.Launcher;

public partial class MainWindow : Window
{
    readonly ClientApi api = new();
    readonly RuntimeService runtime = new();
    readonly UpdateService updates = new();
    readonly PluginService plugins = new();
    readonly DispatcherTimer connectionTimer = new() { Interval = TimeSpan.FromSeconds(2) };
    ClientStatus? state;
    string? launchedGame;
    UpdateInfo? availableUpdate;
    DispatcherOverlay? overlay;
    JoinRequest? pendingJoin;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        PlayButton.Click += async (_, _) => await Play();
        LoginButton.Click += async (_, _) => await Login(true);
        RegisterButton.Click += async (_, _) => await Login(false);
        LogoutButton.Click += async (_, _) => await Logout();
        UpdateButton.Click += async (_, _) => await InstallUpdate();
        connectionTimer.Tick += async (_, _) => await UpdateConnection();
        HomeNav.Click += (_, _) => StatusText.Text = "Launcher ist aktuell und startbereit";
        ServersNav.Click += (_, _) => ShowServers();
        ModsNav.Click += (_, _) => OpenPluginFolder();
        NewsNav.Click += (_, _) => OpenWeb("https://ets-server.vtc-truck-hub.de");
        SettingsNav.Click += (_, _) => ShowSettings();
        AccountNav.Click += (_, _) => ShowAccount();
        GameSelect.SelectionChanged += async (_, _) => { if (IsLoaded) await Refresh(); };
        Loaded += (_, _) => WireQuickActions();
    }

    async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            StatusText.Text = "Lokaler VTC-Dienst startet …";
            await runtime.EnsureStartedAsync();
            overlay = new DispatcherOverlay();
            Closed += (_, _) => { connectionTimer.Stop(); overlay?.Dispose(); runtime.Dispose(); };
            await Refresh();
            StatusText.Text = "Launcher ist aktuell und startbereit";
            await CheckUpdate();
            if (pendingJoin is { } request) { pendingJoin = null; await Play(request); }
        }
        catch (Exception ex)
        {
            StatusText.Text = "Launcher-Laufzeit nicht bereit";
            MessageBox.Show(ex.Message, "VTC Truck Hub", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    async Task CheckUpdate()
    {
        try
        {
            availableUpdate = await updates.CheckAsync();
            if (availableUpdate is null) return;
            UpdateButton.Content = $"UPDATE {availableUpdate.Version}";
            UpdateButton.Visibility = Visibility.Visible;
            StatusText.Text = $"Neue Launcher-Version {availableUpdate.Version} verfügbar";
        }
        catch { }
    }

    async Task InstallUpdate()
    {
        if (availableUpdate is null) return;
        UpdateButton.IsEnabled = false;
        StatusText.Text = "Update wird heruntergeladen und geprüft …";
        try { await updates.DownloadAndInstallAsync(availableUpdate); }
        catch (Exception ex) { UpdateButton.IsEnabled = true; MessageBox.Show(ex.Message, "Update fehlgeschlagen", MessageBoxButton.OK, MessageBoxImage.Error); }
    }

    async Task Refresh()
    {
        state = await api.Status();
        AccountText.Text = state.Account is null ? "Nicht angemeldet" : $"{state.Account.DisplayName} · Steam verbunden";
        AccountStateText.Text = state.Account is null ? "VTC-KONTO · OFFLINE" : "VTC-KONTO · STEAM VERBUNDEN";
        AccountStateText.Foreground = state.Account is null ? Brushes.Gray : (Brush)FindResource("Green");
        LoginButton.IsEnabled = state.Account is null;
        RegisterButton.IsEnabled = state.Account is null;
        DisplayNameInput.IsEnabled = state.Account is null;
        LogoutButton.IsEnabled = state.Account is not null;
        AccountHint.Text = state.Account is null ? "Bestehendes Konto: LOGIN. Neues Konto: Fahrername eintragen und REGISTRIEREN." : $"Angemeldet als {state.Account.DisplayName}. Das Zugriffstoken liegt ausschließlich lokal.";
        EtsState.Text = State("ets2");
        AtsState.Text = State("ats");
    }

    string State(string id) => state?.Games.FirstOrDefault(g => g.Id == id)?.Installed == true ? "Installiert und startbereit" : "Nicht installiert";
    string SelectedGame() => ((ComboBoxItem)GameSelect.SelectedItem).Tag.ToString()!;

    void WireQuickActions()
    {
        foreach (var button in FindVisualChildren<Button>(this))
        {
            var label = button.Content?.ToString() ?? "";
            if (label.Contains("SERVERLISTE") || label.Contains("Server durchsuchen")) button.Click += (_, _) => ShowServers();
            else if (label.Contains("Mods verwalten")) button.Click += (_, _) => OpenPluginFolder();
            else if (label.Contains("Serverregeln")) button.Click += (_, _) => OpenWeb("https://ets-server.vtc-truck-hub.de");
            else if (label.Contains("Support")) button.Click += (_, _) => OpenWeb("https://github.com/PeckolinoAkJan/ets2-server-louncher/issues");
        }
    }

    void ShowServers()
    {
        if (state is null) return;
        var servers = state.Servers.Where(server => server.Game == SelectedGame()).ToArray();
        if (servers.Length == 0) { MessageBox.Show("Für dieses Spiel ist noch kein VTC-Server eingerichtet.", "Serverliste"); return; }
        var lines = servers.Select(server => $"{server.Name}\n{(server.Running ? "Online" : "Offline")} · {server.Players}/{server.Capacity} Fahrer · {server.Host}:{server.Port}");
        MessageBox.Show(string.Join("\n\n", lines), $"{SelectedGame().ToUpperInvariant()}-Server", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    void OpenPluginFolder()
    {
        if (state is null) return;
        var game = state.Games.FirstOrDefault(item => item.Id == SelectedGame());
        if (game?.Executable is null) { MessageBox.Show("Die gewählte Spielinstallation wurde nicht gefunden."); return; }
        var folder = Path.Combine(Path.GetDirectoryName(game.Executable)!, "plugins");
        Directory.CreateDirectory(folder);
        Process.Start(new ProcessStartInfo("explorer.exe", folder) { UseShellExecute = true });
    }

    void ShowSettings() => MessageBox.Show($"Spiel: {SelectedGame().ToUpperInvariant()}\nKartenprofil: {state?.Config.PreferredMapProfile}\nDispatcher-Hotkey: {state?.Config.DispatcherHotkey}\nTelemetrie-Autostart: {(state?.Config.TelemetryAutoStart == true ? "Aktiv" : "Aus")}\nPanel: {state?.Config.PanelUrl}", "VTC-Einstellungen", MessageBoxButton.OK, MessageBoxImage.Information);
    void ShowAccount() => MessageBox.Show(state?.Account is null ? "Nicht angemeldet" : $"Fahrer: {state.Account.DisplayName}\nSteam-ID: {state.Account.SteamId}\nVTC-Rolle: {state.Account.Role}", "VTC-Konto", MessageBoxButton.OK, MessageBoxImage.Information);
    static void OpenWeb(string url) => Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    static IEnumerable<T> FindVisualChildren<T>(DependencyObject root) where T : DependencyObject
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child is T match) yield return match;
            foreach (var descendant in FindVisualChildren<T>(child)) yield return descendant;
        }
    }

    public void QueueJoinUri(string value)
    {
        if (!JoinRequest.TryParse(value, out var request) || request is null) return;
        pendingJoin = request;
        if (!IsLoaded) return;
        Dispatcher.BeginInvoke(async () => { var queued = pendingJoin; pendingJoin = null; if (queued is not null) await Play(queued); });
    }

    async Task Play(JoinRequest? requested = null)
    {
        if (state is null) return;
        var game = requested?.Game ?? SelectedGame();
        if (requested is not null)
        {
            GameSelect.SelectedItem = GameSelect.Items.Cast<ComboBoxItem>().FirstOrDefault(item => string.Equals(item.Tag?.ToString(), game, StringComparison.OrdinalIgnoreCase)) ?? GameSelect.SelectedItem;
        }
        if (state.Games.FirstOrDefault(g => g.Id == game)?.Installed != true) { MessageBox.Show("Dieses Spiel wurde nicht gefunden."); return; }
        if (state.Account is null && !await Login(true)) return;
        var servers = state.Servers.Where(s => s.Game == game).ToArray();
        if (servers.Length == 0) { MessageBox.Show("Kein passender VTC-Server eingerichtet."); return; }
        var server = requested is null ? (servers.Length == 1 ? servers[0] : ChooseServer(servers)) : servers.FirstOrDefault(item => item.Id == requested.ServerId);
        if (requested is not null && server is null) { MessageBox.Show("Der angeforderte VTC-Server ist für dieses Spiel nicht verfügbar.", "Serverbeitritt", MessageBoxButton.OK, MessageBoxImage.Warning); return; }
        if (server is null) return;

        PlayButton.IsEnabled = false;
        try
        {
            plugins.EnsureInstalled(state.Games.First(g => g.Id == game));
            StatusText.Text = "Spiel wird gestartet …";
            var launch = await api.Launch(game, server.Id);
            launchedGame = game;
            StatusText.Text = launch.Message;
            ConnectionPanel.Visibility = Visibility.Visible;
            ConnectionText.Text = launch.Message;
            connectionTimer.Start();
            WindowState = WindowState.Minimized;
        }
        catch (Exception ex) { MessageBox.Show(ex.Message, "Spielstart fehlgeschlagen", MessageBoxButton.OK, MessageBoxImage.Error); }
        finally { PlayButton.IsEnabled = true; }
    }

    async Task UpdateConnection()
    {
        if (launchedGame is null) return;
        try
        {
            var connection = await api.Connection(launchedGame);
            StatusText.Text = connection.Message;
            ConnectionText.Text = connection.Message;
            if (connection.Status is "failed" or "manual_action_required") connectionTimer.Stop();
        }
        catch { }
    }

    async Task<bool> Login(bool existingAccount)
    {
        string? name = null;
        if (!existingAccount)
        {
            name = DisplayNameInput.Text.Trim();
            if (string.IsNullOrWhiteSpace(name)) { MessageBox.Show("Bitte zuerst einen Fahrernamen eingeben.", "Registrierung", MessageBoxButton.OK, MessageBoxImage.Information); return false; }
        }
        SetAccountBusy(true, existingAccount ? "Steam-Login wird geöffnet …" : "Registrierung wird geöffnet …");
        try
        {
            var start = await api.StartLogin(name);
            ClientApi.OpenSecureLogin(start.VerificationUri);
            for (var i = 0; i < 450; i++)
            {
                await Task.Delay(2000);
                var result = await api.Poll();
                if (result.Account is not null) { await Refresh(); return true; }
                if (result.Status is "approval_required") { AccountText.Text = "Wartet auf Administrator-Freigabe"; AccountHint.Text = "Die Registrierung wurde gespeichert. Ein Administrator muss das VTC-Konto noch freigeben."; continue; }
                if (result.Status is "blocked") { MessageBox.Show("Dieses Fahrerkonto wurde gesperrt."); return false; }
            }
            MessageBox.Show("Anmeldung ist abgelaufen.");
            return false;
        }
        catch (Exception ex) { MessageBox.Show(ex.Message, existingAccount ? "Login fehlgeschlagen" : "Registrierung fehlgeschlagen", MessageBoxButton.OK, MessageBoxImage.Error); return false; }
        finally { SetAccountBusy(false); }
    }

    async Task Logout()
    {
        SetAccountBusy(true, "Abmeldung läuft …");
        try { await api.Logout(); await Refresh(); StatusText.Text = "Sicher abgemeldet"; }
        catch (Exception ex) { MessageBox.Show(ex.Message, "Logout fehlgeschlagen", MessageBoxButton.OK, MessageBoxImage.Error); }
        finally { SetAccountBusy(false); }
    }

    void SetAccountBusy(bool busy, string? hint = null)
    {
        LoginButton.IsEnabled = !busy && state?.Account is null;
        RegisterButton.IsEnabled = !busy && state?.Account is null;
        LogoutButton.IsEnabled = !busy && state?.Account is not null;
        DisplayNameInput.IsEnabled = !busy && state?.Account is null;
        if (hint is not null) AccountHint.Text = hint;
    }

    ServerInfo? ChooseServer(ServerInfo[] servers)
    {
        var box = new Window { Title = "VTC-Server auswählen", Width = 600, Height = 380, Owner = this, WindowStartupLocation = WindowStartupLocation.CenterOwner };
        var panel = new StackPanel { Margin = new Thickness(24) };
        var list = new ListBox { ItemsSource = servers, DisplayMemberPath = "Name", SelectedIndex = 0, Height = 240 };
        var join = new Button { Content = "SERVER BEITRETEN", Background = (System.Windows.Media.Brush)FindResource("Accent"), Foreground = System.Windows.Media.Brushes.White, Margin = new Thickness(0, 12, 0, 0) };
        panel.Children.Add(list); panel.Children.Add(join); box.Content = panel;
        ServerInfo? chosen = null;
        join.Click += (_, _) => { chosen = list.SelectedItem as ServerInfo; if (chosen is not null) box.Close(); };
        box.ShowDialog();
        return chosen;
    }
}
