#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <string>

std::wstring executableDirectory() {
  wchar_t path[MAX_PATH]{};
  const DWORD length = GetModuleFileNameW(nullptr, path, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) return L".";
  std::wstring result(path, length);
  const size_t slash = result.find_last_of(L"\\/");
  return slash == std::wstring::npos ? L"." : result.substr(0, slash);
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
  const std::wstring root = executableDirectory();
  const std::wstring application = root + L"\\deepseek-harness-app\\DeepSeek Harness.exe";
  if (GetFileAttributesW(application.c_str()) == INVALID_FILE_ATTRIBUTES) {
    MessageBoxW(nullptr,
                L"缺少 deepseek-harness-app\\DeepSeek Harness.exe。\n请保持应用文件夹与本启动器在同一目录。",
                L"DeepSeek Harness", MB_OK | MB_ICONERROR);
    return 2;
  }

  std::wstring command = L"\"" + application + L"\"";
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  if (!CreateProcessW(application.c_str(), command.data(), nullptr, nullptr, FALSE,
                      0, nullptr, root.c_str(), &startup, &process)) {
    MessageBoxW(nullptr, L"无法启动 DeepSeek Harness。", L"DeepSeek Harness", MB_OK | MB_ICONERROR);
    return 3;
  }
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  return 0;
}
