// server.js

const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Importa os dados do FAQ de um arquivo externo
const faqData = require('./faqData');

// Middleware para servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));

// Configuração do Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const grupo = req.params.grupo;
        const uploadDir = path.join(__dirname, `../uploads/${grupo}`);
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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
app.get('/api/pedidos', (req, res) => {
    const pedidos = [];
    const lerPedidosDoGrupo = (grupo) => {
        const dirPath = path.join(__dirname, `../uploads/${grupo}`);
        if (!fs.existsSync(dirPath)) return;
        const files = fs.readdirSync(dirPath);

        files.forEach(file => {
            if (file.endsWith('.json')) {
                const filePath = path.join(dirPath, file);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                try {
                    const pedido = JSON.parse(fileContent);
                    pedido.grupo = grupo;
                    pedidos.push(pedido);
                } catch (error) {
                    console.error(`Erro ao analisar JSON do arquivo ${file}:`, error);
                }
            }
        });
    };

    try {
        lerPedidosDoGrupo('grupo-a');
        lerPedidosDoGrupo('grupo-b');
        res.json(pedidos);
    } catch (error) {
        console.error('Erro ao ler os pedidos:', error);
        res.status(500).send('Erro interno do servidor ao carregar os pedidos.');
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
app.get('/uploads/:grupo/:filename', (req, res) => {
    const { grupo, filename } = req.params;
    const filePath = path.join(__dirname, `../uploads/${grupo}`, filename);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Comprovante não encontrado.');
    }
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

// Rota POST dinâmica para processar pedidos e salvar comprovantes e dados em JSON
app.post('/pedido/:grupo', upload.single('comprovante'), (req, res) => {
    const grupo = req.params.grupo;
    const { solicitante, produtos } = req.body;
    const comprovante = req.file;

    if (!comprovante) {
        return res.status(400).send('Nenhum comprovante de pagamento foi enviado.');
    }

    const pedidoData = {
        solicitante: solicitante,
        produtos: produtos,
        comprovantePath: path.basename(comprovante.path),
        dataPedido: new Date().toISOString()
    };

    const jsonFilePath = path.join(comprovante.destination, `pedido-${Date.now()}.json`);

    fs.writeFile(jsonFilePath, JSON.stringify(pedidoData, null, 2), (err) => {
        if (err) {
            console.error('Erro ao salvar o arquivo JSON:', err);
            return res.status(500).send('Erro interno do servidor.');
        }

        console.log(`Novo pedido do Grupo: ${grupo}`);
        console.log(`Dados do pedido salvos em: ${jsonFilePath}`);
        console.log(`Comprovante salvo em: ${comprovante.path}`);

        // --- AQUI ESTÁ A MUDANÇA: APENAS O REDIRECIONAMENTO ---
        res.redirect(`/${grupo}`);
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});