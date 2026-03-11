import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello from Striyo Server!');
});

app.listen(PORT, () => {
    console.log(`Server is running in production mode on port ${PORT}`);
});