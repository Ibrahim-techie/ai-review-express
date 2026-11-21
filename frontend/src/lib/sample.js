// A small Express handler with real problems in it (injection, XSS, an
// off-by-one, unhandled errors), so a first review shows what the tool does.
export const SAMPLE = {
  language: "javascript",
  code: `const express = require("express");
const db = require("./db");

const app = express();

app.get("/user", async (req, res) => {
  const id = req.query.id;
  const rows = await db.query("SELECT * FROM users WHERE id = " + id);
  res.send("<h1>Hello " + rows[0].name + "</h1>");
});

function cartTotal(items) {
  let sum = 0;
  for (let i = 0; i <= items.length; i++) {
    sum += items[i].price * items[i].qty;
  }
  return sum;
}

app.post("/checkout", (req, res) => {
  const total = cartTotal(req.body.items);
  res.json({ total: total.toFixed(2) });
});

app.listen(3000);
`,
};
