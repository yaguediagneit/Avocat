import { createWorker } from "tesseract.js";

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker("fra");
  try {
    const ret = await worker.recognize(buffer);
    return ret.data.text;
  } finally {
    await worker.terminate();
  }
}
