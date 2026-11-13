import { createApp } from "./app.js";

/* Do not inherit ambient PORT from other apps — ARC defaults to 8787 */
const port = Number(process.env.ARC_PORT ?? 8787);
const app = createApp();

app.listen(port, "127.0.0.1", () => {
  console.log(
    JSON.stringify({
      msg: "arc-server listening",
      port,
      phase: 1,
      deploymentExecution: "disabled",
      bind: "127.0.0.1",
    }),
  );
});
