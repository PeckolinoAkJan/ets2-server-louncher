#include <windows.h>
#include <atomic>
#include <fstream>
#include <string>
#include "scssdk_telemetry.h"

namespace {
std::atomic<bool> running{false};
HHOOK keyboard_hook{};
HANDLE worker{};
std::wstring bridge_url=L"http://127.0.0.1:27110/ingame.html";

LRESULT CALLBACK keyboard_proc(int code, WPARAM message, LPARAM value) {
  if(code==HC_ACTION && message==WM_KEYDOWN) {
    const auto* key=reinterpret_cast<KBDLLHOOKSTRUCT*>(value);
    if(key->vkCode==VK_TAB) {
      // Contract only: a production build signals the signed overlay host here.
      // It must never manipulate game memory from this keyboard callback.
      PostThreadMessage(GetCurrentThreadId(),WM_APP+1,0,0);
      return 1;
    }
  }
  return CallNextHookEx(keyboard_hook,code,message,value);
}

DWORD WINAPI worker_main(void*) {
  keyboard_hook=SetWindowsHookExW(WH_KEYBOARD_LL,keyboard_proc,GetModuleHandleW(nullptr),0);
  MSG msg{};while(running && GetMessageW(&msg,nullptr,0,0)>0){if(msg.message==WM_APP+1){OutputDebugStringW(L"VTC dispatcher toggle requested\n");}}
  if(keyboard_hook)UnhookWindowsHookEx(keyboard_hook);return 0;
}
}

SCSAPI_RESULT scs_telemetry_init(const scs_u32_t version,const scs_telemetry_init_params_t* params) {
  if(version!=SCS_TELEMETRY_VERSION_1_14 || !params)return SCS_RESULT_unsupported;
  running=true;worker=CreateThread(nullptr,0,worker_main,nullptr,0,nullptr);
  return worker?SCS_RESULT_ok:SCS_RESULT_generic_error;
}

SCSAPI_VOID scs_telemetry_shutdown(void) {
  running=false;if(worker){PostThreadMessageW(GetThreadId(worker),WM_QUIT,0,0);WaitForSingleObject(worker,2000);CloseHandle(worker);worker=nullptr;}
}
