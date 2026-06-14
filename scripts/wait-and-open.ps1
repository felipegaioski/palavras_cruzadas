$healthUrl = "http://127.0.0.1:3001/api/health"
$appUrl = "http://127.0.0.1:3001"

for ($attempt = 1; $attempt -le 60; $attempt++) {
    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri $healthUrl `
            -TimeoutSec 1

        if ($response.StatusCode -eq 200) {
            Start-Process $appUrl
            exit 0
        }
    }
    catch {
        Start-Sleep -Seconds 1
    }
}

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show(
    "O servidor não iniciou em até um minuto. Verifique a janela do Ateliê de Cruzadas para consultar o erro.",
    "Ateliê de Cruzadas",
    "OK",
    "Error"
) | Out-Null
