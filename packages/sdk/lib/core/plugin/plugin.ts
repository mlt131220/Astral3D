import { loadPluginAsync } from "./pluginLoader";
import Builtin from "./builtin/builtin";
import { useDispatchSignal } from "#/hooks";

// 所有插件都必须实现此接口
export interface Plugin {
    name: string; // 插件名称，插件的唯一标识
    version: number; // 插件版本号
    icon: string; // 插件图标
    install(config?: any): void; // 插件安装
    uninstall(): void; // 卸载插件
    run(): void; // 从插件盒子面板点击插件时的运行方法
}

export class PluginManager {
    public plugins: Map<string, Plugin> = new Map(); // 已加载插件

    constructor() {
        // 载入内置插件
        new Builtin(this);
    }

    get list() {
        const list: IPlugin.Item[] = [];
        for (const plugin of this.plugins.values()) {
            list.push({
                name: plugin.name,
                icon: plugin.icon
            })
        }
        return list;
    }

    /**
     * 加载插件
     * @param pluginPaths 插件地址
     * @param autoUse 插件是否自动注册
     */
    async loadAsync(pluginPaths: string | string[], autoUse = false) {
        let plugins: Plugin[] = [];

        for (const src of pluginPaths) {
            const plugin = await loadPluginAsync(src);

            if (!plugin) {
                console.error(`插件加载失败: ${src},该插件不存在！`);
                return;
            }

            if (autoUse) {
                this.use(plugin);
            }

            plugins.push(plugin);
        }

        return plugins;
    }

    /**
     * 注册、配置并安装插件的方法
     * @param plugin 新注册插件
     * @param config 插件配置
     * @return PluginManager
     */
    use(plugin: Plugin, config?: any): this {
        // 防止重复注册
        if (this.plugins.has(plugin.name)) return this;

        // 注册插件
        plugin.install(config);
        this.plugins.set(plugin.name, plugin);
        useDispatchSignal("pluginInstall", plugin);

        return this;
    }

    /**
     * 获取插件实例
     * @param pluginName 插件名称
     */
    getPlugin<T extends Plugin>(pluginName: string): T | undefined {
        return this.plugins.get(pluginName) as T;
    }

    /**
     * 获取多个插件实例
     * @param pluginNames 插件名称数组
     */
    getPlugins<T extends Plugin[]>(pluginNames: string[]): T | undefined {
        return pluginNames.map((pluginName) => this.getPlugin(pluginName)) as T;
    }

    /**
     * 转为数组对象
     * @param names 插件名称/插件名称数组
     */
    getStrings(names: string | string[]): string[] {
        if (!Array.isArray(names)) {
            names = [names];
        }

        return names;
    }

    /**
     * 遍历插件执行callback
     * @param pluginNames 插件名称/插件名称数组
     * @param callback 遍历执行的方法
     */
    traverse(pluginNames: string | string[], callback: (data: { name: string, plugin: Plugin }) => void) {
        this.getStrings(pluginNames).forEach(name => {
            if (!this.plugins.has(name)) return;

            callback({
                name,
                plugin: <Plugin>this.getPlugin(name)
            })
        })
    }

    /**
     * 运行插件
     * @param pluginNames 插件名称/插件名称数组
     */
    run(pluginNames: string | string[]) {
        this.traverse(pluginNames, ({ plugin }) => {
            if (typeof plugin.run === 'function') {
                plugin.run();
            }
        })

        return this;
    }

    /**
     * 卸载插件
     * @param pluginNames 插件名称/插件名称数组
     */
    uninstall(pluginNames: string | string[]): this {
        this.traverse(pluginNames, ({ name, plugin }) => {
            // 获取插件的卸载函数并执行
            if (typeof plugin.uninstall === 'function') {
                plugin.uninstall();
            }

            this.plugins.delete(name);
            useDispatchSignal("pluginUninstall", name);

        })

        return this;
    }
}