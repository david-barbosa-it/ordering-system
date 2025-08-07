// server.js

const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const { Storage } = require('@google-cloud/storage');
const app = express();
const PORT = process.env.PORT || 3000;

// Importa os dados do FAQ de um arquivo externo
const faqData = require('./faqData');

// Middleware para servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));

// --- Configuração do Google Cloud Storage ---
const gcs = new Storage();
const bucketName = 'ordering-system-container'; // SUBSTITUA PELO NOME DO SEU BUCKET
const bucket = gcs.bucket(bucketName);

// Configuração do Multer para a pasta temporária
const upload = multer({ dest: os.tmpdir() });

// --- ROTAS ESPECÍFICAS (sem parâmetros) VÊM PRIMEIRO ---

// Rota principal: Serve a página do FAQ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Endpoint da API para os dados do FAQ
app.get('/api/faq', (req, res) => {
    res.json(faqData);
});

// Endpoint da API para listar todos os pedidos
app.get('/api/pedidos', async (req, res) => {
    try {
        const [files] = await bucket.getFiles({ prefix: 'pedidos/' });
        const pedidos = [];
        
        for (const file of files) {
            if (file.name.endsWith('.json')) {
                const [content] = await file.download();
                pedidos.push(JSON.parse(content.toString('utf8')));
            }
        }
        res.json(pedidos);
    } catch (error) {
        console.error('Erro ao buscar pedidos do GCS:', error);
        res.status(500).send('Erro interno ao buscar pedidos.');
    }
});

// Rota para servir o dashboard administrativo
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Rota para download de arquivos da pasta 'assets'
app.get('/download/assets/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../assets', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            if (err) {
                res.status(500).send('Erro ao baixar o arquivo.');
            }
        });
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Rota para servir os arquivos da pasta 'uploads' de forma dinâmica
// AGORA LÊ O ARQUIVO DO GCS
app.get('/uploads/:grupo/:filename', (req, res) => {
    const { grupo, filename } = req.params;
    const gcsPath = `comprovantes/${grupo}/${filename}`;

    const file = bucket.file(gcsPath);

    file.exists().then(([exists]) => {
        if (exists) {
            res.redirect(`https://storage.googleapis.com/${bucketName}/${gcsPath}`);
        } else {
            res.status(404).send('Comprovante não encontrado.');
        }
    }).catch(err => {
        console.error('Erro ao verificar arquivo no GCS:', err);
        res.status(500).send('Erro interno do servidor.');
    });
});


// --- ROTAS DINÂMICAS VÊM POR ÚLTIMO ---

// Rota dinâmica para servir os formulários dos grupos
app.get('/:grupo', (req, res) => {
    const grupo = req.params.grupo;
    if (grupo === 'grupo-a' || grupo === 'grupo-b') {
        res.sendFile(path.join(__dirname, '../public/form-pedido.html'));
    } else {
        res.status(404).send('Página não encontrada.');
    }
});

// Rota POST dinâmica para processar pedidos e salvar comprovantes e dados em JSON no GCS
app.post('/pedido/:grupo', upload.single('comprovante'), async (req, res) => {
    const grupo = req.params.grupo;
    const { solicitante, produtos } = req.body;
    const comprovante = req.file;

    if (!comprovante) {
        return res.status(400).send('Nenhum comprovante de pagamento foi enviado.');
    }

    try {
        const comprovanteFileName = `comprovantes/${grupo}/${comprovante.filename}`;
        
// Use o streaming para enviar o arquivo
        const gcsFile = bucket.file(comprovanteFileName);
        const stream = gcsFile.createWriteStream({
            metadata: {
                contentType: comprovante.mimetype
            }
        });

        // Crie um stream de leitura do arquivo temporário
        const readStream = fs.createReadStream(comprovante.path);
        
        // Envie o arquivo para o GCS
        await new Promise((resolve, reject) => {
            readStream.pipe(stream)
                .on('finish', () => {
                    console.log('Upload do comprovante concluído.');
                    resolve();
                })
                .on('error', (error) => {
                    console.error('Erro no stream de upload:', error);
                    reject(error);
                });
        });
        
        const comprovanteUrl = `https://storage.googleapis.com/${bucketName}/${comprovanteFileName}`;

        const pedidoData = {
            solicitante: solicitante,
            produtos: produtos,
            grupo: grupo,
            comprovantePath: comprovanteUrl, // Salva a URL pública
            dataPedido: new Date().toISOString()
        };

        const jsonFileName = `pedidos/pedido-${Date.now()}.json`;

        // Upload do arquivo JSON para o GCS
        const file = bucket.file(jsonFileName);
        await file.save(JSON.stringify(pedidoData, null, 2), {
            contentType: 'application/json'
        });

        fs.unlinkSync(comprovante.path);

        console.log(`Novo pedido do Grupo: ${grupo}`);
        console.log(`Dados e comprovante salvos no GCS.`);

        res.redirect(`/${grupo}?sucesso=true`);

    } catch (error) {
        console.error('Erro no processamento do pedido:', error);
        if (comprovante && fs.existsSync(comprovante.path)) {
            fs.unlinkSync(comprovante.path);
        }
        res.status(500).send('Erro interno do servidor.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});