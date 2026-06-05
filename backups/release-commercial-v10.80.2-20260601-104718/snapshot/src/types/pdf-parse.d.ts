declare module 'pdf-parse' {
  type JsonMap = Record<string, unknown>;

  interface PDFData {
    numpages: number;
    numrender: number;
    info: JsonMap;
    metadata: JsonMap;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: JsonMap): Promise<PDFData>;
  export default pdfParse;
}
