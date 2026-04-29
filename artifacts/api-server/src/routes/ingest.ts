import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { processFiles } from "../lib/processFiles";
import type { UploadedDocx } from "../lib/types";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router: IRouter = Router();

const getExtension = (filename: string): string => {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
};

router.post(
  "/ingest",
  upload.any(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];

      if (files.length === 0) {
        res.status(400).json({ error: "Please select at least one file" });
        return;
      }

      const xlsxFiles = files.filter(
        (f) => getExtension(f.originalname) === ".xlsx",
      );
      const docxFiles = files.filter(
        (f) => getExtension(f.originalname) === ".docx",
      );

      if (xlsxFiles.length > 1) {
        res
          .status(400)
          .json({ error: "Please upload only one Excel status file" });
        return;
      }

      if (xlsxFiles.length === 0 && docxFiles.length === 0) {
        res
          .status(400)
          .json({ error: "Only .xlsx and .docx files are supported" });
        return;
      }

      const excelFile = xlsxFiles[0]
        ? { buffer: xlsxFiles[0].buffer, filename: xlsxFiles[0].originalname }
        : null;

      const docxPayload: UploadedDocx[] = docxFiles.map((f) => ({
        buffer: f.buffer,
        filename: f.originalname,
      }));

      const bundle = await processFiles({
        excelFile,
        docxFiles: docxPayload,
      });

      res.json(bundle);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process files";
      res.status(400).json({ error: message });
    }
  },
);

export default router;
