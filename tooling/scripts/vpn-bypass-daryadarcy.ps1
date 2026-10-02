# Route daryadarcy VPS around hidemy.name VPN (run after VPN connects).
# Requires Administrator.
$ErrorActionPreference = "Stop"
$targets = @(
  "200.165.234.36",
  "daryadarcy.com"
)

function Get-PhysicalGateway {
  $vpnPattern = "hidemy|OpenVPN|TAP|TUN|WireGuard|Wintun"
  $if = Get-NetIPConfiguration |
    Where-Object {
      $_.IPv4DefaultGateway -and
      $_.NetAdapter.Status -eq "Up" -and
      $_.NetAdapter.InterfaceDescription -notmatch $vpnPattern
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1
  if (-not $if) { throw "Physical default gateway not found (disable VPN or connect Wi-Fi/Ethernet)." }
  return @{
    Gateway = $if.IPv4DefaultGateway.NextHop
    IfIndex = $if.InterfaceIndex
  }
}

function Resolve-TargetHost {
  param([string]$Target)
  if ($Target -match '^\d{1,3}(\.\d{1,3}){3}$') { return @($Target) }
  try {
    return ([System.Net.Dns]::GetHostAddresses($Target) |
      Where-Object { $_.AddressFamily -eq "InterNetwork" } |
      ForEach-Object { $_.IPAddressToString })
  } catch {
    Write-Warning "DNS failed for $Target"
    return @()
  }
}

$needsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $needsAdmin) {
  Write-Host "Re-launching as Administrator..."
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

$gw = Get-PhysicalGateway
Write-Host "Physical gateway:" $gw.Gateway "(ifIndex $($gw.IfIndex))"

$ips = New-Object System.Collections.Generic.HashSet[string]
foreach ($t in $targets) {
  foreach ($ip in (Resolve-TargetHost $t)) { [void]$ips.Add($ip) }
}

if ($ips.Count -eq 0) { throw "No target IPs resolved." }

foreach ($ip in $ips) {
  route delete $ip 2>$null | Out-Null
  route add $ip mask 255.255.255.255 $($gw.Gateway) metric 1 if $($gw.IfIndex)
  Write-Host "Bypass route added:" $ip "->" $gw.Gateway
}

Write-Host "Done. Test: Test-NetConnection 200.165.234.36 -Port 22"
