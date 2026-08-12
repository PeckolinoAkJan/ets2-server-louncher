using Microsoft.VisualBasic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;

namespace VtcTruckHub.Launcher;

public partial class MainWindow : Window
{
    readonly ClientApi api = new();
    readonly RuntimeService runtime = new();
    readonly UpdateService updates = new();
    readonly DispatcherTimer connectionTimer = new() { Interval = TimeSpan.FromSeconds(2) };
    ClientStatus? state;
    string? launchedGame;
    UpdateInfo? availableUpdate;
    DispatcherOverlay? overlay;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        PlayButton.Click += async (_, _) => await Play();
        UpdateButton.Click += async (_, _) => await InstallUpdate();
        connectionTimer.Tick += async (_, _) => await UpdateConnection();
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
        EtsState.Text = State("ets2");
        AtsState.Text = State("ats");
    }

    string State(string id) => state?.Games.FirstOrDefault(g => g.Id == id)?.Installed == true ? "Installiert und startbereit" : "Nicht installiert";
    string SelectedGame() => ((ComboBoxItem)GameSelect.SelectedItem).Tag.ToString()!;

    async Task Play()
    {
        if (state is null) return;
        var game = SelectedGame();
        if (state.Games.FirstOrDefault(g => g.Id == game)?.Installed != true) { MessageBox.Show("Dieses Spiel wurde nicht gefunden."); return; }
        if (state.Account is null && !await Login()) return;
        var servers = state.Servers.Where(s => s.Game == game).ToArray();
        if (servers.Length == 0) { MessageBox.Show("Kein passender VTC-Server eingerichtet."); return; }
        var server = servers.Length == 1 ? servers[0] : ChooseServer(servers);
        if (server is null) return;

        PlayButton.IsEnabled = false;
        try
        {
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
            if (connection.Status == "connected") connectionTimer.Stop();
        }
        catch { }
    }

    async Task<bool> Login()
    {
        var answer = MessageBox.Show("Besteht bereits ein freigegebenes Fahrerkonto?\n\nJa = anmelden\nNein = registrieren", "VTC Truck Hub", MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        if (answer == MessageBoxResult.Cancel) return false;
        string? name = null;
        if (answer == MessageBoxResult.No)
        {
            name = Interaction.InputBox("Fahrername für die Registrierliste:", "Fahrerkonto registrieren");
            if (string.IsNullOrWhiteSpace(name)) return false;
        }
        var start = await api.StartLogin(name);
        ClientApi.OpenSecureLogin(start.VerificationUri);
        for (var i = 0; i < 900; i++)
        {
            await Task.Delay(2000);
            var result = await api.Poll();
            if (result.Account is not null) { await Refresh(); return true; }
            if (result.Status is "approval_required") { AccountText.Text = "Wartet auf Administrator-Freigabe"; continue; }
            if (result.Status is "blocked") { MessageBox.Show("Dieses Fahrerkonto wurde gesperrt."); return false; }
        }
        MessageBox.Show("Anmeldung ist abgelaufen.");
        return false;
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
