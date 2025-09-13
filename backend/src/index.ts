import express, { Request, Response } from "express";
import cors from "cors";
import assetsRouter from "./routes/assets";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));
app.use("/api/assets", assetsRouter);

app.listen(port, () => {
  console.log(`GeoOps backend running on http://localhost:${port}`);
});
