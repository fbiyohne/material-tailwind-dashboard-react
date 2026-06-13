import { creerApp } from "./app.js";
import { env } from "./env.js";

creerApp().listen(env.port, () => {
  console.log(`API Barreau de Pointe-Noire — http://localhost:${env.port}/api`);
});
