const express = require("express");
const path = require("path");

const app = express();
const root = path.join(__dirname);

app.use(express.static(root));

app.get("/blog", (_req, res) => {
  res.sendFile(path.join(root, "blog", "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Supreme Advertising site running at http://localhost:${PORT}`);
});
