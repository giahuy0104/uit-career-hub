param(
    [Parameter(Position = 0)]
    [ValidateSet("run", "build", "test", "compile", "db:migrate", "db:seed", "db:setup", "db:demo:reset", "db:e2e:reset")]
    [string]$Task = "run"
)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDirectory = Join-Path $projectRoot "backend"
$mavenWrapper = Join-Path $backendDirectory "mvnw.cmd"

# Terminal mo truoc luc cai JDK co the van giu PATH cu. Tu dong nap
# JAVA_HOME cua Windows de cac lenh pnpm chay ngay ma khong can restart app.
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    $configuredJavaHomes = @(
        [Environment]::GetEnvironmentVariable("JAVA_HOME", "User"),
        [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    foreach ($configuredJavaHome in $configuredJavaHomes) {
        $javaExecutable = Join-Path $configuredJavaHome "bin\java.exe"
        if (Test-Path -LiteralPath $javaExecutable) {
            $env:JAVA_HOME = $configuredJavaHome.TrimEnd("\")
            $env:Path = "$env:JAVA_HOME\bin;$env:Path"
            break
        }
    }
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "Khong tim thay Java. Hay cai JDK 21 va mo lai terminal."
}
if (-not (Test-Path -LiteralPath $mavenWrapper)) {
    throw "Khong tim thay Maven Wrapper tai $mavenWrapper"
}

Push-Location $backendDirectory
try {
    switch ($Task) {
        "build" { & $mavenWrapper -q -DskipTests package }
        "test" { & $mavenWrapper test }
        "compile" { & $mavenWrapper -q -DskipTests compile }
        default {
            & $mavenWrapper -q -DskipTests package
            if ($LASTEXITCODE -eq 0) {
                # Dùng đường dẫn tương đối để java.exe không làm hỏng ký tự Unicode
                # trong đường dẫn tuyệt đối trên Windows PowerShell 5.1.
                $jar = "target\career-hub-api-0.0.1-SNAPSHOT.jar"
                $javaEncodingArgs = @("-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8")
                if ($Task -eq "run") { & java @javaEncodingArgs -jar $jar }
                else { & java @javaEncodingArgs -jar $jar $Task }
            }
        }
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
