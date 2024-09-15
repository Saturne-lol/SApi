const express = require('express');
const fs = require('node:fs');
const cupid = require('cuuid');
const multer = require('multer');
const cors = require('cors');
const {loadImage, createCanvas} = require('canvas');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const app = express();
const cacheUpLink = [];
const upload = multer({dest: 'uploads/'});
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const typDefinition = [
    {
        type: 'profile',
        content: ['image/png'],
    },
    {
        type: 'background',
        content: ['image/png', 'video/mp4'],
    },
    {
        type: 'cursor',
        content: ['image/png'],
    },
];

app.use(cors());
app.options('*', cors());

const token = 'i0yb@zge9$ZI9n';
app.use((req, res, next) => {
    if (req.path.startsWith('/file/') && req.method === 'GET') return next();
    if (req.headers.authorization !== token) return res.sendStatus(401);
    next();
});

app.get('/upload', async (req, res) => {
    const {type, fileName, plan} = req.query;
    if (!type || !fileName || !plan) return res.sendStatus(400);
    if (plan !== '0' && plan !== '1' && plan !== '2') return res.sendStatus(400);

    if (!/^[a-zA-Z0-9_-]+$/.test(type) || !/^[a-zA-Z0-9_-]+\.(mp4|png)$/.test(fileName) || !/^\d+$/.test(plan)) return res.sendStatus(400);


    if (!typDefinition.find(e => e.type === type)) return res.sendStatus(400);
    if (fileName.endsWith('.mp4') && plan === '0') return res.sendStatus(402);

    const id = cupid();
    const clipboardy = await import('clipboardy').then(e => e.default);
    clipboardy.writeSync(id);
    cacheUpLink.push({id, type, fileName, plan});
    const schema = req.get('host').includes('localhost') ? 'http' : 'https';
    res.send({link: `${schema}://${req.get('host')}/upload/${id}`});
});

/**
 * Route pour upload un fichier sur le serveur
 * Aucune failles (validé par copilot)
 */
app.post('/upload/:id', upload.single('file'), async (req, res) => {
    if (!req.file) return res.sendStatus(401);
    if (!req.params.id) return res.sendStatus(400);
    const id = req.params.id.toString().trim();
    const urlStorage = cacheUpLink.find(e => e.id === id);
    if (!urlStorage) return res.sendStatus(404);


    const {type, fileName, plan} = urlStorage;
    const targetPath = `file/${type}/${fileName}`;
    cacheUpLink.splice(cacheUpLink.findIndex(e => e.id === id), 1);

    const allowedTypes = typDefinition.find(e => e.type === type).content;
    if (!allowedTypes.includes(req.file.mimetype)) return res.sendStatus(400);

    try {
        if (!fs.existsSync(`file/${type}`)) fs.mkdirSync(`file/${type}`, {recursive: true});

        const tempPath = req.file.path;
        const baseName = fileName.split('.').slice(0, -1).join('.');
        const dirPath = `file/${type}`;
        const files = await fs.promises.readdir(dirPath);
        for (const file of files) {
            if (file.startsWith(baseName)) {
                await fs.promises.unlink(`${dirPath}/${file}`);
            }
        }

        await fs.promises.rename(tempPath, targetPath);
        switch (type) {
            case 'profile':
                await resizeImg(targetPath, 200, 200);
                break;
            case 'background':
                if (req.file.mimetype === 'video/mp4') await resizeVideo(targetPath, plan === 0 ? 720 : (plan === 1 ? 1080 : 2160), plan === 0 ? 1280 : (plan === 1 ? 1920 : 3840));
                if (req.file.mimetype === 'image/png') await resizeImg(targetPath, plan === 0 ? 720 : (plan === 1 ? 1080 : 2160), plan === 0 ? 1280 : (plan === 1 ? 1920 : 3840));
                break;
            case 'cursor':
                await resizeImg(targetPath, 32, 32);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

/**
 * Requete get pour récupérer un fichier par son nom et son type
 * Aucune failles (validé par copilot)
 */
app.get('/file/:type/:fileName', (req, res) => {
    const type = req.params.type;
    const fileName = req.params.fileName;

    if (!/^[a-zA-Z0-9_-]+$/.test(type) || !/^[a-zA-Z0-9_-]+$/.test(fileName)) {
        return res.sendStatus(400);
    }

    const dirPath = `file/${type}`;
    if (!fs.existsSync(dirPath)) {
        return res.sendStatus(404);
    }

    const files = fs.readdirSync(dirPath);
    const matchedFiles = files.filter(file => file.startsWith(fileName) && /\.(png|mp4)$/.test(file));
    if (matchedFiles.length !== 1) {
        return res.sendStatus(404);
    }

    const targetPath = `${dirPath}/${matchedFiles[0]}`;
    return res.sendFile(targetPath, {root: __dirname});
});

/**
 * Suppression d'un fichier par son nom et son type
 * Aucune failles (validé par copilot)
 */
app.get('/delete/:type/:fileName', (req, res) => {
    const {type, fileName} = req.params;

    // Validation des entrées
    if (!/^[a-zA-Z0-9_-]+$/.test(type) || !/^[a-zA-Z0-9_-]+$/.test(fileName)) {
        return res.sendStatus(400);
    }

    const targetPath = `file/${type}/${fileName}.png`;
    fs.promises.unlink(targetPath)
        .then(() => res.sendStatus(200))
        .catch(err => {
            if (err.code === 'ENOENT') {
                return res.sendStatus(404);
            }
            return res.sendStatus(500);
        });
});

/**
 * Route / qui renvoie un message troll
 */
app.get('/', (req, res) => {
    res.send('Bro what the fuck ??? Why are you look this ? ' +
        'Get out ! Cleboost :)');
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});


async function resizeImg(imgPath, h, w) {
    if (!imgPath.startsWith('file/')) throw new Error('Invalid file path');
    if (!fs.existsSync(imgPath)) throw new Error('File does not exist');
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(require('mime-types').lookup(imgPath))) throw new Error('File is not an image');

    const image = await loadImage(imgPath);
    if (image.width <= w && image.height <= h) return;

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, w, h);

    const buffer = canvas.toBuffer('image/png');
    return fs.writeFileSync(imgPath, buffer);
}

async function resizeVideo(vidPath, h, w) {
    if (!vidPath.startsWith('file/')) return console.log('Invalid file path');
    if (!fs.existsSync(vidPath)) return console.log('File do not exist');
    if (!['video/mp4'].includes(require('mime-types').lookup(vidPath))) return console.log('File is not a video');

    const videoSize = await getVideoSize(vidPath);
    if (videoSize.width <= w && videoSize.height <= h) return console.log('Video is already smaller');

    return new Promise((resolve, reject) => {
        const videoProcess = spawn(ffmpegPath, [
            '-i', vidPath,
            '-vf', `scale=${w}:${h}`,
            '-c:a', 'copy',
            'file/video.mp4'
        ], {stdio: 'inherit'});

        videoProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`ffmpeg process exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

async function getVideoSize(vidPath) {
    if (!vidPath.startsWith('file/')) return console.log('Invalid file path');
    if (!fs.existsSync(vidPath)) return console.log('File does not exist');
    if (!['video/mp4', 'video/avi', 'video/mov'].includes(require('mime-types').lookup(vidPath))) return console.log('File is not a video');

    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(vidPath, (err, metadata) => {
            if (err) {
                return reject(err);
            }
            const {width, height} = metadata.streams.find(stream => stream.width && stream.height);
            resolve({width, height});
        });
    });
}