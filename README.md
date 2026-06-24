# BrainStore - Notas Interconectadas (PWA)

O **BrainStore** é um aplicativo de notas mentais interconectadas que ajuda a criar redes de conhecimento dinâmicas através de tags. O sistema possui uma visualização interativa em 2D/3D (utilizando D3.js) que conecta notas compartilhando a mesma tag, funcionando como um mapa cerebral.

Este projeto é uma Progressive Web App (PWA) com suporte offline completo (IndexedDB) e sincronização online integrada com o **Firebase (Firestore & Authentication)**.

---

## 🚀 Funcionalidades

- **Editor Interativo:** Criação, edição e remoção de notas com tags dinâmicas.
- **Mapa de Ideias:** Visualização em rede do seu cérebro de notas alimentado por simulação de física D3.js.
- **Suporte Offline (PWA):** As notas continuam funcionando normalmente mesmo sem internet via cache do Service Worker e IndexedDB local.
- **Sincronização Cloud:** Integração total com Firestore para persistência em nuvem e Firebase Authentication para login/cadastro de usuários.

---

## ⚙️ Configurações

O projeto já está integrado ao Firebase. O arquivo de configuração principal está localizado em `js/firebase-config.js`.

Se precisar alterar as chaves do Firebase futuramente, edite o objeto abaixo no arquivo:
```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET.firebasestorage.app",
  messagingSenderId: "MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

---

## 💻 Executando Localmente

Como o projeto usa **ES Modules** nativos no navegador (`import`/`export`), abrir o arquivo `index.html` diretamente (via duplo clique) causará erros de segurança de CORS. Você precisa de um servidor local.

### Usando o PowerShell (Nativo no Windows):
Abra o PowerShell no diretório do projeto e execute:
```powershell
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Output "Servidor rodando em http://localhost:$port/"
$rootPath = Resolve-Path "."
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    $urlPath = if ($req.Url.LocalPath -eq "/") { "/index.html" } else { $req.Url.LocalPath }
    $filePath = Join-Path $rootPath $urlPath.TrimStart('/')
    if (Test-Path $filePath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $res.ContentType = switch ($ext) {
            ".html" { "text/html; charset=utf-8" }
            ".css"  { "text/css; charset=utf-8" }
            ".js"   { "text/javascript; charset=utf-8" }
            ".json" { "application/json; charset=utf-8" }
            ".svg"  { "image/svg+xml" }
            default { "application/octet-stream" }
        }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.Close()
}
```

### Se possuir Node.js futuramente:
Basta executar:
```bash
npx http-server
```

---

## 🌐 Deploy na Vercel

O projeto está totalmente configurado para deploy na Vercel com cabeçalhos otimizados para o Service Worker:

1. Suba esta pasta para um repositório no seu **GitHub**.
2. Acesse a [Vercel](https://vercel.com/) e crie uma conta.
3. Clique em **"Add New"** -> **"Project"** e selecione o repositório do GitHub.
4. Mantenha as configurações padrão (a Vercel detectará automaticamente como um projeto estático).
5. Clique em **"Deploy"**!
