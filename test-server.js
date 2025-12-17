import express from 'express';

const app = express();
app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ message: 'Server works!' });
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
});
