$outDir = Join-Path $PSScriptRoot "..\assets\images\vehicle-branding"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$photos = @(
  @{ id = "533460190058847"; url = "https://scontent-lax3-1.xx.fbcdn.net/v/t39.30808-6/505720277_29952701947707948_7362867563218228128_n.jpg" },
  @{ id = "533471423391057"; url = "https://scontent-lax3-1.xx.fbcdn.net/v/t39.30808-6/506312292_29952704137707729_9184084594878663192_n.jpg" },
  @{ id = "533472850057581"; url = "https://scontent-lax3-2.xx.fbcdn.net/v/t39.30808-6/506528889_29952704241041052_8672029398718996484_n.jpg" },
  @{ id = "533473540057512"; url = "https://scontent-lax3-1.xx.fbcdn.net/v/t39.30808-6/506388908_29952704517707691_4508518683480496324_n.jpg" },
  @{ id = "533474393390760"; url = "https://scontent-lax7-1.xx.fbcdn.net/v/t39.30808-6/505807940_29952704524374357_8964781895546022624_n.jpg" },
  @{ id = "533475076724025"; url = "https://scontent-lax3-2.xx.fbcdn.net/v/t39.30808-6/506022666_29952704521041024_5791589494839732491_n.jpg" },
  @{ id = "533476553390544"; url = "https://scontent-lax7-1.xx.fbcdn.net/v/t39.30808-6/506624691_29952704314374378_2447069080514474641_n.jpg" },
  @{ id = "533477416723791"; url = "https://scontent-lax3-1.xx.fbcdn.net/v/t39.30808-6/506627877_29952704534374356_9087866628730134556_n.jpg" }
)

$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
$i = 1
foreach ($p in $photos) {
  $name = "{0:D2}-{1}.jpg" -f $i, $p.id
  $path = Join-Path $outDir $name
  $hiRes = $p.url + "?_nc_cat=110&ccb=1-7&_nc_sid=127cfc&_nc_ht=scontent-lax3-1.xx"
  curl.exe -sL -A $ua -o $path $hiRes
  $len = (Get-Item $path -ErrorAction SilentlyContinue).Length
  Write-Host "$name -> $len bytes"
  $i++
}
