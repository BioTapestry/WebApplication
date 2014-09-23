$configFiles=get-childitem . *.css -rec
foreach ($file in $configFiles)
{
(Get-Content $file.PSPath) | 
Foreach-Object {$_ -replace ".claro", ".biotapestry"} | 
Set-Content $file.PSPath
}