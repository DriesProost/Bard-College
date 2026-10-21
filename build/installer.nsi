; A per-user installer using electron-builder's supported custom NSIS script hook.
; NSIS writes the unsigned uninstaller at install time. No Wine runtime is needed
; to execute an intermediate installer during cross-compilation.
Unicode true
RequestExecutionLevel user
Name "${PRODUCT_NAME}"
InstallDir "$LOCALAPPDATA\Programs\BardsCollege"
InstallDirRegKey HKCU "Software\BardsCollege" "InstallDir"
BrandingText "Bard's College"
ShowInstDetails show
ShowUninstDetails show
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!include "${PROJECT_DIR}/release/uninstall-files.nsh"
!define APP_EXE "${PRODUCT_FILENAME}.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\college.bards.desktop"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open Bard's College"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
Function EnsureAppClosed
  check:
    FindWindow $0 "Chrome_WidgetWin_1" "${PRODUCT_NAME}"
    StrCmp $0 0 done
    MessageBox MB_ICONEXCLAMATION|MB_RETRYCANCEL "Please close Bard's College so its latest changes can be saved, then choose Retry." IDRETRY check
    Abort
  done:
FunctionEnd
Function un.onInit
  check:
    FindWindow $0 "Chrome_WidgetWin_1" "${PRODUCT_NAME}"
    StrCmp $0 0 done
    MessageBox MB_ICONEXCLAMATION|MB_RETRYCANCEL "Please close Bard's College before uninstalling, then choose Retry. Your saved writing will be kept." IDRETRY check
    Abort
  done:
FunctionEnd
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Bard's College requires 64-bit Windows 10 or later."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "Bard's College requires Windows 10 or later."
    Abort
  ${EndIf}
  Call EnsureAppClosed
FunctionEnd
Section "Bard's College" SEC_APP
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /r "${PROJECT_DIR}/release/win-unpacked/*"
  WriteUninstaller "$INSTDIR\Uninstall Bard's College.exe"
  CreateShortcut "$SMPROGRAMS\Bard's College.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$DESKTOP\Bard's College.lnk" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\BardsCollege" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall Bard's College.exe$\""
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  ; Personal writing, progress, curriculum edits and the OS-encrypted key live
  ; in app.getPath('userData'). This installer never deletes that folder.
  !insertmacro RemoveInstalledFiles
  Delete "$INSTDIR\Uninstall Bard's College.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\Bard's College.lnk"
  Delete "$DESKTOP\Bard's College.lnk"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\BardsCollege"
SectionEnd
