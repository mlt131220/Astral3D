/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/9/16 2:57
 * @description 插件加载
 */
import App from "#/core/app/App";

export async function loadPluginAsync(src: string): Promise<any> {
    try {
        // 动态导入插件模块
        const pluginModule = await import(/* @vite-ignore */src);

        // 返回模块的默认导出
        return pluginModule.default;
    } catch (error: any) {
        App.log.error(`插件加载失败: ${error?.message}`);
        return null;
    }
}