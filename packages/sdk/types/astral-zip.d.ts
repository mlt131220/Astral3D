declare namespace IAstralZip {
	type Input = Uint8Array | ArrayBuffer | string;

	type OutputType = "uint8array" | "arraybuffer" | "blob" | "string";

	interface GenerateOptions {
		type?: IAstralZip.OutputType;
		compression?: "STORE" | "DEFLATE";
		compressionOptions?: {
			level?: number;
		};
		workers?: number;
		comment?: string;
	}

	interface FileOptions {
		compression?: "STORE" | "DEFLATE";
		compressionOptions?: {
			level?: number;
		};
	}

	interface FileMeta {
		name: string;
		dir: boolean;
		size?: number;
		compressedSize?: number;
	}

	interface File {
		name: string;
		dir: boolean;
		async(type: "uint8array"): Promise<Uint8Array>;
		async(type: "arraybuffer"): Promise<ArrayBuffer>;
		async(type: "blob"): Promise<Blob>;
		async(type: "string"): Promise<string>;
	}

	interface Constructor {
		new (): IAstralZip;
		create(): IAstralZip;
		loadAsync(data: Uint8Array | ArrayBuffer | Blob): Promise<IAstralZip>;
		generateAsync(
			files: Array<{ name: string; data?: IAstralZip.Input; dir?: boolean; options?: IAstralZip.FileOptions }>,
			options?: IAstralZip.GenerateOptions
		): Promise<Uint8Array | ArrayBuffer | Blob | string>;
	}

	interface Zip {
		file(name: string): IAstralZip.File | null;
		file(name: string, data: IAstralZip.Input, options?: IAstralZip.FileOptions): IAstralZip;
		folder(name: string): IAstralZip;
		files(): IAstralZip.FileMeta[];
		generateAsync(options?: IAstralZip.GenerateOptions): Promise<Uint8Array | ArrayBuffer | Blob | string>;
		dispose(): void;
	}
}
