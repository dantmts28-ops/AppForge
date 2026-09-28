
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const app = express();
const upload = multer({ dest: os.tmpdir() });

app.use(express.json({ limit: "20mb" }));

app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "AppForge",
    message: "Servidor de construção de APK funcionando."
  });
});

app.post("/build", upload.single("html"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Nenhum arquivo HTML foi enviado."
    });
  }

  const nome = (req.body.nome || "AppForge")
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  const pasta = fs.mkdtempSync(
    path.join(os.tmpdir(), "appforge-")
  );

  const htmlDestino = path.join(pasta, "index.html");

  try {
    fs.copyFileSync(req.file.path, htmlDestino);

    execFile(
      "/app/build-apk.sh",
      [pasta, nome],
      { timeout: 10 * 60 * 1000 },
      (erro, stdout, stderr) => {

        try {
          fs.unlinkSync(req.file.path);
        } catch {}

        if (erro) {
          console.error(stderr || erro);

          return res.status(500).json({
            error: "Não foi possível construir o APK.",
            details: stderr || erro.message
          });
        }

        const apk = path.join(pasta, "app-release.apk");

        if (!fs.existsSync(apk)) {
          return res.status(500).json({
            error: "A construção terminou, mas o APK não foi encontrado."
          });
        }

        res.download(apk, `${nome}.apk`, () => {
          fs.rm(
            pasta,
            { recursive: true, force: true },
            () => {}
          );
        });
      }
    );

  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      error: "Erro ao preparar o aplicativo.",
      details: erro.message
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AppForge Server rodando na porta ${PORT}`);
});
