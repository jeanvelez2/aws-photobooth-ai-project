# PowerShell script to make shell scripts executable on Windows (for Git)
# This sets the executable bit in Git for the shell scripts

Write-Host "Making shell scripts executable in Git..."

$scriptFiles = @(
    "packages/infrastructure/scripts/pre-traffic-hook.sh",
    "packages/infrastructure/scripts/application-start-hook.sh", 
    "packages/infrastructure/scripts/application-stop-hook.sh",
    "packages/infrastructure/scripts/validate-service-hook.sh"
)

foreach ($file in $scriptFiles) {
    if (Test-Path $file) {
        Write-Host "Setting executable bit for: $file"
        git update-index --chmod=+x $file
    } else {
        Write-Warning "File not found: $file"
    }
}

Write-Host "✅ Shell scripts are now executable in Git"