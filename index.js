const express = require('express');
const fs = require('fs');
const cuuid = require('cuuid');
const multer = require('multer');
const cors = require('cors');
const canvas = require('canvas');
const {loadImage} = require("canvas");

const app = express();

const cacheUpLink = []

const upload = multer({dest: 'uploads/'});


app.use(cors());
app.get('/upload', (req, res) => {
    const type = req.query.type;
    const fileName = req.query.fileName;
    const id = cuuid();

    cacheUpLink.push({id, type, fileName});

    res.send({link: `https://${req.get('host')}/upload/${id}`});
})

app.post('/upload/:id', upload.single('file'), async (req, res) => {
    const id = req.params.id;
    if (!cacheUpLink.find(e => e.id === id)) {
        return res.sendStatus(404);
    }

    const type = cacheUpLink.find(e => e.id === id).type;
    const fileName = cacheUpLink.find(e => e.id === id).fileName;
    const targetPath = `file/${type}/${fileName}`;

    if (!fs.existsSync(`file/${type}`)) fs.mkdirSync(`file/${type}`);

    const tempPath = req.file.path;

    await fs.renameSync(tempPath, targetPath)
    postTrait(targetPath);
    return cacheUpLink.splice(cacheUpLink.findIndex(e => e.id === id), 1);
});

app.get('/file/:type/:fileName', (req, res) => {
    const type = req.params.type;
    const fileName = req.params.fileName;

    const targetPath = `file/${type}/${fileName}.png`;

    const isExist = fs.existsSync(targetPath);
    if (!isExist) return res.sendFile("default.png", {root: __dirname});

    return res.sendFile(targetPath, {root: __dirname})
})

app.get('/delete/:type/:fileName', (req, res) => {
    const type = req.params.type;
    const fileName = req.params.fileName;

    const targetPath = `file/${type}/${fileName}.png`;

    const isExist = fs.existsSync(targetPath);
    if (!isExist) return res.sendStatus(404);

    fs.unlinkSync(targetPath);
    return res.sendStatus(200);
})

app.get('/', (req, res) => {
    res.send('Bro what the fuck ??? Why are you look this ? ' +
        'Get out ! Cleboost :)');
})

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

async function postTrait(imgPath) {
    const canva = canvas.createCanvas(200, 200);
    const ctx = canva.getContext('2d');
    ctx.drawImage(await loadImage(imgPath), 0, 0, 200, 200);

    const buffer = canva.toBuffer('image/png');
    return fs.writeFileSync(imgPath, buffer);
}