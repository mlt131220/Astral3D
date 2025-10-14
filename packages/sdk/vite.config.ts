import { defineConfig, loadEnv } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dts from 'vite-plugin-dts';
import { wrapperEnv, createPlugins } from "@astral3d/build-vite-plugins";

// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url))

// @ts-ignore
export default defineConfig(async ({ mode, command }) => {
    const root = process.cwd();
    const env = loadEnv(mode, root);
    //LoadEnv读取的布尔类型是一个字符串。此函数可以转换为布尔类型
    const viteEnv = wrapperEnv(env);
    const {
        VITE_PORT,
        VITE_PUBLIC_PATH,
        VITE_BUILD_COMPRESS,
        VITE_BUILD_COMPRESS_DELETE_ORIGIN_FILE,
        VITE_ENABLE_ANALYZE,
        VITE_ENABLE_CONFIG_GENERATE
    } = viteEnv;

    const isBuild = command === 'build';
    const plugins = await createPlugins({
        isBuild,
        root,
        compress: {
            compress: VITE_BUILD_COMPRESS,
            deleteOriginFile: VITE_BUILD_COMPRESS_DELETE_ORIGIN_FILE,
        },
        enableAnalyze: VITE_ENABLE_ANALYZE,
        enableConfig: VITE_ENABLE_CONFIG_GENERATE
    });

    return {
        base: VITE_PUBLIC_PATH,
        build: {
            lib: {
                entry: resolve(__dirname, 'lib/index.ts'),
                name: 'Astral3D', // 打包后全局变量的名称
                fileName: (format) => `astral3d.${format}.js`,
                formats: ['es', 'umd']
            },
            outDir: "dist",
            sourcemap: false,
            // 规定触发警告的 chunk 大小。（以 kbs 为单位）
            chunkSizeWarningLimit: 1024 * 6,
        },
        plugins: [
            dts({
                // 指定生成的类型文件存放的目录
                outDir: './dist/types',
                // 指定tsconfig.json位置
                tsconfigPath: './tsconfig.json',
                // 覆盖tsconfig.json对应配置
                include: ["lib", "types"],
                // 是否生成类型入口文件.会基于 package.json 的 `types` 字段生成
                insertTypesEntry: true,
                // 是否将所有的类型合并到一个文件中
                rollupTypes: false,
            }),
            ...plugins
        ],
        // 路径别名
        resolve: {
            alias: {
                '#': resolve(__dirname, './lib')
            },
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
        },
        server: {
            port: Number(VITE_PORT)
        }
    }
})
