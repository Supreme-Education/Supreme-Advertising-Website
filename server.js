const { createApp, getAdminPassword } = require("./lib/create-app");

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Supreme Advertising site running at http://localhost:${PORT}`);
  console.log(`Admin portal: http://localhost:${PORT}/admin`);
  if (getAdminPassword() === "supreme2026") {
    console.log("Warning: Using default admin password. Set ADMIN_PASSWORD in .env");
  }
});
