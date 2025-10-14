import JSZip from "jszip";
import * as THREE from "three";
import Loader from "#/core/loader/Loader.ts";
import App from "#/core/app/App.ts";

/**
 * 解析材质zip包
 */
export function parseMaterialZip(zipFile: File): Promise<THREE.MeshStandardMaterial> {
    return new Promise(async (resolve, reject) => {
        const zip = new JSZip();

        const zipContent = await zip.loadAsync(zipFile);

        // 强制检查根目录下是否存在material.json
        let materialJson: any = zipContent.file('material.json');
        if (!materialJson) {
            materialJson = {
                textures: {},
                properties: {}
            }

            // 获取所有文件路径列表（JSZip存储结构为 {路径: 文件对象}）
            const filePaths = Object.keys(zipContent.files);
            for (let i = 0; i < filePaths.length; i++) {
                const relativePath: string = filePaths[i];
                const file = zipContent.file(relativePath);

                if (!file) continue;

                // 判断是否为文件（JSZip中目录路径以 '/' 结尾）
                if (file.dir || relativePath.endsWith('/')) continue;

                if (relativePath.includes("baseColor")) {
                    materialJson.textures.baseColor = relativePath;
                } else if (relativePath.includes("normal")) {
                    materialJson.textures.normal = relativePath;
                } else if (relativePath.includes("bump")) {
                    materialJson.textures.bump = relativePath;
                } else if (relativePath.includes("displacement")) {
                    materialJson.textures.displacement = relativePath;
                } else if (relativePath.includes("emissive")) {
                    materialJson.textures.emissive = relativePath;
                } else if (relativePath.includes("alpha")) {
                    materialJson.textures.alpha = relativePath;
                } else if (relativePath.includes("env")) {
                    materialJson.textures.env = relativePath;
                } else if (relativePath.includes("light")) {
                    materialJson.textures.light = relativePath;
                } else {
                    // arm可能在一张图上各占一个通道
                    if (relativePath.includes("roughness")) {
                        materialJson.textures.roughness = relativePath;
                    }
                    if (relativePath.includes("metalness")) {
                        materialJson.textures.metalness = relativePath;
                    }
                    if (relativePath.includes("ao")) {
                        materialJson.textures.ao = relativePath;
                    }
                }
            }
        } else {
            try {
                materialJson = JSON.parse(await materialJson.async('text'));
            } catch (error) {
                reject(error);
            }
        }

        // 并行加载所有纹理
        const texturePromises = Object.entries(materialJson.textures).map(
            async ([type, path]: any) => {
                const textureFile = zipContent.file(path);
                if (!textureFile) {
                    console.warn(`Texture file not found: ${path}`);
                    return { type, texture: null };
                }

                const extension = path.toString().split(".").pop()?.toLowerCase() || "jpg";
                let textureBlob: Blob;

                try {
                    // 特殊处理 EXR 格式
                    if (extension === "exr") {
                        const buffer = await textureFile.async("arraybuffer");
                        textureBlob = new Blob([buffer], { type: "image/x-exr" });
                    } else {
                        textureBlob = await textureFile.async("blob");
                    }
                } catch (err) {
                    console.error(`Failed to load texture (${type}):`, err);
                    return { type, texture: null };
                }

                const textureUrl = URL.createObjectURL(textureBlob);

                return new Promise<{ type: string; texture: THREE.Texture | null }>(
                    (resolve) => {
                        Loader.loadUrlTexture(
                            extension,
                            textureUrl,
                            (texture: THREE.Texture) => {
                                URL.revokeObjectURL(textureUrl); // 清理资源
                                resolve({ type, texture });
                            },
                            (error: Error) => {
                                URL.revokeObjectURL(textureUrl);
                                console.error(`Texture load error (${type}):`, error);
                                resolve({ type, texture: null });
                            }
                        );
                    }
                );
            }
        );

        // 等待所有纹理加载完成
        const textureResults = await Promise.all(texturePromises);
        const textures = textureResults.reduce((acc, { type, texture }) => {
            if (texture) acc[type] = texture;
            return acc;
        }, {} as Record<string, THREE.Texture>);

        // 处理无有效纹理的情况
        if (Object.keys(textures).length === 0) {
            throw new Error("No valid textures found in the zip file");
        }

        const material = await App.createPBRMaterial(textures, materialJson.properties || {});

        resolve(material);
    })
}