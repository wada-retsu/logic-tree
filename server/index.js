import express from 'express';

const app = express();

// APIエンドポイント
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// サーバー起動
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
