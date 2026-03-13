import express from "express";
import path from "path";
import cors from "cors";
import routes from "./routes";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

const storageDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
app.use("/media", express.static(storageDir));
app.use("/api", routes);

export default app;
