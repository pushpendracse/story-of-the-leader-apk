const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Placeholder for news storage
let currentNews = "Welcome to the News Room. Waiting for broadcast...";

// API Endpoints
app.get('/api/news', (req, res) => {
    res.json({ text: currentNews });
});

app.post('/api/news', (req, res) => {
    const { text, heading } = req.body;
    if (text) {
        currentNews = text;
        console.log(`Broadcasting: [${heading || 'No Heading'}] ${text}`);
        res.status(200).json({ message: "News updated" });
    } else {
        res.status(400).json({ message: "Text required" });
    }
});

// Serve client in production (optional, for single run)
// Assuming client build is in ../client/dist
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
        next();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
