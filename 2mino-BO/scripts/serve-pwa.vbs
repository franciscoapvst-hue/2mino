' Lanza serve-pwa.cjs con Node sin abrir ventana de consola visible.
' Usado por la tarea programada de Windows para que el servidor arranque
' solo al iniciar sesión, sin que aparezca ninguna terminal.
Set objShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
objShell.CurrentDirectory = scriptDir
objShell.Run "node """ & scriptDir & "\serve-pwa.cjs""", 0, False
