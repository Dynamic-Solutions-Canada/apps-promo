# refresh-catalog.ps1 - regenerates Assets/PromotedApps from live Microsoft Store listings.
#
# Dev-side tool only: run it occasionally (e.g. when publishing a new app or before a
# release), review the diff, and commit the result. Consuming apps bundle the generated
# files and refresh from the public manifest at runtime.
#
# NOTE: keep this file ASCII-only (see project conventions).

$ErrorActionPreference = "Stop"

# The catalog files live at the repo root, one level above this script.
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "Assets\PromotedApps"
$ids = Get-Content (Join-Path $root "ids.json") -Raw | ConvertFrom-Json

New-Item -ItemType Directory -Force $outDir | Out-Null

function Get-BriefDescription([string]$text, [int]$maxLen = 180) {
    if (-not $text) { return "" }
    # First non-empty line, trimmed to a word boundary.
    $line = ($text -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 1).Trim()
    if ($line.Length -le $maxLen) { return $line }
    $cut = $line.Substring(0, $maxLen)
    $lastSpace = $cut.LastIndexOf(" ")
    if ($lastSpace -gt 0) { $cut = $cut.Substring(0, $lastSpace) }
    return $cut.TrimEnd(".,;: ") + "..."
}

# Catalog icons are 256 px squares (PROMO-5). Each app repo publishes one at
# assets/generated/icon-256.png (ASSET-12); npm run check:catalog enforces the size
# for entries that point there.
$iconSize = 256

# Read a PNG's width and height from its IHDR header, the same way
# scripts/png-size.ts does. Returns $null when the file is not a PNG.
function Get-PngSize([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $signature = 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    if ($bytes.Length -lt 24) { return $null }
    for ($i = 0; $i -lt 8; $i++) {
        if ($bytes[$i] -ne $signature[$i]) { return $null }
    }
    if ([System.Text.Encoding]::ASCII.GetString($bytes, 12, 4) -ne "IHDR") { return $null }

    # PNG integers are big-endian.
    $width = ([int]$bytes[16] -shl 24) -bor ([int]$bytes[17] -shl 16) -bor ([int]$bytes[18] -shl 8) -bor [int]$bytes[19]
    $height = ([int]$bytes[20] -shl 24) -bor ([int]$bytes[21] -shl 16) -bor ([int]$bytes[22] -shl 8) -bor [int]$bytes[23]
    return [pscustomobject]@{ Width = $width; Height = $height }
}

# Download an icon, refuse anything that is not a square PNG, and warn while it is
# not yet 256 px (the Store's own logos are 50 px). The download goes to a temporary
# file first, so a rejected icon never replaces the committed one.
function Save-Icon([string]$url, [string]$fileName, [string]$label) {
    $path = Join-Path $outDir $fileName
    $download = "$path.download"
    Invoke-WebRequest $url -OutFile $download | Out-Null

    $size = Get-PngSize $download
    if (-not $size -or $size.Width -ne $size.Height) {
        Remove-Item $download
        if (-not $size) { throw "Icon for $label is not a PNG: $url" }
        throw "Icon for $label is not square ($($size.Width)x$($size.Height)): $url"
    }
    if ($size.Width -ne $iconSize) {
        Write-Warning "Icon for $label is $($size.Width) px, not $iconSize px. Set iconUrl to the app repo's assets/generated/icon-256.png once it exists."
    }

    Move-Item -Force $download $path
}

$apps = @()
foreach ($id in $ids.productIds) {
    Write-Host "Fetching $id ..."
    $url = "https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${id}?market=US&locale=en-us&deviceFamily=Windows.Desktop"
    $payload = (Invoke-RestMethod $url).Payload

    # Prefer the square logo; fall back to any tile, then the first image.
    $img = $payload.Images | Where-Object { $_.ImageType -eq "logo" } | Select-Object -First 1
    if (-not $img) { $img = $payload.Images | Where-Object { $_.ImageType -eq "tile" } | Sort-Object Width -Descending | Select-Object -First 1 }
    if (-not $img) { $img = $payload.Images | Select-Object -First 1 }
    $imgUrl = $img.Url
    if ($imgUrl -and $imgUrl.StartsWith("//")) { $imgUrl = "https:" + $imgUrl }

    # An iconUrl in appOverrides (the app repo's 256 px icon) replaces the Store logo.
    $override = $ids.appOverrides.$id
    if ($override -and $override.iconUrl) { $imgUrl = $override.iconUrl }

    $iconFile = "$id.png"
    Save-Icon $imgUrl $iconFile $id

    $blurb = $null
    if ($ids.blurbOverrides -and $ids.blurbOverrides.PSObject.Properties[$id]) {
        $blurb = $ids.blurbOverrides.$id
    }
    if (-not $blurb) { $blurb = Get-BriefDescription $payload.Description }

    $metadata = $ids.appOverrides.$id
    if (-not $metadata.appId -or -not $metadata.links) {
        throw "Missing appOverrides metadata for $id"
    }

    # Preserve publisher-approved names while Store listing updates catch up.
    $name = $payload.Title
    if ($metadata.name) { $name = $metadata.name }

    $apps += [ordered]@{
        appId             = $metadata.appId
        links             = @($metadata.links)
        destination       = "ms-windows-store://pdp/?ProductId=$id"
        actionLabel       = "View in Store"
        name              = $name
        blurb             = $blurb
        packageFamilyName = @($payload.PackageFamilyNames)[0]
        icon              = $iconFile
    }
    Write-Host "  -> ${name}: $blurb"
}

# Web apps use explicit repository-owned metadata instead of Store listing data.
foreach ($externalApp in @($ids.externalApps)) {
    Write-Host "Fetching $($externalApp.name) icon ..."
    Save-Icon $externalApp.iconUrl $externalApp.icon $externalApp.name

    $apps += [ordered]@{
        appId             = $externalApp.appId
        links             = @($externalApp.links)
        destination       = $externalApp.destination
        actionLabel       = $externalApp.actionLabel
        name              = $externalApp.name
        blurb             = $externalApp.blurb
        packageFamilyName = $null
        icon              = $externalApp.icon
    }
}

# Publish one canonical order for every consumer, including older Windows apps
# that simply enumerate the manifest. Refuse incomplete or duplicate ordering.
$orderedApps = @()
foreach ($appId in @($ids.appOrder)) {
    $matches = @($apps | Where-Object { $_.appId -eq $appId })
    if ($matches.Count -ne 1 -or $appId -in @($orderedApps | ForEach-Object { $_.appId })) {
        throw "Invalid or duplicate appOrder entry: $appId"
    }
    $orderedApps += $matches[0]
}
if ($orderedApps.Count -ne $apps.Count) {
    throw "appOrder must include every app exactly once"
}

$manifest = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    publisher    = "Dynamic Solutions (CA)"
    apps         = $orderedApps
}
$json = $manifest | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $outDir "apps.json") -Value $json -Encoding UTF8
Write-Host "Wrote $(Join-Path $outDir 'apps.json') ($($apps.Count) apps)."
