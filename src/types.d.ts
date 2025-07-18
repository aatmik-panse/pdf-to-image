declare module "pdf2pic" {
  interface ConvertOptions {
    density?: number;
    saveFilename?: string;
    savePath?: string;
    format?: "png" | "jpg" | "jpeg";
    width?: number;
    height?: number;
  }

  interface ConvertResult {
    name: string;
    path: string;
    page: number;
  }

  interface Converter {
    (
      page: number,
      options?: { responseType: "image" | "base64" }
    ): Promise<ConvertResult>;
    bulk(
      pages: number,
      options?: { responseType: "image" | "base64" }
    ): Promise<ConvertResult[]>;
  }

  interface PDF2PIC {
    fromPath(pdfPath: string, options: ConvertOptions): Converter;
    fromBuffer(pdfBuffer: Buffer, options: ConvertOptions): Converter;
  }

  const pdf2pic: PDF2PIC;
  export = pdf2pic;
}
