using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
namespace VtcTruckHub.Launcher;
public sealed class ClientApi
{
  readonly HttpClient http=new(){BaseAddress=new("http://127.0.0.1:27111/"),Timeout=TimeSpan.FromSeconds(40)};
  readonly JsonSerializerOptions json=new(JsonSerializerDefaults.Web){PropertyNameCaseInsensitive=true};
  public async Task<ClientStatus> Status()=>await http.GetFromJsonAsync<ClientStatus>("api/status",json)??throw new InvalidOperationException("Clientstatus fehlt.");
  public async Task<DeviceStart> StartLogin(string? displayName=null)
  {
    var path=displayName is null?"api/auth/steam":"api/client/register";
    object payload=displayName is null?new{}:new{displayName};var response=await http.PostAsJsonAsync(path,payload,json);await Ensure(response);
    return (await response.Content.ReadFromJsonAsync<DeviceStart>(json))!;
  }
  public async Task<TokenResult> Poll()
  {
    var response=await http.PostAsJsonAsync("api/auth/poll",new{},json);var value=await response.Content.ReadFromJsonAsync<TokenResult>(json);
    if(response.StatusCode==(System.Net.HttpStatusCode)202)return value!;await Ensure(response);return value!;
  }
  public async Task Logout(){var response=await http.PostAsJsonAsync("api/auth/logout",new{},json);await Ensure(response);}
  public async Task<LaunchResult> Launch(string game,string serverId){var r=await http.PostAsJsonAsync("api/game/launch",new{game,serverId},json);await Ensure(r);return (await r.Content.ReadFromJsonAsync<LaunchResult>(json))!;}
  public async Task<MultiplayerJoinResult> JoinMultiplayer(string game,string serverId){var r=await http.PostAsJsonAsync("api/multiplayer/join",new{game,serverId,mapProfile="standard"},json);await Ensure(r);return (await r.Content.ReadFromJsonAsync<MultiplayerJoinResult>(json))!;}
  public async Task<SaveSetupResult> SetupDispatcher(){var r=await http.PostAsJsonAsync("api/real-dispatch/setup",new{confirmed=true},json);await Ensure(r);return (await r.Content.ReadFromJsonAsync<SaveSetupResult>(json))!;}
  public async Task<ConnectionResult> Connection(string game)=>await http.GetFromJsonAsync<ConnectionResult>($"api/game/connection-status?game={Uri.EscapeDataString(game)}",json)??throw new InvalidOperationException("Verbindungsstatus fehlt.");
  static async Task Ensure(HttpResponseMessage response){if(response.IsSuccessStatusCode)return;var text=await response.Content.ReadAsStringAsync();throw new InvalidOperationException(text);}
  public static void OpenSecureLogin(string url)=>Process.Start(new ProcessStartInfo(url){UseShellExecute=true});
}
