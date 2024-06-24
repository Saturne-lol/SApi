const express = require('express');
const fs = require('fs');
const cuuid = require('cuuid');
const multer = require('multer');
const cors = require('cors');
const {loadImage, createCanvas} = require("canvas");

const app = express();

const cacheUpLink = []

const upload = multer({dest: 'uploads/'});


app.use(cors());
app.options('*', cors());

app.get('/upload', (req, res) => {
    if (!req.query.type || !req.query.fileName || !req.query.plan) return res.sendStatus(400);

    const type = req.query.type;
    const fileName = req.query.fileName;
    const plan = req.query.plan;
    const id = cuuid();

    cacheUpLink.push({id, type, fileName, plan});

    const shema = req.get('host').includes("localhost") ? "http" : "https";

    res.send({link: `${shema}://${req.get('host')}/upload/${id}`});
})

app.post('/upload/:id', upload.single('file'), async (req, res) => {
    const id = req.params.id;
    if (!cacheUpLink.find(e => e.id === id)) {
        return res.sendStatus(404);
    }

    const urlStorage = cacheUpLink.find(e => e.id === id)
    const type = urlStorage.type;
    const fileName = urlStorage.fileName;
    const plan = urlStorage.plan;
    const targetPath = `file/${type}/${fileName}`;

    if (!fs.existsSync(`file/${type}`)) fs.mkdirSync(`file/${type}`);

    const tempPath = req.file.path;

    await fs.renameSync(tempPath, targetPath)
    postTrait(targetPath, plan, type)
    return cacheUpLink.splice(cacheUpLink.findIndex(e => e.id === id), 1);
});

app.get('/file/:type/:fileName', (req, res) => {
    const type = req.params.type;
    const fileName = req.params.fileName;

    const targetPath = `file/${type}/${fileName}.png`;

    const isExist = fs.existsSync(targetPath);
    if (!isExist) {
        if (type === "profile") return res.sendFile("default.png", {root: __dirname});
        return res.sendFile("default.png", {root: __dirname});
    }

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

async function postTrait(imgPath, plan, type) {
    const image = await loadImage(imgPath)

    const ratioHMax = (type, plan) => {
        if (type === "profile") return 200
        if (type === "background") {
            if (plan === 0) return 720
            if (plan > 0) return 1080
        }
    }

    const newH = ratioHMax(type, plan)
    const ratio = image.width / image.height

    const newW = newH * ratio

    const canvas = createCanvas(newH, newW)
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, newW, newH);

    const buffer = canvas.toBuffer('image/png');
    return fs.writeFileSync(imgPath, buffer);
}