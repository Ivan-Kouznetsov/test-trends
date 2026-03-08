const dotenv = require("dotenv");
const { app } = require("./app");

dotenv.config();

const port = Number.parseInt(process.env.PORT, 10) || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Chaos server listening on port ${port}`);
});
