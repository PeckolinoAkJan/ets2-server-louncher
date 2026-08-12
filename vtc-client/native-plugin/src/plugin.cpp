#include <windows.h>
#include <winhttp.h>
#include <atomic>
#include <cstdio>
#include <cmath>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include "scssdk_telemetry.h"
#include "scssdk_telemetry_event.h"
#include "scssdk_telemetry_channel.h"
#include "eurotrucks2/scssdk_eut2.h"
#include "eurotrucks2/scssdk_telemetry_eut2.h"
#include "amtrucks/scssdk_ats.h"
#include "amtrucks/scssdk_telemetry_ats.h"

#pragma comment(lib,"winhttp.lib")

namespace {
constexpr wchar_t kHost[]=L"127.0.0.1";constexpr INTERNET_PORT kPort=27111;
std::atomic<bool> running{false};std::thread worker;std::mutex state_mutex;
struct State{double x{},y{},z{},heading{},speed{};bool lights{},beacon{};} state;
std::string game_id{"ets2"};

std::string post(const wchar_t* route,const std::string& body){
  HINTERNET session=WinHttpOpen(L"VTCTruckHubNative/0.1",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0);if(!session)return{};
  HINTERNET connect=WinHttpConnect(session,kHost,kPort,0);if(!connect){WinHttpCloseHandle(session);return{};}
  HINTERNET request=WinHttpOpenRequest(connect,L"POST",route,nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,0);std::string result;
  if(request){const wchar_t headers[]=L"Content-Type: application/json\r\n";if(WinHttpSendRequest(request,headers,-1L,(LPVOID)body.data(),(DWORD)body.size(),(DWORD)body.size(),0)&&WinHttpReceiveResponse(request,nullptr)){char buffer[8192];DWORD read=0;do{if(!WinHttpReadData(request,buffer,sizeof(buffer),&read)||!read)break;result.append(buffer,read);}while(read);}WinHttpCloseHandle(request);}
  WinHttpCloseHandle(connect);WinHttpCloseHandle(session);return result;
}
void on_float(const scs_string_t,scs_u32_t,const scs_value_t* value,void* context){if(!value)return;std::lock_guard lock(state_mutex);auto target=static_cast<double*>(context);*target=value->value_float.value;}
void on_dplacement(const scs_string_t,scs_u32_t,const scs_value_t* value,void*){if(!value)return;std::lock_guard lock(state_mutex);state.x=value->value_dplacement.position.x;state.y=value->value_dplacement.position.y;state.z=value->value_dplacement.position.z;state.heading=value->value_dplacement.orientation.heading;}
void on_bool(const scs_string_t,scs_u32_t,const scs_value_t* value,void* context){if(!value)return;std::lock_guard lock(state_mutex);*static_cast<bool*>(context)=value->value_bool.value!=0;}
void loop(){
  const auto hello=std::string{"{\"game\":\""}+game_id+"\",\"gameVersion\":\"unknown\",\"pluginVersion\":\"0.1.0\",\"profileId\":\"native\"}";
  post(L"/api/integration/hello",hello);
  while(running){
    State copy;{std::lock_guard lock(state_mutex);copy=state;}
    char json[1536];
    sprintf_s(json,R"({"plugin":{"game":"%s","gameVersion":"unknown","pluginVersion":"0.1.0","profileId":"native"},"telemetry":{"x":%.4f,"y":%.4f,"z":%.4f,"heading":%.6f,"speed":%.3f,"lights":%s,"beacon":%s}})",game_id.c_str(),copy.x,copy.y,copy.z,copy.heading,copy.speed,copy.lights?"true":"false",copy.beacon?"true":"false");
    post(L"/api/integration/command",json);
    for(int i=0;i<10&&running;i++)Sleep(100);
  }
  post(L"/api/integration/disconnect",R"({"reason":"plugin_shutdown"})");
}
}

SCSAPI_RESULT scs_telemetry_init(const scs_u32_t version,const scs_telemetry_init_params_t* params){
  if(version!=SCS_TELEMETRY_VERSION_1_00||!params)return SCS_RESULT_unsupported;auto p=static_cast<const scs_telemetry_init_params_v101_t*>(params);bool ok=true;
  if(std::strcmp(p->common.game_id,SCS_GAME_ID_ATS)==0)game_id="ats";else if(std::strcmp(p->common.game_id,SCS_GAME_ID_EUT2)==0)game_id="ets2";else return SCS_RESULT_unsupported;
  ok&=p->register_for_channel(SCS_TELEMETRY_TRUCK_CHANNEL_world_placement,SCS_U32_NIL,SCS_VALUE_TYPE_dplacement,SCS_TELEMETRY_CHANNEL_FLAG_none,on_dplacement,nullptr)==SCS_RESULT_ok;
  ok&=p->register_for_channel(SCS_TELEMETRY_TRUCK_CHANNEL_speed,SCS_U32_NIL,SCS_VALUE_TYPE_float,SCS_TELEMETRY_CHANNEL_FLAG_none,on_float,&state.speed)==SCS_RESULT_ok;
  p->register_for_channel(SCS_TELEMETRY_TRUCK_CHANNEL_light_beacon,SCS_U32_NIL,SCS_VALUE_TYPE_bool,SCS_TELEMETRY_CHANNEL_FLAG_none,on_bool,&state.beacon);
  if(!ok)return SCS_RESULT_generic_error;running=true;worker=std::thread(loop);return SCS_RESULT_ok;
}
SCSAPI_VOID scs_telemetry_shutdown(void){running=false;if(worker.joinable())worker.join();}
