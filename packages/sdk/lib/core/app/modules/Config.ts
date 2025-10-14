/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/4/26 13:59
 * @description 应用的全局配置，会存储在本地缓存
 */
import { Storage } from "./Storage";
import { deepAssign, getNestedProperty } from "#/utils";
import { ROAMING_CHARACTERS } from "#/constant";

class Config {
    protected storage: Storage;
    public config: IAppConfig.Config;

    constructor(storage: Storage) {
        this.storage = storage;

        this.config = {
            // UI相关配置
            theme: 'os',
            mainColor: '#7FE7C4',
            // 历史记录功能是否启用
            history: false,
            // 快捷键相关配置
            shortcuts: {
                translate: 'w',
                rotate: 'e',
                scale: 'r',
                undo: 'z',
                focus: 'f',
            },
            //漫游角色
            roamingCharacter: ROAMING_CHARACTERS.JACKIE
        };

        this.syncStorage();
    }

    /**
     * 设置初始配置
     */
    setConfig(_config: Record<string, any>) {
        deepAssign(this.config, _config);

        this.syncStorage();
    }

    /**
     * 和本地存储中的配置同步
     */
    syncStorage() {
        for (let key of Object.keys(this.config)) {
            this.storage.getConfigItem(key).then(_value => {
                if (_value === null) {
                    this.storage.setConfigItem(key, this.config[key])
                } else {
                    let newVal = _value;
                    // 有可能会在代码开发过程中增加新的配置项
                    if (this.config[key] && typeof this.config[key] === "object") {
                        newVal = Object.assign({}, this.config[key], _value);
                    }
                    this.config[key] = newVal;

                    if (newVal !== _value) {
                        this.storage.setConfigItem(key, newVal)
                    }
                }
            }).catch(() => {
                this.storage.setConfigItem(key, this.config[key])
            })
        }
    }

    /**
     * 获取配置
     * @param {string} key 可以多层级，需用.分割，如a.b.c
     */
    getKey(key: string): any {
        return getNestedProperty(this.config, key);
    }

    /**
     * 设置配置项
     * @param {string} key 可以多层级，需用.分割，如a.b.c
     * @param {unknown} value 配置项的值
     */
    setKey(key: string, value: unknown) {
        const keys = key.split(".");

        if (keys.length === 1) {
            this.config[key] = value;
            this.storage.setConfigItem(key, value);

            return;
        }

        let obj = this.config;
        for (let i = 0; i < keys.length; i++) {
            if (keys.length - i === 1) {
                obj[keys[i]] = value;
                break;
            }

            obj = obj[keys[i]];
        }
        this.storage.setConfigItem(keys[0], this.config[keys[0]]);
    }

    /**
     * 获取快捷键配置
     * @param {string} key
     */
    getShortcutItem(key: string) {
        return this.config.shortcuts[key];
    }

    /**
     * 设置快捷键
     * @param {string} key
     * @param {any} value
     */
    setShortcutItem(key: string, value: any) {
        this.config.shortcuts[key] = value;
        return this.storage.setConfigItem("shortcuts", this.config.shortcuts)
    }

    clear() {
        for (let key of Object.keys(this.config)) {
            this.storage.removeConfigItem(key);
        }
    }
}

export { Config };
